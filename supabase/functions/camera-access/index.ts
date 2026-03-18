import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-camera-session-token",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE_REGEX = /^\d{6}$/;

async function sha256(value: string) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isValidCameraIndex(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 2;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, matchId, cameraIndex } = body ?? {};

    if (!UUID_REGEX.test(matchId ?? "")) {
      return new Response(JSON.stringify({ error: "Ungültige Match-ID" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!isValidCameraIndex(cameraIndex)) {
      return new Response(JSON.stringify({ error: "Ungültige Kamera" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (action === "login") {
      const code = String(body.code ?? "").trim();
      if (!CODE_REGEX.test(code)) {
        return new Response(JSON.stringify({ error: "Code muss 6-stellig sein" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: match } = await supabase.from("matches").select("id, home_club_id").eq("id", matchId).single();
      if (!match?.home_club_id) {
        return new Response(JSON.stringify({ error: "Spiel nicht gefunden" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const codeHash = await sha256(code);
      const { data: accessCode } = await supabase
        .from("camera_access_codes")
        .select("id, club_id, active")
        .eq("club_id", match.home_club_id)
        .eq("code_hash", codeHash)
        .eq("active", true)
        .maybeSingle();

      if (!accessCode) {
        return new Response(JSON.stringify({ error: "Code ungültig oder deaktiviert" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const sessionToken = createToken();
      const sessionHash = await sha256(sessionToken);
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

      await supabase.from("camera_access_sessions").insert({
        code_id: accessCode.id,
        club_id: accessCode.club_id,
        match_id: matchId,
        camera_index: cameraIndex,
        session_token_hash: sessionHash,
        expires_at: expiresAt,
      });

      await supabase.from("camera_access_codes").update({ last_used_at: new Date().toISOString() }).eq("id", accessCode.id);

      return new Response(JSON.stringify({ sessionToken, expiresAt }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "session") {
      const sessionToken = String(body.sessionToken ?? "").trim();
      if (sessionToken.length < 20) {
        return new Response(JSON.stringify({ error: "Ungültige Session" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const sessionHash = await sha256(sessionToken);
      const { data: session } = await supabase
        .from("camera_access_sessions")
        .select("id, club_id, expires_at")
        .eq("match_id", matchId)
        .eq("camera_index", cameraIndex)
        .eq("session_token_hash", sessionHash)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (!session) {
        return new Response(JSON.stringify({ error: "Session abgelaufen oder ungültig" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabase.from("camera_access_sessions").update({ last_used_at: new Date().toISOString() }).eq("id", session.id);

      const { data: match } = await supabase
        .from("matches")
        .select("id, date, kickoff, away_club_name, status, field_id, fields(name, width_m, height_m, calibration)")
        .eq("id", matchId)
        .single();

      return new Response(JSON.stringify({ match }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Ungültige Aktion" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("camera-access error", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unbekannter Fehler" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});