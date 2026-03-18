import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ConsentStatus = "unknown" | "granted" | "denied";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return json({ error: "Unauthorized" }, 401);
    }

    const callerId = claimsData.claims.sub;
    const [{ data: adminRole }, { data: superAdminRow }, { data: profileRow }] = await Promise.all([
      anonClient.from("user_roles").select("id").eq("user_id", callerId).eq("role", "admin").maybeSingle(),
      anonClient.from("super_admins").select("id").eq("user_id", callerId).eq("active", true).maybeSingle(),
      anonClient.from("profiles").select("club_id").eq("user_id", callerId).maybeSingle(),
    ]);

    const isSuperAdmin = !!superAdminRow;
    const isClubAdmin = !!adminRole;

    if (!isSuperAdmin && !isClubAdmin) {
      return json({ error: "Forbidden" }, 403);
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const action = body?.action ?? "update";

    if (action === "list") {
      let query = adminClient
        .from("players")
        .select("id, name, number, position, active, club_id, tracking_consent_status, tracking_consent_notes, tracking_consent_updated_at, clubs(name)")
        .order("name");

      if (!isSuperAdmin && profileRow?.club_id) {
        query = query.eq("club_id", profileRow.club_id);
      }

      const { data, error } = await query;
      if (error) return json({ error: error.message }, 400);
      return json({ players: data ?? [] });
    }

    const { playerId, tracking_consent_status, tracking_consent_notes } = body;
    const normalizedStatus = tracking_consent_status as ConsentStatus;

    if (!playerId) {
      return json({ error: "playerId required" }, 400);
    }

    if (!["unknown", "granted", "denied"].includes(normalizedStatus)) {
      return json({ error: "Invalid consent status" }, 400);
    }

    const { data: player, error: playerError } = await adminClient
      .from("players")
      .select("id, club_id, name, tracking_consent_status, tracking_consent_notes")
      .eq("id", playerId)
      .single();

    if (playerError || !player) {
      return json({ error: "Player not found" }, 404);
    }

    if (!isSuperAdmin && player.club_id !== profileRow?.club_id) {
      return json({ error: "Forbidden" }, 403);
    }

    const updatedAt = new Date().toISOString();
    const { data: updatedPlayer, error: updateError } = await adminClient
      .from("players")
      .update({
        tracking_consent_status: normalizedStatus,
        tracking_consent_notes: typeof tracking_consent_notes === "string" && tracking_consent_notes.trim().length > 0
          ? tracking_consent_notes.trim()
          : null,
        tracking_consent_updated_at: updatedAt,
      })
      .eq("id", playerId)
      .select("id, tracking_consent_status, tracking_consent_notes, tracking_consent_updated_at")
      .single();

    if (updateError) {
      return json({ error: updateError.message }, 400);
    }

    await adminClient.from("audit_logs").insert({
      user_id: callerId,
      action: "player_consent_updated",
      entity_type: "player",
      entity_id: playerId,
      details: {
        player_name: player.name,
        status_before: player.tracking_consent_status,
        status_after: normalizedStatus,
        is_super_admin: isSuperAdmin,
      },
    });

    return json({ player: updatedPlayer });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
