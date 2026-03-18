import { ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";

type TrackingConsentStatus = "unknown" | "granted" | "denied" | null | undefined;

const CONSENT_CONFIG = {
  granted: {
    label: "Einwilligung liegt vor",
    shortLabel: "Tracking erlaubt",
    hint: "Einwilligung liegt vor – Spieler darf ins Tracking aufgenommen werden.",
    icon: ShieldCheck,
    className: "border-primary/20 bg-primary/10 text-primary",
  },
  denied: {
    label: "Keine Einwilligung",
    shortLabel: "Nicht trackbar",
    hint: "Nicht freigegeben – Spieler sollte vom Tracking ausgeschlossen werden.",
    icon: ShieldOff,
    className: "border-destructive/20 bg-destructive/10 text-destructive",
  },
  unknown: {
    label: "Einwilligung offen",
    shortLabel: "Einwilligung offen",
    hint: "Noch offen – Tracking vor Einsatz klären und dokumentieren.",
    icon: ShieldAlert,
    className: "border-border bg-secondary text-secondary-foreground",
  },
} as const;

function getConsentKey(status: TrackingConsentStatus) {
  return status === "granted" || status === "denied" ? status : "unknown";
}

export function canTrackPlayer(status: TrackingConsentStatus) {
  return status === "granted";
}

export function getConsentHint(status: TrackingConsentStatus) {
  return CONSENT_CONFIG[getConsentKey(status)].hint;
}

export function ConsentStatusBadge({
  status,
  compact = false,
  className,
}: {
  status: TrackingConsentStatus;
  compact?: boolean;
  className?: string;
}) {
  const config = CONSENT_CONFIG[getConsentKey(status)];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium leading-none",
        config.className,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 break-words">{compact ? config.shortLabel : config.label}</span>
    </span>
  );
}
