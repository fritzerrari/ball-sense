import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-camera-session-token",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function sha256(value: string) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function validateSession(supabase: ReturnType<typeof createClient>, sessionToken: string, matchId: string, cameraIndex: number) {
  const sessionHash = await sha256(sessionToken);
  return supabase
    .from("camera_access_sessions")
    .select("id")
    .eq("match_id", matchId)
    .eq("camera_index", cameraIndex)
    .eq("session_token_hash", sessionHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, matchId, cameraIndex, sessionToken } = body ?? {};

    if (!UUID_REGEX.test(matchId ?? "")) {
      return new Response(JSON.stringify({ error: "Ungültige Match-ID" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (typeof cameraIndex !== "number" || cameraIndex < 0 || cameraIndex > 4) {
      return new Response(JSON.stringify({ error: "Ungültige Kamera" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (typeof sessionToken !== "string" || sessionToken.length < 20) {
      return new Response(JSON.stringify({ error: "Ungültige Session" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: session } = await validateSession(supabase, sessionToken, matchId, cameraIndex);
    if (!session) {
      return new Response(JSON.stringify({ error: "Session abgelaufen oder ungültig" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update_status") {
      const status = body.status;
      if (!["live", "processing"].includes(status)) {
        return new Response(JSON.stringify({ error: "Ungültiger Status" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await supabase.from("matches").update({ status }).eq("id", matchId);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "register_upload") {
      const filePath = String(body.filePath ?? "").trim();
      const framesCount = Number(body.framesCount ?? 0);
      const durationSec = Number(body.durationSec ?? 0);
      if (!filePath || filePath.length > 255) {
        return new Response(JSON.stringify({ error: "Ungültiger Dateipfad" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await supabase.from("tracking_uploads").insert({
        match_id: matchId,
        camera_index: cameraIndex,
        file_path: filePath,
        status: "uploaded",
        frames_count: Number.isFinite(framesCount) ? framesCount : null,
        duration_sec: Number.isFinite(durationSec) ? durationSec : null,
      });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Upload tracking data through the edge function (service role bypasses storage RLS)
    if (action === "upload_tracking") {
      const trackingData = body.trackingData;
      const framesCount = Number(body.framesCount ?? 0);
      const durationSec = Number(body.durationSec ?? 0);

      if (!trackingData || !trackingData.frames) {
        return new Response(JSON.stringify({ error: "Keine Tracking-Daten" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const objectPath = `${matchId}/cam_${cameraIndex}.json`;
      const filePath = `tracking/${objectPath}`;
      const jsonString = JSON.stringify(trackingData);
      const blob = new Blob([jsonString], { type: "application/json" });

      console.log(`[camera-ops] Uploading tracking data: ${(blob.size / 1024).toFixed(0)} KB, ${framesCount} frames`);

      const { error: uploadErr } = await supabase.storage
        .from("tracking")
        .upload(objectPath, blob, { contentType: "application/json", upsert: true });

      if (uploadErr) {
        console.error("[camera-ops] Storage upload failed:", uploadErr);
        return new Response(JSON.stringify({ error: "Upload fehlgeschlagen: " + uploadErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Register the upload entry
      await supabase.from("tracking_uploads").insert({
        match_id: matchId,
        camera_index: cameraIndex,
        file_path: filePath,
        status: "uploaded",
        frames_count: Number.isFinite(framesCount) ? framesCount : null,
        duration_sec: Number.isFinite(durationSec) ? durationSec : null,
      });

      console.log(`[camera-ops] Upload registered: ${filePath}`);
      return new Response(JSON.stringify({ success: true, filePath }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Ungültige Aktion" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("camera-ops error", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unbekannter Fehler" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
