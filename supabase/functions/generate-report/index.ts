import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REPORT_PROMPTS: Record<string, string> = {
  prematch: `Du erstellst einen professionellen Vorbericht für Trainerstab, Verein, Presse oder Social-Ausspielung.

Pflichtstruktur:
1. **Ausgangslage** – Form, Tabellen-/Leistungskontext, Erwartung an das Spiel
2. **Spielcharakteristik** – Was ist anhand der vorliegenden Daten über Stil, Rhythmus, Intensität und Schwerpunktzonen zu erwarten?
3. **Schlüsselspieler & Schlüsselräume** – Wer oder welche Zonen werden spielentscheidend?
4. **Taktischer Matchplan** – Wie sollte das Heimteam das Spiel anlegen?
5. **Risiken & Hebel** – Wo liegen die größten Chancen und Gefahren?
6. **Schlussbild** – saubere Prognose ohne Übertreibung`,
  halftime: `Du erstellst einen Halbzeitbericht für den Trainerstab.

Pflichtstruktur:
1. **Kurzfazit zur ersten Hälfte**
2. **Was funktioniert** – mit Datenbelegen
3. **Was nicht greift** – mit klarer Ursache-Wirkung
4. **Datenqualität / Vorsichtspunkte**
5. **3 konkrete Anpassungen für Halbzeit 2** – personell, taktisch, gegen den Ball / mit dem Ball`,
  match: `Du erstellst einen professionellen Nachbericht nach dem Spiel.

Pflichtstruktur:
1. **Kurzfazit**
2. **Spielverlauf & Wendepunkte**
3. **Taktische Analyse** – Aufbau, Pressing, Restverteidigung, Umschalten, Chancenqualität
4. **Belastbare Spielerbewertungen** – nur mit konkreten Werten begründen
5. **Datenqualität / Ausreißer**
6. **Konsequenzen für Training und nächstes Spiel**`,
  training: `Du erstellst einen hochwertigen Trainings- und Maßnahmenbericht auf Basis der Spieldaten.

Pflichtstruktur:
1. **Leistungsdiagnose**
2. **3 priorisierte Entwicklungsfelder**
3. **Wochentrainingsplan (Mo-Fr)** – Ziel, Inhalt, Intensität, Coachingpunkte
4. **Individuelle Maßnahmen für Schlüsselspieler**
5. **Belastungssteuerung & Regeneration**`,
};

const LENGTH_INSTRUCTIONS: Record<string, string> = {
  short: "Halte den Bericht kompakt und pointiert bei ca. 300–450 Wörtern.",
  medium: "Erstelle einen substanziellen Bericht mit ca. 700–1000 Wörtern.",
  long: "Erstelle eine tiefgehende Analyse mit ca. 1200–1600 Wörtern und klaren Ableitungen.",
};

const STYLE_INSTRUCTIONS: Record<string, string> = {
  professional: "Schreibe analytisch, nüchtern, fachlich präzise – wie ein Performance-Analyst für den Trainerstab.",
  journalistic: "Schreibe im hochwertigen Sportjournalismus: klar, dramaturgisch sauber, aber ohne Pathos und ohne Übertreibung.",
  coaching: "Schreibe trainernah, direkt und handlungsorientiert. Fokus auf Maßnahmen und Korrekturen.",
  social: "Schreibe als Social-Media-Set mit 3 klar getrennten Modulen: 1) kurzer Hauptpost, 2) drei Bullet-Highlights, 3) passende Hashtags. Prägnant, professionell, nicht platt.",
  newspaper: "Schreibe wie ein seriöser Zeitungsbericht mit starkem Lead, dann Einordnung und Datenbelegen in sauberer Nachrichtenlogik.",
  press: "Schreibe als Pressetext für Medien und Vereinskommunikation: zitierfähig, professionell, reputationssicher, ohne interne Detailkritik zu entblößen.",
  club: "Schreibe als Vereinsbericht für Website, Newsletter und Mitglieder: professionell, nahbar, informativ und mit klarer sportlicher Einordnung.",
};

const GENERAL_RULES = `Allgemeine Regeln:
- Antworte immer auf Deutsch und formatiere mit Markdown.
- Keine Begrüßung, kein Smalltalk, keine floskelhaften Sätze.
- Erfinde keine Fakten.
- Wenn Datenlage dünn oder inkonsistent ist, benenne das explizit.
- Top-Speed-Werte deutlich über ca. 45 km/h im Fußball als wahrscheinlichen Tracking-Ausreißer markieren.
- Aus sehr kleinen Stichproben keine großen taktischen Wahrheiten ableiten.
- Nutze konkrete Zahlen, Vergleiche und Ursache-Wirkung statt generischer Aussagen.
- Wenn Stil = social, press, newspaper oder club: passe Tonalität und Struktur exakt an diesen Kanal an.`;

function fmt(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "?";
  return value.toFixed(digits);
}

function buildQualityNotes(playerStats: any[], teamStats: any[]) {
  const notes: string[] = [];
  const implausiblePlayers = playerStats.filter((entry) => typeof entry.top_speed_kmh === "number" && entry.top_speed_kmh > 45);
  if (implausiblePlayers.length > 0) {
    notes.push(`Unplausible Top-Speed-Werte entdeckt (${implausiblePlayers.map((entry) => `${fmt(entry.top_speed_kmh)} km/h`).join(", ")}); diese Werte nur als möglichen Tracking-Ausreißer interpretieren.`);
  }
  const lowMinutes = playerStats.filter((entry) => typeof entry.minutes_played === "number" && entry.minutes_played <= 5).length;
  if (lowMinutes > 0) {
    notes.push(`${lowMinutes} Spieler-Datensätze basieren auf sehr geringer Einsatzzeit (≤ 5 Min.) und sind nur eingeschränkt vergleichbar.`);
  }
  const lowTeamDistance = teamStats.some((entry) => typeof entry.total_distance_km === "number" && entry.total_distance_km < 1);
  if (lowTeamDistance) {
    notes.push("Mindestens ein Teamwert weist eine extrem niedrige Gesamtdistanz auf; das spricht eher für unvollständiges Tracking als für eine belastbare Physis-Bewertung.");
  }
  return notes;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const { matchId, reportType, length, style } = await req.json();

    if (!matchId || !reportType) {
      return new Response(JSON.stringify({ error: "matchId and reportType required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const { count } = await supabase
      .from("report_generations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", `${today}T00:00:00Z`);

    if ((count ?? 0) >= 10) {
      return new Response(JSON.stringify({ error: "Tageslimit erreicht (max. 10 Berichte/Tag)." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase.from("profiles").select("club_id").eq("user_id", userId).single();
    const clubId = profile?.club_id;

    const { data: match } = await supabase.from("matches").select("*, fields(name)").eq("id", matchId).single();
    if (!match) {
      return new Response(JSON.stringify({ error: "Spiel nicht gefunden" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recentMatchesPromise = clubId
      ? supabase
          .from("matches")
          .select("id, date, away_club_name, status, home_formation, away_formation")
          .eq("home_club_id", clubId)
          .order("date", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] as any[] });

    const [clubRes, lineupsRes, playerStatsRes, teamStatsRes, apiStatsRes, apiPlayerStatsRes, eventsRes, recentMatchesRes] = await Promise.all([
      clubId ? supabase.from("clubs").select("name, league, city").eq("id", clubId).single() : Promise.resolve({ data: null as any }),
      supabase.from("match_lineups").select("team, starting, shirt_number, player_name, players(name, number, position)").eq("match_id", matchId),
      supabase
        .from("player_match_stats")
        .select("*, players(name, number, position)")
        .eq("match_id", matchId),
      supabase.from("team_match_stats").select("*").eq("match_id", matchId),
      supabase.from("api_football_match_stats").select("*").eq("match_id", matchId),
      supabase.from("api_football_player_stats").select("player_name, minutes_played, rating, goals, assists, shots_total, shots_on_goal, passes_total, passes_accuracy, tackles, duels_won, duels_total").eq("club_id", clubId ?? "00000000-0000-0000-0000-000000000000"),
      supabase.from("match_events").select("minute, event_type, team, player_name, related_player_name, notes").eq("match_id", matchId).order("minute"),
      recentMatchesPromise,
    ]);

    const homeLineups = (lineupsRes.data || []).filter((entry: any) => entry.team === "home");
    const awayLineups = (lineupsRes.data || []).filter((entry: any) => entry.team === "away");
    const playerStats = playerStatsRes.data || [];
    const teamStats = teamStatsRes.data || [];
    const apiStats = apiStatsRes.data?.[0];
    const events = eventsRes.data || [];
    const qualityNotes = buildQualityNotes(playerStats, teamStats);
    const homeStats = teamStats.find((entry: any) => entry.team === "home");
    const awayStats = teamStats.find((entry: any) => entry.team === "away");

    const recentMatches = recentMatchesRes.data || [];
    let recentTrendBlock = "Keine historischen Vergleichsdaten vorhanden.";
    if (recentMatches.length > 0) {
      const recentIds = recentMatches.map((entry: any) => entry.id);
      const recentTeamStatsRes = await supabase
        .from("team_match_stats")
        .select("match_id, team, total_distance_km, top_speed_kmh, possession_pct, avg_distance_km")
        .in("match_id", recentIds);

      recentTrendBlock = recentMatches
        .map((recent: any) => {
          const current = (recentTeamStatsRes.data || []).filter((entry: any) => entry.match_id === recent.id);
          return `- ${recent.date} vs ${recent.away_club_name || "Unbekannt"} [${recent.status}] ${current.map((entry: any) => `${entry.team}: ${fmt(entry.total_distance_km)} km / Ballbesitz ${fmt(entry.possession_pct, 0)}% / Top ${fmt(entry.top_speed_kmh)} km/h`).join(" | ")}`;
        })
        .join("\n");
    }

    const context = `--- SPIELKONTEXT ---
Verein: ${clubRes.data?.name || "Unbekannt"}
Ort / Stadt: ${clubRes.data?.city || "Nicht angegeben"}
Liga: ${clubRes.data?.league || "Nicht angegeben"}
Datum: ${match.date}${match.kickoff ? ` · Anstoß ${match.kickoff}` : ""}
Spielort: ${(match.fields as any)?.name || "Unbekannt"}
Gegner: ${match.away_club_name || "Unbekannt"}
Status: ${match.status}
Heim-Formation: ${match.home_formation || "Nicht festgelegt"}
Gast-Formation: ${match.away_formation || "Nicht festgelegt"}

HEIMKADER:
${homeLineups.map((entry: any) => `- #${entry.shirt_number ?? entry.players?.number ?? "?"} ${entry.players?.name ?? entry.player_name ?? "?"} (${entry.players?.position ?? "?"}) ${entry.starting ? "Startelf" : "Bank"}`).join("\n") || "Keine Heimkaderdaten"}

GASTKADER:
${awayLineups.map((entry: any) => `- #${entry.shirt_number ?? "?"} ${entry.player_name ?? "?"} ${entry.starting ? "Startelf" : "Bank"}`).join("\n") || "Keine Gastkaderdaten"}

TEAMSTATISTIKEN:
${homeStats ? `- Heim: ${fmt(homeStats.total_distance_km)} km gesamt, Ø ${fmt(homeStats.avg_distance_km)} km, Top ${fmt(homeStats.top_speed_kmh)} km/h, Ballbesitz ${fmt(homeStats.possession_pct, 0)}%` : "- Heim: keine Teamwerte"}
${awayStats ? `- Gast: ${fmt(awayStats.total_distance_km)} km gesamt, Ø ${fmt(awayStats.avg_distance_km)} km, Top ${fmt(awayStats.top_speed_kmh)} km/h, Ballbesitz ${fmt(awayStats.possession_pct, 0)}%` : "- Gast: keine Teamwerte"}

SPIELERSTATISTIKEN:
${playerStats
  .map((entry: any) => `- ${entry.team}: #${entry.players?.number ?? "?"} ${entry.players?.name ?? "?"} (${entry.players?.position ?? "?"}) · ${fmt(entry.distance_km)} km · Top ${fmt(entry.top_speed_kmh)} km/h · Ø ${fmt(entry.avg_speed_kmh)} km/h · ${entry.sprint_count ?? 0} Sprints · ${entry.minutes_played ?? "?"} Min · Pässe ${entry.passes_completed ?? 0}/${entry.passes_total ?? 0} · Passquote ${fmt(entry.pass_accuracy, 0)}% · Zweikämpfe ${entry.duels_won ?? 0}/${entry.duels_total ?? 0} · Tackles ${entry.tackles ?? 0} · Interceptions ${entry.interceptions ?? 0} · Tore ${entry.goals ?? 0} · Assists ${entry.assists ?? 0} · Rating ${entry.rating ?? "?"}`)
  .join("\n") || "Keine Spielerstatistiken"}

EREIGNISSE:
${events.map((event: any) => `- ${event.minute}'. ${event.team}: ${event.event_type}${event.player_name ? ` · ${event.player_name}` : ""}${event.related_player_name ? ` / ${event.related_player_name}` : ""}${event.notes ? ` · ${event.notes}` : ""}`).join("\n") || "Keine Ereignisse"}

${apiStats ? `API-FOOTBALL TEAMWERTE:
- Ergebnis: ${apiStats.home_goals ?? "?"}:${apiStats.away_goals ?? "?"}
- Schüsse: ${apiStats.shots_home ?? "?"} (${apiStats.shots_on_target_home ?? "?"} aufs Tor) vs ${apiStats.shots_away ?? "?"} (${apiStats.shots_on_target_away ?? "?"} aufs Tor)
- Ballbesitz: ${apiStats.possession_home ?? "?"}% vs ${apiStats.possession_away ?? "?"}%
- Pässe: ${apiStats.passes_home ?? "?"} (${apiStats.pass_accuracy_home ?? "?"}%) vs ${apiStats.passes_away ?? "?"} (${apiStats.pass_accuracy_away ?? "?"}%)
- Ecken: ${apiStats.corners_home ?? "?"} vs ${apiStats.corners_away ?? "?"}
- Fouls: ${apiStats.fouls_home ?? "?"} vs ${apiStats.fouls_away ?? "?"}
- Karten: Gelb ${apiStats.yellow_cards_home ?? "?"}/${apiStats.yellow_cards_away ?? "?"}, Rot ${apiStats.red_cards_home ?? "?"}/${apiStats.red_cards_away ?? "?"}` : "API-FOOTBALL TEAMWERTE: nicht vorhanden"}

API-FOOTBALL SPIELERWERTE (Fallback / Kontext):
${(apiPlayerStatsRes.data || [])
  .slice(0, 12)
  .map((entry: any) => `- ${entry.player_name || "Unbekannt"}: ${entry.minutes_played ?? "?"} Min, Rating ${entry.rating ?? "?"}, Tore ${entry.goals ?? 0}, Assists ${entry.assists ?? 0}, Schüsse ${entry.shots_on_goal ?? 0}/${entry.shots_total ?? 0}, Pässe ${entry.passes_total ?? 0}, Passquote ${entry.passes_accuracy ?? "?"}%, Zweikämpfe ${entry.duels_won ?? 0}/${entry.duels_total ?? 0}, Tackles ${entry.tackles ?? 0}`)
  .join("\n") || "Keine API-Spielerwerte geladen"}

TREND LETZTE SPIELE:
${recentTrendBlock}

DATENQUALITÄT:
${qualityNotes.length > 0 ? qualityNotes.map((note) => `- ${note}`).join("\n") : "- Keine offensichtlichen Datenwarnungen erkannt."}
--- ENDE SPIELKONTEXT ---`;

    const promptKey = reportType in REPORT_PROMPTS ? reportType : "match";
    const systemPrompt = `Du bist der leitende Match-Analyst und Kommunikationsredakteur von FieldIQ.
${GENERAL_RULES}
${REPORT_PROMPTS[promptKey]}
${LENGTH_INSTRUCTIONS[length] || LENGTH_INSTRUCTIONS.medium}
${STYLE_INSTRUCTIONS[style] || STYLE_INSTRUCTIONS.professional}

${context}`;

    const userMessages: Record<string, string> = {
      prematch: "Erstelle jetzt einen hochwertigen Vorbericht auf Basis der vorliegenden Daten.",
      halftime: "Erstelle jetzt einen hochwertigen Halbzeitbericht auf Basis der vorliegenden Daten.",
      match: "Erstelle jetzt einen hochwertigen Nachbericht auf Basis der vorliegenden Daten.",
      training: "Erstelle jetzt einen hochwertigen Trainings- und Maßnahmenbericht auf Basis der vorliegenden Daten.",
    };

    await supabase.from("report_generations").insert({
      user_id: userId,
      match_id: matchId,
      club_id: clubId,
      report_type: `${reportType}:${style || "professional"}`,
    });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessages[promptKey] || userMessages.match },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Zu viele Anfragen. Bitte warte kurz." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "KI-Credits aufgebraucht." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "KI-Dienst nicht verfügbar" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});