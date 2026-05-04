// Player Portal Invite — sendet E-Mail-Einladung an Spieler/Eltern für Read-Only-Account.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { player_id, email, notes, action } = await req.json();
    if (!action || (action === "create" && (!player_id || !email))) {
      return new Response(JSON.stringify({ error: "action + player_id + email erforderlich" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Nicht eingeloggt" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "list") {
      const { data: profile } = await supabase.from("profiles").select("club_id").eq("user_id", user.id).maybeSingle();
      const { data: invites } = await supabase
        .from("player_portal_invites")
        .select("id, player_id, email, status, invited_at, accepted_at, players(name, number)")
        .eq("club_id", profile?.club_id)
        .order("invited_at", { ascending: false });
      return new Response(JSON.stringify({ invites: invites ?? [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "revoke") {
      const { id } = await (async () => req.json().catch(() => ({ id: player_id })))();
      const targetId = id || player_id;
      await supabase.from("player_portal_invites").update({ status: "revoked" }).eq("id", targetId);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // create
    const { data: profile } = await supabase.from("profiles").select("club_id").eq("user_id", user.id).maybeSingle();
    const { data: player } = await supabase.from("players").select("id, name, club_id").eq("id", player_id).maybeSingle();
    if (!player || player.club_id !== profile?.club_id) {
      return new Response(JSON.stringify({ error: "Spieler nicht im eigenen Club" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Upsert Einladung
    const { data: existing } = await supabase
      .from("player_portal_invites")
      .select("id, status")
      .eq("player_id", player.id)
      .eq("email", normalizedEmail)
      .maybeSingle();

    let inviteId: string | undefined = existing?.id;
    if (!existing) {
      const { data: ins, error: insErr } = await supabase
        .from("player_portal_invites")
        .insert({ player_id: player.id, club_id: player.club_id, email: normalizedEmail, invited_by: user.id, notes })
        .select("id").single();
      if (insErr) throw insErr;
      inviteId = ins.id;
    } else {
      await supabase.from("player_portal_invites").update({ status: "pending", invited_at: new Date().toISOString(), notes }).eq("id", existing.id);
    }

    // Auth-Einladung verschicken (oder Magic-Link, falls bereits registriert)
    const redirectTo = `${req.headers.get("origin") ?? ""}/player-portal`;
    let authMethod = "invite";
    let inviteError: string | null = null;
    try {
      const { error: invErr } = await supabase.auth.admin.inviteUserByEmail(normalizedEmail, { redirectTo });
      if (invErr) {
        // Falls bereits registriert: Magic-Link
        const { error: mlErr } = await supabase.auth.admin.generateLink({
          type: "magiclink", email: normalizedEmail, options: { redirectTo },
        });
        if (mlErr) inviteError = mlErr.message;
        else authMethod = "magiclink";
      }
    } catch (e) {
      inviteError = e instanceof Error ? e.message : "unknown";
    }

    return new Response(JSON.stringify({
      ok: true, invite_id: inviteId, player: player.name, email: normalizedEmail, auth_method: authMethod, invite_warning: inviteError,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("player-portal-invite error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
