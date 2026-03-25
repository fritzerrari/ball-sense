import { Clock, RefreshCw, CheckCircle2, TrendingUp, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { type AnalysisStage, getAnalysisStatusInfo, getCoverageRatio, isExtrapolatedMetric } from "@/lib/analysis-status";

interface AnalysisStatusBannerProps {
  stage: AnalysisStage;
  coverageRatio?: number;
  isExtrapolated?: boolean;
  playerCount?: number;
  matchStatus?: string;
  /** Compact inline mode for use inside cards */
  compact?: boolean;
  /** Actual progress from match processing_progress (overrides stage default) */
  actualProgress?: number;
  /** Number of AI frames analyzed */
  framesAnalyzed?: number;
  /** Number of cameras used */
  camerasUsed?: number;
}

const iconMap = {
  clock: Clock,
  refresh: RefreshCw,
  check: CheckCircle2,
};

const colorMap = {
  amber: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/8",
    iconBg: "bg-amber-500/15",
    iconText: "text-amber-600 dark:text-amber-400",
    text: "text-amber-700 dark:text-amber-300",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    progress: "[&>div]:bg-amber-500",
  },
  blue: {
    border: "border-blue-500/30",
    bg: "bg-blue-500/8",
    iconBg: "bg-blue-500/15",
    iconText: "text-blue-600 dark:text-blue-400",
    text: "text-blue-700 dark:text-blue-300",
    badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    progress: "[&>div]:bg-blue-500",
  },
  emerald: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/8",
    iconBg: "bg-emerald-500/15",
    iconText: "text-emerald-600 dark:text-emerald-400",
    text: "text-emerald-700 dark:text-emerald-300",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    progress: "[&>div]:bg-emerald-500",
  },
};

export function AnalysisStatusBanner({ stage, coverageRatio = 1, isExtrapolated = false, playerCount, matchStatus, compact = false, actualProgress, framesAnalyzed, camerasUsed }: AnalysisStatusBannerProps) {
  const info = getAnalysisStatusInfo(stage, actualProgress);
  const colors = colorMap[info.color];
  const Icon = iconMap[info.icon];

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${colors.badge}`}>
        <Icon className="h-3 w-3" />
        {info.label}
      </div>
    );
  }

  return (
    <div className={`glass-card ${colors.border} ${colors.bg} p-4 space-y-3`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${colors.iconBg} ${colors.iconText}`}>
          <Icon className={`h-4.5 w-4.5 ${stage === "vorläufig" ? "animate-spin" : ""}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-semibold ${colors.text}`}>
              Analyse-Status: {info.label}
            </p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${colors.badge}`}>
              {stage === "prognose" ? "LIVE" : stage === "vorläufig" ? "WIRD KORRIGIERT" : "VERIFIZIERT"}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{info.description}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Datenqualität</span>
          <span className={`font-medium ${colors.text}`}>{info.progress}%</span>
        </div>
        <Progress value={info.progress} className={`h-1.5 ${colors.progress}`} />
      </div>

      {/* Status details */}
      <div className="flex flex-wrap gap-2">
        {isExtrapolated && coverageRatio < 1 && (
          <div className="flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/5 px-2.5 py-1 text-[10px] text-amber-700 dark:text-amber-400">
            <TrendingUp className="h-3 w-3" />
            {Math.round(coverageRatio * 100)}% Feld · Hochgerechnet
          </div>
        )}
        {playerCount !== undefined && (
          <div className="flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2.5 py-1 text-[10px] text-muted-foreground">
            {playerCount > 32 ? `${playerCount} Tracks (unrealistisch)` : `${playerCount} Spieler zugeordnet`}
          </div>
        )}
        {framesAnalyzed !== undefined && (
          <div className="flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2.5 py-1 text-[10px] text-muted-foreground">
            {framesAnalyzed} Frames analysiert
          </div>
        )}
        {camerasUsed !== undefined && camerasUsed > 0 && (
          <div className="flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2.5 py-1 text-[10px] text-muted-foreground">
            {camerasUsed} Kamera{camerasUsed > 1 ? "s" : ""}
          </div>
        )}
        {stage === "prognose" && (
          <div className="flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/5 px-2.5 py-1 text-[10px] text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            Werte können sich noch ändern
          </div>
        )}
        {stage === "vorläufig" && (
          <div className="flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/5 px-2.5 py-1 text-[10px] text-blue-700 dark:text-blue-400">
            <RefreshCw className="h-3 w-3" />
            Auto-Nachberechnung aktiv
          </div>
        )}
        {stage === "final" && (
          <div className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-[10px] text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            Qualitätsgeprüft
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Inline badge for individual metric values.
 * Shows whether a value is a prognosis, preliminary, or final.
 */
export function MetricStatusIndicator({ stage, className = "" }: { stage: AnalysisStage; className?: string }) {
  const info = getAnalysisStatusInfo(stage);
  const colors = colorMap[info.color];
  const Icon = iconMap[info.icon];

  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-medium ${colors.text} ${className}`} title={info.description}>
      <Icon className="h-2.5 w-2.5" />
      {stage === "prognose" ? "~" : stage === "vorläufig" ? "○" : "✓"}
    </span>
  );
}
