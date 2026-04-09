import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
    const { match_id, report_type, opponentName, clubName } = body;

    if (!match_id) {
      return new Response(JSON.stringify({ error: "match_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load match data
    const { data: match } = await supabase
      .from("matches")
      .select("*, fields(name), home_club:clubs!matches_home_club_id_fkey(name, logo_url)")
      .eq("id", match_id)
      .single();

    // Load all data in parallel
    const [sectionsRes, trainingRecsRes, matchEventsRes, teamStatsRes, homePlayerStatsRes, awayPlayerStatsRes, lineupsRes] = await Promise.all([
      supabase.from("report_sections").select("*").eq("match_id", match_id).order("sort_order"),
      supabase.from("training_recommendations").select("*").eq("match_id", match_id).order("priority"),
      supabase.from("match_events").select("*").eq("match_id", match_id).order("minute"),
      supabase.from("team_match_stats").select("*").eq("match_id", match_id),
      supabase.from("player_match_stats").select("*, players(name, number, position)").eq("match_id", match_id).eq("team", "home").order("rating", { ascending: false }),
      supabase.from("player_match_stats").select("*, players(name, number, position)").eq("match_id", match_id).eq("team", "away").order("rating", { ascending: false }),
      supabase.from("match_lineups").select("*").eq("match_id", match_id).order("team").order("starting", { ascending: false }),
    ]);

    const sections = sectionsRes.data;
    const trainingRecs = trainingRecsRes.data;
    const matchEvents = matchEventsRes.data;
    const teamStats = teamStatsRes.data;
    const playerStats = homePlayerStatsRes.data;
    const awayPlayerStats = awayPlayerStatsRes.data;
    const lineups = lineupsRes.data;

    // Load match preparation if needed
    let prepData = null;
    if (report_type === "match_prep" || report_type === "halftime_tactics") {
      const oppName = opponentName || match?.away_club_name;
      if (oppName && match?.home_club_id) {
        const { data: prep } = await supabase
          .from("match_preparations")
          .select("*")
          .eq("club_id", match.home_club_id)
          .eq("opponent_name", oppName)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        prepData = prep;
      }
    }

    const parseSection = (type: string) => {
      const s = (sections ?? []).find((s: any) => s.section_type === type);
      if (!s) return null;
      try { return JSON.parse(s.content); } catch { return s.content; }
    };

    const homeTeam = clubName || match?.home_club?.name || "Heim";
    const awayTeam = match?.away_club_name || "Gegner";
    const matchDate = match?.date ? new Date(match.date).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";
    const homeScore = match?.home_score;
    const awayScore = match?.away_score;
    const scoreDisplay = homeScore != null && awayScore != null ? `${homeScore} : ${awayScore}` : "– : –";

    const formatPlayerStats = (stats: any[]) => (stats ?? []).map((ps: any) => ({
      name: ps.players?.name ?? "Unbekannt",
      number: ps.players?.number,
      position: ps.players?.position,
      rating: ps.rating,
      distance_km: ps.distance_km,
      goals: ps.goals,
      assists: ps.assists,
      passes_completed: ps.passes_completed,
      passes_total: ps.passes_total,
      duels_won: ps.duels_won,
      duels_total: ps.duels_total,
      sprint_count: ps.sprint_count,
      minutes_played: ps.minutes_played,
      top_speed_kmh: ps.top_speed_kmh,
      shots_total: ps.shots_total,
      shots_on_target: ps.shots_on_target,
      tackles: ps.tackles,
      interceptions: ps.interceptions,
      yellow_cards: ps.yellow_cards,
      red_cards: ps.red_cards,
    }));

    const formatLineups = (team: string) => (lineups ?? []).filter((l: any) => l.team === team).map((l: any) => ({
      name: l.player_name,
      number: l.shirt_number,
      starting: l.starting,
      subbed_in_min: l.subbed_in_min,
      subbed_out_min: l.subbed_out_min,
    }));

    // Build context for AI
    const dataContext = {
      match: { homeTeam, awayTeam, date: matchDate, kickoff: match?.kickoff, status: match?.status, score: scoreDisplay, homeScore, awayScore, homeFormation: match?.home_formation, awayFormation: match?.away_formation },
      homeLineup: formatLineups("home"),
      awayLineup: formatLineups("away"),
      matchRating: parseSection("match_rating"),
      tacticalGrades: parseSection("tactical_grades"),
      momentum: parseSection("momentum"),
      summary: parseSection("summary"),
      riskMatrix: parseSection("risk_matrix"),
      playerSpotlight: parseSection("player_spotlight"),
      opponentDna: parseSection("opponent_dna"),
      nextMatchActions: parseSection("next_match_actions"),
      coaching: parseSection("coaching"),
      trainingMicroCycle: parseSection("training_micro_cycle"),
      insights: (sections ?? []).filter((s: any) => s.section_type === "insight").map((s: any) => {
        try { return { title: s.title, ...JSON.parse(s.content) }; } catch { return { title: s.title, description: s.content }; }
      }),
      trainingRecommendations: trainingRecs ?? [],
      matchEvents: (matchEvents ?? []).map((e: any) => `Min ${e.minute}: ${e.event_type} (${e.team})${e.player_name ? ` — ${e.player_name}` : ""}`),
      teamStats: teamStats ?? [],
      homePlayerStats: formatPlayerStats(playerStats ?? []),
      awayPlayerStats: formatPlayerStats(awayPlayerStats ?? []),
      preparation: prepData?.preparation_data ?? null,
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI gateway not configured");

    const reportTypeLabels: Record<string, string> = {
      full_report: "Vollständiger Spielbericht",
      training_plan: "Trainingsplan",
      match_prep: "Spielvorbereitung & Gegner-Briefing",
      halftime_tactics: "Halbzeit-Taktik & Anpassungen",
    };

    const systemPrompt = `Du bist ein Elite-Fußball-Analyst. Erstelle ein druckfertiges HTML-Dokument (<!DOCTYPE html> bis </html>) für: "${reportTypeLabels[report_type] ?? report_type}".

LAYOUT: A4, @page{size:A4;margin:18mm}, font-family:'Segoe UI',system-ui,sans-serif, page-break-before:always vor Hauptsektionen.
FARBEN: Heim #2563eb, Gegner #dc2626. Tabellen: alternating rows #f8fafc/weiß.
GRAFIKEN: Nutze CSS-basierte Balkendiagramme für Statistik-Vergleiche, farbige Badges für Noten (≥8 grün, ≥6.5 blau, ≥5 orange, <5 rot).
Footer: "Generiert mit FieldIQ • ${matchDate}". Keine externen Ressourcen.

${report_type === "full_report" ? `SEKTIONEN: 1.Deckblatt(Verein,Ergebnis "${scoreDisplay}" groß,Gegner,Datum) 2.Management Summary(Ergebnis,3 Takeaways,Gesamtnote) 3.Aufstellung(Formation+Spielernamen) 4.Team-Statistiken(Balkenvergleich:Ballbesitz,Pässe,Schüsse,Zweikämpfe) 5.Taktische Bewertung(6 Dimensionen A-F) 6.Event-Chronik(Timeline) 7.Stärken/Schwächen Heim 8.Stärken/Schwächen Gegner 9.Coaching-Insights 10.Spieler-Bewertungen Heim(Tabelle) 11.Spieler-Bewertungen Gegner 12.Trainingsempfehlungen 13.Fazit+Notizseite` :
report_type === "training_plan" ? `SEKTIONEN: 1.Deckblatt 2.Schwächen-Übersicht 3.Mikrozyklus(3 Sessions) 4.Trainingsempfehlungen 5.Notizseite` :
report_type === "match_prep" ? `SEKTIONEN: 1.Deckblatt "${homeTeam} vs ${awayTeam}" 2.Gegner-Profil 3.Formation+Begründung 4.Taktische Schwerpunkte 5.Do/Don't Liste 6.Notizseite` :
`SEKTIONEN: 1.Übersicht gut/schlecht 2.Formations-Empfehlung 2.HZ 3.Wechsel-Vorschläge 4.Taktische Anpassungen 5.Notizbereich`}

SPRACHE: Deutsch. Gib NUR HTML zurück, kein Markdown.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Erstelle den Report. Daten:\n${JSON.stringify(dataContext)}` },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI PDF error:", aiResponse.status, errText);
      throw new Error(aiResponse.status === 429 ? "Rate limit — bitte später erneut versuchen" : aiResponse.status === 402 ? "Credits aufgebraucht — bitte Guthaben aufladen" : `AI-Fehler: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    let html = aiResult.choices?.[0]?.message?.content ?? "";

    // Strip markdown code fences if present
    html = html.replace(/^```html?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    if (!html.includes("<html") && !html.includes("<!DOCTYPE")) {
      throw new Error("AI hat kein gültiges HTML generiert");
    }

    return new Response(JSON.stringify({ html }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-pdf-report error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
