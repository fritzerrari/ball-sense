export type DataQualityFlag = {
  code: string;
  severity: "info" | "warn" | "error";
  label: string;
  detail: string;
};

export type QualityMetrics = {
  top_speed_kmh?: number | null;
  avg_speed_kmh?: number | null;
  distance_km?: number | null;
  sprint_count?: number | null;
  minutes_played?: number | null;
  quality_score?: number | null;
  anomaly_flags?: unknown;
  suspected_cause?: string | null;
  corrected_top_speed_kmh?: number | null;
  corrected_avg_speed_kmh?: number | null;
  corrected_distance_km?: number | null;
  raw_metrics?: Record<string, unknown> | null;
};

const MAX_REALISTIC_TOP_SPEED = 45;
const MAX_REALISTIC_AVG_SPEED = 18;
const MAX_REALISTIC_DISTANCE_PER_90 = 16;
const MAX_REALISTIC_SPRINTS_PER_90 = 80;

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeStoredFlags(value: unknown): DataQualityFlag[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const candidate = entry as Partial<DataQualityFlag>;
      if (!candidate.code || !candidate.label || !candidate.detail || !candidate.severity) return null;
      return {
        code: candidate.code,
        label: candidate.label,
        detail: candidate.detail,
        severity: candidate.severity,
      } as DataQualityFlag;
    })
    .filter(Boolean) as DataQualityFlag[];
}

export function getDataQualityFlags(metrics: QualityMetrics): DataQualityFlag[] {
  const flags = normalizeStoredFlags(metrics.anomaly_flags);
  if (flags.length > 0) return flags;

  const topSpeed = toNumber(metrics.top_speed_kmh);
  const avgSpeed = toNumber(metrics.avg_speed_kmh);
  const distance = toNumber(metrics.distance_km);
  const sprints = toNumber(metrics.sprint_count);
  const minutes = Math.max(toNumber(metrics.minutes_played), 1);
  const distancePer90 = (distance / minutes) * 90;
  const sprintsPer90 = (sprints / minutes) * 90;

  const derived: DataQualityFlag[] = [];

  if (topSpeed > MAX_REALISTIC_TOP_SPEED) {
    derived.push({
      code: "top_speed_outlier",
      severity: "error",
      label: "Unrealistische Top-Speed",
      detail: "Der Wert liegt deutlich über einem plausiblen Fußballbereich und spricht oft für Kalibrierungs- oder Trackingfehler.",
    });
  }

  if (avgSpeed > MAX_REALISTIC_AVG_SPEED) {
    derived.push({
      code: "avg_speed_outlier",
      severity: "warn",
      label: "Auffällige Durchschnittsgeschwindigkeit",
      detail: "Die Durchschnittsgeschwindigkeit wirkt für ein ganzes Spiel ungewöhnlich hoch und sollte geprüft werden.",
    });
  }

  if (distancePer90 > MAX_REALISTIC_DISTANCE_PER_90) {
    derived.push({
      code: "distance_outlier",
      severity: "warn",
      label: "Auffällige Laufdistanz",
      detail: "Die hochgerechnete Distanz pro 90 Minuten ist sehr hoch und kann auf falsche Platzmaße oder Tracking-Sprünge hindeuten.",
    });
  }

  if (sprintsPer90 > MAX_REALISTIC_SPRINTS_PER_90) {
    derived.push({
      code: "sprint_outlier",
      severity: "warn",
      label: "Auffällige Sprintfrequenz",
      detail: "Die Sprintanzahl passt nicht sauber zu typischen Matchwerten und sollte im Zusammenhang mit Speed und Kalibrierung geprüft werden.",
    });
  }

  return derived;
}

export function hasDataQualityIssue(metrics: QualityMetrics) {
  return getDataQualityFlags(metrics).length > 0;
}

export function getQualitySummary(metrics: QualityMetrics) {
  const flags = getDataQualityFlags(metrics);
  if (flags.length === 0) {
    return {
      score: typeof metrics.quality_score === "number" ? metrics.quality_score : 100,
      label: "Plausibel",
      tone: "info" as const,
      detail: "Die Kennzahlen wirken aktuell plausibel.",
    };
  }

  const hasError = flags.some((flag) => flag.severity === "error");
  return {
    score: typeof metrics.quality_score === "number" ? metrics.quality_score : hasError ? 35 : 62,
    label: hasError ? "Prüfen" : "Auffällig",
    tone: hasError ? ("error" as const) : ("warn" as const),
    detail: metrics.suspected_cause || "Mögliche Ursache: Kalibrierung, Feldmaße oder Tracking-Sprünge prüfen.",
  };
}

export function getDisplayMetric(value: number | null | undefined, corrected: number | null | undefined) {
  const correctedValue = typeof corrected === "number" && Number.isFinite(corrected) ? corrected : null;
  const rawValue = typeof value === "number" && Number.isFinite(value) ? value : null;
  return correctedValue ?? rawValue;
}

export const AI_DISCLAIMER = "KI-generiert: Diese Inhalte wurden mit KI erstellt, können Fehler enthalten und sollten fachlich geprüft werden.";
export const AI_RECOMMENDATION_DISCLAIMER = "Empfehlung statt Gewissheit: Die Was-wäre-wenn-Analyse ist KI-gestützt, kann Fehler machen und ersetzt keine Trainerentscheidung.";
