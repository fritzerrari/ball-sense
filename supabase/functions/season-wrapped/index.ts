// Season Wrapped — aggregiert Saison-Highlights eines Clubs (intern, kein Public-Sharing).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Nicht eingeloggt" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: profile } = await supabase.from("profiles").select("club_id").eq("user_id", user.id).maybeSingle();
    const clubId = profile?.club_id;
    if (!clubId) {
      return new Response(JSON.stringify({ error: "Kein Club" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { from, to } = await req.json().catch(() => ({}));
    const fromDate = from ?? new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const toDate = to ?? new Date().toISOString().slice(0, 10);

    const [matchesRes, statsRes, eventsRes, playersRes] = await Promise.all([
      supabase.from("matches").select("id, date, home_score, away_score, status, away_club_name").eq("home_club_id", clubId).eq("status", "done").gte("date", fromDate).lte("date", toDate).order("date"),
      supabase.from("player_match_stats").select("match_id, player_id, team, distance_km, top_speed_kmh, sprint_count, goals, assists, ball_recoveries, players(name, number)").eq("team", "home"),
      supabase.from("match_events").select("match_id, team, event_type, minute, player_name").in("event_type", ["goal", "own_goal", "yellow_card", "red_card"]),
      supabase.from("players").select("id, name, number").eq("club_id", clubId),
    ]);

    const matches = matchesRes.data ?? [];
    const matchIds = new Set(matches.map((m: { id: string }) => m.id));
    const stats = (statsRes.data ?? []).filter((s: { match_id: string }) => matchIds.has(s.match_id));
    const events = (eventsRes.data ?? []).filter((e: { match_id: string }) => matchIds.has(e.match_id));

    // Aggregate
    const totalGames = matches.length;
    let wins = 0, draws = 0, losses = 0, gf = 0, ga = 0;
    for (const m of matches as Array<{ home_score: number | null; away_score: number | null }>) {
      const h = m.home_score ?? 0, a = m.away_score ?? 0;
      gf += h; ga += a;
      if (h > a) wins++; else if (h === a) draws++; else losses++;
    }

    type PlayerAgg = { player_id: string | null; name: string; number: number | null; km: number; sprints: number; topSpeed: number; goals: number; assists: number; recoveries: number; games: number };
    const playerMap = new Map<string, PlayerAgg>();
    for (const s of stats as Array<{ player_id: string | null; distance_km: number | null; top_speed_kmh: number | null; sprint_count: number | null; goals: number | null; assists: number | null; ball_recoveries: number | null; players?: { name?: string; number?: number } }>) {
      const key = s.player_id ?? "anon";
      const existing = playerMap.get(key) ?? { player_id: s.player_id, name: s.players?.name ?? "Anonym", number: s.players?.number ?? null, km: 0, sprints: 0, topSpeed: 0, goals: 0, assists: 0, recoveries: 0, games: 0 };
      existing.km += s.distance_km ?? 0;
      existing.sprints += s.sprint_count ?? 0;
      existing.topSpeed = Math.max(existing.topSpeed, s.top_speed_kmh ?? 0);
      existing.goals += s.goals ?? 0;
      existing.assists += s.assists ?? 0;
      existing.recoveries += s.ball_recoveries ?? 0;
      existing.games += 1;
      playerMap.set(key, existing);
    }

    // Goals from events (fallback for stats-loose matches)
    const goalsByPlayer = new Map<string, number>();
    for (const e of events as Array<{ event_type: string; team: string; player_name: string | null }>) {
      if (e.event_type === "goal" && e.team === "home" && e.player_name) {
        goalsByPlayer.set(e.player_name, (goalsByPlayer.get(e.player_name) ?? 0) + 1);
      }
    }

    const allPlayers = Array.from(playerMap.values());
    const topScorer = [...allPlayers].sort((a, b) => b.goals - a.goals)[0];
    const topRunner = [...allPlayers].sort((a, b) => b.km - a.km)[0];
    const topSprinter = [...allPlayers].sort((a, b) => b.topSpeed - a.topSpeed)[0];
    const topAssist = [...allPlayers].sort((a, b) => b.assists - a.assists)[0];
    const ironman = [...allPlayers].sort((a, b) => b.games - a.games)[0];

    // Best match (highest goal-diff win)
    const bestMatch = [...matches].sort((a: { home_score?: number | null; away_score?: number | null }, b: { home_score?: number | null; away_score?: number | null }) =>
      ((b.home_score ?? 0) - (b.away_score ?? 0)) - ((a.home_score ?? 0) - (a.away_score ?? 0))
    )[0];

    return new Response(JSON.stringify({
      from: fromDate, to: toDate,
      totals: { games: totalGames, wins, draws, losses, gf, ga, gd: gf - ga, points: wins * 3 + draws },
      top: {
        scorer: topScorer ? { name: topScorer.name, value: topScorer.goals, suffix: "Tore" } : null,
        runner: topRunner ? { name: topRunner.name, value: Number(topRunner.km.toFixed(1)), suffix: "km" } : null,
        sprinter: topSprinter ? { name: topSprinter.name, value: Number(topSprinter.topSpeed.toFixed(1)), suffix: "km/h" } : null,
        assist: topAssist ? { name: topAssist.name, value: topAssist.assists, suffix: "Assists" } : null,
        ironman: ironman ? { name: ironman.name, value: ironman.games, suffix: "Spiele" } : null,
      },
      best_match: bestMatch ? {
        date: (bestMatch as { date?: string }).date,
        opponent: (bestMatch as { away_club_name?: string }).away_club_name,
        score: `${(bestMatch as { home_score?: number }).home_score ?? 0}:${(bestMatch as { away_score?: number }).away_score ?? 0}`,
      } : null,
      form_strip: matches.slice(-10).map((m: { home_score: number | null; away_score: number | null; date: string }) => {
        const h = m.home_score ?? 0, a = m.away_score ?? 0;
        return { date: m.date, result: h > a ? "W" : h === a ? "D" : "L", score: `${h}:${a}` };
      }),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("season-wrapped error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
