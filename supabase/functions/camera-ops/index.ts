import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function hashToken(token: string): Promise<string> {
  const enc = new TextEncoder().encode(token);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function validateSession(supabaseAdmin: any, sessionToken: string, matchId: string) {
  const tokenHash = await hashToken(sessionToken);
  const { data: session, error } = await supabaseAdmin
    .from("camera_access_sessions")
    .select("id, match_id, club_id, expires_at, transfer_authorized, camera_index")
    .eq("session_token_hash", tokenHash)
    .eq("match_id", matchId)
    .maybeSingle();

  if (error || !session) return null;
  if (new Date(session.expires_at) < new Date()) return null;

  await supabaseAdmin
    .from("camera_access_sessions")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", session.id);

  return session;
}

async function updateCanonicalFrameFile(supabaseAdmin: any, matchId: string, newFrames: string[], cameraIndex: number | null) {
  try {
    // Write camera-specific canonical file
    const camSuffix = cameraIndex != null ? `_cam${cameraIndex}` : "";
    const camPath = `${matchId}${camSuffix}.json`;

    const { data: existing } = await supabaseAdmin.storage
      .from("match-frames")
      .download(camPath);

    let camFrames: string[] = [];
    let camDuration = 0;

    if (existing) {
      try {
        const parsed = JSON.parse(await existing.text());
        camFrames = parsed.frames ?? [];
        camDuration = parsed.duration_sec ?? 0;
      } catch { /* start fresh */ }
    }

    camFrames.push(...newFrames);
    camDuration += newFrames.length * 30;

    const camJson = JSON.stringify({
      frames: camFrames,
      duration_sec: camDuration,
      phase: "full",
      camera_index: cameraIndex ?? 0,
      captured_at: new Date().toISOString(),
    });

    await supabaseAdmin.storage
      .from("match-frames")
      .upload(camPath, new Blob([camJson], { type: "application/json" }), { upsert: true });

    // Now merge all camera canonicals into global {matchId}.json
    await mergeAllCameraCanonicals(supabaseAdmin, matchId);
  } catch (err) {
    console.error("canonical frame file update error:", err);
  }
}

async function mergeAllCameraCanonicals(supabaseAdmin: any, matchId: string) {
  try {
    const allFrames: string[] = [];
    let totalDuration = 0;

    // Try camera-specific files (cam0-3)
    let foundAnyCam = false;
    for (let cam = 0; cam < 4; cam++) {
      const { data: camFile } = await supabaseAdmin.storage
        .from("match-frames")
        .download(`${matchId}_cam${cam}.json`);
      if (camFile) {
        foundAnyCam = true;
        try {
          const parsed = JSON.parse(await camFile.text());
          if (parsed.frames?.length) {
            allFrames.push(...parsed.frames);
            totalDuration += parsed.duration_sec ?? 0;
          }
        } catch { /* skip corrupt */ }
      }
    }

    // If no camera-specific files found, the global file is already the source of truth
    if (!foundAnyCam) return;

    const globalJson = JSON.stringify({
      frames: allFrames,
      duration_sec: totalDuration,
      phase: "full",
      captured_at: new Date().toISOString(),
    });

    await supabaseAdmin.storage
      .from("match-frames")
      .upload(`${matchId}.json`, new Blob([globalJson], { type: "application/json" }), { upsert: true });
  } catch (err) {
    console.error("merge camera canonicals error:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, session_token, match_id, ...payload } = body;

    const supabaseAdmin = getAdminClient();

    // ── ACTION: send-command (trainer → helper, requires auth) ──
    if (action === "send-command") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Authorization required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { session_id, command } = payload;
      if (!session_id || !command) {
        return new Response(JSON.stringify({ error: "session_id and command required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("club_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: session } = await supabaseAdmin
        .from("camera_access_sessions")
        .select("id, club_id")
        .eq("id", session_id)
        .maybeSingle();

      if (!session || !profile || session.club_id !== profile.club_id) {
        return new Response(JSON.stringify({ error: "Access denied" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin
        .from("camera_access_sessions")
        .update({ command })
        .eq("id", session_id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── ACTION: authorize-transfer ──
    if (action === "authorize-transfer") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Authorization required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { session_id, authorized } = payload;
      if (!session_id) {
        return new Response(JSON.stringify({ error: "session_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("club_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: session } = await supabaseAdmin
        .from("camera_access_sessions")
        .select("id, club_id")
        .eq("id", session_id)
        .maybeSingle();

      if (!session || !profile || session.club_id !== profile.club_id) {
        return new Response(JSON.stringify({ error: "Access denied" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin
        .from("camera_access_sessions")
        .update({
          transfer_authorized: authorized !== false,
          transfer_authorized_at: authorized !== false ? new Date().toISOString() : null,
        })
        .eq("id", session_id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // All other actions require session_token + match_id
    if (!session_token || !match_id) {
      return new Response(JSON.stringify({ error: "session_token and match_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const session = await validateSession(supabaseAdmin, session_token, match_id);
    if (!session) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: update-timing ──
    if (action === "update-timing") {
      const { timing } = payload;
      if (!timing || typeof timing !== "object") {
        return new Response(JSON.stringify({ error: "timing object required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Only allow known timing fields
      const allowed = ["h1_started_at", "h1_ended_at", "h2_started_at", "h2_ended_at", "recording_started_at", "recording_ended_at"];
      const safe: Record<string, string> = {};
      for (const key of allowed) {
        if (timing[key]) safe[key] = timing[key];
      }

      if (Object.keys(safe).length > 0) {
        await supabaseAdmin.from("matches").update(safe).eq("id", match_id);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── ACTION: heartbeat ──
    if (action === "heartbeat") {
      const { phase, frame_count, thumbnail } = payload;
      const statusUpdate: any = {
        phase: phase ?? "unknown",
        frame_count: frame_count ?? 0,
        updated_at: new Date().toISOString(),
      };
      if (thumbnail) statusUpdate.thumbnail = thumbnail;

      const { data: currentSession } = await supabaseAdmin
        .from("camera_access_sessions")
        .select("status_data")
        .eq("id", session.id)
        .maybeSingle();
      
      const existingSyncedFrames = (currentSession?.status_data as any)?.synced_frames ?? 0;
      statusUpdate.synced_frames = existingSyncedFrames;

      await supabaseAdmin
        .from("camera_access_sessions")
        .update({
          last_used_at: new Date().toISOString(),
          status_data: statusUpdate,
        })
        .eq("id", session.id);

      const { data: current } = await supabaseAdmin
        .from("camera_access_sessions")
        .select("command, transfer_authorized")
        .eq("id", session.id)
        .maybeSingle();

      const pendingCommand = current?.command ?? null;
      const transferAuthorized = current?.transfer_authorized ?? false;

      if (pendingCommand) {
        await supabaseAdmin
          .from("camera_access_sessions")
          .update({ command: null })
          .eq("id", session.id);
      }

      return new Response(
        JSON.stringify({ success: true, command: pendingCommand, transfer_authorized: transferAuthorized }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── ACTION: upload-frames ──
    if (action === "upload-frames") {
      const { frames, duration_sec, phase } = payload;

      if (!frames || !Array.isArray(frames) || frames.length === 0) {
        return new Response(JSON.stringify({ error: "No frames provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const suffix = phase && phase !== "full" ? `_${phase}` : "";
      const filePath = `${match_id}${suffix}.json`;

      const framesJson = JSON.stringify({
        frames,
        duration_sec: duration_sec ?? 0,
        phase: phase ?? "full",
        captured_at: new Date().toISOString(),
      });

      console.log(`Uploading ${frames.length} frames (${(framesJson.length / 1024 / 1024).toFixed(2)} MB) to ${filePath}`);

      const { error: uploadError } = await supabaseAdmin.storage
        .from("match-frames")
        .upload(filePath, new Blob([framesJson], { type: "application/json" }), {
          upsert: true,
        });

      if (uploadError) {
        console.error("Frame upload error:", uploadError);
        return new Response(JSON.stringify({ error: "Frame upload failed", detail: uploadError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await updateCanonicalFrameFile(supabaseAdmin, match_id, frames);

      const { data: job, error: jobError } = await supabaseAdmin
        .from("analysis_jobs")
        .insert({ match_id, status: "queued", progress: 0, job_kind: "final" })
        .select()
        .single();

      if (jobError) {
        console.error("Job creation error:", jobError);
        return new Response(JSON.stringify({ error: "Job creation failed", detail: jobError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin.from("matches").update({ status: "processing" }).eq("id", match_id);

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      // DON'T send inline frames — let analyze-match load from canonical file
      // which contains ALL accumulated frames (H1 + H2 + chunks merged).
      // This prevents the bug where only the latest upload's frames are analyzed.
      fetch(`${supabaseUrl}/functions/v1/analyze-match`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          match_id,
          job_id: job.id,
          duration_sec: duration_sec ?? 0,
          phase: phase ?? "full",
        }),
      }).catch((err) => console.error("analyze-match invoke error:", err));

      return new Response(
        JSON.stringify({ success: true, job_id: job.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── ACTION: log-event ──
    if (action === "log-event") {
      const { event_type, minute, team } = payload;

      if (!event_type || minute == null) {
        return new Response(JSON.stringify({ error: "event_type and minute required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: eventError } = await supabaseAdmin.from("match_events").insert({
        match_id,
        event_type,
        minute,
        team: team ?? "home",
      });

      if (eventError) {
        console.error("Event insert error:", eventError);
        return new Response(JSON.stringify({ error: "Event logging failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── ACTION: append-frames ──
    if (action === "append-frames") {
      const { frames, chunk_index } = payload;

      if (!frames || !Array.isArray(frames) || frames.length === 0) {
        return new Response(JSON.stringify({ error: "No frames provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const filePath = `${match_id}_chunk_${chunk_index ?? 0}.json`;
      const framesJson = JSON.stringify({
        frames,
        chunk_index: chunk_index ?? 0,
        captured_at: new Date().toISOString(),
      });

      console.log(`Appending ${frames.length} frames (${(framesJson.length / 1024 / 1024).toFixed(2)} MB) as chunk ${chunk_index ?? 0}`);

      const { error: uploadError } = await supabaseAdmin.storage
        .from("match-frames")
        .upload(filePath, new Blob([framesJson], { type: "application/json" }), {
          upsert: true,
        });

      if (uploadError) {
        console.error("Chunk upload error:", uploadError);
        return new Response(JSON.stringify({ error: "Chunk upload failed", detail: uploadError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await updateCanonicalFrameFile(supabaseAdmin, match_id, frames);

      const { data: currentSession } = await supabaseAdmin
        .from("camera_access_sessions")
        .select("status_data")
        .eq("id", session.id)
        .maybeSingle();
      
      const currentStatusData = (currentSession?.status_data as any) ?? {};
      const previousSynced = currentStatusData.synced_frames ?? 0;
      const newSyncedTotal = previousSynced + frames.length;

      await supabaseAdmin
        .from("camera_access_sessions")
        .update({
          status_data: { ...currentStatusData, synced_frames: newSyncedTotal },
        })
        .eq("id", session.id);

      if (newSyncedTotal >= 5 && (chunk_index ?? 0) % 3 === 2) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        const allFrames: string[] = [];
        for (let i = 0; i <= (chunk_index ?? 0); i++) {
          const chunkPath = `${match_id}_chunk_${i}.json`;
          const { data: chunkData } = await supabaseAdmin.storage
            .from("match-frames")
            .download(chunkPath);
          if (chunkData) {
            try {
              const parsed = JSON.parse(await chunkData.text());
              if (parsed.frames) allFrames.push(...parsed.frames);
            } catch { /* skip corrupt chunks */ }
          }
        }

        if (allFrames.length >= 5) {
          console.log(`Triggering live partial analysis with ${allFrames.length} frames`);
          
          const { data: job } = await supabaseAdmin
            .from("analysis_jobs")
            .insert({ match_id, status: "queued", progress: 0, job_kind: "live_partial" })
            .select()
            .single();

          if (job) {
            fetch(`${supabaseUrl}/functions/v1/analyze-match`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                match_id,
                job_id: job.id,
                frames: allFrames,
                duration_sec: allFrames.length * 30,
                phase: "live_partial",
              }),
            }).catch((err) => console.error("live partial analyze error:", err));
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, chunk_index: chunk_index ?? 0, frames_in_chunk: frames.length, synced_total: newSyncedTotal }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("camera-ops error:", err);
    return new Response(JSON.stringify({ error: "Internal server error", detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
