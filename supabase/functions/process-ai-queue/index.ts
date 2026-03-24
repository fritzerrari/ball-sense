import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_PARALLEL_INSTANT = 5;
const MAX_PARALLEL_DEFAULT = 3;
const TIMEOUT_INSTANT = 120_000;  // 2 min
const TIMEOUT_QUICK = 180_000;    // 3 min
const TIMEOUT_DEEP = 300_000;     // 5 min
const STUCK_THRESHOLD = 10 * 60 * 1000; // 10 min

const GENERAL_RULES = `Allgemeine Regeln:
- Antworte immer auf Deutsch.
- Schreibe fachlich, präzise, trainerrelevant und ohne Floskeln.
- Keine Begrüßung und kein werblicher Ton.
- Erfinde nichts; benenne Datenlücken offen.
- Top-Speed-Werte deutlich über ca. 45 km/h im Fußball als wahrscheinlichen Tracking-Ausreißer markieren.
- Kleine Stichproben und niedrige Einsatzzeiten nur vorsichtig interpretieren.
- Ballverluste sind aktuell nicht direkt erfasst; erwähne die Datenlücke klar, statt freie Annahmen zu machen.
- Leite aus den Daten konkrete Maßnahmen für Training, Rollenprofil, Belastungssteuerung und Matchplan ab.`;

const QUICK_RULES = `${GENERAL_RULES}
Zusatzregeln für Schnell-Analyse:
- Fasse dich kurz und prägnant (max 800 Wörter).
- Fokus auf die 3-5 wichtigsten Erkenntnisse.
- Keine detaillierte Tabellenaufschlüsselung nötig.`;

const INSTANT_RULES = `${GENERAL_RULES}
Zusatzregeln für Sofort-Fazit:
- Maximal 200 Wörter.
- Genau 3-5 Bullet Points mit den wichtigsten Erkenntnissen.
- Kein Trend-Block, keine Historie, nur das aktuelle Spiel.
- Keine Überschriften-Hierarchie, nur eine flache Liste.`;

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
      avgKm: round(average(items.map((i) => safeNumber(i.distance_km))), 2),
      avgTopSpeed: round(average(items.map((i) => safeNumber(i.top_speed_kmh))), 1),
      avgPassAccuracy: passesTotal > 0 ? round((passesCompleted / passesTotal) * 100, 0) : 0,
      duelRate: duelsTotal > 0 ? round((duelsWon / duelsTotal) * 100, 0) : 0,
      shots: items.reduce((s, i) => s + safeNumber(i.shots_total), 0),
      goals: items.reduce((s, i) => s + safeNumber(i.goals), 0),
      assists: items.reduce((s, i) => s + safeNumber(i.assists), 0),
      recoveries: items.reduce((s, i) => s + safeNumber(i.ball_recoveries), 0),
    };
  };
  return { recent: summarize(recent), previous: summarize(older) };
}

function aggregatePlayerStats(stats: any[]) {
  const passesTotal = stats.reduce((s, i) => s + safeNumber(i.passes_total), 0);
  const passesCompleted = stats.reduce((s, i) => s + safeNumber(i.passes_completed), 0);
  const duelsTotal = stats.reduce((s, i) => s + safeNumber(i.duels_total), 0);
  const duelsWon = stats.reduce((s, i) => s + safeNumber(i.duels_won), 0);
  return {
    games: stats.length,
    totalKm: round(stats.reduce((s, i) => s + safeNumber(i.distance_km), 0), 1),
    avgKm: round(average(stats.map((i) => safeNumber(i.distance_km))), 2),
    maxTopSpeed: round(Math.max(...stats.map((i) => safeNumber(i.top_speed_kmh)), 0), 1),
    avgTopSpeed: round(average(stats.map((i) => safeNumber(i.top_speed_kmh))), 1),
    avgSpeed: round(average(stats.map((i) => safeNumber(i.avg_speed_kmh))), 1),
    totalSprints: stats.reduce((s, i) => s + safeNumber(i.sprint_count), 0),
    sprintDistanceM: round(stats.reduce((s, i) => s + safeNumber(i.sprint_distance_m), 0), 0),
    avgMinutes: round(average(stats.map((i) => safeNumber(i.minutes_played))), 0),
    passAccuracy: passesTotal > 0 ? round((passesCompleted / passesTotal) * 100, 0) : 0,
    passesTotal,
    duelRate: duelsTotal > 0 ? round((duelsWon / duelsTotal) * 100, 0) : 0,
    duelsWon, duelsTotal,
    tackles: stats.reduce((s, i) => s + safeNumber(i.tackles), 0),
    interceptions: stats.reduce((s, i) => s + safeNumber(i.interceptions), 0),
    ballRecoveries: stats.reduce((s, i) => s + safeNumber(i.ball_recoveries), 0),
    shots: stats.reduce((s, i) => s + safeNumber(i.shots_total), 0),
    shotsOnTarget: stats.reduce((s, i) => s + safeNumber(i.shots_on_target), 0),
    goals: stats.reduce((s, i) => s + safeNumber(i.goals), 0),
    assists: stats.reduce((s, i) => s + safeNumber(i.assists), 0),
    ballContacts: stats.reduce((s, i) => s + safeNumber(i.ball_contacts), 0),
    foulsCommitted: stats.reduce((s, i) => s + safeNumber(i.fouls_committed), 0),
    foulsDrawn: stats.reduce((s, i) => s + safeNumber(i.fouls_drawn), 0),
    yellowCards: stats.reduce((s, i) => s + safeNumber(i.yellow_cards), 0),
    redCards: stats.reduce((s, i) => s + safeNumber(i.red_cards), 0),
    dribbles: stats.reduce((s, i) => s + safeNumber(i.dribbles_success), 0),
    aerialWon: stats.reduce((s, i) => s + safeNumber(i.aerial_won), 0),
    crosses: stats.reduce((s, i) => s + safeNumber(i.crosses), 0),
    avgRating: round(average(stats.map((i) => safeNumber(i.rating)).filter((v) => v > 0)), 1),
  };
}

function aggregateTeamBySide(stats: any[], team: "home" | "away") {
  const players = stats.filter((i) => i.team === team);
  const passesTotal = players.reduce((s, i) => s + safeNumber(i.passes_total), 0);
  const passesCompleted = players.reduce((s, i) => s + safeNumber(i.passes_completed), 0);
  const duelsTotal = players.reduce((s, i) => s + safeNumber(i.duels_total), 0);
  const duelsWon = players.reduce((s, i) => s + safeNumber(i.duels_won), 0);
  return {
    players: players.map((i) => ({
      name: i.players?.name, number: i.players?.number, position: i.players?.position,
      km: i.distance_km, topSpeed: i.top_speed_kmh, sprints: i.sprint_count,
      passesTotal: i.passes_total, passAccuracy: i.pass_accuracy,
      duelsWon: i.duels_won, duelsTotal: i.duels_total,
      tackles: i.tackles, interceptions: i.interceptions, ballRecoveries: i.ball_recoveries,
      shots: i.shots_total, shotsOnTarget: i.shots_on_target,
      goals: i.goals, assists: i.assists, fouls: i.fouls_committed,
      yellowCards: i.yellow_cards, redCards: i.red_cards,
      ballContacts: i.ball_contacts, rating: i.rating,
      aerialWon: i.aerial_won, crosses: i.crosses,
    })),
    summary: {
      totalPlayers: players.length,
      totalKm: round(players.reduce((s, i) => s + safeNumber(i.distance_km), 0), 1),
      maxTopSpeed: round(Math.max(...players.map((i) => safeNumber(i.top_speed_kmh)), 0), 1),
      totalSprints: players.reduce((s, i) => s + safeNumber(i.sprint_count), 0),
      passAccuracy: passesTotal > 0 ? round((passesCompleted / passesTotal) * 100, 0) : 0,
      passesTotal,
      duelRate: duelsTotal > 0 ? round((duelsWon / duelsTotal) * 100, 0) : 0,
      ballRecoveries: players.reduce((s, i) => s + safeNumber(i.ball_recoveries), 0),
      tackles: players.reduce((s, i) => s + safeNumber(i.tackles), 0),
      interceptions: players.reduce((s, i) => s + safeNumber(i.interceptions), 0),
      shots: players.reduce((s, i) => s + safeNumber(i.shots_total), 0),
      shotsOnTarget: players.reduce((s, i) => s + safeNumber(i.shots_on_target), 0),
      goals: players.reduce((s, i) => s + safeNumber(i.goals), 0),
      assists: players.reduce((s, i) => s + safeNumber(i.assists), 0),
      ballContacts: players.reduce((s, i) => s + safeNumber(i.ball_contacts), 0),
      fouls: players.reduce((s, i) => s + safeNumber(i.fouls_committed), 0),
      yellowCards: players.reduce((s, i) => s + safeNumber(i.yellow_cards), 0),
      redCards: players.reduce((s, i) => s + safeNumber(i.red_cards), 0),
      aerialWon: players.reduce((s, i) => s + safeNumber(i.aerial_won), 0),
      crosses: players.reduce((s, i) => s + safeNumber(i.crosses), 0),
    },
  };
}

async function buildPrompt(supabase: any, report: any): Promise<string> {
  const { report_type, player_id, match_id, depth } = report;
  const isInstant = depth === "instant";
  const isQuick = depth === "quick";
  const rules = isInstant ? INSTANT_RULES : isQuick ? QUICK_RULES : GENERAL_RULES;
  const isPlayer = report_type === "analysis" || report_type === "training";

  if (isPlayer && player_id) {
    const { data: player } = await supabase.from("players").select("name, number, position").eq("id", player_id).single();
    const limit = isInstant ? 1 : isQuick ? 5 : 15;
    const { data: stats } = await supabase
      .from("player_match_stats")
      .select("distance_km, top_speed_kmh, avg_speed_kmh, sprint_count, sprint_distance_m, minutes_played, match_id, passes_total, passes_completed, pass_accuracy, duels_total, duels_won, tackles, interceptions, ball_recoveries, shots_total, shots_on_target, goals, assists, ball_contacts, fouls_committed, fouls_drawn, yellow_cards, red_cards, dribbles_success, aerial_won, rating, crosses, matches(date, away_club_name)")
      .eq("player_id", player_id)
      .eq("period", "full")
      .order("match_id", { ascending: false })
      .limit(limit);

    if (!stats?.length) throw new Error("Keine Statistiken vorhanden");

    const playerJson = JSON.stringify({ name: player?.name ?? "Unbekannt", number: player?.number ?? null, position: player?.position ?? null }, null, 2);

    if (isInstant) {
      const s = stats[0];
      const compact = { km: s.distance_km, topSpeed: s.top_speed_kmh, sprints: s.sprint_count, passes: s.passes_total, passAcc: s.pass_accuracy, duelsWon: s.duels_won, duelsTotal: s.duels_total, goals: s.goals, assists: s.assists, shots: s.shots_total, tackles: s.tackles, interceptions: s.interceptions, fouls: s.fouls_committed, rating: s.rating };
      return `${rules}\n\nSpieler: ${player?.name ?? "Unbekannt"} (#${player?.number ?? "?"}, ${player?.position ?? "?"})\n\nAktuelles Spiel:\n${JSON.stringify(compact)}\n\nGib genau 3-5 Bullet Points als Sofort-Fazit.`;
    }

    const playerSummary = aggregatePlayerStats(stats);
    const trendBlock = buildTrendBlock(stats);
    const statsTable = stats.map((s: any) => ({
      date: s.matches?.date, opponent: s.matches?.away_club_name,
      km: s.distance_km, topSpeed: s.top_speed_kmh, avgSpeed: s.avg_speed_kmh,
      sprints: s.sprint_count, sprintDistM: s.sprint_distance_m, minutes: s.minutes_played,
      passesTotal: s.passes_total, passesCompleted: s.passes_completed, passAccuracy: s.pass_accuracy,
      duelsTotal: s.duels_total, duelsWon: s.duels_won,
      tackles: s.tackles, interceptions: s.interceptions, ballRecoveries: s.ball_recoveries,
      shotsTotal: s.shots_total, shotsOnTarget: s.shots_on_target,
      goals: s.goals, assists: s.assists, ballContacts: s.ball_contacts,
      fouls: s.fouls_committed, foulsDrawn: s.fouls_drawn,
      yellowCards: s.yellow_cards, redCards: s.red_cards,
      dribbles: s.dribbles_success, aerialWon: s.aerial_won, rating: s.rating, crosses: s.crosses,
    }));

    if (report_type === "training") {
      if (isQuick) {
        return `${rules}\n\nDu bist ein Individualcoach im Fußball.\nErstelle einen kompakten Wochentrainingsplan.\n\nSpieler:\n${playerJson}\n\nLeistungsprofil:\n${JSON.stringify(playerSummary, null, 2)}\n\nStruktur:\n## Kurzdiagnose (3 Sätze)\n## 3 Entwicklungsfelder\n## Wochenplan (Mo-Fr, je 2 Zeilen)\n## 3 Coachingpunkte`;
      }
      return `${rules}\n\nDu bist ein professioneller Individualcoach im Leistungsfußball.\nErstelle einen hochwertigen, positionsspezifischen Wochentrainingsplan auf Basis realer Leistungsdaten.\n\nSpieler:\n${playerJson}\n\nAggregiertes Leistungsprofil:\n${JSON.stringify(playerSummary, null, 2)}\n\nTrendblock letzte Spiele vs. vorherige Spiele:\n${JSON.stringify(trendBlock, null, 2)}\n\nSpieldaten:\n${JSON.stringify(statsTable, null, 2)}\n\nPflichtstruktur:\n## Kurzdiagnose\n## Leistungsprofil\n### Physis\n### Ballarbeit\n### Verhalten gegen den Ball\n### Offensivbeitrag\n### Disziplin & Datenlücken\n## Priorisierte Entwicklungsfelder\n## Wochentrainingsplan (Mo-Fr)\n## Individuelle Coachingpunkte\n## Belastungssteuerung\n## 4-Wochen-Ziele`;
    } else {
      if (isQuick) {
        return `${rules}\n\nDu bist ein Leistungsanalyst im Fußball.\nErstelle eine kompakte Analyse.\n\nSpieler:\n${playerJson}\n\nLeistungsprofil:\n${JSON.stringify(playerSummary, null, 2)}\n\nStruktur:\n## Kurzfazit (3 Sätze)\n## Stärken (3 Punkte)\n## Verbesserungsfelder (3 Punkte)\n## Konkrete Maßnahmen (3 Punkte)`;
      }
      return `${rules}\n\nDu bist ein leitender Individualanalyst im Profifußball.\nAnalysiere die Leistungsentwicklung dieses Spielers tiefgehend.\n\nSpieler:\n${playerJson}\n\nAggregiertes Leistungsprofil:\n${JSON.stringify(playerSummary, null, 2)}\n\nTrendblock:\n${JSON.stringify(trendBlock, null, 2)}\n\nSpieldaten:\n${JSON.stringify(statsTable, null, 2)}\n\nPflichtstruktur:\n## Kurzfazit\n## Leistungsprofil nach Modulen\n### Physis\n### Ballarbeit\n### Duell- und Defensivverhalten\n### Offensivwirkung\n### Disziplin & Datenqualität\n## Trendanalyse\n## Stärkenprofil\n## Verbesserungsfelder\n## Taktische Einordnung\n## Belastungsmanagement\n## Konkrete Trainingsmaßnahmen`;
    }
  } else if (report_type === "team" && match_id) {
    const { data: match } = await supabase.from("matches").select("date, away_club_name, home_club_id, home_formation, away_formation, status").eq("id", match_id).single();
    const { data: teamStats } = await supabase.from("team_match_stats").select("*").eq("match_id", match_id);
    const { data: playerStats } = await supabase
      .from("player_match_stats")
      .select("distance_km, top_speed_kmh, avg_speed_kmh, sprint_count, sprint_distance_m, minutes_played, team, passes_total, passes_completed, pass_accuracy, duels_total, duels_won, tackles, interceptions, ball_recoveries, goals, assists, shots_total, shots_on_target, ball_contacts, rating, fouls_committed, yellow_cards, red_cards, aerial_won, crosses, players(name, number, position)")
      .eq("match_id", match_id)
      .eq("period", "full");

    if (!playerStats?.length) throw new Error("Keine Spielstatistiken vorhanden");

    const homeAnalysis = aggregateTeamBySide(playerStats, "home");
    const awayAnalysis = aggregateTeamBySide(playerStats, "away");

    if (isInstant) {
      return `${INSTANT_RULES}\n\nSpiel: Heim vs ${match?.away_club_name ?? "Unbekannt"} (${match?.date ?? "?"})\n\nHeim:\n${JSON.stringify(homeAnalysis.summary)}\n\nGast:\n${JSON.stringify(awayAnalysis.summary)}\n\nGib genau 3-5 Bullet Points als Sofort-Fazit.`;
    }

    if (isQuick) {
      return `${rules}\n\nDu bist ein Match-Analyst.\nErstelle eine kompakte Spielanalyse.\n\nGegner: ${match?.away_club_name ?? "Unbekannt"}\nDatum: ${match?.date ?? "?"}\n\nHeimteam:\n${JSON.stringify(homeAnalysis.summary, null, 2)}\n\nGastteam:\n${JSON.stringify(awayAnalysis.summary, null, 2)}\n\nStruktur:\n## Kurzfazit (3 Sätze)\n## Heim-Stärken (3 Punkte)\n## Verbesserungsfelder (3 Punkte)\n## 3 Trainingsableitungen`;
    }

    const { data: apiMatchStats } = await supabase.from("api_football_match_stats").select("*").eq("match_id", match_id).maybeSingle();
    return `${rules}\n\nDu bist ein leitender Match-Analyst im Fußball.\nErstelle eine tiefgehende Spielanalyse.\n\nSpielkontext:\n${JSON.stringify({ opponent: match?.away_club_name, date: match?.date, homeFormation: match?.home_formation, awayFormation: match?.away_formation })}\n\nTeam-Statistiken:\n${JSON.stringify(teamStats)}\n\nHeimteam:\n${JSON.stringify(homeAnalysis, null, 2)}\n\nGastteam:\n${JSON.stringify(awayAnalysis, null, 2)}\n\nAPI-Stats:\n${JSON.stringify(apiMatchStats)}\n\nPflichtstruktur:\n## Kurzfazit\n## Physis & Intensität\n## Ballbesitz & Aufbau\n## Zweikampf- und Defensivverhalten\n## Offensivproduktion\n## Disziplin & Datenqualität\n## Taktische Bewertung\n## Konkrete Trainings- und Matchplan-Ableitungen`;
  }

  throw new Error("Ungültige Report-Parameter");
}

function getModelForDepth(depth: string): string {
  switch (depth) {
    case "instant": return "google/gemini-2.5-flash-lite";
    case "quick": return "google/gemini-3-flash-preview";
    case "deep": return "google/gemini-2.5-pro";
    default: return "google/gemini-3-flash-preview";
  }
}

function getTimeoutForDepth(depth: string): number {
  switch (depth) {
    case "instant": return TIMEOUT_INSTANT;
    case "quick": return TIMEOUT_QUICK;
    case "deep": return TIMEOUT_DEEP;
    default: return TIMEOUT_QUICK;
  }
}

async function sendNotification(supabase: any, userId: string, matchId: string | null, type: string, title: string, body: string) {
  try {
    await supabase.from("notifications").insert({ user_id: userId, match_id: matchId, type, title, body });
  } catch (e) {
    console.error("Notification insert failed:", e);
  }
}

async function processReport(supabase: any, report: any, apiKey: string) {
  await supabase.from("ai_reports").update({ status: "generating", updated_at: new Date().toISOString() }).eq("id", report.id);

  const timeout = getTimeoutForDepth(report.depth);
  const model = getModelForDepth(report.depth);
  const startTime = Date.now();

  try {
    const prompt = await buildPrompt(supabase, report);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "Du bist ein Top-Analyst im Fußball mit Fokus auf Matchanalyse, Individualdiagnostik, Trainingssteuerung und belastbare Ableitungen für Trainerteams." },
          { role: "user", content: prompt },
        ],
        stream: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Rate limit handling with backoff
      if (response.status === 429) {
        console.log(`Report ${report.id}: Rate limited, requeueing`);
        await supabase.from("ai_reports").update({ status: "queued", updated_at: new Date().toISOString() }).eq("id", report.id);
        return;
      }
      const statusMsg = response.status === 402 ? "KI-Kontingent erschöpft" : "KI-Analyse fehlgeschlagen";
      await supabase.from("ai_reports").update({ status: "error", content: statusMsg, updated_at: new Date().toISOString() }).eq("id", report.id);
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let soFar = "";
    let lastSave = Date.now();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) !== -1) {
        let line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") break;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) soFar += content;
        } catch { /* partial */ }
      }

      // Check timeout
      if (Date.now() - startTime > timeout) {
        console.log(`Report ${report.id}: Timeout after ${Math.round((Date.now() - startTime) / 1000)}s`);
        if (soFar) {
          await supabase.from("ai_reports").update({ content: soFar, status: "complete", updated_at: new Date().toISOString() }).eq("id", report.id);
        } else {
          await supabase.from("ai_reports").update({ status: "error", content: "Zeitüberschreitung", updated_at: new Date().toISOString() }).eq("id", report.id);
        }
        return;
      }

      if (Date.now() - lastSave > 5000 && soFar) {
        const { data: check } = await supabase.from("ai_reports").select("status").eq("id", report.id).single();
        if (check?.status === "cancelled") {
          console.log(`Report ${report.id} was cancelled`);
          return;
        }
        await supabase.from("ai_reports").update({ content: soFar, updated_at: new Date().toISOString() }).eq("id", report.id);
        lastSave = Date.now();
      }
    }

    await supabase.from("ai_reports").update({ content: soFar, status: "complete", updated_at: new Date().toISOString() }).eq("id", report.id);
    console.log(`Report ${report.id} completed (${report.depth}, ${model}, ${Math.round((Date.now() - startTime) / 1000)}s)`);

    // Send notification on completion
    const depthLabel = report.depth === "instant" ? "Sofort-Fazit" : report.depth === "quick" ? "Schnell-Analyse" : "Tiefenanalyse";
    const notifType = report.depth === "deep" ? "deep_analysis_ready" : "quick_analysis_ready";
    await sendNotification(supabase, report.user_id, report.match_id, notifType, `${depthLabel} fertig`, `Deine ${depthLabel} ist jetzt verfügbar.`);

  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Fehler";
    const isAbort = errMsg.includes("abort");
    console.error(`Report ${report.id} failed:`, isAbort ? "Timeout" : e);
    await supabase.from("ai_reports").update({ 
      status: "error", 
      content: isAbort ? "Zeitüberschreitung — bitte erneut versuchen" : errMsg, 
      updated_at: new Date().toISOString() 
    }).eq("id", report.id);
  }
}

async function cleanupStuckReports(supabase: any) {
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD).toISOString();
  const { data: stuck } = await supabase
    .from("ai_reports")
    .select("id")
    .eq("status", "generating")
    .lt("updated_at", cutoff);

  if (stuck?.length) {
    console.log(`Cleaning up ${stuck.length} stuck reports`);
    for (const r of stuck) {
      await supabase.from("ai_reports").update({ 
        status: "error", 
        content: "Verarbeitung abgebrochen (Zeitüberschreitung)", 
        updated_at: new Date().toISOString() 
      }).eq("id", r.id);
    }
  }
}

async function processNextBatch(supabase: any, apiKey: string) {
  // Cleanup stuck reports first
  await cleanupStuckReports(supabase);

  // Count currently generating
  const { data: active } = await supabase
    .from("ai_reports")
    .select("id, depth")
    .eq("status", "generating");

  const activeCount = active?.length ?? 0;

  // Check next queued to determine max parallel
  const { data: nextQueued } = await supabase
    .from("ai_reports")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(10);

  if (!nextQueued?.length) {
    console.log("No queued reports");
    return;
  }

  // Instant reports get higher parallelism
  const hasInstant = nextQueued.some((r: any) => r.depth === "instant");
  const maxParallel = hasInstant ? MAX_PARALLEL_INSTANT : MAX_PARALLEL_DEFAULT;
  const slotsAvailable = maxParallel - activeCount;

  if (slotsAvailable <= 0) {
    console.log(`All ${maxParallel} slots occupied, skipping`);
    return;
  }

  const batch = nextQueued.slice(0, slotsAvailable);
  console.log(`Starting ${batch.length} reports (${activeCount} active, max ${maxParallel})`);

  const promises = batch.map((report: any) => processReport(supabase, report, apiKey));
  
  for (const promise of promises) {
    promise.then(() => {
      processNextBatch(supabase, apiKey).catch(console.error);
    }).catch(console.error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));

    if (body.action === "cancel" && body.reportId) {
      await supabase.from("ai_reports").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", body.reportId);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (body.action === "queue_status") {
      const { data: queue } = await supabase
        .from("ai_reports")
        .select("id, status, created_at, depth")
        .in("status", ["queued", "generating"])
        .order("created_at", { ascending: true });
      return new Response(JSON.stringify({ queue: queue ?? [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const processingPromise = processNextBatch(supabase, LOVABLE_API_KEY);
    try {
      (globalThis as any).EdgeRuntime?.waitUntil?.(processingPromise);
    } catch {
      await processingPromise;
    }

    const { data: queue } = await supabase
      .from("ai_reports")
      .select("id, status, created_at, depth")
      .in("status", ["queued", "generating"])
      .order("created_at", { ascending: true });

    return new Response(JSON.stringify({ ok: true, queue: queue ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-ai-queue error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Fehler" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
