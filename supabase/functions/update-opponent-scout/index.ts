// Auto-aktualisiert das Gegner-Scouting-Profil nach jedem Final-Job.
// Sammelt alle vergangenen Spiele desselben Heim-Vereins gegen diesen Gegner,
// aggregiert Stats + Patterns, und persistiert ein Scouting-Snapshot in
// match_preparations.preparation_data (mit type="scouting_auto").
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Body {
  match_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { match_id } = (await req.json()) as Body;
    if (!match_id) {
      return new Response(JSON.stringify({ error: "match_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve current match → home_club_id + opponent name
    const { data: thisMatch, error: matchErr } = await supabase
      .from("matches")
      .select("id, home_club_id, away_club_name, away_club_id, date")
      .eq("id", match_id)
      .single();

    if (matchErr || !thisMatch) {
      return new Response(JSON.stringify({ error: "match not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const opponentName = thisMatch.away_club_name?.trim();
    if (!opponentName) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no opponent name" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Pull all matches by this club vs this opponent
    const { data: history } = await supabase
      .from("matches")
      .select("id, date, home_score, away_score, home_formation, away_formation")
      .eq("home_club_id", thisMatch.home_club_id)
      .eq("away_club_name", opponentName)
      .order("date", { ascending: false })
      .limit(20);

    const matchIds = (history ?? []).map((m: any) => m.id);
    if (matchIds.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no history" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Aggregate opponent stats from team_match_stats (their side = "away")
    const { data: teamStats } = await supabase
      .from("team_match_stats")
      .select("match_id, team, possession_pct, total_distance_km, top_speed_kmh, avg_distance_km")
      .in("match_id", matchIds)
      .eq("team", "away");

    // Pull recurring patterns from auto_pattern markers (file_path: auto://...)
    const { data: patterns } = await supabase
      .from("match_videos")
      .select("match_id, event_type, event_minute")
      .in("match_id", matchIds)
      .eq("video_type", "auto_pattern");

    // Aggregate
    const stats = teamStats ?? [];
    const avg = (k: string) => {
      const vals = stats
        .map((s: any) => s[k])
        .filter((v: any) => v != null && Number.isFinite(Number(v)))
        .map(Number);
      return vals.length
        ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2))
        : null;
    };

    const patternFreq: Record<string, number> = {};
    (patterns ?? []).forEach((p: any) => {
      const key = String(p.event_type ?? "unknown");
      patternFreq[key] = (patternFreq[key] ?? 0) + 1;
    });
    const topPatterns = Object.entries(patternFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, count]) => ({ key, count }));

    // Win/draw/loss tally from this club's perspective
    let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;
    (history ?? []).forEach((m: any) => {
      const hs = m.home_score ?? 0;
      const as = m.away_score ?? 0;
      goalsFor += hs;
      goalsAgainst += as;
      if (hs > as) wins++;
      else if (hs < as) losses++;
      else if (m.home_score != null) draws++;
    });

    // Most-used opponent formation
    const formationFreq: Record<string, number> = {};
    (history ?? []).forEach((m: any) => {
      if (m.away_formation) {
        formationFreq[m.away_formation] = (formationFreq[m.away_formation] ?? 0) + 1;
      }
    });
    const preferredFormation = Object.entries(formationFreq)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const scoutingPayload = {
      type: "scouting_auto",
      generated_at: new Date().toISOString(),
      opponent: opponentName,
      sample_size: matchIds.length,
      record: { wins, draws, losses, goals_for: goalsFor, goals_against: goalsAgainst },
      averages: {
        possession_pct: avg("possession_pct"),
        total_distance_km: avg("total_distance_km"),
        top_speed_kmh: avg("top_speed_kmh"),
        avg_distance_km: avg("avg_distance_km"),
      },
      preferred_formation: preferredFormation,
      recurring_patterns: topPatterns,
      last_meeting: history?.[0]
        ? {
          match_id: history[0].id,
          date: history[0].date,
          score: `${history[0].home_score ?? "?"}:${history[0].away_score ?? "?"}`,
        }
        : null,
    };

    // Upsert into match_preparations (one auto entry per opponent per club).
    // We delete prior auto entries for this opponent + insert the new snapshot.
    await supabase
      .from("match_preparations")
      .delete()
      .eq("club_id", thisMatch.home_club_id)
      .eq("opponent_name", opponentName)
      .filter("preparation_data->>type", "eq", "scouting_auto");

    const { error: insertErr } = await supabase.from("match_preparations").insert({
      club_id: thisMatch.home_club_id,
      opponent_name: opponentName,
      match_id,
      preparation_data: scoutingPayload,
    });

    if (insertErr) {
      console.error("scouting insert error", insertErr);
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, scouting: scoutingPayload }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("update-opponent-scout error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
