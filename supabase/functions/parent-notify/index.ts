// Sends parent push notifications via Web Push (VAPID/aes128gcm) when a match is finalized.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendWebPush } from "../_shared/web-push.ts";

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

    const { data: lineup } = await supabase
      .from("match_lineups")
      .select("player_id")
      .eq("match_id", match_id);
    const playerIds = (lineup ?? []).map(l => l.player_id).filter(Boolean);
    if (playerIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_lineup" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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
    let sent = 0, failed = 0;
    const logs: any[] = [];
    const expiredIds: string[] = [];

    for (const sub of subs) {
      // Skip if this sub already got a notification for this match
      const { count: dup } = await supabase
        .from("parent_notifications")
        .select("id", { count: "exact", head: true })
        .eq("subscription_id", sub.id)
        .eq("match_id", match_id)
        .eq("delivery_status", "sent");
      if ((dup ?? 0) > 0) continue;

      const name = playerName.get(sub.player_id) ?? "Spieler";
      const goals = goalsByPlayer.get(sub.player_id) ?? 0;
      const title = goals > 0 ? `⚽ ${name} – ${goals} Tor${goals > 1 ? "e" : ""}!` : `⚽ ${name} – Spielende`;
      const body = goals > 0
        ? `Endstand vs ${match.opponent}: ${score}. ${goals} Tor${goals > 1 ? "e" : ""} erzielt!`
        : `Endstand vs ${match.opponent}: ${score}. Bericht in der App.`;

      let status: "sent" | "failed" | "expired" | "pending" = "pending";
      let error: string | null = null;

      if (sub.push_endpoint && sub.push_p256dh && sub.push_auth) {
        try {
          const res = await sendWebPush(
            { endpoint: sub.push_endpoint, p256dh: sub.push_p256dh, auth: sub.push_auth },
            { title, body, url: `/matches/${match_id}`, tag: `match-${match_id}-${sub.player_id}` },
          );
          if (res.ok) { status = "sent"; sent++; }
          else if (res.expired) { status = "expired"; expiredIds.push(sub.id); }
          else { status = "failed"; error = `${res.status}: ${res.error?.slice(0, 200) ?? ""}`; failed++; }
        } catch (e: any) {
          status = "failed"; error = e?.message?.slice(0, 200) ?? "push_error"; failed++;
        }
      }

      logs.push({
        subscription_id: sub.id, player_id: sub.player_id, match_id,
        title, body, delivery_status: status, error,
      });
    }

    if (logs.length > 0) await supabase.from("parent_notifications").insert(logs);
    if (expiredIds.length > 0) {
      await supabase.from("parent_subscriptions").update({ active: false }).in("id", expiredIds);
    }

    return new Response(JSON.stringify({ sent, failed, expired: expiredIds.length, total_subs: subs.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("parent-notify error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
