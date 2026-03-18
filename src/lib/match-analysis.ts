import { HEATMAP_COLS, HEATMAP_ROWS, POSITION_LABELS } from "./constants";

type Grid = number[][];

type MaybeNumber = number | null | undefined;

type PlayerRef = {
  name?: string | null;
  number?: number | null;
  position?: string | null;
};

export type PlayerMetricStat = {
  player_id?: string | null;
  team?: string | null;
  distance_km?: MaybeNumber;
  top_speed_kmh?: MaybeNumber;
  sprint_count?: MaybeNumber;
  passes_total?: MaybeNumber;
  pass_accuracy?: MaybeNumber;
  duels_won?: MaybeNumber;
  duels_total?: MaybeNumber;
  tackles?: MaybeNumber;
  interceptions?: MaybeNumber;
  ball_recoveries?: MaybeNumber;
  shots_total?: MaybeNumber;
  shots_on_target?: MaybeNumber;
  goals?: MaybeNumber;
  assists?: MaybeNumber;
  fouls_committed?: MaybeNumber;
  yellow_cards?: MaybeNumber;
  red_cards?: MaybeNumber;
  rating?: MaybeNumber;
  players?: PlayerRef | null;
};

export type ApiMatchStatsLite = {
  away_goals?: MaybeNumber;
  shots_on_target_away?: MaybeNumber;
  shots_away?: MaybeNumber;
  possession_away?: MaybeNumber;
  corners_away?: MaybeNumber;
  fouls_home?: MaybeNumber;
  yellow_cards_home?: MaybeNumber;
  red_cards_home?: MaybeNumber;
  pass_accuracy_away?: MaybeNumber;
};

export type MatchEventLite = {
  id: string;
  minute: number;
  team: string;
  event_type: string;
  player_name?: string | null;
  related_player_name?: string | null;
  notes?: string | null;
  event_zone?: string | null;
  event_cause?: string | null;
  event_pattern?: string | null;
  affected_line?: string | null;
  severity?: number | null;
  possession_phase?: string | null;
};

export type ZoneLinkedPlayer = {
  id: string | null;
  name: string;
  number: number | null;
  position: string | null;
  positionLabel: string;
};

export type ZoneInsight = {
  id: string;
  label: string;
  severity: number;
  line: string;
  corridor: string;
  description: string;
  reasons: string[];
  players: ZoneLinkedPlayer[];
};

export type ConcededGoalAnalysis = {
  concededGoals: number;
  dataQuality: string;
  structuredEvents: MatchEventLite[];
  riskFactors: { title: string; detail: string; severity: "high" | "medium" | "low" }[];
  phaseSignals: { label: string; detail: string; active: boolean }[];
};

function safeNumber(value: MaybeNumber) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function createEmptyGrid(): Grid {
  return Array.from({ length: HEATMAP_ROWS }, () => Array(HEATMAP_COLS).fill(0));
}

function normalizeGrid(grid?: Grid | null): Grid {
  const fallback = grid && grid.length ? grid : createEmptyGrid();
  const max = Math.max(...fallback.flat().map((value) => safeNumber(value)), 1);
  return fallback.map((row) => row.map((value) => safeNumber(value) / max));
}

function averageZone(grid: Grid, rowStart: number, rowEnd: number, colStart: number, colEnd: number) {
  let total = 0;
  let count = 0;
  for (let row = rowStart; row < rowEnd; row++) {
    for (let col = colStart; col < colEnd; col++) {
      total += safeNumber(grid[row]?.[col]);
      count += 1;
    }
  }
  return count ? total / count : 0;
}

function corridorLabel(index: number) {
  return ["linker Korridor", "Zentrum", "rechter Korridor"][index] ?? "Zentrum";
}

function lineLabel(index: number) {
  return ["tiefe Zone", "mittlere Zone", "hohe Zone"][index] ?? "mittlere Zone";
}

function matchesCorridor(position: string | null | undefined, corridor: number) {
  if (!position) return corridor === 1;
  if (corridor === 0) return ["LV", "LIV", "LM", "LA"].includes(position);
  if (corridor === 2) return ["RV", "RIV", "RM", "RA"].includes(position);
  return ["TW", "IV", "ZDM", "ZM", "ZOM", "ST", "HS"].includes(position);
}

function matchesLine(position: string | null | undefined, line: number) {
  if (!position) return true;
  if (line === 0) return ["TW", "IV", "LIV", "RIV", "LV", "RV", "ZDM"].includes(position);
  if (line === 1) return ["ZDM", "ZM", "LM", "RM", "ZOM"].includes(position);
  return ["LA", "RA", "ST", "HS", "ZOM"].includes(position);
}

function playerRiskScore(player: PlayerMetricStat) {
  const duelRate = safeNumber(player.duels_total) > 0 ? (safeNumber(player.duels_won) / safeNumber(player.duels_total)) * 100 : 0;
  return (
    safeNumber(player.ball_recoveries) * 1.5 +
    safeNumber(player.tackles) * 1.15 +
    safeNumber(player.interceptions) * 1.1 +
    duelRate * 0.4 +
    safeNumber(player.pass_accuracy) * 0.15 +
    safeNumber(player.rating) * 2
  );
}

function linkedPlayersForZone(stats: PlayerMetricStat[], corridor: number, line: number, limit = 3): ZoneLinkedPlayer[] {
  const filtered = stats
    .filter((player) => player.team !== "away")
    .filter((player) => matchesCorridor(player.players?.position, corridor))
    .filter((player) => matchesLine(player.players?.position, line));

  const source = filtered.length > 0 ? filtered : stats.filter((player) => player.team !== "away");

  return source
    .filter((player) => player.player_id || player.players?.name)
    .sort((a, b) => playerRiskScore(a) - playerRiskScore(b))
    .slice(0, limit)
    .map((player) => ({
      id: player.player_id ?? null,
      name: player.players?.name ?? "Unbekannt",
      number: player.players?.number ?? null,
      position: player.players?.position ?? null,
      positionLabel: player.players?.position ? POSITION_LABELS[player.players.position] ?? player.players.position : "Ohne Position",
    }));
}

export function getTopPlayersForMetric(
  stats: PlayerMetricStat[],
  metric: keyof PlayerMetricStat,
  limit = 3,
  descending = true,
) {
  return [...stats]
    .filter((entry) => entry.player_id && entry.players?.name)
    .sort((a, b) => {
      const aValue = safeNumber(a[metric] as MaybeNumber);
      const bValue = safeNumber(b[metric] as MaybeNumber);
      return descending ? bValue - aValue : aValue - bValue;
    })
    .slice(0, limit)
    .map((entry) => ({
      id: entry.player_id ?? null,
      name: entry.players?.name ?? "Unbekannt",
      number: entry.players?.number ?? null,
      position: entry.players?.position ?? null,
      value: safeNumber(entry[metric] as MaybeNumber),
    }));
}

export function deriveWeaknessHeatmap(
  homeHeatmap?: Grid | null,
  awayHeatmap?: Grid | null,
  apiStats?: ApiMatchStatsLite | null,
): Grid {
  const home = normalizeGrid(homeHeatmap);
  const away = normalizeGrid(awayHeatmap);
  const result = createEmptyGrid();

  const wingBoost = 1 + clamp((safeNumber(apiStats?.corners_away) + safeNumber(apiStats?.fouls_home)) / 35, 0, 0.35);
  const centerBoost = 1 + clamp((safeNumber(apiStats?.shots_on_target_away) + safeNumber(apiStats?.pass_accuracy_away) / 10) / 25, 0, 0.3);
  const transitionBoost = 1 + clamp((safeNumber(apiStats?.possession_away) - 50) / 100, 0, 0.2);

  for (let row = 0; row < HEATMAP_ROWS; row++) {
    for (let col = 0; col < HEATMAP_COLS; col++) {
      const homeValue = safeNumber(home[row]?.[col]);
      const awayValue = safeNumber(away[row]?.[col]);
      const coverageGap = Math.max(0, awayValue - homeValue);
      const lowPresence = 1 - homeValue;
      const corridor = col < HEATMAP_COLS / 3 ? 0 : col >= (HEATMAP_COLS * 2) / 3 ? 2 : 1;
      const line = row < HEATMAP_ROWS / 3 ? 0 : row >= (HEATMAP_ROWS * 2) / 3 ? 2 : 1;

      let multiplier = corridor === 1 ? centerBoost : wingBoost;
      if (line === 1) multiplier *= transitionBoost;

      result[row][col] = (awayValue * 0.5 + coverageGap * 0.35 + lowPresence * 0.15) * multiplier;
    }
  }

  const max = Math.max(...result.flat(), 1);
  return result.map((row) => row.map((value) => clamp(value / max)));
}

export function deriveZoneInsights(
  weaknessGrid: Grid,
  homePlayerStats: PlayerMetricStat[],
  apiStats?: ApiMatchStatsLite | null,
  limit = 3,
): ZoneInsight[] {
  const zones: ZoneInsight[] = [];
  const rowSize = Math.ceil(HEATMAP_ROWS / 3);
  const colSize = Math.ceil(HEATMAP_COLS / 3);

  for (let line = 0; line < 3; line++) {
    for (let corridor = 0; corridor < 3; corridor++) {
      const value = averageZone(
        weaknessGrid,
        line * rowSize,
        Math.min((line + 1) * rowSize, HEATMAP_ROWS),
        corridor * colSize,
        Math.min((corridor + 1) * colSize, HEATMAP_COLS),
      );

      const reasons = [
        "Gegnerische Präsenz überlagert die eigene Teamdichte.",
        safeNumber(apiStats?.shots_on_target_away) >= 5 ? "Viele gegnerische Abschlüsse aufs Tor verstärken das Risikobild." : "Das Risikobild ist vor allem aus Heatmap-Dichte und Raumkontrolle abgeleitet.",
      ];

      if (safeNumber(apiStats?.corners_away) >= 5 && corridor !== 1) {
        reasons.push("Viele gegnerische Standards oder Flanken sprechen für zusätzlichen Druck auf den Außenkorridoren.");
      }
      if (safeNumber(apiStats?.fouls_home) >= 10 && line !== 2) {
        reasons.push("Viele Fouls deuten auf verspäteten Zugriff und erzwungene Stopps im Zugriffsmoment hin.");
      }
      if (safeNumber(apiStats?.possession_away) >= 55 && corridor === 1) {
        reasons.push("Der Gegner hatte viel Kontrolle im Zentrum und konnte dort Phasen stabilisieren.");
      }

      zones.push({
        id: `${line}-${corridor}`,
        label: `${lineLabel(line)} · ${corridorLabel(corridor)}`,
        severity: Math.round(value * 100),
        line: lineLabel(line),
        corridor: corridorLabel(corridor),
        description:
          value >= 0.75
            ? "Akute Problemzone mit klarer Überzahl des Gegners oder zu wenig eigenem Zugriff."
            : value >= 0.55
              ? "Wiederkehrende Problemzone, die im Matchplan und im Coaching priorisiert werden sollte."
              : "Beobachtungszone mit leichter gegnerischer Überlegenheit oder schwächerer Raumkontrolle.",
        reasons,
        players: linkedPlayersForZone(homePlayerStats, corridor, line),
      });
    }
  }

  return zones.sort((a, b) => b.severity - a.severity).slice(0, limit);
}

export function deriveConcededGoalAnalysis(
  events: MatchEventLite[],
  apiStats?: ApiMatchStatsLite | null,
  homeSummary?: { duelRate?: number; ballRecoveries?: number; fouls?: number; passAccuracy?: number },
  awaySummary?: { shotsOnTarget?: number; shots?: number; ballRecoveries?: number },
): ConcededGoalAnalysis {
  const structuredEvents = events
    .filter((event) => event.event_type === "conceded_goal" || (event.event_type === "goal" && event.team === "away"))
    .sort((a, b) => a.minute - b.minute);

  const concededGoals = Math.max(structuredEvents.length, safeNumber(apiStats?.away_goals));
  const riskFactors: ConcededGoalAnalysis["riskFactors"] = [];

  if (safeNumber(apiStats?.shots_on_target_away) >= 5 || safeNumber(awaySummary?.shotsOnTarget) >= 5) {
    riskFactors.push({
      title: "Zu viele klare Abschlüsse zugelassen",
      detail: "Der Gegner kam mehrfach sauber aufs Tor. Das spricht für Lücken in Restverteidigung, Druck auf den Ball oder Box-Verteidigung.",
      severity: "high",
    });
  }

  if (safeNumber(homeSummary?.duelRate) > 0 && safeNumber(homeSummary?.duelRate) < 48) {
    riskFactors.push({
      title: "Zu wenig Zugriff in direkten Duellen",
      detail: "Eine niedrige Zweikampfquote verschlechtert das Verteidigen von zweiten Bällen und offenen Umschaltsituationen.",
      severity: "high",
    });
  }

  if (safeNumber(apiStats?.corners_away) >= 5 || safeNumber(homeSummary?.fouls) >= 12) {
    riskFactors.push({
      title: "Standard- und Flankenrisiko erhöht",
      detail: "Viele gegnerische Standards, Flanken oder Fouls in Druckphasen deuten auf Probleme bei Box-Verteidigung und Staffelung hin.",
      severity: "medium",
    });
  }

  if (safeNumber(homeSummary?.passAccuracy) > 0 && safeNumber(homeSummary?.passAccuracy) < 76) {
    riskFactors.push({
      title: "Aufbau zu fehleranfällig",
      detail: "Unsaubere Passphasen erhöhen das Risiko für Ballverluste vor offenen Restverteidigungs-Momenten.",
      severity: "medium",
    });
  }

  if (safeNumber(homeSummary?.ballRecoveries) > 0 && safeNumber(awaySummary?.ballRecoveries) > safeNumber(homeSummary?.ballRecoveries)) {
    riskFactors.push({
      title: "Gegner gewann mehr zweite Bälle",
      detail: "Wenn der Gegner mehr Ballgewinne sammelt, kippen Druckphasen oft in längere Verteidigungssequenzen gegen das eigene Team.",
      severity: "medium",
    });
  }

  const phaseSignals = [
    {
      label: "Frühe Instabilität",
      active: structuredEvents.some((event) => event.minute <= 20) || (concededGoals > 0 && safeNumber(apiStats?.shots_on_target_away) >= 3),
      detail: "Frühe Gegentore oder früher Dauerdruck sprechen für langsames Ankommen ins Spiel oder fehlende Anfangskontrolle.",
    },
    {
      label: "Mittelblock unter Druck",
      active: safeNumber(apiStats?.possession_away) >= 55 || safeNumber(awaySummary?.shots) >= 8,
      detail: "Längere gegnerische Ballbesitzphasen und viele Abschlüsse deuten auf Probleme in Zugriff, Nachschieben und Raumkontrolle hin.",
    },
    {
      label: "Disziplin kippt in Risiko",
      active: safeNumber(apiStats?.yellow_cards_home) + safeNumber(apiStats?.red_cards_home) >= 3 || safeNumber(apiStats?.fouls_home) >= 12,
      detail: "Viele Karten oder Fouls zeigen, dass Druckphasen häufiger nur noch mit Notfallverhalten gelöst wurden.",
    },
  ];

  return {
    concededGoals,
    dataQuality: structuredEvents.length > 0 ? "Strukturiert erfasst" : concededGoals > 0 ? "Indirekt aus Matchdaten abgeleitet" : "Keine Gegentore erkannt",
    structuredEvents,
    riskFactors: riskFactors.slice(0, 4),
    phaseSignals,
  };
}
