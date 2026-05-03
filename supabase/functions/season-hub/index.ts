import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";
const OPENLIGA_BASE = "https://api.openligadb.de";
const CURRENT_SEASON = 2025;

// Map common German league names → OpenLigaDB shortcuts
function mapToOpenligaShortcut(league?: string | null): string | null {
  if (!league) return null;
  const l = league.toLowerCase();
  if (l.includes("bundesliga") && (l.includes("2") || l.includes("zweite"))) return "bl2";
  if (l.includes("3. liga") || l.includes("dritte liga")) return "bl3";
  if (l.includes("bundesliga") || l === "bl1" || l === "1. bl") return "bl1";
  if (l.includes("dfb")) return "dfb";
  return null;
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const force: boolean = body.force === true;

    // Resolve user's club
    const { data: profile } = await supabase
      .from("profiles")
      .select("club_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    const clubId = profile?.club_id;
    if (!clubId) return json({ error: "Kein Verein zugeordnet" }, 400);

    // Cache check
    if (!force) {
      const { data: cache } = await supabase
        .from("season_hub_cache")
        .select("data, source, fetched_at, expires_at")
        .eq("club_id", clubId)
        .maybeSingle();
      if (cache && new Date(cache.expires_at).getTime() > Date.now()) {
        return json({ cached: true, ...cache });
      }
    }

    // Fetch club info
    const { data: club } = await supabase
      .from("clubs")
      .select("id, name, league, city")
      .eq("id", clubId)
      .single();

    if (!club) return json({ error: "Verein nicht gefunden" }, 404);

    // Check API-Football config
    const { data: apiCfg } = await supabase
      .from("api_football_config")
      .select("api_team_id, api_league_id, api_season, fussball_de_staffel_id, fussball_de_url, club_website_url, scrape_enabled")
      .eq("club_id", clubId)
      .maybeSingle();

    const API_KEY = Deno.env.get("API_FOOTBALL_KEY");
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    let result: any = { club, source: "none", generated_at: new Date().toISOString() };

    // ── STRATEGY 1: API-Football (if configured) ──
    if (apiCfg?.api_team_id && apiCfg?.api_league_id && API_KEY) {
      try {
        result = await fetchFromApiFootball(API_KEY, club, apiCfg);
        result.source = "api-football";
      } catch (e) {
        console.warn("API-Football failed:", e);
      }
    }

    // ── STRATEGY 2: fussball.de Scraping (Amateur/Jugend) ──
    if (result.source === "none" && apiCfg?.scrape_enabled && (apiCfg?.fussball_de_url || apiCfg?.fussball_de_staffel_id) && FIRECRAWL_API_KEY) {
      try {
        result = await fetchFromFussballDe(FIRECRAWL_API_KEY, club, apiCfg);
        result.source = "fussball-de";
      } catch (e) {
        console.warn("fussball.de scrape failed:", e);
      }
    }

    // ── STRATEGY 3: OpenLigaDB (German leagues, no key needed) ──
    if (result.source === "none") {
      const shortcut = mapToOpenligaShortcut(club.league);
      if (shortcut) {
        try {
          result = await fetchFromOpenligaDB(shortcut, club);
          result.source = "openligadb";
        } catch (e) {
          console.warn("OpenLigaDB failed:", e);
        }
      }
    }

    // ── STRATEGY 4: Own match history fallback ──
    if (result.source === "none") {
      result = await fetchFromOwnHistory(supabase, club);
      result.source = "own-history";
    }

    // ── ENRICHMENT: Vereinsseite scraping for News (optional, additive) ──
    if (apiCfg?.club_website_url && FIRECRAWL_API_KEY) {
      try {
        const news = await scrapeClubNews(FIRECRAWL_API_KEY, apiCfg.club_website_url);
        if (news && news.length > 0) {
          result.club_news = news;
          result.club_website_url = apiCfg.club_website_url;
        }
      } catch (e) {
        console.warn("Club website scrape failed:", e);
      }
    }

    // ── ENRICHMENT: AI match plan for next opponent ──
    if (result.next_match?.opponent && result.source !== "none") {
      try {
        const prepUrl = `${supabaseUrl}/functions/v1/match-preparation`;
        const prepResp = await fetch(prepUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify({
            opponent_name: result.next_match.opponent,
            club_id: clubId,
          }),
        });
        if (prepResp.ok) {
          const prep = await prepResp.json();
          result.next_match.ai_briefing = prep?.preparation_data ?? prep;
        }
      } catch (e) {
        console.warn("match-preparation enrichment failed:", e);
      }
    }

    // Persist cache
    await supabase.from("season_hub_cache").upsert(
      {
        club_id: clubId,
        data: result,
        source: result.source,
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: "club_id" }
    );

    return json({ cached: false, data: result, source: result.source, fetched_at: new Date().toISOString() });
  } catch (e) {
    console.error("season-hub error:", e);
    return json({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ────────────────────────────────────────────
// API-Football
// ────────────────────────────────────────────
async function fetchFromApiFootball(apiKey: string, club: any, cfg: any) {
  const teamId = cfg.api_team_id;
  const leagueId = cfg.api_league_id;
  const season = cfg.api_season || CURRENT_SEASON;

  async function af(endpoint: string, params: Record<string, string>) {
    const url = new URL(`${API_FOOTBALL_BASE}/${endpoint}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const r = await fetch(url.toString(), { headers: { "x-apisports-key": apiKey } });
    if (!r.ok) throw new Error(`API-Football ${endpoint}: ${r.status}`);
    return (await r.json()).response ?? [];
  }

  const [standings, lastFixtures, nextFixtures, injuries, scorers] = await Promise.all([
    af("standings", { league: String(leagueId), season: String(season) }),
    af("fixtures", { team: String(teamId), league: String(leagueId), season: String(season), last: "5" }),
    af("fixtures", { team: String(teamId), league: String(leagueId), season: String(season), next: "5" }),
    af("injuries", { team: String(teamId), season: String(season) }).catch(() => []),
    af("players/topscorers", { league: String(leagueId), season: String(season) }).catch(() => []),
  ]);

  // Parse standings table
  const tableRaw = standings?.[0]?.league?.standings?.[0] ?? [];
  const table = tableRaw.map((row: any) => ({
    rank: row.rank,
    team_name: row.team?.name,
    team_logo: row.team?.logo,
    is_us: row.team?.id === teamId,
    matches: row.all?.played,
    won: row.all?.win,
    draw: row.all?.draw,
    lost: row.all?.lose,
    goals_for: row.all?.goals?.for,
    goals_against: row.all?.goals?.against,
    goal_diff: row.goalsDiff,
    points: row.points,
    form: row.form, // e.g. "WWDLW"
  }));

  const ourRank = table.find((t: any) => t.is_us);

  const mapFixture = (f: any) => {
    const isHome = f.teams?.home?.id === teamId;
    const opponent = isHome ? f.teams?.away?.name : f.teams?.home?.name;
    const opponentLogo = isHome ? f.teams?.away?.logo : f.teams?.home?.logo;
    return {
      fixture_id: f.fixture?.id,
      date: f.fixture?.date,
      venue: f.fixture?.venue?.name,
      status: f.fixture?.status?.short,
      is_home: isHome,
      opponent,
      opponent_logo: opponentLogo,
      home_goals: f.goals?.home,
      away_goals: f.goals?.away,
      our_goals: isHome ? f.goals?.home : f.goals?.away,
      their_goals: isHome ? f.goals?.away : f.goals?.home,
      result:
        f.goals?.home == null
          ? null
          : isHome
            ? f.goals.home > f.goals.away ? "W" : f.goals.home === f.goals.away ? "D" : "L"
            : f.goals.away > f.goals.home ? "W" : f.goals.home === f.goals.away ? "D" : "L",
    };
  };

  const last_results = lastFixtures.map(mapFixture);
  const upcoming = nextFixtures.map(mapFixture);
  const next_match = upcoming[0] ?? null;

  const top_scorers = (scorers || []).slice(0, 10).map((s: any) => ({
    name: s.player?.name,
    photo: s.player?.photo,
    team: s.statistics?.[0]?.team?.name,
    goals: s.statistics?.[0]?.goals?.total,
    assists: s.statistics?.[0]?.goals?.assists,
  }));

  const injury_list = (injuries || []).map((i: any) => ({
    player: i.player?.name,
    type: i.player?.type,
    reason: i.player?.reason,
    fixture_date: i.fixture?.date,
  }));

  return {
    club,
    season,
    league_id: leagueId,
    standings: table,
    our_rank: ourRank,
    last_results,
    upcoming,
    next_match,
    top_scorers,
    injuries: injury_list,
    generated_at: new Date().toISOString(),
  };
}

// ────────────────────────────────────────────
// OpenLigaDB
// ────────────────────────────────────────────
async function fetchFromOpenligaDB(shortcut: string, club: any) {
  async function og(path: string) {
    const r = await fetch(`${OPENLIGA_BASE}${path}`);
    if (!r.ok) throw new Error(`OpenLigaDB ${path}: ${r.status}`);
    return r.json();
  }

  const [tableRaw, allMatches] = await Promise.all([
    og(`/getbltable/${shortcut}/${CURRENT_SEASON}`),
    og(`/getmatchdata/${shortcut}/${CURRENT_SEASON}`),
  ]);

  const table = (tableRaw || []).map((t: any) => {
    const isUs = norm(t.teamName) === norm(club.name);
    return {
      rank: t.rank ?? 0,
      team_name: t.teamName,
      team_logo: t.teamIconUrl,
      is_us: isUs,
      matches: t.matches,
      won: t.won,
      draw: t.draw,
      lost: t.lost,
      goals_for: t.goals,
      goals_against: t.opponentGoals,
      goal_diff: t.goalDiff,
      points: t.points,
    };
  }).sort((a: any, b: any) => (a.rank ?? 0) - (b.rank ?? 0));

  const ourRank = table.find((t: any) => t.is_us);

  const mapMatch = (m: any) => {
    const isHome = norm(m.team1?.teamName) === norm(club.name);
    const isAway = norm(m.team2?.teamName) === norm(club.name);
    if (!isHome && !isAway) return null;
    const opp = isHome ? m.team2 : m.team1;
    const finalRes = m.matchResults?.find((r: any) => r.resultTypeID === 2) ?? m.matchResults?.[0];
    const ourGoals = isHome ? finalRes?.pointsTeam1 : finalRes?.pointsTeam2;
    const theirGoals = isHome ? finalRes?.pointsTeam2 : finalRes?.pointsTeam1;
    return {
      fixture_id: m.matchID,
      date: m.matchDateTimeUTC,
      is_home: isHome,
      opponent: opp?.teamName,
      opponent_logo: opp?.teamIconUrl,
      our_goals: ourGoals ?? null,
      their_goals: theirGoals ?? null,
      is_finished: m.matchIsFinished,
      matchday: m.group?.groupOrderID,
      result:
        ourGoals == null || theirGoals == null
          ? null
          : ourGoals > theirGoals ? "W" : ourGoals === theirGoals ? "D" : "L",
    };
  };

  const ourMatches = (allMatches || []).map(mapMatch).filter(Boolean);
  const finished = ourMatches.filter((m: any) => m.is_finished);
  const upcoming = ourMatches.filter((m: any) => !m.is_finished);
  const last_results = finished.slice(-5);
  const next_match = upcoming[0] ?? null;

  return {
    club,
    season: CURRENT_SEASON,
    league: shortcut,
    standings: table,
    our_rank: ourRank,
    last_results,
    upcoming: upcoming.slice(0, 5),
    next_match,
    top_scorers: [],
    injuries: [],
    generated_at: new Date().toISOString(),
  };
}

function norm(s?: string | null) {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ────────────────────────────────────────────
// Own history fallback
// ────────────────────────────────────────────
async function fetchFromOwnHistory(supabase: any, club: any) {
  const { data: matches } = await supabase
    .from("matches")
    .select("id, date, kickoff, home_club_id, away_club_name, home_score, away_score, status")
    .eq("home_club_id", club.id)
    .order("date", { ascending: false })
    .limit(20);

  const list = matches ?? [];
  const finished = list.filter((m: any) => m.home_score != null && m.away_score != null);
  const upcoming = list
    .filter((m: any) => m.home_score == null)
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const last_results = finished.slice(0, 5).map((m: any) => ({
    fixture_id: m.id,
    date: m.date,
    is_home: true,
    opponent: m.away_club_name,
    our_goals: m.home_score,
    their_goals: m.away_score,
    result: m.home_score > m.away_score ? "W" : m.home_score === m.away_score ? "D" : "L",
  }));

  const next_match = upcoming[0]
    ? {
        fixture_id: upcoming[0].id,
        date: upcoming[0].date,
        is_home: true,
        opponent: upcoming[0].away_club_name,
      }
    : null;

  // Simple form-based pseudo "rank"
  const wins = finished.filter((m: any) => m.home_score > m.away_score).length;
  const draws = finished.filter((m: any) => m.home_score === m.away_score).length;
  const losses = finished.length - wins - draws;
  const goalsFor = finished.reduce((s: number, m: any) => s + (m.home_score ?? 0), 0);
  const goalsAgainst = finished.reduce((s: number, m: any) => s + (m.away_score ?? 0), 0);

  return {
    club,
    season: CURRENT_SEASON,
    standings: [],
    our_rank: {
      rank: null,
      team_name: club.name,
      matches: finished.length,
      won: wins,
      draw: draws,
      lost: losses,
      goals_for: goalsFor,
      goals_against: goalsAgainst,
      goal_diff: goalsFor - goalsAgainst,
      points: wins * 3 + draws,
      is_us: true,
    },
    last_results,
    upcoming: upcoming.slice(0, 5).map((m: any) => ({
      fixture_id: m.id,
      date: m.date,
      is_home: true,
      opponent: m.away_club_name,
    })),
    next_match,
    top_scorers: [],
    injuries: [],
    note: "Keine externe Liga-API verbunden. Daten basieren auf eigener Match-Historie.",
    generated_at: new Date().toISOString(),
  };
}

// ────────────────────────────────────────────
// fussball.de Scraping via Firecrawl + Gemini extraction
// ────────────────────────────────────────────
async function fetchFromFussballDe(firecrawlKey: string, club: any, cfg: any) {
  const baseUrl = cfg.fussball_de_url
    || `https://www.fussball.de/spieltag/-/staffel/${cfg.fussball_de_staffel_id}`;

  // Derive table URL (replace /spieltag/ -> /spielplan/ for full schedule when not present)
  const scheduleUrl = baseUrl.replace("/spieltag/", "/spielplan/");

  // 1. Scrape table + spieltag page (markdown is enough — Gemini parses)
  const [tablePage, schedulePage] = await Promise.all([
    firecrawlScrape(firecrawlKey, baseUrl),
    firecrawlScrape(firecrawlKey, scheduleUrl).catch(() => null),
  ]);

  const combinedMd = [
    tablePage?.markdown ?? "",
    schedulePage?.markdown ?? "",
  ].join("\n\n---\n\n").slice(0, 50000); // safety limit

  if (!combinedMd.trim()) throw new Error("fussball.de returned empty content");

  // 2. Use Gemini to extract structured data
  const LOVABLE_AI_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_AI_KEY) throw new Error("LOVABLE_API_KEY missing for AI extraction");

  const prompt = `Extrahiere aus dem fussball.de-Markdown unten die Tabelle und den Spielplan. Eigenes Team: "${club.name}".

Liefere VALID JSON in genau diesem Schema (keine Erklärungen, kein Markdown):
{
  "standings": [{"rank": 1, "team_name": "...", "matches": 10, "won": 7, "draw": 2, "lost": 1, "goals_for": 25, "goals_against": 8, "goal_diff": 17, "points": 23}],
  "last_results": [{"date": "2026-03-01", "is_home": true, "opponent": "...", "our_goals": 2, "their_goals": 1, "result": "W", "matchday": 18}],
  "upcoming": [{"date": "2026-03-08", "is_home": false, "opponent": "...", "matchday": 19}]
}

Markiere unser Team in standings durch Vergleich mit "${club.name}" (case-insensitive, ignoriere Sonderzeichen). Maximal 5 last_results und 5 upcoming.

MARKDOWN:
${combinedMd}`;

  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_AI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  if (!aiResp.ok) throw new Error(`AI extraction failed: ${aiResp.status}`);
  const aiData = await aiResp.json();
  const content = aiData?.choices?.[0]?.message?.content ?? "{}";
  const extracted = JSON.parse(content);

  // Mark our team in standings
  const norm = (s: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ourNorm = norm(club.name);
  const standings = (extracted.standings ?? []).map((row: any) => ({
    ...row,
    is_us: norm(row.team_name).includes(ourNorm) || ourNorm.includes(norm(row.team_name)),
  }));
  const our_rank = standings.find((s: any) => s.is_us) ?? null;
  const upcoming = extracted.upcoming ?? [];

  return {
    club,
    season: CURRENT_SEASON,
    standings,
    our_rank,
    last_results: extracted.last_results ?? [],
    upcoming,
    next_match: upcoming[0] ?? null,
    top_scorers: [],
    injuries: [],
    source_url: baseUrl,
    generated_at: new Date().toISOString(),
  };
}

async function firecrawlScrape(apiKey: string, url: string) {
  const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
      waitFor: 2500,
    }),
  });
  if (!r.ok) throw new Error(`Firecrawl ${r.status}: ${await r.text()}`);
  const data = await r.json();
  // v2 may return { data: { markdown } } or top-level markdown
  return data?.data ?? data;
}

// ────────────────────────────────────────────
// Vereinsseite News Scraping
// ────────────────────────────────────────────
async function scrapeClubNews(firecrawlKey: string, url: string) {
  try {
    const page = await firecrawlScrape(firecrawlKey, url);
    const md = (page?.markdown ?? "").slice(0, 30000);
    if (!md.trim()) return [];

    const LOVABLE_AI_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_AI_KEY) return [];

    const prompt = `Extrahiere die letzten 5 News-Einträge / Spielberichte / Ankündigungen aus dem Markdown.
Liefere VALID JSON: {"news": [{"title": "...", "date": "YYYY-MM-DD oder null", "summary": "max 2 Sätze", "url": "absolute URL falls erkennbar, sonst null"}]}.
Keine Werbung, keine Spielerkader-Listen, keine Navigationselemente.

MARKDOWN:
${md}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_AI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!aiResp.ok) return [];
    const aiData = await aiResp.json();
    const parsed = JSON.parse(aiData?.choices?.[0]?.message?.content ?? "{}");
    return Array.isArray(parsed.news) ? parsed.news.slice(0, 5) : [];
  } catch (e) {
    console.warn("scrapeClubNews error:", e);
    return [];
  }
}
