const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE = "https://api.openligadb.de";

// Known league shortcuts for OpenLigaDB
const KNOWN_LEAGUES: Record<string, string> = {
  "bl1": "1. Bundesliga",
  "bl2": "2. Bundesliga",
  "bl3": "3. Liga",
  "dfb": "DFB-Pokal",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    // ── List available leagues ──
    if (action === "list_leagues") {
      return new Response(
        JSON.stringify({
          leagues: Object.entries(KNOWN_LEAGUES).map(([key, name]) => ({ key, name })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Get current matchday results ──
    if (action === "current_matchday") {
      const { league } = body;
      if (!league) {
        return new Response(JSON.stringify({ error: "league required (e.g. bl1, bl2, bl3)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch(`${BASE}/getmatchdata/${league}`);
      if (!res.ok) {
        return new Response(JSON.stringify({ error: "OpenLigaDB request failed" }), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const matches = await res.json();
      const simplified = matches.map((m: any) => ({
        match_id: m.matchID,
        date: m.matchDateTimeUTC,
        home_team: m.team1?.teamName ?? "?",
        away_team: m.team2?.teamName ?? "?",
        home_logo: m.team1?.teamIconUrl ?? null,
        away_logo: m.team2?.teamIconUrl ?? null,
        home_goals: m.matchResults?.find((r: any) => r.resultTypeID === 2)?.pointsTeam1 ?? null,
        away_goals: m.matchResults?.find((r: any) => r.resultTypeID === 2)?.pointsTeam2 ?? null,
        is_finished: m.matchIsFinished ?? false,
        matchday: m.group?.groupOrderID ?? null,
      }));

      return new Response(
        JSON.stringify({ matches: simplified, league: KNOWN_LEAGUES[league] ?? league }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Get specific matchday ──
    if (action === "matchday") {
      const { league, season, matchday } = body;
      if (!league || !season || !matchday) {
        return new Response(JSON.stringify({ error: "league, season, matchday required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch(`${BASE}/getmatchdata/${league}/${season}/${matchday}`);
      if (!res.ok) {
        return new Response(JSON.stringify({ error: "OpenLigaDB request failed" }), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const matches = await res.json();
      const simplified = matches.map((m: any) => ({
        match_id: m.matchID,
        date: m.matchDateTimeUTC,
        home_team: m.team1?.teamName ?? "?",
        away_team: m.team2?.teamName ?? "?",
        home_logo: m.team1?.teamIconUrl ?? null,
        away_logo: m.team2?.teamIconUrl ?? null,
        home_goals: m.matchResults?.find((r: any) => r.resultTypeID === 2)?.pointsTeam1 ?? null,
        away_goals: m.matchResults?.find((r: any) => r.resultTypeID === 2)?.pointsTeam2 ?? null,
        is_finished: m.matchIsFinished ?? false,
        matchday: m.group?.groupOrderID ?? null,
      }));

      return new Response(
        JSON.stringify({ matches: simplified }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Get league table ──
    if (action === "table") {
      const { league, season } = body;
      if (!league) {
        return new Response(JSON.stringify({ error: "league required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const url = season
        ? `${BASE}/getbltable/${league}/${season}`
        : `${BASE}/getbltable/${league}`;

      const res = await fetch(url);
      if (!res.ok) {
        return new Response(JSON.stringify({ error: "OpenLigaDB request failed" }), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const table = await res.json();
      const simplified = table.map((t: any) => ({
        rank: t.rank ?? 0,
        team_name: t.teamName ?? "?",
        team_logo: t.teamIconUrl ?? null,
        matches: t.matches ?? 0,
        won: t.won ?? 0,
        draw: t.draw ?? 0,
        lost: t.lost ?? 0,
        goals_for: t.goals ?? 0,
        goals_against: t.opponentGoals ?? 0,
        goal_diff: t.goalDiff ?? 0,
        points: t.points ?? 0,
      }));

      return new Response(
        JSON.stringify({ table: simplified, league: KNOWN_LEAGUES[league] ?? league }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("openligadb error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
