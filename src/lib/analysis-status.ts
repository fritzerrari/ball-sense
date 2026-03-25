/**
 * Analysis status system for progressive data refinement.
 * 
 * Stages:
 * - "prognose"   → Live/during game. Values are extrapolated from partial data. Clearly labeled.
 * - "vorläufig"  → Post-game, initial processing done. Full data available but auto-correction pending.
 * - "final"      → All corrections applied, quality-checked. Definitive values.
 */

export type AnalysisStage = "prognose" | "vorläufig" | "final";

export interface AnalysisStatus {
  stage: AnalysisStage;
  label: string;
  description: string;
  color: "amber" | "blue" | "emerald";
  icon: "clock" | "refresh" | "check";
  progress: number; // 0-100
}

export function getAnalysisStage(
  matchStatus: string,
  period?: string,
  hasExtrapolation?: boolean,
  qualityScore?: number | null,
): AnalysisStage {
  if (matchStatus === "live" || matchStatus === "processing" || period === "partial") {
    return "prognose";
  }
  if (matchStatus === "done") {
    // If quality score is high and no extrapolation needed, it's final
    if (!hasExtrapolation && (qualityScore === null || qualityScore === undefined || qualityScore >= 80)) {
      return "final";
    }
    return "vorläufig";
  }
  return "prognose";
}

export function getAnalysisStatusInfo(stage: AnalysisStage): AnalysisStatus {
  switch (stage) {
    case "prognose":
      return {
        stage,
        label: "Prognose",
        description: "Live-Hochrechnung basierend auf bisherigen Daten. Werte werden laufend aktualisiert und können sich ändern.",
        color: "amber",
        icon: "clock",
        progress: 35,
      };
    case "vorläufig":
      return {
        stage,
        label: "Vorläufig",
        description: "Erste vollständige Berechnung. Automatische Nachkorrektur und Qualitätsprüfung laufen noch.",
        color: "blue",
        icon: "refresh",
        progress: 70,
      };
    case "final":
      return {
        stage,
        label: "Final",
        description: "Alle Daten vollständig verarbeitet, korrigiert und qualitätsgeprüft.",
        color: "emerald",
        icon: "check",
        progress: 100,
      };
  }
}

/**
 * Determine if a metric value should be shown with an extrapolation indicator.
 */
export function isExtrapolatedMetric(rawMetrics: Record<string, unknown> | null | undefined): boolean {
  if (!rawMetrics || typeof rawMetrics !== "object") return false;
  return (rawMetrics as any)?.extrapolated === true;
}

/**
 * Get coverage ratio from raw metrics.
 */
export function getCoverageRatio(rawMetrics: Record<string, unknown> | null | undefined): number {
  if (!rawMetrics || typeof rawMetrics !== "object") return 1;
  const ratio = (rawMetrics as any)?.coverage_ratio;
  return typeof ratio === "number" ? ratio : 1;
}

/**
 * Check if tactical stats are estimated (not from manual events).
 */
export function isTacticallyEstimated(rawMetrics: Record<string, unknown> | null | undefined): boolean {
  if (!rawMetrics || typeof rawMetrics !== "object") return false;
  return (rawMetrics as any)?.tactical_estimated === true;
}
