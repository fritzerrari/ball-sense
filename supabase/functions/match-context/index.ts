import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface MatchRow {
  id: string;
  home_club_id: string;
  away_club_id: string | null;
  away_club_name: string | null;
  date: string;
  context_cache: any;
}

interface TeamStatsRow {
  match_id: string;
  team: string;
  total_distance_km: number | null;
  avg_distance_km: number | null;
  top_speed_kmh: number | null;
  possession_pct: number | null;
}

function avg(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => typeof v === "number" && !isNaN(v));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function delta(current: number | null, baseline: number | null): {
  abs: number | null;
  pct: number | null;
} {
  if (current == null || baseline == null || baseline === 0) {
    return { abs: null, pct: null };
  }
  return {
    abs: current - baseline,
    pct: ((current - baseline) / baseline) * 100,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const auth = req.headers.get("Authorization") ?? "";

    // Auth client to validate user
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes } = await authClient.auth.getUser();
    if (!userRes?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const matchId: string | undefined = body.match_id;
    const force: boolean = !!body.force_refresh;
    if (!matchId) {
      return new Response(JSON.stringify({ error: "match_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Load current match
    const { data: match, error: matchErr } = await admin
      .from("matches")
      .select("id, home_club_id, away_club_id, away_club_name, date, context_cache")
      .eq("id", matchId)
      .single();
    if (matchErr || !match) {
      return new Response(JSON.stringify({ error: "match not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const m = match as MatchRow;

    // Cache hit
    if (!force && m.context_cache?.generated_at) {
      const ageMs = Date.now() - new Date(m.context_cache.generated_at).getTime();
      if (ageMs < 1000 * 60 * 60 * 12) {
        return new Response(JSON.stringify({ context: m.context_cache, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Current match team stats
    const { data: currentStats } = await admin
      .from("team_match_stats")
      .select("match_id, team, total_distance_km, avg_distance_km, top_speed_kmh, possession_pct")
      .eq("match_id", matchId);

    const currentHome = (currentStats as TeamStatsRow[] | null)?.find((s) => s.team === "home") ?? null;

    // Club history: last 10 finished matches (excluding current)
    const { data: clubMatches } = await admin
      .from("matches")
      .select("id, date, away_club_id, away_club_name")
      .eq("home_club_id", m.home_club_id)
      .neq("id", matchId)
      .order("date", { ascending: false })
      .limit(10);

    const historyMatchIds = (clubMatches ?? []).map((x) => x.id);
    let historyStats: TeamStatsRow[] = [];
    if (historyMatchIds.length) {
      const { data } = await admin
        .from("team_match_stats")
        .select("match_id, team, total_distance_km, avg_distance_km, top_speed_kmh, possession_pct")
        .in("match_id", historyMatchIds)
        .eq("team", "home");
      historyStats = (data ?? []) as TeamStatsRow[];
    }

    const clubBaseline = {
      possession_pct: avg(historyStats.map((s) => s.possession_pct)),
      total_distance_km: avg(historyStats.map((s) => s.total_distance_km)),
      avg_distance_km: avg(historyStats.map((s) => s.avg_distance_km)),
      top_speed_kmh: avg(historyStats.map((s) => s.top_speed_kmh)),
      sample_size: historyStats.length,
    };

    // Direct opponent history
    let opponentBaseline: any = null;
    if (m.away_club_id || m.away_club_name) {
      const opponentMatchQuery = admin
        .from("matches")
        .select("id")
        .eq("home_club_id", m.home_club_id)
        .neq("id", matchId);

      const { data: oppMatches } = m.away_club_id
        ? await opponentMatchQuery.eq("away_club_id", m.away_club_id)
        : await opponentMatchQuery.eq("away_club_name", m.away_club_name!);

      const oppIds = (oppMatches ?? []).map((x: any) => x.id);
      if (oppIds.length) {
        const { data: oppStats } = await admin
          .from("team_match_stats")
          .select("match_id, team, total_distance_km, avg_distance_km, top_speed_kmh, possession_pct")
          .in("match_id", oppIds)
          .eq("team", "home");
        const ostats = (oppStats ?? []) as TeamStatsRow[];
        opponentBaseline = {
          possession_pct: avg(ostats.map((s) => s.possession_pct)),
          total_distance_km: avg(ostats.map((s) => s.total_distance_km)),
          avg_distance_km: avg(ostats.map((s) => s.avg_distance_km)),
          top_speed_kmh: avg(ostats.map((s) => s.top_speed_kmh)),
          sample_size: ostats.length,
          opponent: m.away_club_name ?? "Gegner",
        };
      }
    }

    // League benchmark via opt-in RPC
    let leagueBenchmark: any = null;
    try {
      const { data: rpc } = await admin.rpc("get_league_benchmarks", {
        _club_id: m.home_club_id,
        _league: "",
      });
      if (rpc && !(rpc as any).error) {
        leagueBenchmark = rpc;
      }
    } catch (_) {
      // ignore
    }

    const current = {
      possession_pct: currentHome?.possession_pct ?? null,
      total_distance_km: currentHome?.total_distance_km ?? null,
      avg_distance_km: currentHome?.avg_distance_km ?? null,
      top_speed_kmh: currentHome?.top_speed_kmh ?? null,
    };

    const buildKpis = (baseline: any, label: string) => {
      if (!baseline) return null;
      return {
        label,
        sample_size: baseline.sample_size ?? 0,
        possession: delta(current.possession_pct, baseline.possession_pct ?? baseline.avg_possession_pct),
        total_distance: delta(current.total_distance_km, baseline.total_distance_km ?? baseline.avg_total_distance_km),
        avg_distance: delta(current.avg_distance_km, baseline.avg_distance_km ?? baseline.avg_avg_distance_km),
        top_speed: delta(current.top_speed_kmh, baseline.top_speed_kmh ?? baseline.avg_top_speed_kmh),
      };
    };

    const context = {
      generated_at: new Date().toISOString(),
      current,
      vs_club_history: buildKpis(clubBaseline, "Eigene letzte Spiele"),
      vs_opponent_history: buildKpis(opponentBaseline, opponentBaseline?.opponent ?? "Direktduell"),
      vs_league: buildKpis(leagueBenchmark, "Liga-Schnitt (opt-in)"),
      league_participants: leagueBenchmark?.participants ?? null,
    };

    // Persist cache
    await admin.from("matches").update({ context_cache: context }).eq("id", matchId);

    return new Response(JSON.stringify({ context, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("match-context error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
