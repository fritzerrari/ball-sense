import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GENERAL_RULES = `Allgemeine Regeln:
- Antworte immer auf Deutsch.
- Schreibe fachlich, präzise, trainerrelevant und ohne Floskeln.
- Keine Begrüßung und kein werblicher Ton.
- Erfinde nichts; benenne Datenlücken offen.
- Top-Speed-Werte deutlich über ca. 45 km/h im Fußball als wahrscheinlichen Tracking-Ausreißer markieren.
- Kleine Stichproben und niedrige Einsatzzeiten nur vorsichtig interpretieren.
- Ballverluste sind aktuell nicht direkt erfasst; erwähne die Datenlücke klar, statt freie Annahmen zu machen.
- Leite aus den Daten konkrete Maßnahmen für Training, Rollenprofil, Belastungssteuerung und Matchplan ab.`;

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function safeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function buildTrendBlock(stats: any[]) {
  const recent = stats.slice(0, 5);
  const older = stats.slice(5, 10);

  const summarize = (items: any[]) => {
    const passesTotal = items.reduce((sum, item) => sum + safeNumber(item.passes_total), 0);
    const passesCompleted = items.reduce((sum, item) => sum + safeNumber(item.passes_completed), 0);
    const duelsTotal = items.reduce((sum, item) => sum + safeNumber(item.duels_total), 0);
    const duelsWon = items.reduce((sum, item) => sum + safeNumber(item.duels_won), 0);

    return {
      avgKm: round(average(items.map((item) => safeNumber(item.distance_km))), 2),
      avgTopSpeed: round(average(items.map((item) => safeNumber(item.top_speed_kmh))), 1),
      avgPassAccuracy: passesTotal > 0 ? round((passesCompleted / passesTotal) * 100, 0) : 0,
      duelRate: duelsTotal > 0 ? round((duelsWon / duelsTotal) * 100, 0) : 0,
      shots: items.reduce((sum, item) => sum + safeNumber(item.shots_total), 0),
      goals: items.reduce((sum, item) => sum + safeNumber(item.goals), 0),
      assists: items.reduce((sum, item) => sum + safeNumber(item.assists), 0),
      recoveries: items.reduce((sum, item) => sum + safeNumber(item.ball_recoveries), 0),
    };
  };

  return {
    recent: summarize(recent),
    previous: summarize(older),
  };
}

function aggregatePlayerStats(stats: any[]) {
  const passesTotal = stats.reduce((sum, item) => sum + safeNumber(item.passes_total), 0);
  const passesCompleted = stats.reduce((sum, item) => sum + safeNumber(item.passes_completed), 0);
  const duelsTotal = stats.reduce((sum, item) => sum + safeNumber(item.duels_total), 0);
  const duelsWon = stats.reduce((sum, item) => sum + safeNumber(item.duels_won), 0);

  return {
    games: stats.length,
    totalKm: round(stats.reduce((sum, item) => sum + safeNumber(item.distance_km), 0), 1),
    avgKm: round(average(stats.map((item) => safeNumber(item.distance_km))), 2),
    maxTopSpeed: round(Math.max(...stats.map((item) => safeNumber(item.top_speed_kmh)), 0), 1),
    avgTopSpeed: round(average(stats.map((item) => safeNumber(item.top_speed_kmh))), 1),
    avgSpeed: round(average(stats.map((item) => safeNumber(item.avg_speed_kmh))), 1),
    totalSprints: stats.reduce((sum, item) => sum + safeNumber(item.sprint_count), 0),
    sprintDistanceM: round(stats.reduce((sum, item) => sum + safeNumber(item.sprint_distance_m), 0), 0),
    avgMinutes: round(average(stats.map((item) => safeNumber(item.minutes_played))), 0),
    passAccuracy: passesTotal > 0 ? round((passesCompleted / passesTotal) * 100, 0) : 0,
    passesTotal,
    duelRate: duelsTotal > 0 ? round((duelsWon / duelsTotal) * 100, 0) : 0,
    duelsWon,
    duelsTotal,
    tackles: stats.reduce((sum, item) => sum + safeNumber(item.tackles), 0),
    interceptions: stats.reduce((sum, item) => sum + safeNumber(item.interceptions), 0),
    ballRecoveries: stats.reduce((sum, item) => sum + safeNumber(item.ball_recoveries), 0),
    shots: stats.reduce((sum, item) => sum + safeNumber(item.shots_total), 0),
    shotsOnTarget: stats.reduce((sum, item) => sum + safeNumber(item.shots_on_target), 0),
    goals: stats.reduce((sum, item) => sum + safeNumber(item.goals), 0),
    assists: stats.reduce((sum, item) => sum + safeNumber(item.assists), 0),
    ballContacts: stats.reduce((sum, item) => sum + safeNumber(item.ball_contacts), 0),
    foulsCommitted: stats.reduce((sum, item) => sum + safeNumber(item.fouls_committed), 0),
    foulsDrawn: stats.reduce((sum, item) => sum + safeNumber(item.fouls_drawn), 0),
    yellowCards: stats.reduce((sum, item) => sum + safeNumber(item.yellow_cards), 0),
    redCards: stats.reduce((sum, item) => sum + safeNumber(item.red_cards), 0),
    dribbles: stats.reduce((sum, item) => sum + safeNumber(item.dribbles_success), 0),
    aerialWon: stats.reduce((sum, item) => sum + safeNumber(item.aerial_won), 0),
    crosses: stats.reduce((sum, item) => sum + safeNumber(item.crosses), 0),
    avgRating: round(average(stats.map((item) => safeNumber(item.rating)).filter((value) => value > 0)), 1),
  };
}

function aggregateTeamBySide(stats: any[], team: "home" | "away") {
  const players = stats.filter((item) => item.team === team);
  const passesTotal = players.reduce((sum, item) => sum + safeNumber(item.passes_total), 0);
  const passesCompleted = players.reduce((sum, item) => sum + safeNumber(item.passes_completed), 0);
  const duelsTotal = players.reduce((sum, item) => sum + safeNumber(item.duels_total), 0);
  const duelsWon = players.reduce((sum, item) => sum + safeNumber(item.duels_won), 0);

  return {
    players: players.map((item) => ({
      name: item.players?.name,
      number: item.players?.number,
      position: item.players?.position,
      km: item.distance_km,
      topSpeed: item.top_speed_kmh,
      sprints: item.sprint_count,
      passesTotal: item.passes_total,
      passAccuracy: item.pass_accuracy,
      duelsWon: item.duels_won,
      duelsTotal: item.duels_total,
      tackles: item.tackles,
      interceptions: item.interceptions,
      ballRecoveries: item.ball_recoveries,
      shots: item.shots_total,
      shotsOnTarget: item.shots_on_target,
      goals: item.goals,
      assists: item.assists,
      fouls: item.fouls_committed,
      yellowCards: item.yellow_cards,
      redCards: item.red_cards,
      ballContacts: item.ball_contacts,
      rating: item.rating,
      aerialWon: item.aerial_won,
      crosses: item.crosses,
    })),
    summary: {
      totalPlayers: players.length,
      totalKm: round(players.reduce((sum, item) => sum + safeNumber(item.distance_km), 0), 1),
      maxTopSpeed: round(Math.max(...players.map((item) => safeNumber(item.top_speed_kmh)), 0), 1),
      totalSprints: players.reduce((sum, item) => sum + safeNumber(item.sprint_count), 0),
      passAccuracy: passesTotal > 0 ? round((passesCompleted / passesTotal) * 100, 0) : 0,
      passesTotal,
      duelRate: duelsTotal > 0 ? round((duelsWon / duelsTotal) * 100, 0) : 0,
      ballRecoveries: players.reduce((sum, item) => sum + safeNumber(item.ball_recoveries), 0),
      tackles: players.reduce((sum, item) => sum + safeNumber(item.tackles), 0),
      interceptions: players.reduce((sum, item) => sum + safeNumber(item.interceptions), 0),
      shots: players.reduce((sum, item) => sum + safeNumber(item.shots_total), 0),
      shotsOnTarget: players.reduce((sum, item) => sum + safeNumber(item.shots_on_target), 0),
      goals: players.reduce((sum, item) => sum + safeNumber(item.goals), 0),
      assists: players.reduce((sum, item) => sum + safeNumber(item.assists), 0),
      ballContacts: players.reduce((sum, item) => sum + safeNumber(item.ball_contacts), 0),
      fouls: players.reduce((sum, item) => sum + safeNumber(item.fouls_committed), 0),
      yellowCards: players.reduce((sum, item) => sum + safeNumber(item.yellow_cards), 0),
      redCards: players.reduce((sum, item) => sum + safeNumber(item.red_cards), 0),
      aerialWon: players.reduce((sum, item) => sum + safeNumber(item.aerial_won), 0),
      crosses: players.reduce((sum, item) => sum + safeNumber(item.crosses), 0),
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, playerId, matchId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let prompt = "";

    if ((type === "player" || type === "training") && playerId) {
      const { data: player } = await supabase.from("players").select("name, number, position").eq("id", playerId).single();
      const { data: stats } = await supabase
        .from("player_match_stats")
        .select("distance_km, top_speed_kmh, avg_speed_kmh, sprint_count, sprint_distance_m, minutes_played, match_id, passes_total, passes_completed, pass_accuracy, duels_total, duels_won, tackles, interceptions, ball_recoveries, shots_total, shots_on_target, goals, assists, ball_contacts, fouls_committed, fouls_drawn, yellow_cards, red_cards, dribbles_success, aerial_won, rating, crosses, matches(date, away_club_name)")
        .eq("player_id", playerId)
        .order("match_id", { ascending: false })
        .limit(15);

      if (!stats?.length) {
        return new Response(JSON.stringify({ error: "Keine Statistiken vorhanden" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const playerSummary = aggregatePlayerStats(stats);
      const trendBlock = buildTrendBlock(stats);
      const statsTable = stats.map((s: any) => ({
        date: s.matches?.date,
        opponent: s.matches?.away_club_name,
        km: s.distance_km,
        topSpeed: s.top_speed_kmh,
        avgSpeed: s.avg_speed_kmh,
        sprints: s.sprint_count,
        sprintDistM: s.sprint_distance_m,
        minutes: s.minutes_played,
        passesTotal: s.passes_total,
        passesCompleted: s.passes_completed,
        passAccuracy: s.pass_accuracy,
        duelsTotal: s.duels_total,
        duelsWon: s.duels_won,
        tackles: s.tackles,
        interceptions: s.interceptions,
        ballRecoveries: s.ball_recoveries,
        shotsTotal: s.shots_total,
        shotsOnTarget: s.shots_on_target,
        goals: s.goals,
        assists: s.assists,
        ballContacts: s.ball_contacts,
        fouls: s.fouls_committed,
        foulsDrawn: s.fouls_drawn,
        yellowCards: s.yellow_cards,
        redCards: s.red_cards,
        dribbles: s.dribbles_success,
        aerialWon: s.aerial_won,
        rating: s.rating,
        crosses: s.crosses,
      }));

      if (type === "training") {
        prompt = `${GENERAL_RULES}

Du bist ein professioneller Individualcoach im Leistungsfußball.
Erstelle einen hochwertigen, positionsspezifischen Wochentrainingsplan auf Basis realer Leistungsdaten.

Spieler:
${JSON.stringify({ name: player?.name ?? "Unbekannt", number: player?.number ?? null, position: player?.position ?? null }, null, 2)}

Aggregiertes Leistungsprofil:
${JSON.stringify(playerSummary, null, 2)}

Trendblock letzte Spiele vs. vorherige Spiele:
${JSON.stringify(trendBlock, null, 2)}

Spieldaten:
${JSON.stringify(statsTable, null, 2)}

Pflichtstruktur:
## Kurzdiagnose
- 4-6 Sätze mit den wichtigsten Fakten aus den Daten

## Leistungsprofil
### Physis
### Ballarbeit
### Verhalten gegen den Ball
### Offensivbeitrag
### Disziplin & Datenlücken

## Priorisierte Entwicklungsfelder
- 3 Felder mit klarer Begründung aus den Daten

## Wochentrainingsplan (Mo-Fr)
Für jeden Tag:
- Ziel
- Inhalt / Übungen
- Umfang / Dauer
- Intensität
- Coachingpunkte

## Individuelle Coachingpunkte
- 5 klare, positionsbezogene Hinweise

## Belastungssteuerung
- Risiko, Regeneration und Steuerung der nächsten 7 Tage

## 4-Wochen-Ziele
- messbar, realistisch und datenbasiert

Zusatzregeln:
- Ballverluste nur als Datenlücke nennen, nicht frei schätzen.
- Gehe explizit auf Zweikämpfe, Passspiel, Ballgewinne, Fouls, Kopfbälle, Schüsse, Tore und Assists ein.`;
      } else {
        prompt = `${GENERAL_RULES}

Du bist ein leitender Individualanalyst im Profifußball.
Analysiere die Leistungsentwicklung dieses Spielers tiefgehend, trainerrelevant und positionsbezogen.

Spieler:
${JSON.stringify({ name: player?.name ?? "Unbekannt", number: player?.number ?? null, position: player?.position ?? null }, null, 2)}

Aggregiertes Leistungsprofil:
${JSON.stringify(playerSummary, null, 2)}

Trendblock letzte Spiele vs. vorherige Spiele:
${JSON.stringify(trendBlock, null, 2)}

Spieldaten:
${JSON.stringify(statsTable, null, 2)}

Pflichtstruktur:
## Kurzfazit
## Leistungsprofil nach Modulen
### Physis
### Ballarbeit
### Duell- und Defensivverhalten
### Offensivwirkung
### Disziplin & Datenqualität
## Trendanalyse
## Stärkenprofil
## Verbesserungsfelder
## Taktische Einordnung nach Position/Rolle
## Belastungsmanagement
## Konkrete Trainingsmaßnahmen

Zusatzregeln:
- Nicht nur Werte aufzählen, sondern sauber einordnen.
- Zweikampf-, Pass-, Lauf-, Abschluss- und Kontaktprofile zusammenführen.
- Gehe explizit auf Tackles, Interceptions, Ballgewinne, Pässe, Assists, Tore, Fouls, Kopfballduelle und Schüsse ein.
- Falls Werte unplausibel wirken, separat als Datenrisiko markieren.`;
      }
    } else if (type === "team" && matchId) {
      const { data: match } = await supabase.from("matches").select("date, away_club_name, home_club_id, home_formation, away_formation, status").eq("id", matchId).single();
      const { data: teamStats } = await supabase.from("team_match_stats").select("*").eq("match_id", matchId);
      const { data: playerStats } = await supabase
        .from("player_match_stats")
        .select("distance_km, top_speed_kmh, avg_speed_kmh, sprint_count, sprint_distance_m, minutes_played, team, passes_total, passes_completed, pass_accuracy, duels_total, duels_won, tackles, interceptions, ball_recoveries, goals, assists, shots_total, shots_on_target, ball_contacts, rating, fouls_committed, yellow_cards, red_cards, aerial_won, crosses, players(name, number, position)")
        .eq("match_id", matchId);
      const { data: apiMatchStats } = await supabase.from("api_football_match_stats").select("*").eq("match_id", matchId).maybeSingle();

      let recentTeamStats: any[] = [];
      if (match?.home_club_id) {
        const { data: recentMatches } = await supabase
          .from("matches")
          .select("id, date, away_club_name")
          .eq("home_club_id", match.home_club_id)
          .eq("status", "done")
          .order("date", { ascending: false })
          .limit(5);
        if (recentMatches?.length) {
          const { data: rts } = await supabase
            .from("team_match_stats")
            .select("match_id, total_distance_km, top_speed_kmh, possession_pct, avg_distance_km")
            .in("match_id", recentMatches.map((m) => m.id))
            .eq("team", "home");
          recentTeamStats = rts ?? [];
        }
      }

      if (!playerStats?.length) {
        return new Response(JSON.stringify({ error: "Keine Spielstatistiken vorhanden" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const homeAnalysis = aggregateTeamBySide(playerStats, "home");
      const awayAnalysis = aggregateTeamBySide(playerStats, "away");

      prompt = `${GENERAL_RULES}

Du bist ein leitender Match-Analyst im Fußball.
Erstelle eine tiefgehende Team- und Spielanalyse aus Match-, Tracking- und Aktionsdaten.

Spielkontext:
${JSON.stringify({
  opponent: match?.away_club_name ?? "Unbekannt",
  date: match?.date ?? null,
  status: match?.status ?? null,
  homeFormation: match?.home_formation ?? null,
  awayFormation: match?.away_formation ?? null,
}, null, 2)}

Team-Statistiken:
${JSON.stringify(teamStats, null, 2)}

Heimteam – aggregiertes Wirkungsprofil:
${JSON.stringify(homeAnalysis, null, 2)}

Auswärtsteam – aggregiertes Wirkungsprofil:
${JSON.stringify(awayAnalysis, null, 2)}

API-Matchstats:
${JSON.stringify(apiMatchStats, null, 2)}

Letzte 5 Heim-Spiele Team-Stats:
${JSON.stringify(recentTeamStats, null, 2)}

Pflichtstruktur:
## Kurzfazit
## Belastbare Team-Erkenntnisse nach Modulen
### Physis & Intensität
### Ballbesitz & Aufbau
### Zweikampf- und Defensivverhalten
### Offensivproduktion
### Disziplin & Datenqualität
## Taktische Bewertung
## Spieler mit Wirkung auf den Spielverlauf
## Vergleich zu den letzten Spielen
## Konkrete Trainings- und Matchplan-Ableitungen

Zusatzregeln:
- Explizit auf Pässe, Passquote, Zweikämpfe, Ballgewinne, Tackles, Interceptions, Schüsse, Tore, Assists, Fouls und Kopfballduelle eingehen.
- Ballverluste als fehlende Rohmetrik kenntlich machen.
- Nicht nur beschreiben, sondern Ableitungen für Restverteidigung, Gegenpressing, Kontrolle, Chance-Erzeugung und Belastung machen.`;
    } else {
      return new Response(JSON.stringify({ error: "Ungültige Parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: "Du bist ein Top-Analyst im Fußball mit Fokus auf Matchanalyse, Individualdiagnostik, Trainingssteuerung und belastbare Ableitungen für Trainerteams.",
          },
          { role: "user", content: prompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate-Limit erreicht" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "KI-Kontingent erschöpft" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "KI-Analyse fehlgeschlagen" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("analyze-performance error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
