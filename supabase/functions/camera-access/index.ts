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

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body ?? {};
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ── New: lookup action — find active match by code only (no matchId needed) ──
    if (action === "lookup") {
      const code = String(body.code ?? "").trim();
      if (!CODE_REGEX.test(code)) {
        return jsonResp({ error: "Code muss 6-stellig sein" }, 400);
      }

      const codeHash = await sha256(code);
      console.log("lookup: code_hash =", codeHash.substring(0, 12) + "...");

      // Find the active access code
      const { data: accessCode, error: codeError } = await supabase
        .from("camera_access_codes")
        .select("id, club_id")
        .eq("code_hash", codeHash)
        .eq("active", true)
        .maybeSingle();

      if (codeError) console.error("lookup code query error:", codeError);

      if (!accessCode) {
        // Debug: check if code exists but inactive
        const { data: anyCode } = await supabase
          .from("camera_access_codes")
          .select("id, active")
          .eq("code_hash", codeHash)
          .maybeSingle();
        if (anyCode && !anyCode.active) {
          console.log("lookup: code exists but inactive", anyCode.id);
          return jsonResp({ error: "Dieser Code wurde deaktiviert. Bitte den Trainer kontaktieren." }, 401);
        }
        console.log("lookup: no matching code found");
        return jsonResp({ error: "Code ungültig. Bitte prüfe den 6-stelligen Code und versuche es erneut." }, 401);
      }

      // Find the most recent match for this club that is not 'completed'
      const { data: matches } = await supabase
        .from("matches")
        .select("id, date, kickoff, away_club_name, status")
        .eq("home_club_id", accessCode.club_id)
        .in("status", ["setup", "live", "ready"])
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1);

      if (!matches || matches.length === 0) {
        return jsonResp({ error: "Kein aktives Spiel gefunden. Bitte den Trainer kontaktieren." }, 404);
      }

      const match = matches[0];

      // Create session for camera 0 by default
      const cameraIndex = 0;
      const sessionToken = createToken();
      const sessionHash = await sha256(sessionToken);
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

      await supabase.from("camera_access_sessions").insert({
        code_id: accessCode.id,
        club_id: accessCode.club_id,
        match_id: match.id,
        camera_index: cameraIndex,
        session_token_hash: sessionHash,
        expires_at: expiresAt,
      });

      await supabase.from("camera_access_codes").update({ last_used_at: new Date().toISOString() }).eq("id", accessCode.id);

      return jsonResp({ sessionToken, expiresAt, matchId: match.id, cameraIndex, match });
    }

    // ── Existing actions require matchId + cameraIndex ──
    const { matchId, cameraIndex } = body ?? {};

    if (!UUID_REGEX.test(matchId ?? "")) {
      return jsonResp({ error: "Ungültige Match-ID" }, 400);
    }
    if (!isValidCameraIndex(cameraIndex)) {
      return jsonResp({ error: "Ungültige Kamera" }, 400);
    }

    if (action === "login") {
      const code = String(body.code ?? "").trim();
      if (!CODE_REGEX.test(code)) {
        return jsonResp({ error: "Code muss 6-stellig sein" }, 400);
      }

      const { data: match } = await supabase.from("matches").select("id, home_club_id").eq("id", matchId).single();
      if (!match?.home_club_id) {
        return jsonResp({ error: "Spiel nicht gefunden" }, 404);
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
        return jsonResp({ error: "Code ungültig oder deaktiviert" }, 401);
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

      return jsonResp({ sessionToken, expiresAt });
    }

    if (action === "session") {
      const sessionToken = String(body.sessionToken ?? "").trim();
      if (sessionToken.length < 20) {
        return jsonResp({ error: "Ungültige Session" }, 401);
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
        return jsonResp({ error: "Session abgelaufen oder ungültig" }, 401);
      }

      await supabase.from("camera_access_sessions").update({ last_used_at: new Date().toISOString() }).eq("id", session.id);

      const { data: match } = await supabase
        .from("matches")
        .select("id, date, kickoff, away_club_name, status, field_id, fields(name, width_m, height_m, calibration)")
        .eq("id", matchId)
        .single();

      return jsonResp({ match });
    }

    return jsonResp({ error: "Ungültige Aktion" }, 400);
  } catch (error) {
    console.error("camera-access error", error);
    return jsonResp({ error: error instanceof Error ? error.message : "Unbekannter Fehler" }, 500);
  }
});
