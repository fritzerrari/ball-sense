import { HEATMAP_COLS, HEATMAP_ROWS } from "@/lib/constants";

export interface DemoPlayer {
  name: string;
  num: number;
  pos: string;
  km: number;
  topSpeed: number;
  sprints: number;
  sprintDistanceM: number;
  avgSpeed: number;
  minutesPlayed: number;
  heatmap: number[][];
  passAccuracy: number;
  passesTotal: number;
  duelsWon: number;
  duelsTotal: number;
  tackles: number;
  dribblesSuccess: number;
  shotsTotal: number;
  shotsOnGoal: number;
  goals: number;
  assists: number;
  foulsCommitted: number;
  foulsDrawn: number;
  yellowCards: number;
  redCards: number;
  rating: number;
  trend: "up" | "down" | "stable";
}

export interface DemoData {
  matchInfo: {
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    date: string;
    venue: string;
  };
  players: DemoPlayer[];
  teamStats: {
    possession: number;
    totalKm: number;
    avgSpeed: number;
    topSpeed: number;
    sprints: number;
    passes: number;
    passAccuracy: number;
    shotsOnTarget: number;
    shotsTotal: number;
    corners: number;
    fouls: number;
    yellowCards: number;
    redCards: number;
    offsides: number;
  };
  heatmapGrid: number[][];
  apiStats: {
    xG: number;
    xGA: number;
    ppda: number;
    fieldTilt: number;
    shotConversion: number;
    duelWinRate: number;
    aerialWinRate: number;
    crossAccuracy: number;
    counterAttacks: number;
    setPlayGoals: number;
  };
  /** Optional AI suggestions from Phase 3 — derived on demand if missing. */
  aiSuggestions?: {
    scenes: Array<{
      minute: number;
      type:
        | "open_play"
        | "corner_kick"
        | "free_kick"
        | "throw_in"
        | "kickoff"
        | "penalty"
        | "stoppage"
        | "goal_celebration";
      team?: "home" | "away" | "unknown";
      confidence?: number;
      evidence?: string;
    }>;
    goalCandidates: Array<{
      minute: number;
      team?: "home" | "away" | "unknown";
      confidence?: number;
      scorer_jersey?: number;
      assist_jersey?: number;
      evidence?: string;
    }>;
  };
}

// Position-based hotspot templates for realistic heatmaps
const positionHotspots: Record<string, { cx: number; cy: number; spread: number }[]> = {
  TW: [{ cx: 2, cy: 7, spread: 1.5 }],
  IV: [{ cx: 5, cy: 5, spread: 2.5 }, { cx: 5, cy: 9, spread: 2.5 }],
  LV: [{ cx: 6, cy: 2, spread: 2.2 }, { cx: 10, cy: 1, spread: 2 }],
  RV: [{ cx: 6, cy: 12, spread: 2.2 }, { cx: 10, cy: 13, spread: 2 }],
  ZDM: [{ cx: 8, cy: 7, spread: 3 }, { cx: 10, cy: 6, spread: 2.5 }],
  ZM: [{ cx: 11, cy: 7, spread: 3.5 }, { cx: 13, cy: 5, spread: 2.5 }],
  ZOM: [{ cx: 14, cy: 7, spread: 3 }, { cx: 16, cy: 6, spread: 2 }],
  RA: [{ cx: 16, cy: 11, spread: 2.5 }, { cx: 18, cy: 13, spread: 2 }],
  LA: [{ cx: 16, cy: 3, spread: 2.5 }, { cx: 18, cy: 1, spread: 2 }],
  ST: [{ cx: 17, cy: 7, spread: 3 }, { cx: 19, cy: 6, spread: 2 }],
};

function generateHeatmap(pos: string, seed: number): number[][] {
  const spots = positionHotspots[pos] || [{ cx: 10, cy: 7, spread: 3 }];
  const heatmap: number[][] = [];
  
  for (let row = 0; row < HEATMAP_ROWS; row++) {
    const rowData: number[] = [];
    for (let col = 0; col < HEATMAP_COLS; col++) {
      let val = 0;
      for (const hs of spots) {
        // Add slight variation based on seed
        const offsetX = Math.sin(seed * 0.1 + col * 0.3) * 0.5;
        const offsetY = Math.cos(seed * 0.15 + row * 0.25) * 0.5;
        const dist = Math.sqrt((col - hs.cx + offsetX) ** 2 + (row - hs.cy + offsetY) ** 2);
        val += Math.exp(-(dist * dist) / (2 * hs.spread ** 2));
      }
      // Deterministic noise based on seed
      val += Math.sin(seed + col * 0.5 + row * 0.7) * 0.03 + 0.02;
      rowData.push(Math.min(Math.max(val, 0), 1));
    }
    heatmap.push(rowData);
  }
  return heatmap;
}

function generateTeamHeatmap(seed: number): number[][] {
  const hotspots = [
    { cx: 8, cy: 7, strength: 0.9, radius: 4 },
    { cx: 12, cy: 5, strength: 0.75, radius: 3.5 },
    { cx: 12, cy: 9, strength: 0.7, radius: 3 },
    { cx: 5, cy: 7, strength: 0.5, radius: 3 },
    { cx: 16, cy: 7, strength: 0.6, radius: 2.5 },
  ];

  const heatmap: number[][] = [];
  for (let row = 0; row < HEATMAP_ROWS; row++) {
    const rowData: number[] = [];
    for (let col = 0; col < HEATMAP_COLS; col++) {
      let val = 0;
      for (let i = 0; i < hotspots.length; i++) {
        const hs = hotspots[i];
        // Vary position slightly per dataset
        const cx = hs.cx + Math.sin(seed * 0.3 + i) * 1.5;
        const cy = hs.cy + Math.cos(seed * 0.4 + i) * 1;
        const dist = Math.sqrt((col - cx) ** 2 + (row - cy) ** 2);
        val += hs.strength * Math.exp(-(dist * dist) / (2 * hs.radius ** 2));
      }
      val += Math.sin(seed * 0.2 + col * 0.4 + row * 0.5) * 0.03;
      rowData.push(Math.min(Math.max(val, 0), 1));
    }
    heatmap.push(rowData);
  }
  return heatmap;
}

// 10 predefined match datasets
const DEMO_DATASETS: DemoData[] = [
  // Dataset 1: FC Musterstadt vs SV Beispielburg
  {
    matchInfo: {
      homeTeam: "FC Musterstadt",
      awayTeam: "SV Beispielburg",
      homeScore: 2,
      awayScore: 1,
      date: "So, 2. März 2026 · 15:30",
      venue: "Sportplatz Am Wald",
    },
    players: [
      { name: "T. Hartmann", num: 9, pos: "ST", km: 10.8, topSpeed: 32.4, sprints: 48, sprintDistanceM: 890, avgSpeed: 7.8, minutesPlayed: 90, heatmap: generateHeatmap("ST", 1), passAccuracy: 78, passesTotal: 28, duelsWon: 62, duelsTotal: 16, tackles: 1, dribblesSuccess: 5, shotsTotal: 5, shotsOnGoal: 3, goals: 1, assists: 1, foulsCommitted: 2, foulsDrawn: 4, yellowCards: 0, redCards: 0, rating: 8.2, trend: "up" },
      { name: "M. Lindner", num: 8, pos: "ZM", km: 11.4, topSpeed: 29.8, sprints: 42, sprintDistanceM: 780, avgSpeed: 7.5, minutesPlayed: 90, heatmap: generateHeatmap("ZM", 2), passAccuracy: 89, passesTotal: 62, duelsWon: 58, duelsTotal: 14, tackles: 3, dribblesSuccess: 2, shotsTotal: 2, shotsOnGoal: 1, goals: 0, assists: 1, foulsCommitted: 1, foulsDrawn: 2, yellowCards: 0, redCards: 0, rating: 7.8, trend: "stable" },
      { name: "S. Braun", num: 6, pos: "ZDM", km: 11.8, topSpeed: 28.5, sprints: 38, sprintDistanceM: 710, avgSpeed: 7.2, minutesPlayed: 90, heatmap: generateHeatmap("ZDM", 3), passAccuracy: 91, passesTotal: 71, duelsWon: 68, duelsTotal: 18, tackles: 6, dribblesSuccess: 1, shotsTotal: 1, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 3, foulsDrawn: 1, yellowCards: 1, redCards: 0, rating: 7.4, trend: "up" },
      { name: "F. König", num: 7, pos: "RA", km: 10.5, topSpeed: 33.1, sprints: 52, sprintDistanceM: 980, avgSpeed: 8.1, minutesPlayed: 85, heatmap: generateHeatmap("RA", 4), passAccuracy: 82, passesTotal: 35, duelsWon: 55, duelsTotal: 12, tackles: 2, dribblesSuccess: 6, shotsTotal: 3, shotsOnGoal: 2, goals: 1, assists: 0, foulsCommitted: 1, foulsDrawn: 3, yellowCards: 0, redCards: 0, rating: 7.9, trend: "up" },
      { name: "A. Vogt", num: 10, pos: "ZOM", km: 10.9, topSpeed: 30.2, sprints: 44, sprintDistanceM: 820, avgSpeed: 7.6, minutesPlayed: 90, heatmap: generateHeatmap("ZOM", 5), passAccuracy: 86, passesTotal: 54, duelsWon: 52, duelsTotal: 11, tackles: 1, dribblesSuccess: 4, shotsTotal: 4, shotsOnGoal: 2, goals: 0, assists: 0, foulsCommitted: 0, foulsDrawn: 2, yellowCards: 0, redCards: 0, rating: 7.5, trend: "stable" },
      { name: "M. Berger", num: 4, pos: "IV", km: 10.2, topSpeed: 27.8, sprints: 28, sprintDistanceM: 520, avgSpeed: 6.8, minutesPlayed: 90, heatmap: generateHeatmap("IV", 6), passAccuracy: 88, passesTotal: 58, duelsWon: 72, duelsTotal: 22, tackles: 7, dribblesSuccess: 0, shotsTotal: 1, shotsOnGoal: 1, goals: 0, assists: 0, foulsCommitted: 2, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 7.6, trend: "up" },
      { name: "F. Hauser", num: 3, pos: "LV", km: 10.8, topSpeed: 30.5, sprints: 45, sprintDistanceM: 840, avgSpeed: 7.4, minutesPlayed: 90, heatmap: generateHeatmap("LV", 7), passAccuracy: 84, passesTotal: 42, duelsWon: 65, duelsTotal: 15, tackles: 4, dribblesSuccess: 2, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 1, yellowCards: 0, redCards: 0, rating: 7.2, trend: "stable" },
      { name: "N. Roth", num: 2, pos: "RV", km: 11.1, topSpeed: 31.2, sprints: 47, sprintDistanceM: 870, avgSpeed: 7.5, minutesPlayed: 90, heatmap: generateHeatmap("RV", 8), passAccuracy: 85, passesTotal: 45, duelsWon: 61, duelsTotal: 14, tackles: 5, dribblesSuccess: 1, shotsTotal: 1, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 2, foulsDrawn: 1, yellowCards: 0, redCards: 0, rating: 7.3, trend: "down" },
      { name: "P. Schwarz", num: 5, pos: "IV", km: 9.8, topSpeed: 26.9, sprints: 25, sprintDistanceM: 460, avgSpeed: 6.5, minutesPlayed: 90, heatmap: generateHeatmap("IV", 9), passAccuracy: 90, passesTotal: 65, duelsWon: 75, duelsTotal: 20, tackles: 8, dribblesSuccess: 0, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 7.7, trend: "stable" },
      { name: "D. Werner", num: 11, pos: "LA", km: 10.3, topSpeed: 32.8, sprints: 50, sprintDistanceM: 940, avgSpeed: 8.0, minutesPlayed: 78, heatmap: generateHeatmap("LA", 10), passAccuracy: 80, passesTotal: 32, duelsWon: 48, duelsTotal: 10, tackles: 1, dribblesSuccess: 5, shotsTotal: 2, shotsOnGoal: 1, goals: 0, assists: 0, foulsCommitted: 0, foulsDrawn: 3, yellowCards: 0, redCards: 0, rating: 7.1, trend: "down" },
      { name: "K. Fischer", num: 1, pos: "TW", km: 5.8, topSpeed: 24.2, sprints: 8, sprintDistanceM: 120, avgSpeed: 4.8, minutesPlayed: 90, heatmap: generateHeatmap("TW", 11), passAccuracy: 72, passesTotal: 28, duelsWon: 100, duelsTotal: 2, tackles: 0, dribblesSuccess: 0, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 0, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 7.4, trend: "stable" },
    ],
    teamStats: { possession: 56, totalKm: 10.4, avgSpeed: 7.3, topSpeed: 33.1, sprints: 427, passes: 458, passAccuracy: 85, shotsOnTarget: 8, shotsTotal: 14, corners: 6, fouls: 12, yellowCards: 1, redCards: 0, offsides: 2 },
    heatmapGrid: generateTeamHeatmap(1),
    apiStats: { xG: 1.85, xGA: 0.92, ppda: 9.2, fieldTilt: 58, shotConversion: 21, duelWinRate: 54, aerialWinRate: 52, crossAccuracy: 32, counterAttacks: 5, setPlayGoals: 0 },
  },

  // Dataset 2: TSV Grünwald vs SC Waldheim
  {
    matchInfo: {
      homeTeam: "TSV Grünwald",
      awayTeam: "SC Waldheim",
      homeScore: 3,
      awayScore: 2,
      date: "Sa, 8. März 2026 · 14:00",
      venue: "Waldsportanlage",
    },
    players: [
      { name: "L. Meier", num: 9, pos: "ST", km: 11.2, topSpeed: 33.8, sprints: 55, sprintDistanceM: 1020, avgSpeed: 8.2, minutesPlayed: 90, heatmap: generateHeatmap("ST", 21), passAccuracy: 75, passesTotal: 24, duelsWon: 58, duelsTotal: 18, tackles: 0, dribblesSuccess: 4, shotsTotal: 6, shotsOnGoal: 4, goals: 2, assists: 0, foulsCommitted: 3, foulsDrawn: 5, yellowCards: 1, redCards: 0, rating: 8.6, trend: "up" },
      { name: "K. Huber", num: 8, pos: "ZM", km: 12.1, topSpeed: 28.9, sprints: 40, sprintDistanceM: 740, avgSpeed: 7.4, minutesPlayed: 90, heatmap: generateHeatmap("ZM", 22), passAccuracy: 92, passesTotal: 68, duelsWon: 62, duelsTotal: 16, tackles: 4, dribblesSuccess: 3, shotsTotal: 1, shotsOnGoal: 1, goals: 1, assists: 1, foulsCommitted: 1, foulsDrawn: 2, yellowCards: 0, redCards: 0, rating: 8.1, trend: "up" },
      { name: "J. Weber", num: 6, pos: "ZDM", km: 11.5, topSpeed: 27.2, sprints: 32, sprintDistanceM: 590, avgSpeed: 6.9, minutesPlayed: 90, heatmap: generateHeatmap("ZDM", 23), passAccuracy: 88, passesTotal: 72, duelsWon: 71, duelsTotal: 21, tackles: 7, dribblesSuccess: 1, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 4, foulsDrawn: 1, yellowCards: 1, redCards: 0, rating: 7.2, trend: "stable" },
      { name: "R. Schmidt", num: 7, pos: "RA", km: 10.8, topSpeed: 34.2, sprints: 58, sprintDistanceM: 1080, avgSpeed: 8.4, minutesPlayed: 90, heatmap: generateHeatmap("RA", 24), passAccuracy: 79, passesTotal: 38, duelsWon: 52, duelsTotal: 14, tackles: 2, dribblesSuccess: 7, shotsTotal: 4, shotsOnGoal: 2, goals: 0, assists: 1, foulsCommitted: 1, foulsDrawn: 4, yellowCards: 0, redCards: 0, rating: 7.7, trend: "stable" },
      { name: "P. Bauer", num: 10, pos: "ZOM", km: 10.6, topSpeed: 29.5, sprints: 41, sprintDistanceM: 760, avgSpeed: 7.5, minutesPlayed: 82, heatmap: generateHeatmap("ZOM", 25), passAccuracy: 84, passesTotal: 48, duelsWon: 50, duelsTotal: 12, tackles: 1, dribblesSuccess: 3, shotsTotal: 3, shotsOnGoal: 1, goals: 0, assists: 1, foulsCommitted: 0, foulsDrawn: 2, yellowCards: 0, redCards: 0, rating: 7.4, trend: "down" },
      { name: "T. Klein", num: 4, pos: "IV", km: 9.9, topSpeed: 26.5, sprints: 24, sprintDistanceM: 440, avgSpeed: 6.4, minutesPlayed: 90, heatmap: generateHeatmap("IV", 26), passAccuracy: 86, passesTotal: 55, duelsWon: 68, duelsTotal: 24, tackles: 6, dribblesSuccess: 0, shotsTotal: 1, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 2, foulsDrawn: 1, yellowCards: 0, redCards: 0, rating: 7.0, trend: "stable" },
      { name: "M. Wolf", num: 3, pos: "LV", km: 11.0, topSpeed: 31.8, sprints: 48, sprintDistanceM: 890, avgSpeed: 7.6, minutesPlayed: 90, heatmap: generateHeatmap("LV", 27), passAccuracy: 82, passesTotal: 44, duelsWon: 60, duelsTotal: 16, tackles: 5, dribblesSuccess: 2, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 2, foulsDrawn: 1, yellowCards: 0, redCards: 0, rating: 7.1, trend: "up" },
      { name: "S. Fuchs", num: 2, pos: "RV", km: 10.9, topSpeed: 30.8, sprints: 46, sprintDistanceM: 850, avgSpeed: 7.4, minutesPlayed: 90, heatmap: generateHeatmap("RV", 28), passAccuracy: 83, passesTotal: 46, duelsWon: 58, duelsTotal: 15, tackles: 4, dribblesSuccess: 1, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 7.0, trend: "stable" },
      { name: "A. Richter", num: 5, pos: "IV", km: 10.0, topSpeed: 27.1, sprints: 26, sprintDistanceM: 480, avgSpeed: 6.6, minutesPlayed: 90, heatmap: generateHeatmap("IV", 29), passAccuracy: 89, passesTotal: 62, duelsWon: 74, duelsTotal: 22, tackles: 9, dribblesSuccess: 0, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 3, foulsDrawn: 0, yellowCards: 1, redCards: 0, rating: 7.3, trend: "up" },
      { name: "B. Neumann", num: 11, pos: "LA", km: 10.4, topSpeed: 33.5, sprints: 53, sprintDistanceM: 980, avgSpeed: 8.1, minutesPlayed: 90, heatmap: generateHeatmap("LA", 30), passAccuracy: 78, passesTotal: 30, duelsWon: 45, duelsTotal: 11, tackles: 1, dribblesSuccess: 4, shotsTotal: 2, shotsOnGoal: 1, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 4, yellowCards: 0, redCards: 0, rating: 7.0, trend: "stable" },
      { name: "E. Hofmann", num: 1, pos: "TW", km: 5.6, topSpeed: 23.8, sprints: 7, sprintDistanceM: 100, avgSpeed: 4.6, minutesPlayed: 90, heatmap: generateHeatmap("TW", 31), passAccuracy: 68, passesTotal: 32, duelsWon: 85, duelsTotal: 4, tackles: 0, dribblesSuccess: 0, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 0, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 6.8, trend: "down" },
    ],
    teamStats: { possession: 52, totalKm: 10.5, avgSpeed: 7.4, topSpeed: 34.2, sprints: 430, passes: 482, passAccuracy: 83, shotsOnTarget: 9, shotsTotal: 17, corners: 5, fouls: 15, yellowCards: 3, redCards: 0, offsides: 3 },
    heatmapGrid: generateTeamHeatmap(2),
    apiStats: { xG: 2.45, xGA: 1.68, ppda: 8.5, fieldTilt: 54, shotConversion: 25, duelWinRate: 56, aerialWinRate: 48, crossAccuracy: 28, counterAttacks: 7, setPlayGoals: 1 },
  },

  // Dataset 3: VfB Sternberg vs Eintracht Bergfeld
  {
    matchInfo: {
      homeTeam: "VfB Sternberg",
      awayTeam: "Eintracht Bergfeld",
      homeScore: 1,
      awayScore: 1,
      date: "So, 15. März 2026 · 15:00",
      venue: "Sternberg Arena",
    },
    players: [
      { name: "C. Keller", num: 9, pos: "ST", km: 10.2, topSpeed: 31.5, sprints: 42, sprintDistanceM: 780, avgSpeed: 7.5, minutesPlayed: 90, heatmap: generateHeatmap("ST", 41), passAccuracy: 72, passesTotal: 22, duelsWon: 55, duelsTotal: 20, tackles: 1, dribblesSuccess: 3, shotsTotal: 4, shotsOnGoal: 2, goals: 1, assists: 0, foulsCommitted: 2, foulsDrawn: 3, yellowCards: 0, redCards: 0, rating: 7.4, trend: "stable" },
      { name: "H. Beck", num: 8, pos: "ZM", km: 11.6, topSpeed: 28.2, sprints: 38, sprintDistanceM: 700, avgSpeed: 7.2, minutesPlayed: 90, heatmap: generateHeatmap("ZM", 42), passAccuracy: 87, passesTotal: 58, duelsWon: 60, duelsTotal: 15, tackles: 3, dribblesSuccess: 2, shotsTotal: 2, shotsOnGoal: 1, goals: 0, assists: 0, foulsCommitted: 2, foulsDrawn: 1, yellowCards: 0, redCards: 0, rating: 7.1, trend: "stable" },
      { name: "G. Lorenz", num: 6, pos: "ZDM", km: 11.9, topSpeed: 27.8, sprints: 35, sprintDistanceM: 650, avgSpeed: 7.0, minutesPlayed: 90, heatmap: generateHeatmap("ZDM", 43), passAccuracy: 90, passesTotal: 74, duelsWon: 70, duelsTotal: 19, tackles: 8, dribblesSuccess: 0, shotsTotal: 1, shotsOnGoal: 0, goals: 0, assists: 1, foulsCommitted: 3, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 7.5, trend: "up" },
      { name: "O. Krause", num: 7, pos: "RA", km: 10.1, topSpeed: 32.5, sprints: 50, sprintDistanceM: 920, avgSpeed: 7.9, minutesPlayed: 75, heatmap: generateHeatmap("RA", 44), passAccuracy: 76, passesTotal: 32, duelsWon: 48, duelsTotal: 12, tackles: 1, dribblesSuccess: 5, shotsTotal: 2, shotsOnGoal: 1, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 2, yellowCards: 0, redCards: 0, rating: 6.8, trend: "down" },
      { name: "W. Peters", num: 10, pos: "ZOM", km: 10.4, topSpeed: 29.1, sprints: 39, sprintDistanceM: 720, avgSpeed: 7.4, minutesPlayed: 90, heatmap: generateHeatmap("ZOM", 45), passAccuracy: 82, passesTotal: 46, duelsWon: 52, duelsTotal: 13, tackles: 2, dribblesSuccess: 4, shotsTotal: 3, shotsOnGoal: 1, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 2, yellowCards: 0, redCards: 0, rating: 7.0, trend: "stable" },
      { name: "U. Sommer", num: 4, pos: "IV", km: 9.8, topSpeed: 26.2, sprints: 22, sprintDistanceM: 400, avgSpeed: 6.3, minutesPlayed: 90, heatmap: generateHeatmap("IV", 46), passAccuracy: 85, passesTotal: 52, duelsWon: 75, duelsTotal: 25, tackles: 7, dribblesSuccess: 0, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 7.3, trend: "stable" },
      { name: "I. Lang", num: 3, pos: "LV", km: 10.5, topSpeed: 30.2, sprints: 43, sprintDistanceM: 790, avgSpeed: 7.3, minutesPlayed: 90, heatmap: generateHeatmap("LV", 47), passAccuracy: 80, passesTotal: 40, duelsWon: 62, duelsTotal: 16, tackles: 4, dribblesSuccess: 2, shotsTotal: 1, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 2, foulsDrawn: 1, yellowCards: 1, redCards: 0, rating: 6.9, trend: "down" },
      { name: "V. Stein", num: 2, pos: "RV", km: 10.7, topSpeed: 30.5, sprints: 44, sprintDistanceM: 810, avgSpeed: 7.4, minutesPlayed: 90, heatmap: generateHeatmap("RV", 48), passAccuracy: 81, passesTotal: 42, duelsWon: 58, duelsTotal: 14, tackles: 3, dribblesSuccess: 1, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 1, yellowCards: 0, redCards: 0, rating: 7.0, trend: "stable" },
      { name: "Z. Frank", num: 5, pos: "IV", km: 9.6, topSpeed: 25.8, sprints: 20, sprintDistanceM: 360, avgSpeed: 6.1, minutesPlayed: 90, heatmap: generateHeatmap("IV", 49), passAccuracy: 88, passesTotal: 60, duelsWon: 78, duelsTotal: 23, tackles: 9, dribblesSuccess: 0, shotsTotal: 1, shotsOnGoal: 1, goals: 0, assists: 0, foulsCommitted: 2, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 7.6, trend: "up" },
      { name: "Q. Engel", num: 11, pos: "LA", km: 9.9, topSpeed: 32.1, sprints: 48, sprintDistanceM: 880, avgSpeed: 7.8, minutesPlayed: 68, heatmap: generateHeatmap("LA", 50), passAccuracy: 74, passesTotal: 26, duelsWon: 42, duelsTotal: 10, tackles: 0, dribblesSuccess: 3, shotsTotal: 1, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 0, foulsDrawn: 2, yellowCards: 0, redCards: 0, rating: 6.5, trend: "down" },
      { name: "Y. Gross", num: 1, pos: "TW", km: 5.4, topSpeed: 22.5, sprints: 5, sprintDistanceM: 80, avgSpeed: 4.4, minutesPlayed: 90, heatmap: generateHeatmap("TW", 51), passAccuracy: 70, passesTotal: 30, duelsWon: 90, duelsTotal: 3, tackles: 0, dribblesSuccess: 0, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 0, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 7.2, trend: "stable" },
    ],
    teamStats: { possession: 48, totalKm: 10.0, avgSpeed: 7.0, topSpeed: 32.5, sprints: 386, passes: 412, passAccuracy: 81, shotsOnTarget: 6, shotsTotal: 15, corners: 4, fouls: 14, yellowCards: 1, redCards: 0, offsides: 4 },
    heatmapGrid: generateTeamHeatmap(3),
    apiStats: { xG: 1.22, xGA: 1.35, ppda: 11.2, fieldTilt: 46, shotConversion: 15, duelWinRate: 51, aerialWinRate: 55, crossAccuracy: 25, counterAttacks: 4, setPlayGoals: 0 },
  },

  // Dataset 4: SC Nordheim vs FSV Südstadt
  {
    matchInfo: {
      homeTeam: "SC Nordheim",
      awayTeam: "FSV Südstadt",
      homeScore: 4,
      awayScore: 0,
      date: "Sa, 22. März 2026 · 15:30",
      venue: "Nordheim Stadion",
    },
    players: [
      { name: "D. Adler", num: 9, pos: "ST", km: 11.5, topSpeed: 34.5, sprints: 60, sprintDistanceM: 1120, avgSpeed: 8.5, minutesPlayed: 90, heatmap: generateHeatmap("ST", 61), passAccuracy: 82, passesTotal: 30, duelsWon: 65, duelsTotal: 18, tackles: 1, dribblesSuccess: 6, shotsTotal: 7, shotsOnGoal: 5, goals: 2, assists: 1, foulsCommitted: 1, foulsDrawn: 4, yellowCards: 0, redCards: 0, rating: 9.1, trend: "up" },
      { name: "F. Hahn", num: 8, pos: "ZM", km: 12.3, topSpeed: 29.5, sprints: 44, sprintDistanceM: 820, avgSpeed: 7.6, minutesPlayed: 90, heatmap: generateHeatmap("ZM", 62), passAccuracy: 93, passesTotal: 75, duelsWon: 68, duelsTotal: 15, tackles: 5, dribblesSuccess: 3, shotsTotal: 2, shotsOnGoal: 2, goals: 1, assists: 2, foulsCommitted: 0, foulsDrawn: 1, yellowCards: 0, redCards: 0, rating: 8.8, trend: "up" },
      { name: "N. Vogel", num: 6, pos: "ZDM", km: 11.8, topSpeed: 28.1, sprints: 36, sprintDistanceM: 670, avgSpeed: 7.1, minutesPlayed: 90, heatmap: generateHeatmap("ZDM", 63), passAccuracy: 91, passesTotal: 78, duelsWon: 72, duelsTotal: 20, tackles: 8, dribblesSuccess: 1, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 2, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 7.8, trend: "stable" },
      { name: "L. Jäger", num: 7, pos: "RA", km: 11.0, topSpeed: 35.2, sprints: 62, sprintDistanceM: 1150, avgSpeed: 8.6, minutesPlayed: 90, heatmap: generateHeatmap("RA", 64), passAccuracy: 85, passesTotal: 42, duelsWon: 60, duelsTotal: 14, tackles: 2, dribblesSuccess: 8, shotsTotal: 4, shotsOnGoal: 3, goals: 1, assists: 1, foulsCommitted: 0, foulsDrawn: 5, yellowCards: 0, redCards: 0, rating: 8.5, trend: "up" },
      { name: "M. Krug", num: 10, pos: "ZOM", km: 10.8, topSpeed: 30.8, sprints: 46, sprintDistanceM: 850, avgSpeed: 7.8, minutesPlayed: 85, heatmap: generateHeatmap("ZOM", 65), passAccuracy: 88, passesTotal: 58, duelsWon: 55, duelsTotal: 12, tackles: 1, dribblesSuccess: 5, shotsTotal: 3, shotsOnGoal: 2, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 2, yellowCards: 0, redCards: 0, rating: 7.6, trend: "stable" },
      { name: "B. Ernst", num: 4, pos: "IV", km: 10.1, topSpeed: 27.5, sprints: 26, sprintDistanceM: 480, avgSpeed: 6.7, minutesPlayed: 90, heatmap: generateHeatmap("IV", 66), passAccuracy: 90, passesTotal: 62, duelsWon: 80, duelsTotal: 18, tackles: 6, dribblesSuccess: 0, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 7.9, trend: "up" },
      { name: "R. Kraft", num: 3, pos: "LV", km: 11.2, topSpeed: 31.5, sprints: 50, sprintDistanceM: 930, avgSpeed: 7.7, minutesPlayed: 90, heatmap: generateHeatmap("LV", 67), passAccuracy: 86, passesTotal: 48, duelsWon: 68, duelsTotal: 15, tackles: 4, dribblesSuccess: 3, shotsTotal: 1, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 1, yellowCards: 0, redCards: 0, rating: 7.5, trend: "stable" },
      { name: "T. Sturm", num: 2, pos: "RV", km: 11.3, topSpeed: 32.0, sprints: 52, sprintDistanceM: 960, avgSpeed: 7.8, minutesPlayed: 90, heatmap: generateHeatmap("RV", 68), passAccuracy: 87, passesTotal: 50, duelsWon: 65, duelsTotal: 14, tackles: 5, dribblesSuccess: 2, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 0, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 7.6, trend: "up" },
      { name: "H. Frei", num: 5, pos: "IV", km: 9.9, topSpeed: 26.8, sprints: 24, sprintDistanceM: 440, avgSpeed: 6.5, minutesPlayed: 90, heatmap: generateHeatmap("IV", 69), passAccuracy: 92, passesTotal: 68, duelsWon: 82, duelsTotal: 20, tackles: 7, dribblesSuccess: 0, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 8.0, trend: "stable" },
      { name: "S. Horn", num: 11, pos: "LA", km: 10.6, topSpeed: 34.0, sprints: 55, sprintDistanceM: 1020, avgSpeed: 8.3, minutesPlayed: 90, heatmap: generateHeatmap("LA", 70), passAccuracy: 82, passesTotal: 36, duelsWon: 52, duelsTotal: 11, tackles: 1, dribblesSuccess: 6, shotsTotal: 3, shotsOnGoal: 2, goals: 0, assists: 0, foulsCommitted: 0, foulsDrawn: 3, yellowCards: 0, redCards: 0, rating: 7.4, trend: "up" },
      { name: "J. Stern", num: 1, pos: "TW", km: 5.2, topSpeed: 21.8, sprints: 4, sprintDistanceM: 60, avgSpeed: 4.2, minutesPlayed: 90, heatmap: generateHeatmap("TW", 71), passAccuracy: 75, passesTotal: 25, duelsWon: 100, duelsTotal: 1, tackles: 0, dribblesSuccess: 0, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 0, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 7.5, trend: "stable" },
    ],
    teamStats: { possession: 64, totalKm: 10.7, avgSpeed: 7.6, topSpeed: 35.2, sprints: 459, passes: 535, passAccuracy: 88, shotsOnTarget: 12, shotsTotal: 20, corners: 8, fouls: 7, yellowCards: 0, redCards: 0, offsides: 1 },
    heatmapGrid: generateTeamHeatmap(4),
    apiStats: { xG: 3.12, xGA: 0.45, ppda: 7.8, fieldTilt: 68, shotConversion: 28, duelWinRate: 62, aerialWinRate: 58, crossAccuracy: 38, counterAttacks: 3, setPlayGoals: 1 },
  },

  // Dataset 5: Fortuna Ostmark vs Dynamo Westfalen
  {
    matchInfo: {
      homeTeam: "Fortuna Ostmark",
      awayTeam: "Dynamo Westfalen",
      homeScore: 0,
      awayScore: 2,
      date: "So, 29. März 2026 · 14:00",
      venue: "Ostmark Sportpark",
    },
    players: [
      { name: "E. Ritter", num: 9, pos: "ST", km: 9.8, topSpeed: 30.2, sprints: 38, sprintDistanceM: 700, avgSpeed: 7.2, minutesPlayed: 90, heatmap: generateHeatmap("ST", 81), passAccuracy: 68, passesTotal: 18, duelsWon: 42, duelsTotal: 22, tackles: 0, dribblesSuccess: 2, shotsTotal: 3, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 3, foulsDrawn: 2, yellowCards: 1, redCards: 0, rating: 5.8, trend: "down" },
      { name: "K. Baum", num: 8, pos: "ZM", km: 11.0, topSpeed: 28.0, sprints: 36, sprintDistanceM: 660, avgSpeed: 7.0, minutesPlayed: 90, heatmap: generateHeatmap("ZM", 82), passAccuracy: 82, passesTotal: 52, duelsWon: 48, duelsTotal: 18, tackles: 2, dribblesSuccess: 1, shotsTotal: 1, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 2, foulsDrawn: 1, yellowCards: 0, redCards: 0, rating: 6.2, trend: "down" },
      { name: "P. Grund", num: 6, pos: "ZDM", km: 11.2, topSpeed: 26.8, sprints: 30, sprintDistanceM: 550, avgSpeed: 6.7, minutesPlayed: 90, heatmap: generateHeatmap("ZDM", 83), passAccuracy: 85, passesTotal: 64, duelsWon: 55, duelsTotal: 22, tackles: 5, dribblesSuccess: 0, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 4, foulsDrawn: 0, yellowCards: 1, redCards: 0, rating: 6.5, trend: "stable" },
      { name: "W. Blatt", num: 7, pos: "RA", km: 9.5, topSpeed: 31.0, sprints: 42, sprintDistanceM: 780, avgSpeed: 7.5, minutesPlayed: 70, heatmap: generateHeatmap("RA", 84), passAccuracy: 70, passesTotal: 25, duelsWon: 38, duelsTotal: 14, tackles: 1, dribblesSuccess: 3, shotsTotal: 2, shotsOnGoal: 1, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 1, yellowCards: 0, redCards: 0, rating: 5.9, trend: "down" },
      { name: "O. Luft", num: 10, pos: "ZOM", km: 10.0, topSpeed: 28.5, sprints: 35, sprintDistanceM: 650, avgSpeed: 7.1, minutesPlayed: 90, heatmap: generateHeatmap("ZOM", 85), passAccuracy: 78, passesTotal: 40, duelsWon: 45, duelsTotal: 15, tackles: 1, dribblesSuccess: 2, shotsTotal: 2, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 2, yellowCards: 0, redCards: 0, rating: 6.0, trend: "stable" },
      { name: "U. Wald", num: 4, pos: "IV", km: 9.5, topSpeed: 25.5, sprints: 20, sprintDistanceM: 360, avgSpeed: 6.2, minutesPlayed: 90, heatmap: generateHeatmap("IV", 86), passAccuracy: 80, passesTotal: 48, duelsWon: 58, duelsTotal: 28, tackles: 5, dribblesSuccess: 0, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 3, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 6.3, trend: "down" },
      { name: "I. Feld", num: 3, pos: "LV", km: 10.2, topSpeed: 29.5, sprints: 40, sprintDistanceM: 740, avgSpeed: 7.2, minutesPlayed: 90, heatmap: generateHeatmap("LV", 87), passAccuracy: 76, passesTotal: 35, duelsWon: 52, duelsTotal: 18, tackles: 3, dribblesSuccess: 1, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 2, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 6.1, trend: "stable" },
      { name: "Y. Berg", num: 2, pos: "RV", km: 10.4, topSpeed: 29.8, sprints: 41, sprintDistanceM: 760, avgSpeed: 7.3, minutesPlayed: 90, heatmap: generateHeatmap("RV", 88), passAccuracy: 78, passesTotal: 38, duelsWon: 50, duelsTotal: 16, tackles: 4, dribblesSuccess: 1, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 1, yellowCards: 0, redCards: 0, rating: 6.2, trend: "stable" },
      { name: "X. See", num: 5, pos: "IV", km: 9.3, topSpeed: 25.2, sprints: 18, sprintDistanceM: 320, avgSpeed: 6.0, minutesPlayed: 90, heatmap: generateHeatmap("IV", 89), passAccuracy: 82, passesTotal: 55, duelsWon: 62, duelsTotal: 26, tackles: 6, dribblesSuccess: 0, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 2, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 6.4, trend: "stable" },
      { name: "V. Wind", num: 11, pos: "LA", km: 9.2, topSpeed: 30.5, sprints: 40, sprintDistanceM: 740, avgSpeed: 7.4, minutesPlayed: 65, heatmap: generateHeatmap("LA", 90), passAccuracy: 68, passesTotal: 20, duelsWon: 35, duelsTotal: 12, tackles: 0, dribblesSuccess: 2, shotsTotal: 1, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 0, foulsDrawn: 1, yellowCards: 0, redCards: 0, rating: 5.5, trend: "down" },
      { name: "A. Fluss", num: 1, pos: "TW", km: 5.5, topSpeed: 23.0, sprints: 6, sprintDistanceM: 90, avgSpeed: 4.5, minutesPlayed: 90, heatmap: generateHeatmap("TW", 91), passAccuracy: 65, passesTotal: 28, duelsWon: 70, duelsTotal: 8, tackles: 0, dribblesSuccess: 0, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 0, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 6.0, trend: "down" },
    ],
    teamStats: { possession: 42, totalKm: 9.8, avgSpeed: 6.9, topSpeed: 31.0, sprints: 346, passes: 378, passAccuracy: 76, shotsOnTarget: 1, shotsTotal: 9, corners: 3, fouls: 18, yellowCards: 2, redCards: 0, offsides: 5 },
    heatmapGrid: generateTeamHeatmap(5),
    apiStats: { xG: 0.58, xGA: 2.15, ppda: 14.5, fieldTilt: 38, shotConversion: 0, duelWinRate: 42, aerialWinRate: 45, crossAccuracy: 18, counterAttacks: 2, setPlayGoals: 0 },
  },

  // Dataset 6: Union Talstadt vs Kickers Höhenberg
  {
    matchInfo: {
      homeTeam: "Union Talstadt",
      awayTeam: "Kickers Höhenberg",
      homeScore: 2,
      awayScore: 2,
      date: "Sa, 5. April 2026 · 15:00",
      venue: "Talstadion",
    },
    players: [
      { name: "M. Zweig", num: 9, pos: "ST", km: 10.6, topSpeed: 32.8, sprints: 52, sprintDistanceM: 960, avgSpeed: 8.0, minutesPlayed: 90, heatmap: generateHeatmap("ST", 101), passAccuracy: 76, passesTotal: 26, duelsWon: 58, duelsTotal: 19, tackles: 1, dribblesSuccess: 4, shotsTotal: 5, shotsOnGoal: 3, goals: 1, assists: 0, foulsCommitted: 2, foulsDrawn: 4, yellowCards: 0, redCards: 0, rating: 7.8, trend: "up" },
      { name: "S. Wurzel", num: 8, pos: "ZM", km: 11.8, topSpeed: 29.2, sprints: 42, sprintDistanceM: 780, avgSpeed: 7.4, minutesPlayed: 90, heatmap: generateHeatmap("ZM", 102), passAccuracy: 88, passesTotal: 64, duelsWon: 62, duelsTotal: 16, tackles: 4, dribblesSuccess: 2, shotsTotal: 1, shotsOnGoal: 1, goals: 1, assists: 0, foulsCommitted: 1, foulsDrawn: 2, yellowCards: 0, redCards: 0, rating: 7.9, trend: "stable" },
      { name: "B. Stamm", num: 6, pos: "ZDM", km: 11.5, topSpeed: 27.5, sprints: 34, sprintDistanceM: 630, avgSpeed: 6.9, minutesPlayed: 90, heatmap: generateHeatmap("ZDM", 103), passAccuracy: 89, passesTotal: 70, duelsWon: 68, duelsTotal: 20, tackles: 7, dribblesSuccess: 0, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 1, foulsCommitted: 3, foulsDrawn: 1, yellowCards: 0, redCards: 0, rating: 7.3, trend: "stable" },
      { name: "F. Laub", num: 7, pos: "RA", km: 10.4, topSpeed: 33.5, sprints: 55, sprintDistanceM: 1020, avgSpeed: 8.2, minutesPlayed: 88, heatmap: generateHeatmap("RA", 104), passAccuracy: 80, passesTotal: 36, duelsWon: 52, duelsTotal: 13, tackles: 2, dribblesSuccess: 6, shotsTotal: 3, shotsOnGoal: 1, goals: 0, assists: 1, foulsCommitted: 0, foulsDrawn: 3, yellowCards: 0, redCards: 0, rating: 7.5, trend: "up" },
      { name: "K. Ast", num: 10, pos: "ZOM", km: 10.5, topSpeed: 29.8, sprints: 43, sprintDistanceM: 800, avgSpeed: 7.6, minutesPlayed: 90, heatmap: generateHeatmap("ZOM", 105), passAccuracy: 84, passesTotal: 52, duelsWon: 50, duelsTotal: 12, tackles: 1, dribblesSuccess: 4, shotsTotal: 4, shotsOnGoal: 2, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 2, yellowCards: 0, redCards: 0, rating: 7.2, trend: "stable" },
      { name: "R. Rinde", num: 4, pos: "IV", km: 9.9, topSpeed: 26.8, sprints: 25, sprintDistanceM: 460, avgSpeed: 6.5, minutesPlayed: 90, heatmap: generateHeatmap("IV", 106), passAccuracy: 86, passesTotal: 56, duelsWon: 72, duelsTotal: 24, tackles: 6, dribblesSuccess: 0, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 2, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 7.1, trend: "stable" },
      { name: "T. Moos", num: 3, pos: "LV", km: 10.8, topSpeed: 30.8, sprints: 47, sprintDistanceM: 870, avgSpeed: 7.5, minutesPlayed: 90, heatmap: generateHeatmap("LV", 107), passAccuracy: 82, passesTotal: 44, duelsWon: 60, duelsTotal: 16, tackles: 4, dribblesSuccess: 2, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 1, yellowCards: 0, redCards: 0, rating: 7.0, trend: "stable" },
      { name: "H. Stein", num: 2, pos: "RV", km: 10.9, topSpeed: 31.0, sprints: 48, sprintDistanceM: 890, avgSpeed: 7.5, minutesPlayed: 90, heatmap: generateHeatmap("RV", 108), passAccuracy: 83, passesTotal: 46, duelsWon: 58, duelsTotal: 15, tackles: 5, dribblesSuccess: 1, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 7.0, trend: "stable" },
      { name: "P. Kies", num: 5, pos: "IV", km: 9.7, topSpeed: 26.2, sprints: 22, sprintDistanceM: 400, avgSpeed: 6.3, minutesPlayed: 90, heatmap: generateHeatmap("IV", 109), passAccuracy: 88, passesTotal: 62, duelsWon: 75, duelsTotal: 22, tackles: 8, dribblesSuccess: 0, shotsTotal: 1, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 7.4, trend: "up" },
      { name: "L. Sand", num: 11, pos: "LA", km: 10.2, topSpeed: 32.5, sprints: 50, sprintDistanceM: 920, avgSpeed: 7.9, minutesPlayed: 82, heatmap: generateHeatmap("LA", 110), passAccuracy: 76, passesTotal: 30, duelsWon: 45, duelsTotal: 11, tackles: 0, dribblesSuccess: 4, shotsTotal: 2, shotsOnGoal: 1, goals: 0, assists: 0, foulsCommitted: 0, foulsDrawn: 3, yellowCards: 0, redCards: 0, rating: 6.9, trend: "stable" },
      { name: "N. Lehm", num: 1, pos: "TW", km: 5.6, topSpeed: 23.5, sprints: 7, sprintDistanceM: 100, avgSpeed: 4.6, minutesPlayed: 90, heatmap: generateHeatmap("TW", 111), passAccuracy: 70, passesTotal: 30, duelsWon: 75, duelsTotal: 6, tackles: 0, dribblesSuccess: 0, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 0, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 6.5, trend: "down" },
    ],
    teamStats: { possession: 52, totalKm: 10.4, avgSpeed: 7.3, topSpeed: 33.5, sprints: 425, passes: 468, passAccuracy: 83, shotsOnTarget: 8, shotsTotal: 16, corners: 5, fouls: 11, yellowCards: 0, redCards: 0, offsides: 2 },
    heatmapGrid: generateTeamHeatmap(6),
    apiStats: { xG: 1.95, xGA: 1.82, ppda: 9.8, fieldTilt: 52, shotConversion: 18, duelWinRate: 54, aerialWinRate: 50, crossAccuracy: 30, counterAttacks: 6, setPlayGoals: 0 },
  },

  // Dataset 7: Alemannia Rheinufer vs Borussia Eckfeld
  {
    matchInfo: {
      homeTeam: "Alemannia Rheinufer",
      awayTeam: "Borussia Eckfeld",
      homeScore: 3,
      awayScore: 1,
      date: "So, 12. April 2026 · 15:30",
      venue: "Rheinstadion",
    },
    players: [
      { name: "J. Anker", num: 9, pos: "ST", km: 11.0, topSpeed: 33.2, sprints: 54, sprintDistanceM: 1000, avgSpeed: 8.1, minutesPlayed: 90, heatmap: generateHeatmap("ST", 121), passAccuracy: 80, passesTotal: 28, duelsWon: 62, duelsTotal: 17, tackles: 1, dribblesSuccess: 5, shotsTotal: 6, shotsOnGoal: 4, goals: 2, assists: 0, foulsCommitted: 1, foulsDrawn: 4, yellowCards: 0, redCards: 0, rating: 8.4, trend: "up" },
      { name: "D. Kette", num: 8, pos: "ZM", km: 12.0, topSpeed: 29.0, sprints: 41, sprintDistanceM: 760, avgSpeed: 7.4, minutesPlayed: 90, heatmap: generateHeatmap("ZM", 122), passAccuracy: 90, passesTotal: 66, duelsWon: 64, duelsTotal: 15, tackles: 4, dribblesSuccess: 3, shotsTotal: 1, shotsOnGoal: 1, goals: 0, assists: 2, foulsCommitted: 1, foulsDrawn: 1, yellowCards: 0, redCards: 0, rating: 8.0, trend: "stable" },
      { name: "V. Tau", num: 6, pos: "ZDM", km: 11.6, topSpeed: 27.8, sprints: 35, sprintDistanceM: 650, avgSpeed: 7.0, minutesPlayed: 90, heatmap: generateHeatmap("ZDM", 123), passAccuracy: 91, passesTotal: 74, duelsWon: 70, duelsTotal: 19, tackles: 7, dribblesSuccess: 1, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 2, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 7.6, trend: "stable" },
      { name: "C. Segel", num: 7, pos: "RA", km: 10.6, topSpeed: 34.0, sprints: 58, sprintDistanceM: 1080, avgSpeed: 8.4, minutesPlayed: 90, heatmap: generateHeatmap("RA", 124), passAccuracy: 82, passesTotal: 38, duelsWon: 55, duelsTotal: 13, tackles: 2, dribblesSuccess: 7, shotsTotal: 3, shotsOnGoal: 2, goals: 1, assists: 0, foulsCommitted: 0, foulsDrawn: 4, yellowCards: 0, redCards: 0, rating: 8.1, trend: "up" },
      { name: "E. Ruder", num: 10, pos: "ZOM", km: 10.7, topSpeed: 30.0, sprints: 44, sprintDistanceM: 820, avgSpeed: 7.7, minutesPlayed: 85, heatmap: generateHeatmap("ZOM", 125), passAccuracy: 86, passesTotal: 54, duelsWon: 52, duelsTotal: 12, tackles: 1, dribblesSuccess: 4, shotsTotal: 3, shotsOnGoal: 1, goals: 0, assists: 1, foulsCommitted: 1, foulsDrawn: 2, yellowCards: 0, redCards: 0, rating: 7.5, trend: "stable" },
      { name: "A. Bug", num: 4, pos: "IV", km: 10.0, topSpeed: 27.2, sprints: 26, sprintDistanceM: 480, avgSpeed: 6.6, minutesPlayed: 90, heatmap: generateHeatmap("IV", 126), passAccuracy: 88, passesTotal: 58, duelsWon: 76, duelsTotal: 22, tackles: 7, dribblesSuccess: 0, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 7.7, trend: "up" },
      { name: "G. Heck", num: 3, pos: "LV", km: 10.9, topSpeed: 31.2, sprints: 49, sprintDistanceM: 910, avgSpeed: 7.6, minutesPlayed: 90, heatmap: generateHeatmap("LV", 127), passAccuracy: 84, passesTotal: 46, duelsWon: 63, duelsTotal: 15, tackles: 5, dribblesSuccess: 2, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 1, yellowCards: 0, redCards: 0, rating: 7.3, trend: "stable" },
      { name: "W. Steg", num: 2, pos: "RV", km: 11.0, topSpeed: 31.5, sprints: 50, sprintDistanceM: 930, avgSpeed: 7.6, minutesPlayed: 90, heatmap: generateHeatmap("RV", 128), passAccuracy: 85, passesTotal: 48, duelsWon: 62, duelsTotal: 14, tackles: 5, dribblesSuccess: 1, shotsTotal: 1, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 0, foulsDrawn: 1, yellowCards: 0, redCards: 0, rating: 7.4, trend: "up" },
      { name: "O. Kai", num: 5, pos: "IV", km: 9.8, topSpeed: 26.5, sprints: 23, sprintDistanceM: 420, avgSpeed: 6.4, minutesPlayed: 90, heatmap: generateHeatmap("IV", 129), passAccuracy: 90, passesTotal: 64, duelsWon: 78, duelsTotal: 21, tackles: 8, dribblesSuccess: 0, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 2, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 7.8, trend: "stable" },
      { name: "U. Mast", num: 11, pos: "LA", km: 10.4, topSpeed: 33.0, sprints: 52, sprintDistanceM: 960, avgSpeed: 8.0, minutesPlayed: 90, heatmap: generateHeatmap("LA", 130), passAccuracy: 78, passesTotal: 32, duelsWon: 48, duelsTotal: 11, tackles: 1, dribblesSuccess: 5, shotsTotal: 2, shotsOnGoal: 1, goals: 0, assists: 0, foulsCommitted: 0, foulsDrawn: 3, yellowCards: 0, redCards: 0, rating: 7.2, trend: "stable" },
      { name: "I. Welle", num: 1, pos: "TW", km: 5.7, topSpeed: 24.0, sprints: 8, sprintDistanceM: 120, avgSpeed: 4.7, minutesPlayed: 90, heatmap: generateHeatmap("TW", 131), passAccuracy: 74, passesTotal: 28, duelsWon: 90, duelsTotal: 3, tackles: 0, dribblesSuccess: 0, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 0, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 7.0, trend: "stable" },
    ],
    teamStats: { possession: 58, totalKm: 10.5, avgSpeed: 7.4, topSpeed: 34.0, sprints: 440, passes: 485, passAccuracy: 86, shotsOnTarget: 9, shotsTotal: 16, corners: 7, fouls: 9, yellowCards: 0, redCards: 0, offsides: 1 },
    heatmapGrid: generateTeamHeatmap(7),
    apiStats: { xG: 2.35, xGA: 0.88, ppda: 8.8, fieldTilt: 60, shotConversion: 24, duelWinRate: 58, aerialWinRate: 54, crossAccuracy: 35, counterAttacks: 4, setPlayGoals: 0 },
  },

  // Dataset 8: Viktoria Seestadt vs Concordia Flusstal
  {
    matchInfo: {
      homeTeam: "Viktoria Seestadt",
      awayTeam: "Concordia Flusstal",
      homeScore: 1,
      awayScore: 3,
      date: "Sa, 19. April 2026 · 14:00",
      venue: "Seepark Stadion",
    },
    players: [
      { name: "R. Woge", num: 9, pos: "ST", km: 10.0, topSpeed: 31.0, sprints: 44, sprintDistanceM: 820, avgSpeed: 7.6, minutesPlayed: 90, heatmap: generateHeatmap("ST", 141), passAccuracy: 72, passesTotal: 22, duelsWon: 50, duelsTotal: 20, tackles: 0, dribblesSuccess: 3, shotsTotal: 4, shotsOnGoal: 2, goals: 1, assists: 0, foulsCommitted: 2, foulsDrawn: 3, yellowCards: 0, redCards: 0, rating: 7.0, trend: "stable" },
      { name: "N. Strom", num: 8, pos: "ZM", km: 11.2, topSpeed: 28.5, sprints: 38, sprintDistanceM: 700, avgSpeed: 7.2, minutesPlayed: 90, heatmap: generateHeatmap("ZM", 142), passAccuracy: 84, passesTotal: 56, duelsWon: 55, duelsTotal: 17, tackles: 3, dribblesSuccess: 2, shotsTotal: 1, shotsOnGoal: 0, goals: 0, assists: 1, foulsCommitted: 2, foulsDrawn: 1, yellowCards: 0, redCards: 0, rating: 6.8, trend: "down" },
      { name: "K. Drift", num: 6, pos: "ZDM", km: 11.4, topSpeed: 27.2, sprints: 32, sprintDistanceM: 590, avgSpeed: 6.8, minutesPlayed: 90, heatmap: generateHeatmap("ZDM", 143), passAccuracy: 86, passesTotal: 68, duelsWon: 62, duelsTotal: 20, tackles: 6, dribblesSuccess: 0, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 3, foulsDrawn: 0, yellowCards: 1, redCards: 0, rating: 6.5, trend: "down" },
      { name: "H. Tide", num: 7, pos: "RA", km: 9.8, topSpeed: 32.0, sprints: 48, sprintDistanceM: 890, avgSpeed: 7.8, minutesPlayed: 78, heatmap: generateHeatmap("RA", 144), passAccuracy: 74, passesTotal: 30, duelsWon: 45, duelsTotal: 14, tackles: 1, dribblesSuccess: 4, shotsTotal: 2, shotsOnGoal: 1, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 2, yellowCards: 0, redCards: 0, rating: 6.4, trend: "stable" },
      { name: "F. Düne", num: 10, pos: "ZOM", km: 10.2, topSpeed: 29.0, sprints: 40, sprintDistanceM: 740, avgSpeed: 7.4, minutesPlayed: 90, heatmap: generateHeatmap("ZOM", 145), passAccuracy: 80, passesTotal: 46, duelsWon: 48, duelsTotal: 13, tackles: 1, dribblesSuccess: 3, shotsTotal: 3, shotsOnGoal: 1, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 2, yellowCards: 0, redCards: 0, rating: 6.6, trend: "stable" },
      { name: "L. Riff", num: 4, pos: "IV", km: 9.6, topSpeed: 26.0, sprints: 22, sprintDistanceM: 400, avgSpeed: 6.3, minutesPlayed: 90, heatmap: generateHeatmap("IV", 146), passAccuracy: 82, passesTotal: 52, duelsWon: 65, duelsTotal: 26, tackles: 5, dribblesSuccess: 0, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 2, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 6.3, trend: "down" },
      { name: "B. Brandung", num: 3, pos: "LV", km: 10.4, topSpeed: 30.0, sprints: 44, sprintDistanceM: 820, avgSpeed: 7.3, minutesPlayed: 90, heatmap: generateHeatmap("LV", 147), passAccuracy: 78, passesTotal: 40, duelsWon: 55, duelsTotal: 17, tackles: 3, dribblesSuccess: 1, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 2, foulsDrawn: 1, yellowCards: 0, redCards: 0, rating: 6.4, trend: "stable" },
      { name: "T. Küste", num: 2, pos: "RV", km: 10.5, topSpeed: 30.2, sprints: 45, sprintDistanceM: 840, avgSpeed: 7.4, minutesPlayed: 90, heatmap: generateHeatmap("RV", 148), passAccuracy: 80, passesTotal: 42, duelsWon: 54, duelsTotal: 16, tackles: 4, dribblesSuccess: 1, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 6.5, trend: "stable" },
      { name: "M. Hafen", num: 5, pos: "IV", km: 9.4, topSpeed: 25.5, sprints: 20, sprintDistanceM: 360, avgSpeed: 6.1, minutesPlayed: 90, heatmap: generateHeatmap("IV", 149), passAccuracy: 84, passesTotal: 58, duelsWon: 68, duelsTotal: 24, tackles: 7, dribblesSuccess: 0, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 2, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 6.6, trend: "stable" },
      { name: "S. Bucht", num: 11, pos: "LA", km: 9.6, topSpeed: 31.5, sprints: 46, sprintDistanceM: 850, avgSpeed: 7.6, minutesPlayed: 72, heatmap: generateHeatmap("LA", 150), passAccuracy: 72, passesTotal: 26, duelsWon: 40, duelsTotal: 12, tackles: 0, dribblesSuccess: 3, shotsTotal: 1, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 0, foulsDrawn: 2, yellowCards: 0, redCards: 0, rating: 6.0, trend: "down" },
      { name: "J. Pier", num: 1, pos: "TW", km: 5.5, topSpeed: 23.2, sprints: 6, sprintDistanceM: 90, avgSpeed: 4.5, minutesPlayed: 90, heatmap: generateHeatmap("TW", 151), passAccuracy: 68, passesTotal: 30, duelsWon: 72, duelsTotal: 7, tackles: 0, dribblesSuccess: 0, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 0, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 6.0, trend: "down" },
    ],
    teamStats: { possession: 44, totalKm: 10.0, avgSpeed: 7.0, topSpeed: 32.0, sprints: 385, passes: 402, passAccuracy: 79, shotsOnTarget: 4, shotsTotal: 11, corners: 4, fouls: 14, yellowCards: 1, redCards: 0, offsides: 3 },
    heatmapGrid: generateTeamHeatmap(8),
    apiStats: { xG: 0.92, xGA: 2.45, ppda: 12.5, fieldTilt: 42, shotConversion: 12, duelWinRate: 46, aerialWinRate: 48, crossAccuracy: 22, counterAttacks: 3, setPlayGoals: 0 },
  },

  // Dataset 9: Sportfreunde Bergheim vs FC Tal 1920
  {
    matchInfo: {
      homeTeam: "Sportfreunde Bergheim",
      awayTeam: "FC Tal 1920",
      homeScore: 5,
      awayScore: 2,
      date: "So, 26. April 2026 · 15:00",
      venue: "Bergheim Arena",
    },
    players: [
      { name: "A. Gipfel", num: 9, pos: "ST", km: 11.8, topSpeed: 35.0, sprints: 64, sprintDistanceM: 1180, avgSpeed: 8.8, minutesPlayed: 90, heatmap: generateHeatmap("ST", 161), passAccuracy: 84, passesTotal: 32, duelsWon: 68, duelsTotal: 18, tackles: 1, dribblesSuccess: 7, shotsTotal: 8, shotsOnGoal: 6, goals: 3, assists: 1, foulsCommitted: 1, foulsDrawn: 5, yellowCards: 0, redCards: 0, rating: 9.5, trend: "up" },
      { name: "E. Hang", num: 8, pos: "ZM", km: 12.5, topSpeed: 30.0, sprints: 46, sprintDistanceM: 850, avgSpeed: 7.8, minutesPlayed: 90, heatmap: generateHeatmap("ZM", 162), passAccuracy: 94, passesTotal: 78, duelsWon: 70, duelsTotal: 15, tackles: 5, dribblesSuccess: 4, shotsTotal: 2, shotsOnGoal: 2, goals: 1, assists: 2, foulsCommitted: 0, foulsDrawn: 2, yellowCards: 0, redCards: 0, rating: 9.0, trend: "up" },
      { name: "O. Schlucht", num: 6, pos: "ZDM", km: 12.0, topSpeed: 28.5, sprints: 38, sprintDistanceM: 700, avgSpeed: 7.2, minutesPlayed: 90, heatmap: generateHeatmap("ZDM", 163), passAccuracy: 92, passesTotal: 82, duelsWon: 74, duelsTotal: 20, tackles: 9, dribblesSuccess: 1, shotsTotal: 1, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 8.0, trend: "stable" },
      { name: "I. Klippe", num: 7, pos: "RA", km: 11.2, topSpeed: 35.5, sprints: 66, sprintDistanceM: 1220, avgSpeed: 8.9, minutesPlayed: 90, heatmap: generateHeatmap("RA", 164), passAccuracy: 86, passesTotal: 44, duelsWon: 62, duelsTotal: 14, tackles: 2, dribblesSuccess: 9, shotsTotal: 4, shotsOnGoal: 3, goals: 1, assists: 1, foulsCommitted: 0, foulsDrawn: 6, yellowCards: 0, redCards: 0, rating: 8.8, trend: "up" },
      { name: "U. Abhang", num: 10, pos: "ZOM", km: 11.0, topSpeed: 31.2, sprints: 48, sprintDistanceM: 890, avgSpeed: 8.0, minutesPlayed: 85, heatmap: generateHeatmap("ZOM", 165), passAccuracy: 88, passesTotal: 60, duelsWon: 58, duelsTotal: 12, tackles: 1, dribblesSuccess: 5, shotsTotal: 4, shotsOnGoal: 3, goals: 0, assists: 1, foulsCommitted: 1, foulsDrawn: 3, yellowCards: 0, redCards: 0, rating: 8.2, trend: "up" },
      { name: "C. Fels", num: 4, pos: "IV", km: 10.2, topSpeed: 28.0, sprints: 28, sprintDistanceM: 520, avgSpeed: 6.8, minutesPlayed: 90, heatmap: generateHeatmap("IV", 166), passAccuracy: 91, passesTotal: 65, duelsWon: 82, duelsTotal: 20, tackles: 7, dribblesSuccess: 0, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 8.0, trend: "stable" },
      { name: "G. Sattel", num: 3, pos: "LV", km: 11.4, topSpeed: 32.0, sprints: 52, sprintDistanceM: 960, avgSpeed: 7.8, minutesPlayed: 90, heatmap: generateHeatmap("LV", 167), passAccuracy: 88, passesTotal: 50, duelsWon: 70, duelsTotal: 15, tackles: 5, dribblesSuccess: 3, shotsTotal: 1, shotsOnGoal: 1, goals: 0, assists: 0, foulsCommitted: 0, foulsDrawn: 1, yellowCards: 0, redCards: 0, rating: 7.8, trend: "up" },
      { name: "K. Kamm", num: 2, pos: "RV", km: 11.5, topSpeed: 32.5, sprints: 54, sprintDistanceM: 1000, avgSpeed: 7.9, minutesPlayed: 90, heatmap: generateHeatmap("RV", 168), passAccuracy: 89, passesTotal: 52, duelsWon: 68, duelsTotal: 14, tackles: 6, dribblesSuccess: 2, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 0, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 7.9, trend: "stable" },
      { name: "M. Zinne", num: 5, pos: "IV", km: 10.0, topSpeed: 27.5, sprints: 25, sprintDistanceM: 460, avgSpeed: 6.6, minutesPlayed: 90, heatmap: generateHeatmap("IV", 169), passAccuracy: 93, passesTotal: 70, duelsWon: 85, duelsTotal: 22, tackles: 8, dribblesSuccess: 0, shotsTotal: 1, shotsOnGoal: 1, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 8.2, trend: "up" },
      { name: "P. Höhe", num: 11, pos: "LA", km: 10.8, topSpeed: 34.5, sprints: 58, sprintDistanceM: 1080, avgSpeed: 8.5, minutesPlayed: 90, heatmap: generateHeatmap("LA", 170), passAccuracy: 84, passesTotal: 38, duelsWon: 55, duelsTotal: 12, tackles: 1, dribblesSuccess: 6, shotsTotal: 3, shotsOnGoal: 2, goals: 0, assists: 0, foulsCommitted: 0, foulsDrawn: 4, yellowCards: 0, redCards: 0, rating: 7.8, trend: "stable" },
      { name: "R. Plateau", num: 1, pos: "TW", km: 5.3, topSpeed: 22.0, sprints: 5, sprintDistanceM: 70, avgSpeed: 4.3, minutesPlayed: 90, heatmap: generateHeatmap("TW", 171), passAccuracy: 78, passesTotal: 26, duelsWon: 85, duelsTotal: 4, tackles: 0, dribblesSuccess: 0, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 0, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 7.0, trend: "stable" },
    ],
    teamStats: { possession: 68, totalKm: 10.9, avgSpeed: 7.8, topSpeed: 35.5, sprints: 484, passes: 565, passAccuracy: 90, shotsOnTarget: 14, shotsTotal: 24, corners: 10, fouls: 5, yellowCards: 0, redCards: 0, offsides: 0 },
    heatmapGrid: generateTeamHeatmap(9),
    apiStats: { xG: 3.85, xGA: 1.22, ppda: 6.5, fieldTilt: 72, shotConversion: 32, duelWinRate: 65, aerialWinRate: 62, crossAccuracy: 42, counterAttacks: 2, setPlayGoals: 2 },
  },

  // Dataset 10: Rot-Weiß Stadtmitte vs Blau-Gelb Vorstadt
  {
    matchInfo: {
      homeTeam: "Rot-Weiß Stadtmitte",
      awayTeam: "Blau-Gelb Vorstadt",
      homeScore: 0,
      awayScore: 0,
      date: "Sa, 3. Mai 2026 · 15:30",
      venue: "Zentralstadion",
    },
    players: [
      { name: "T. Zentrum", num: 9, pos: "ST", km: 9.8, topSpeed: 30.5, sprints: 40, sprintDistanceM: 740, avgSpeed: 7.4, minutesPlayed: 90, heatmap: generateHeatmap("ST", 181), passAccuracy: 70, passesTotal: 20, duelsWon: 48, duelsTotal: 22, tackles: 0, dribblesSuccess: 2, shotsTotal: 3, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 2, foulsDrawn: 2, yellowCards: 0, redCards: 0, rating: 6.0, trend: "down" },
      { name: "H. Platz", num: 8, pos: "ZM", km: 11.0, topSpeed: 28.2, sprints: 36, sprintDistanceM: 660, avgSpeed: 7.1, minutesPlayed: 90, heatmap: generateHeatmap("ZM", 182), passAccuracy: 85, passesTotal: 58, duelsWon: 56, duelsTotal: 16, tackles: 3, dribblesSuccess: 1, shotsTotal: 2, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 1, yellowCards: 0, redCards: 0, rating: 6.5, trend: "stable" },
      { name: "B. Straße", num: 6, pos: "ZDM", km: 11.3, topSpeed: 27.0, sprints: 32, sprintDistanceM: 590, avgSpeed: 6.8, minutesPlayed: 90, heatmap: generateHeatmap("ZDM", 183), passAccuracy: 88, passesTotal: 68, duelsWon: 65, duelsTotal: 19, tackles: 6, dribblesSuccess: 0, shotsTotal: 1, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 2, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 6.8, trend: "stable" },
      { name: "F. Gasse", num: 7, pos: "RA", km: 9.5, topSpeed: 31.5, sprints: 44, sprintDistanceM: 820, avgSpeed: 7.6, minutesPlayed: 82, heatmap: generateHeatmap("RA", 184), passAccuracy: 74, passesTotal: 28, duelsWon: 44, duelsTotal: 14, tackles: 1, dribblesSuccess: 3, shotsTotal: 2, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 2, yellowCards: 0, redCards: 0, rating: 6.2, trend: "stable" },
      { name: "D. Allee", num: 10, pos: "ZOM", km: 10.0, topSpeed: 28.8, sprints: 38, sprintDistanceM: 700, avgSpeed: 7.3, minutesPlayed: 90, heatmap: generateHeatmap("ZOM", 185), passAccuracy: 80, passesTotal: 44, duelsWon: 50, duelsTotal: 14, tackles: 1, dribblesSuccess: 2, shotsTotal: 2, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 0, foulsDrawn: 1, yellowCards: 0, redCards: 0, rating: 6.3, trend: "stable" },
      { name: "W. Weg", num: 4, pos: "IV", km: 9.5, topSpeed: 25.8, sprints: 21, sprintDistanceM: 380, avgSpeed: 6.2, minutesPlayed: 90, heatmap: generateHeatmap("IV", 186), passAccuracy: 84, passesTotal: 54, duelsWon: 72, duelsTotal: 24, tackles: 6, dribblesSuccess: 0, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 7.0, trend: "stable" },
      { name: "A. Brücke", num: 3, pos: "LV", km: 10.3, topSpeed: 29.8, sprints: 42, sprintDistanceM: 780, avgSpeed: 7.2, minutesPlayed: 90, heatmap: generateHeatmap("LV", 187), passAccuracy: 80, passesTotal: 40, duelsWon: 58, duelsTotal: 17, tackles: 4, dribblesSuccess: 1, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 6.6, trend: "stable" },
      { name: "L. Ufer", num: 2, pos: "RV", km: 10.4, topSpeed: 30.0, sprints: 43, sprintDistanceM: 800, avgSpeed: 7.3, minutesPlayed: 90, heatmap: generateHeatmap("RV", 188), passAccuracy: 82, passesTotal: 42, duelsWon: 56, duelsTotal: 16, tackles: 4, dribblesSuccess: 1, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 0, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 6.7, trend: "stable" },
      { name: "N. Damm", num: 5, pos: "IV", km: 9.3, topSpeed: 25.5, sprints: 19, sprintDistanceM: 340, avgSpeed: 6.0, minutesPlayed: 90, heatmap: generateHeatmap("IV", 189), passAccuracy: 86, passesTotal: 60, duelsWon: 75, duelsTotal: 23, tackles: 7, dribblesSuccess: 0, shotsTotal: 1, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 1, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 7.2, trend: "up" },
      { name: "C. Park", num: 11, pos: "LA", km: 9.2, topSpeed: 30.8, sprints: 42, sprintDistanceM: 780, avgSpeed: 7.4, minutesPlayed: 75, heatmap: generateHeatmap("LA", 190), passAccuracy: 72, passesTotal: 24, duelsWon: 38, duelsTotal: 12, tackles: 0, dribblesSuccess: 2, shotsTotal: 1, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 0, foulsDrawn: 1, yellowCards: 0, redCards: 0, rating: 5.8, trend: "down" },
      { name: "M. Tor", num: 1, pos: "TW", km: 5.4, topSpeed: 22.8, sprints: 5, sprintDistanceM: 80, avgSpeed: 4.4, minutesPlayed: 90, heatmap: generateHeatmap("TW", 191), passAccuracy: 72, passesTotal: 28, duelsWon: 100, duelsTotal: 2, tackles: 0, dribblesSuccess: 0, shotsTotal: 0, shotsOnGoal: 0, goals: 0, assists: 0, foulsCommitted: 0, foulsDrawn: 0, yellowCards: 0, redCards: 0, rating: 7.5, trend: "up" },
    ],
    teamStats: { possession: 50, totalKm: 9.9, avgSpeed: 6.9, topSpeed: 31.5, sprints: 362, passes: 420, passAccuracy: 80, shotsOnTarget: 0, shotsTotal: 12, corners: 4, fouls: 9, yellowCards: 0, redCards: 0, offsides: 4 },
    heatmapGrid: generateTeamHeatmap(10),
    apiStats: { xG: 0.68, xGA: 0.72, ppda: 11.8, fieldTilt: 50, shotConversion: 0, duelWinRate: 50, aerialWinRate: 52, crossAccuracy: 24, counterAttacks: 4, setPlayGoals: 0 },
  },
];

/**
 * Returns a random demo dataset from the 10 predefined matches.
 * No API calls needed - pure static data.
 */
export function getRandomDemoData(): DemoData {
  const index = Math.floor(Math.random() * DEMO_DATASETS.length);
  return DEMO_DATASETS[index];
}

/**
 * Returns a specific demo dataset by index (0-9).
 */
export function getDemoDataByIndex(index: number): DemoData {
  return DEMO_DATASETS[Math.max(0, Math.min(9, index))];
}

/**
 * Returns all demo datasets for manual selection.
 */
export function getAllDemoData(): DemoData[] {
  return DEMO_DATASETS;
}

/**
 * Phase 3 — derive plausible scene + goal candidates from a demo dataset.
 * Deterministic per match (seeded by score + corners) so every reload shows
 * the same suggestions. Use when `data.aiSuggestions` is not pre-populated.
 */
export function getDemoAISuggestions(data: DemoData): NonNullable<DemoData["aiSuggestions"]> {
  if (data.aiSuggestions) return data.aiSuggestions;

  const { homeScore, awayScore } = data.matchInfo;
  const corners = data.teamStats.corners ?? 0;
  const fouls = data.teamStats.fouls ?? 0;
  const seed = homeScore * 17 + awayScore * 31 + corners * 7 + fouls;
  const rand = (i: number) => ((seed + i * 53) % 90) + 1; // minute 1..90

  const scorers = data.players.filter((p) => p.goals > 0);

  const goalCandidates: NonNullable<DemoData["aiSuggestions"]>["goalCandidates"] = [];
  let goalIdx = 0;
  for (let i = 0; i < homeScore; i++) {
    const scorer = scorers[goalIdx++ % Math.max(1, scorers.length)];
    goalCandidates.push({
      minute: rand(i + 1),
      team: "home",
      confidence: 0.78 + ((seed + i) % 15) / 100,
      scorer_jersey: scorer?.num,
      evidence: "Ball im Netz erkannt, Jubel-Cluster im Strafraum",
    });
  }
  for (let i = 0; i < awayScore; i++) {
    goalCandidates.push({
      minute: rand(homeScore + i + 1),
      team: "away",
      confidence: 0.72 + ((seed + i) % 18) / 100,
      evidence: "Schiedsrichter zeigt Richtung Mittelkreis",
    });
  }
  goalCandidates.sort((a, b) => a.minute - b.minute);

  const scenes: NonNullable<DemoData["aiSuggestions"]>["scenes"] = [];
  for (let i = 0; i < Math.min(corners, 4); i++) {
    scenes.push({
      minute: rand(100 + i),
      type: "corner_kick",
      team: i % 2 === 0 ? "home" : "away",
      confidence: 0.82,
      evidence: "Spieler an Eckfahne, Strafraum gefüllt",
    });
  }
  if (fouls > 5) {
    scenes.push({
      minute: rand(200),
      type: "free_kick",
      team: "home",
      confidence: 0.7,
      evidence: "Mauer bildet sich vor dem Tor",
    });
  }
  if (data.apiStats.setPlayGoals > 0) {
    scenes.push({
      minute: rand(250),
      type: "penalty",
      team: "home",
      confidence: 0.88,
      evidence: "Schiedsrichter zeigt auf den Punkt",
    });
  }
  scenes.push({
    minute: 1,
    type: "kickoff",
    team: "home",
    confidence: 0.95,
    evidence: "Anstoß im Mittelkreis",
  });
  scenes.sort((a, b) => a.minute - b.minute);

  return { scenes, goalCandidates };
}
