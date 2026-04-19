import { Battery, BatteryLow, BatteryWarning as BatteryWarningIcon, BatteryCharging } from "lucide-react";
import { useBatteryStatus, batterySeverity } from "@/hooks/use-battery-status";
import { cn } from "@/lib/utils";

interface Props {
  /** Compact pill for header, or full warning panel */
  variant?: "pill" | "panel";
  className?: string;
}

/**
 * Shows a colored battery indicator. Renders nothing if the API is unsupported
 * (iOS Safari) AND we want minimal noise — but in panel mode we render a hint
 * so users know to watch their phone manually.
 */
export default function BatteryWarning({ variant = "pill", className }: Props) {
  const status = useBatteryStatus();
  const severity = batterySeverity(status);

  // Hide the pill entirely when status is fine or unknown to keep header clean.
  if (variant === "pill" && (severity === "ok" || severity === "unknown")) return null;

  if (variant === "panel" && severity === "unknown") {
    return (
      <div className={cn("rounded-lg border border-border/40 bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2", className)}>
        <Battery className="h-3.5 w-3.5" />
        <span>Akku-Status nicht verfügbar (iOS) — bitte Helfer-Handy manuell beobachten.</span>
      </div>
    );
  }

  if (!status) return null;

  const icon = status.charging
    ? <BatteryCharging className="h-3.5 w-3.5" />
    : severity === "critical"
      ? <BatteryWarningIcon className="h-3.5 w-3.5" />
      : severity === "low"
        ? <BatteryLow className="h-3.5 w-3.5" />
        : <Battery className="h-3.5 w-3.5" />;

  const tone =
    severity === "critical"
      ? "bg-destructive/15 text-destructive border-destructive/40"
      : severity === "low"
        ? "bg-amber-500/15 text-amber-500 border-amber-500/40"
        : "bg-muted/40 text-muted-foreground border-border/40";

  if (variant === "pill") {
    return (
      <div className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", tone, className)}>
        {icon}
        <span>{status.level}%</span>
      </div>
    );
  }

  // panel
  const message =
    severity === "critical"
      ? "Akku kritisch! Aufnahme JETZT stoppen — Frames werden lokal gesichert und beim nächsten Öffnen automatisch hochgeladen."
      : severity === "low"
        ? "Akku niedrig. Bitte rechtzeitig stoppen, damit die Frames noch hochgeladen werden können."
        : `Akku ${status.level}%`;

  return (
    <div className={cn("rounded-lg border px-3 py-2 text-xs flex items-center gap-2", tone, className)}>
      {icon}
      <span className="font-medium">{message}</span>
    </div>
  );
}
