import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Camera, Mountain, Smartphone, CheckCircle2, X, Maximize2, ArrowLeftRight, Square, UserCheck } from "lucide-react";
import FieldCoverageHelp from "./FieldCoverageHelp";
import type { FieldCoverage } from "@/lib/types";

interface CameraSetupOverlayProps {
  onDismiss: () => void;
  onStart: (coverage: FieldCoverage, eventLeadOnly: boolean) => void;
  /** Show the Event-Lead toggle (trainer-only feature). */
  showEventLeadToggle?: boolean;
}

const tips = [
  {
    icon: Mountain,
    title: "Erhöht aufstellen",
    desc: "Tribüne oder Stativ, 3–5 m Höhe. Je höher, desto besser die Übersicht.",
  },
  {
    icon: Camera,
    title: "Mittellinie anpeilen",
    desc: "Das ganze Feld sollte im Bild sein. Nicht von der Ecke filmen.",
  },
  {
    icon: Smartphone,
    title: "Querformat & stabil",
    desc: "Handy quer halten oder anlehnen. Nicht schwenken oder zoomen.",
  },
  {
    icon: Maximize2,
    title: "Weitwinkel nutzen",
    desc: "Zu nah am Feld? Aktiviere den 0.5x-Modus oben rechts für mehr Übersicht.",
  },
  {
    icon: CheckCircle2,
    title: "Auto-Kalibrierung",
    desc: "Die KI erkennt das Spielfeld automatisch — du musst nichts kalibrieren.",
  },
];

const coverageOptions: { value: FieldCoverage; label: string; icon: typeof Square; desc: string }[] = [
  { value: "full", label: "Ganzes Feld", icon: Square, desc: "Standard — alle Kennzahlen verfügbar" },
  { value: "left_half", label: "Linke Hälfte", icon: ArrowLeftRight, desc: "Nur sichtbare Hälfte wird ausgewertet" },
  { value: "right_half", label: "Rechte Hälfte", icon: ArrowLeftRight, desc: "Nur sichtbare Hälfte wird ausgewertet" },
];

export default function CameraSetupOverlay({ onDismiss, onStart }: CameraSetupOverlayProps) {
  const [checked, setChecked] = useState<boolean[]>([false, false, false, false, false]);
  const [coverage, setCoverage] = useState<FieldCoverage>("full");

  const allChecked = checked.every(Boolean);

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm p-4 safe-area-pad overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold font-display">Kamera-Tipps</h2>
        <button onClick={onDismiss} className="rounded-lg p-2 hover:bg-muted">
          <X className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 space-y-3">
        {tips.map((tip, i) => (
          <button
            key={i}
            onClick={() => setChecked(prev => { const n = [...prev]; n[i] = !n[i]; return n; })}
            className={`w-full flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
              checked[i]
                ? "border-primary/40 bg-primary/5"
                : "border-border bg-card"
            }`}
          >
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
              checked[i] ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              {checked[i] ? <CheckCircle2 className="h-4 w-4" /> : <tip.icon className="h-4 w-4" />}
            </div>
            <div>
              <p className="text-sm font-semibold">{tip.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{tip.desc}</p>
            </div>
          </button>
        ))}

        {/* Help block: what to do if field doesn't fit */}
        <FieldCoverageHelp />

        {/* Field coverage selector */}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold mb-1">Was siehst du im Bild?</p>
          <p className="text-xs text-muted-foreground mb-3">Wähle den Bereich, den deine Kamera abdeckt.</p>
          <div className="space-y-2">
            {coverageOptions.map((opt) => {
              const active = coverage === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setCoverage(opt.value)}
                  className={`w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                    active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border bg-background hover:bg-muted/50"
                  }`}
                >
                  <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    <opt.icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {coverage !== "full" && (
            <div className="mt-3 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-warning leading-relaxed">
              <strong>Tipp:</strong> Mit einem Helfer + zweitem Handy bekommst du das ganze Feld. Brich ab und wähle stattdessen „Helfer filmt".
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2 sticky bottom-0 bg-background/95 backdrop-blur-sm pt-2">
        <Button onClick={() => onStart(coverage)} size="lg" className="w-full gap-2 h-14 text-base">
          <Camera className="h-5 w-5" />
          {allChecked ? "Aufnahme starten" : "Trotzdem starten"}
        </Button>
        {!allChecked && (
          <p className="text-xs text-center text-muted-foreground">
            Tippe die Tipps an, um sie als gelesen zu markieren
          </p>
        )}
      </div>
    </div>
  );
}
