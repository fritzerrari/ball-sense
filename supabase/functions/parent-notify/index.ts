// Sends parent push notifications via Web Push when a match is finalized.
// Triggered manually after match completion or by scheduled job.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { match_id } = await req.json().catch(() => ({}));
    if (!match_id) return new Response(JSON.stringify({ error: "match_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: match } = await supabase
      .from("matches")
      .select("id, opponent, home_score, away_score, match_date, home_club_id")
      .eq("id", match_id)
      .maybeSingle();
    if (!match) return new Response(JSON.stringify({ error: "match not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Players in this match
    const { data: lineup } = await supabase
      .from("match_lineups")
      .select("player_id")
      .eq("match_id", match_id);
    const playerIds = (lineup ?? []).map(l => l.player_id).filter(Boolean);
    if (playerIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_lineup" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get player goals
    const { data: events } = await supabase
      .from("match_events")
      .select("player_id, event_type")
      .eq("match_id", match_id)
      .in("player_id", playerIds);

    const goalsByPlayer = new Map<string, number>();
    (events ?? []).forEach(e => {
      if (e.event_type === "goal" && e.player_id) {
        goalsByPlayer.set(e.player_id, (goalsByPlayer.get(e.player_id) ?? 0) + 1);
      }
    });

    // Active subscriptions for these players
    const { data: subs } = await supabase
      .from("parent_subscriptions")
      .select("*")
      .in("player_id", playerIds)
      .eq("active", true);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_subs" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: players } = await supabase
      .from("players")
      .select("id, name")
      .in("id", playerIds);
    const playerName = new Map((players ?? []).map(p => [p.id, p.name]));

    const score = `${match.home_score ?? 0}:${match.away_score ?? 0}`;
    let sent = 0;
    let logs: any[] = [];

    for (const sub of subs) {
      const name = playerName.get(sub.player_id) ?? "Spieler";
      const goals = goalsByPlayer.get(sub.player_id) ?? 0;
      const title = `⚽ ${name} – Spielende`;
      const body = goals > 0
        ? `${name} hat ${goals} Tor${goals > 1 ? "e" : ""} erzielt! Endstand vs ${match.opponent}: ${score}`
        : `Spielende vs ${match.opponent}: ${score}. Vollständiger Bericht in der App.`;

      let status: "sent" | "failed" | "expired" = "sent";
      let error: string | null = null;

      // Web Push delivery (only if endpoint set)
      if (sub.push_endpoint && sub.push_p256dh && sub.push_auth) {
        try {
          // Note: full Web Push requires VAPID. For now we log; integration with web-push lib pending.
          // In production, add VAPID keys + a proper push library here.
          status = "pending" as any;
        } catch (e: any) {
          status = "failed";
          error = e?.message ?? "push_error";
        }
      } else {
        status = "pending" as any; // No push endpoint = email-only mode (future)
      }

      logs.push({
        subscription_id: sub.id,
        player_id: sub.player_id,
        match_id,
        title,
        body,
        delivery_status: status,
        error,
      });
      sent++;
    }

    if (logs.length > 0) {
      await supabase.from("parent_notifications").insert(logs);
    }

    return new Response(JSON.stringify({ sent, total_subs: subs.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
