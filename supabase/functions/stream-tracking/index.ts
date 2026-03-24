import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-camera-session-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { matchId, cameraIndex, sequence, frames, sessionToken } = await req.json();

    if (!matchId || cameraIndex === undefined || sequence === undefined || !frames?.length) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate session token
    if (sessionToken) {
      const encoder = new TextEncoder();
      const data = encoder.encode(sessionToken);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const tokenHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

      const { data: session } = await supabase
        .from("camera_access_sessions")
        .select("id")
        .eq("session_token_hash", tokenHash)
        .eq("match_id", matchId)
        .gt("expires_at", new Date().toISOString())
        .limit(1);

      if (!session?.length) {
        return new Response(JSON.stringify({ error: "Invalid session" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Store chunk in storage
    const chunkData = JSON.stringify({ matchId, cameraIndex, sequence, frames, timestamp: new Date().toISOString() });
    const objectPath = `${matchId}/cam_${cameraIndex}/chunk_${String(sequence).padStart(5, "0")}.json`;

    const { error: uploadError } = await supabase.storage
      .from("tracking")
      .upload(objectPath, chunkData, {
        contentType: "application/json",
        upsert: true,
      });

    if (uploadError) {
      console.error("Chunk upload error:", uploadError);
      return new Response(JSON.stringify({ error: "Upload failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update tracking_uploads counter
    const { data: existing } = await supabase
      .from("tracking_uploads")
      .select("id, chunks_received")
      .eq("match_id", matchId)
      .eq("camera_index", cameraIndex)
      .eq("upload_mode", "live")
      .limit(1);

    if (existing?.length) {
      await supabase
        .from("tracking_uploads")
        .update({
          chunks_received: (existing[0].chunks_received ?? 0) + 1,
          last_chunk_at: new Date().toISOString(),
          frames_count: sequence * frames.length, // approximate
        })
        .eq("id", existing[0].id);
    } else {
      await supabase.from("tracking_uploads").insert({
        match_id: matchId,
        camera_index: cameraIndex,
        upload_mode: "live",
        chunks_received: 1,
        last_chunk_at: new Date().toISOString(),
        frames_count: frames.length,
        status: "streaming",
      });
    }

    return new Response(JSON.stringify({ ok: true, sequence, stored: objectPath }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("stream-tracking error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Fehler" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
