import type { PlanType } from "./types";

export const FORMATIONS = ["4-4-2", "4-3-3", "3-5-2", "4-2-3-1", "3-4-3", "5-3-2", "5-4-1"];

export const POSITIONS = [
  "TW", "IV", "LV", "RV", "LIV", "RIV",
  "ZDM", "ZM", "LM", "RM", "ZOM",
  "LA", "RA", "ST", "HS",
];

export const POSITION_LABELS: Record<string, string> = {
  TW: "Torwart", IV: "Innenverteidiger", LV: "Linker Verteidiger", RV: "Rechter Verteidiger",
  LIV: "Linker IV", RIV: "Rechter IV", ZDM: "Zentrales def. Mittelfeld", ZM: "Zentrales Mittelfeld",
  LM: "Linkes Mittelfeld", RM: "Rechtes Mittelfeld", ZOM: "Zentrales off. Mittelfeld",
  LA: "Linksaußen", RA: "Rechtsaußen", ST: "Stürmer", HS: "Hängende Spitze",
};

export const PLAN_CONFIG: Record<PlanType, { label: string; price: number; maxMatches: number | null }> = {
  trial: { label: "Trial", price: 0, maxMatches: 2 },
  starter: { label: "Starter", price: 49, maxMatches: 4 },
  club: { label: "Club", price: 99, maxMatches: 12 },
  pro: { label: "Pro", price: 199, maxMatches: null },
};

export const AI_ADDON_PRICE = 79; // €/Monat, zubuchbar zu jedem Plan

export const HEATMAP_COLS = 21;
export const HEATMAP_ROWS = 14;

export const MATCH_STATUS_LABELS: Record<string, string> = {
  setup: "Einrichtung",
  live: "Live",
  processing: "Verarbeitung",
  done: "Abgeschlossen",
};

export const MATCH_STATUS_COLORS: Record<string, string> = {
  setup: "bg-muted text-muted-foreground",
  live: "bg-primary/15 text-primary",
  processing: "bg-warning/15 text-warning",
  done: "bg-success/15 text-success",
};
