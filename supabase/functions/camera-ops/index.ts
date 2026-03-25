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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, session_token, match_id, ...payload } = await req.json();

    if (!session_token || !match_id) {
      return new Response(JSON.stringify({ error: "session_token and match_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validate session token
    const tokenHash = await hashToken(session_token);
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("camera_access_sessions")
      .select("id, match_id, club_id, expires_at")
      .eq("session_token_hash", tokenHash)
      .eq("match_id", match_id)
      .maybeSingle();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "Invalid session token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(session.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update last_used_at
    await supabaseAdmin
      .from("camera_access_sessions")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", session.id);

    // ── ACTION: upload-frames ──
    if (action === "upload-frames") {
      const { frames, duration_sec, phase } = payload;

      if (!frames || !Array.isArray(frames) || frames.length === 0) {
        return new Response(JSON.stringify({ error: "No frames provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 1. Upload frames JSON to storage
      const framesJson = JSON.stringify({
        frames,
        duration_sec: duration_sec ?? 0,
        phase: phase ?? "full",
        captured_at: new Date().toISOString(),
      });

      const { error: uploadError } = await supabaseAdmin.storage
        .from("match-frames")
        .upload(`${match_id}.json`, new Blob([framesJson], { type: "application/json" }), {
          upsert: true,
        });

      if (uploadError) {
        console.error("Frame upload error:", uploadError);
        return new Response(JSON.stringify({ error: "Frame upload failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 2. Create analysis job
      const { data: job, error: jobError } = await supabaseAdmin
        .from("analysis_jobs")
        .insert({ match_id, status: "queued", progress: 0 })
        .select()
        .single();

      if (jobError) {
        console.error("Job creation error:", jobError);
        return new Response(JSON.stringify({ error: "Job creation failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 3. Update match status
      await supabaseAdmin.from("matches").update({ status: "processing" }).eq("id", match_id);

      // 4. Trigger analysis (fire-and-forget)
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      fetch(`${supabaseUrl}/functions/v1/analyze-match`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          match_id,
          job_id: job.id,
          frames,
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

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("camera-ops error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
