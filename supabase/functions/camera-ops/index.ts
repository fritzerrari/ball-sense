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

    if (action === "save_calibration") {
      const rawPoints = Array.isArray(body.points) ? body.points : [];
      if (rawPoints.length !== 4) {
        return new Response(JSON.stringify({ error: "Es müssen genau 4 Eckpunkte gesetzt werden" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const points = rawPoints
        .map((point) => {
          if (!point || typeof point !== "object") return null;
          const candidate = point as { x?: unknown; y?: unknown };
          const x = Number(candidate.x);
          const y = Number(candidate.y);
          if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
          if (x < 0 || x > 1 || y < 0 || y > 1) return null;
          return { x, y };
        })
        .filter((point): point is { x: number; y: number } => !!point);

      if (points.length !== 4) {
        return new Response(JSON.stringify({ error: "Ungültige Eckpunkte" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: matchRow, error: matchError } = await supabase
        .from("matches")
        .select("field_id")
        .eq("id", matchId)
        .maybeSingle();

      if (matchError || !matchRow?.field_id) {
        return new Response(JSON.stringify({ error: "Kein Platz für dieses Spiel gefunden" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: fieldRow } = await supabase
        .from("fields")
        .select("width_m, height_m")
        .eq("id", matchRow.field_id)
        .maybeSingle();

      const calibration = {
        points,
        width_m: Number(fieldRow?.width_m ?? 105),
        height_m: Number(fieldRow?.height_m ?? 68),
        calibrated_at: new Date().toISOString(),
        coverage: "full",
        field_rect: { x: 0, y: 0, w: 1, h: 1 },
      };

      const { error: updateError } = await supabase
        .from("fields")
        .update({ calibration })
        .eq("id", matchRow.field_id);

      if (updateError) {
        console.error("[camera-ops] save_calibration failed:", updateError);
        return new Response(JSON.stringify({ error: "Kalibrierung konnte nicht gespeichert werden" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, calibration }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "release") {
      // Release camera session after upload — expire it immediately
      const sessionHash = await sha256(sessionToken);
      await supabase.from("camera_access_sessions")
        .update({ expires_at: new Date().toISOString() })
        .eq("match_id", matchId)
        .eq("camera_index", cameraIndex)
        .eq("session_token_hash", sessionHash);
      console.log(`[camera-ops] Released session for match=${matchId} cam=${cameraIndex}`);
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
