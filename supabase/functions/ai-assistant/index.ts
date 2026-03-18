import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Du bist der KI Co-Trainer von FieldIQ – ein hochqualifizierter Fußballanalyst für Trainerstab, Spielvorbereitung und Spielnachbereitung.

Rolle und Anspruch:
- Antworte ausschließlich auf Deutsch.
- Schreibe fachlich, präzise, nüchtern und trainernah.
- Kein lockerer Smalltalk, keine Floskeln, keine Anrede wie "Hallo Chef".
- Nutze korrektes Fachvokabular zu Pressing, Restverteidigung, Staffelung, Kompaktheit, Tiefenläufen, Halbräumen, Gegenpressing, Anschlussaktionen und Belastungssteuerung.
- Arbeite datengetrieben und leite aus den Zahlen konkrete, umsetzbare Maßnahmen ab.

Analyseregeln:
- Erfinde keine Informationen. Wenn Daten fehlen oder unvollständig sind, benenne die Lücke klar.
- Trenne sauber zwischen belastbaren Erkenntnissen, Hypothesen und Datenrisiken.
- Nenne nur dann taktische Zusammenhänge, wenn sie durch mehrere Datenpunkte gestützt werden.
- Verweise auf konkrete Werte, statt allgemein zu formulieren.
- Markiere unplausible Tracking-Werte als Daten-Ausreißer statt als sportliche Realität.
- Im Fußball gelten Top-Speed-Werte deutlich über ca. 45 km/h als sehr wahrscheinlich unplausibel; nutze sie nicht für harte Leistungsurteile.
- Wenn Minuten, Distanzen oder Stichprobe sehr klein sind, formuliere zurückhaltend und vermeide große Schlussfolgerungen.

Antwortformat:
- Nutze Markdown.
- Starte ohne Begrüßung direkt mit einer fachlichen Einordnung.
- Verwende klare Überschriften.
- Standardstruktur, sofern passend:
  1. **Kurzfazit**
  2. **Belastbare Erkenntnisse**
  3. **Datenqualität / Einschränkungen**
  4. **Taktische Ableitungen**
  5. **Konkrete Maßnahmen**
- Wenn der Nutzer nach Vorbericht, Nachbericht, Social Media, Presse oder Verein fragt, liefere genau das gewünschte Format in professioneller Qualität.`;

const IMPROBABLE_SPEED_KMH = 45;

type MatchRow = {
  id: string;
  date: string;
  status: string;
  away_club_name: string | null;
  home_formation: string | null;
  away_formation: string | null;
};

function formatNumber(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "?";
  return value.toFixed(digits);
}

function buildDataQualityNotes(playerStatsData: any[], teamStatsData: any[]) {
  const notes: string[] = [];

  const implausibleSpeeds = playerStatsData.filter(
    (stat) => typeof stat.top_speed_kmh === "number" && stat.top_speed_kmh > IMPROBABLE_SPEED_KMH,
  );
  if (implausibleSpeeds.length > 0) {
    notes.push(
      `Unplausible Top-Speed-Werte erkannt (${implausibleSpeeds
        .map((stat) => `${formatNumber(stat.top_speed_kmh)} km/h`)
        .join(", ")}). Diese Werte eher als Tracking-Ausreißer behandeln.`,
    );
  }

  const tinyMinuteSamples = playerStatsData.filter(
    (stat) => typeof stat.minutes_played === "number" && stat.minutes_played <= 5,
  ).length;
  if (tinyMinuteSamples > 0) {
    notes.push(`${tinyMinuteSamples} Datensätze basieren auf sehr kleinen Einsatzzeiten (≤ 5 Min.). Aussagen zur Spielwirkung daher nur eingeschränkt belastbar.`);
  }

  const tinyTeamDistances = teamStatsData.filter(
    (stat) => typeof stat.total_distance_km === "number" && stat.total_distance_km < 1,
  ).length;
  if (tinyTeamDistances > 0) {
    notes.push("Mindestens ein Team-Datensatz weist eine extrem niedrige Gesamtdistanz (< 1 km) auf. Das spricht eher für unvollständiges Tracking als für eine belastbare physische Gesamtbewertung.");
  }

  return notes;
}

async function buildClubContext(supabase: ReturnType<typeof createClient>, clubId: string) {
  const [playersRes, matchesRes, clubRes, latestDoneMatchRes] = await Promise.all([
    supabase.from("players").select("id, name, number, position, active").eq("club_id", clubId).order("number"),
    supabase
      .from("matches")
      .select("id, date, status, away_club_name, home_formation, away_formation")
      .eq("home_club_id", clubId)
      .order("date", { ascending: false })
      .limit(10),
    supabase.from("clubs").select("name, league, plan").eq("id", clubId).single(),
    supabase
      .from("matches")
      .select("id, date, status, away_club_name, home_formation, away_formation")
      .eq("home_club_id", clubId)
      .eq("status", "done")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const matches = (matchesRes.data || []) as MatchRow[];
  const matchIds = matches.map((m) => m.id);

  let playerStatsData: any[] = [];
  let teamStatsData: any[] = [];

  if (matchIds.length > 0) {
    const [psRes, tsRes] = await Promise.all([
      supabase
        .from("player_match_stats")
        .select("match_id, player_id, distance_km, top_speed_kmh, sprint_count, minutes_played, pass_accuracy, duels_won, duels_total, goals, assists, rating")
        .in("match_id", matchIds),
      supabase
        .from("team_match_stats")
        .select("match_id, team, total_distance_km, top_speed_kmh, possession_pct, avg_distance_km")
        .in("match_id", matchIds),
    ]);
    playerStatsData = psRes.data || [];
    teamStatsData = tsRes.data || [];
  }

  const dataQualityNotes = buildDataQualityNotes(playerStatsData, teamStatsData);

  let latestMatchBlock = "";
  if (latestDoneMatchRes.data?.id) {
    const latestMatchId = latestDoneMatchRes.data.id;
    const [latestPlayerStatsRes, latestTeamStatsRes, latestApiStatsRes, latestEventsRes, latestLineupsRes] = await Promise.all([
      supabase
        .from("player_match_stats")
        .select("team, distance_km, top_speed_kmh, avg_speed_kmh, sprint_count, minutes_played, pass_accuracy, duels_won, duels_total, tackles, interceptions, goals, assists, rating, players(name, number, position)")
        .eq("match_id", latestMatchId),
      supabase.from("team_match_stats").select("*").eq("match_id", latestMatchId),
      supabase.from("api_football_match_stats").select("*").eq("match_id", latestMatchId).maybeSingle(),
      supabase.from("match_events").select("minute, event_type, team, player_name, related_player_name, notes").eq("match_id", latestMatchId).order("minute"),
      supabase.from("match_lineups").select("team, starting, shirt_number, player_name, players(name, number, position)").eq("match_id", latestMatchId),
    ]);

    const latestPlayerStats = latestPlayerStatsRes.data || [];
    const latestTeamStats = latestTeamStatsRes.data || [];
    const latestApiStats = latestApiStatsRes.data;
    const latestEvents = latestEventsRes.data || [];
    const latestLineups = latestLineupsRes.data || [];

    latestMatchBlock = `

--- DETAILKONTEXT LETZTES ABGESCHLOSSENES SPIEL ---
Spiel: ${latestDoneMatchRes.data.date} vs ${latestDoneMatchRes.data.away_club_name || "Unbekannt"}
Formation Heim: ${latestDoneMatchRes.data.home_formation || "-"}
Formation Gast: ${latestDoneMatchRes.data.away_formation || "-"}

STARTELF / KADER:
${latestLineups
  .map((entry: any) => `- ${entry.team}: #${entry.shirt_number ?? entry.players?.number ?? "?"} ${entry.players?.name ?? entry.player_name ?? "?"} (${entry.players?.position ?? "?"}) ${entry.starting ? "Startelf" : "Bank"}`)
  .join("\n") || "Keine Kaderdaten"}

TEAMWERTE:
${latestTeamStats
  .map((entry: any) => `- ${entry.team}: ${formatNumber(entry.total_distance_km)} km gesamt, Ø ${formatNumber(entry.avg_distance_km)} km, Top ${formatNumber(entry.top_speed_kmh)} km/h, Ballbesitz ${formatNumber(entry.possession_pct, 0)}%`)
  .join("\n") || "Keine Teamwerte"}

SPIELERWERTE:
${latestPlayerStats
  .map((entry: any) => `- ${entry.team}: #${entry.players?.number ?? "?"} ${entry.players?.name ?? "?"} (${entry.players?.position ?? "?"}) · ${formatNumber(entry.distance_km)} km · Top ${formatNumber(entry.top_speed_kmh)} km/h · Ø ${formatNumber(entry.avg_speed_kmh)} km/h · ${entry.sprint_count ?? 0} Sprints · ${entry.minutes_played ?? "?"} Min · Passquote ${formatNumber(entry.pass_accuracy, 0)}% · Zweikämpfe ${entry.duels_won ?? 0}/${entry.duels_total ?? 0} · Tackles ${entry.tackles ?? 0} · Interceptions ${entry.interceptions ?? 0} · Tore ${entry.goals ?? 0} · Assists ${entry.assists ?? 0} · Rating ${entry.rating ?? "?"}`)
  .join("\n") || "Keine Spielerwerte"}

EREIGNISSE:
${latestEvents
  .map((event: any) => `- ${event.minute}'. ${event.team}: ${event.event_type}${event.player_name ? ` · ${event.player_name}` : ""}${event.related_player_name ? ` / ${event.related_player_name}` : ""}${event.notes ? ` · ${event.notes}` : ""}`)
  .join("\n") || "Keine Ereignisdaten"}

${latestApiStats ? `API-STATISTIKEN:
- Ergebnis: ${latestApiStats.home_goals ?? "?"}:${latestApiStats.away_goals ?? "?"}
- Schüsse: ${latestApiStats.shots_home ?? "?"} (${latestApiStats.shots_on_target_home ?? "?"} aufs Tor) vs ${latestApiStats.shots_away ?? "?"} (${latestApiStats.shots_on_target_away ?? "?"} aufs Tor)
- Ballbesitz: ${latestApiStats.possession_home ?? "?"}% vs ${latestApiStats.possession_away ?? "?"}%
- Pässe: ${latestApiStats.passes_home ?? "?"} (${latestApiStats.pass_accuracy_home ?? "?"}%) vs ${latestApiStats.passes_away ?? "?"} (${latestApiStats.pass_accuracy_away ?? "?"}%)
- Ecken: ${latestApiStats.corners_home ?? "?"} vs ${latestApiStats.corners_away ?? "?"}
- Fouls: ${latestApiStats.fouls_home ?? "?"} vs ${latestApiStats.fouls_away ?? "?"}` : "API-Statistiken: nicht vorhanden"}
--- ENDE DETAILKONTEXT ---`;
  }

  return `

--- VEREINSDATEN ---
Verein: ${clubRes.data?.name || "Unbekannt"}
Liga: ${clubRes.data?.league || "Nicht angegeben"}
Plan: ${clubRes.data?.plan || "trial"}

KADER (${(playersRes.data || []).length} Spieler):
${(playersRes.data || [])
  .map((p: any) => `- #${p.number || "?"} ${p.name} (${p.position || "keine Pos."}) ${p.active ? "aktiv" : "inaktiv"}`)
  .join("\n")}

LETZTE SPIELE (${matches.length}):
${matches
  .map((m) => `- ${m.date}: vs ${m.away_club_name || "Unbekannt"} [${m.status}] Formation: ${m.home_formation || "-"}`)
  .join("\n")}

SPIELER-CLUSTER AUS LETZTEN SPIELEN:
${playerStatsData.length > 0
  ? playerStatsData
      .slice(0, 25)
      .map((s: any) => `- Match ${s.match_id?.slice(0, 8)} · Spieler ${s.player_id?.slice(0, 8)}: ${formatNumber(s.distance_km)} km, Top ${formatNumber(s.top_speed_kmh)} km/h, ${s.sprint_count ?? 0} Sprints, ${s.minutes_played ?? "?"} Min, Passquote ${formatNumber(s.pass_accuracy, 0)}%, Zweikämpfe ${s.duels_won ?? 0}/${s.duels_total ?? 0}, Tore ${s.goals ?? 0}, Assists ${s.assists ?? 0}, Rating ${s.rating ?? "?"}`)
      .join("\n")
  : "Noch keine Spieler-Statistiken vorhanden."}

TEAM-CLUSTER AUS LETZTEN SPIELEN:
${teamStatsData.length > 0
  ? teamStatsData
      .map((s: any) => `- Match ${s.match_id?.slice(0, 8)} (${s.team}): ${formatNumber(s.total_distance_km)} km gesamt, Top ${formatNumber(s.top_speed_kmh)} km/h, Ballbesitz ${formatNumber(s.possession_pct, 0)}%, Ø ${formatNumber(s.avg_distance_km)} km/Spieler`)
      .join("\n")
  : "Noch keine Team-Statistiken vorhanden."}

DATENQUALITÄT:
${dataQualityNotes.length > 0 ? dataQualityNotes.map((note) => `- ${note}`).join("\n") : "- Keine offensichtlichen Warnhinweise in den geladenen Datensätzen erkannt."}
--- ENDE VEREINSDATEN ---${latestMatchBlock}`;
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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const { messages, includeContext, selectedPlayersContext, liveMode, liveMatchId } = await req.json();

    let contextBlock = "";
    if (includeContext) {
      const { data: profile } = await supabase.from("profiles").select("club_id").eq("user_id", userId).single();
      if (profile?.club_id) {
        contextBlock = await buildClubContext(supabase, profile.club_id);
      }
    }

    if (selectedPlayersContext) {
      contextBlock += `\n\n--- AKTUELL AUSGEWÄHLTE SPIELER ---\nDer Trainer hat folgende Spieler in der Analyse-Ansicht ausgewählt. Wenn möglich, priorisiere diese Spieler in der Bewertung:\n${selectedPlayersContext}\n--- ENDE AUSWAHL ---`;
    }

    if (liveMode && liveMatchId) {
      const [livePlayerStats, liveTeamStats] = await Promise.all([
        supabase
          .from("player_match_stats")
          .select("player_id, distance_km, top_speed_kmh, avg_speed_kmh, sprint_count, sprint_distance_m, minutes_played, pass_accuracy, duels_won, duels_total, rating")
          .eq("match_id", liveMatchId),
        supabase
          .from("team_match_stats")
          .select("team, total_distance_km, top_speed_kmh, possession_pct, avg_distance_km")
          .eq("match_id", liveMatchId),
      ]);

      const liveQualityNotes = buildDataQualityNotes(livePlayerStats.data || [], liveTeamStats.data || []);

      contextBlock += `\n\n--- LIVE-SPIEL DATEN (ECHTZEIT) ---\nSPIELER-LIVE-STATS:\n${(livePlayerStats.data || [])
        .map((s: any) => `- Spieler ${s.player_id?.slice(0, 8)}: ${formatNumber(s.distance_km)} km, Top ${formatNumber(s.top_speed_kmh)} km/h, Ø ${formatNumber(s.avg_speed_kmh)} km/h, ${s.sprint_count ?? 0} Sprints, ${formatNumber(s.sprint_distance_m, 0)} m Sprintdistanz, ${s.minutes_played ?? "?"} Min, Passquote ${formatNumber(s.pass_accuracy, 0)}%, Zweikämpfe ${s.duels_won ?? 0}/${s.duels_total ?? 0}, Rating ${s.rating ?? "?"}`)
        .join("\n") || "Noch keine Live-Daten"}

TEAM-LIVE-STATS:\n${(liveTeamStats.data || [])
        .map((s: any) => `- ${s.team}: ${formatNumber(s.total_distance_km)} km gesamt, Top ${formatNumber(s.top_speed_kmh)} km/h, Ballbesitz ${formatNumber(s.possession_pct, 0)}%, Ø ${formatNumber(s.avg_distance_km)} km/Spieler`)
        .join("\n") || "Noch keine Team-Live-Daten"}

LIVE-DATENQUALITÄT:\n${liveQualityNotes.length > 0 ? liveQualityNotes.map((note) => `- ${note}`).join("\n") : "- Keine offensichtlichen Warnhinweise in den Live-Daten erkannt."}\n--- ENDE LIVE-DATEN ---`;
    }

    const systemContent = liveMode
      ? `${SYSTEM_PROMPT}\n\nDu bist im LIVE-MODUS. Gib kurze, sofort umsetzbare taktische Hinweise in maximal 5 Sätzen. Priorisiere: Pressinghöhe, Kompaktheit, Restverteidigung, Unter-/Überladungen, Ermüdungsanzeichen, Wechseloptionen. Markiere Datenrisiken explizit statt sie zu übergehen.${contextBlock}`
      : `${SYSTEM_PROMPT}${contextBlock}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "system", content: systemContent }, ...(messages || [])],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Zu viele Anfragen. Bitte versuche es in einer Minute erneut." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "KI-Credits aufgebraucht. Bitte Credits aufladen." }), {
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
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});