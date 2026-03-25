import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateSessionToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action, code, session_token, match_id } = body;

    if (action === "lookup") {
      // Validate code format
      if (!code || !/^\d{6}$/.test(code)) {
        return new Response(
          JSON.stringify({ error: "Ungültiger Code. Bitte 6 Ziffern eingeben." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const codeHash = await sha256Hex(code);

      // Find active code
      const { data: accessCode, error: codeError } = await supabase
        .from("camera_access_codes")
        .select("id, club_id, label")
        .eq("code_hash", codeHash)
        .eq("active", true)
        .maybeSingle();

      if (codeError || !accessCode) {
        return new Response(
          JSON.stringify({ error: "Code ungültig oder abgelaufen. Frag deinen Trainer nach einem neuen Code." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find the latest match for this club that is in setup or recording status
      const { data: latestMatch } = await supabase
        .from("matches")
        .select("id")
        .eq("home_club_id", accessCode.club_id)
        .in("status", ["setup", "recording", "processing"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestMatch) {
        return new Response(
          JSON.stringify({ error: "Kein aktives Spiel gefunden. Der Trainer muss zuerst ein Spiel anlegen." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Determine camera index (count existing sessions for this match)
      const { count } = await supabase
        .from("camera_access_sessions")
        .select("*", { count: "exact", head: true })
        .eq("match_id", latestMatch.id)
        .gt("expires_at", new Date().toISOString());

      const cameraIndex = (count ?? 0);

      // Create session
      const sessionToken = generateSessionToken();
      const sessionHash = await sha256Hex(sessionToken);
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(); // 12h

      const { error: sessionError } = await supabase
        .from("camera_access_sessions")
        .insert({
          club_id: accessCode.club_id,
          code_id: accessCode.id,
          match_id: latestMatch.id,
          camera_index: cameraIndex,
          session_token_hash: sessionHash,
          expires_at: expiresAt,
        });

      if (sessionError) {
        console.error("Session creation error:", sessionError);
        return new Response(
          JSON.stringify({ error: "Session konnte nicht erstellt werden." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update last_used_at on the access code
      await supabase
        .from("camera_access_codes")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", accessCode.id);

      return new Response(
        JSON.stringify({
          matchId: latestMatch.id,
          cameraIndex,
          sessionToken,
          clubId: accessCode.club_id,
          label: accessCode.label,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "validate") {
      // Validate an existing session token
      if (!session_token || !match_id) {
        return new Response(
          JSON.stringify({ error: "Missing session_token or match_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenHash = await sha256Hex(session_token);
      const { data: session } = await supabase
        .from("camera_access_sessions")
        .select("id, camera_index, expires_at")
        .eq("session_token_hash", tokenHash)
        .eq("match_id", match_id)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (!session) {
        return new Response(
          JSON.stringify({ valid: false, error: "Session abgelaufen oder ungültig." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update last_used_at
      await supabase
        .from("camera_access_sessions")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", session.id);

      return new Response(
        JSON.stringify({ valid: true, cameraIndex: session.camera_index }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "release") {
      // Release a camera session (expire it immediately)
      if (!session_token) {
        return new Response(
          JSON.stringify({ error: "Missing session_token" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenHash = await sha256Hex(session_token);
      await supabase
        .from("camera_access_sessions")
        .update({ expires_at: new Date().toISOString() })
        .eq("session_token_hash", tokenHash);

      return new Response(
        JSON.stringify({ released: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unbekannte Aktion" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("camera-access error:", err);
    return new Response(
      JSON.stringify({ error: "Interner Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
