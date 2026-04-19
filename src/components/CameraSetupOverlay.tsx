import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Camera, Mountain, Smartphone, CheckCircle2, X, Maximize2, ArrowLeftRight, Square, UserCheck, Tag } from "lucide-react";
import FieldCoverageHelp from "./FieldCoverageHelp";
import type { FieldCoverage } from "@/lib/types";

interface CameraSetupOverlayProps {
  onDismiss: () => void;
  onStart: (coverage: FieldCoverage, eventLeadOnly: boolean, deviceLabel: string) => void;
  /** Show the Event-Lead toggle (trainer-only feature). */
  showEventLeadToggle?: boolean;
  /** Whether this device is the trainer (true) or a helper (false) — controls default label. */
  isTrainer?: boolean;
}

const DEVICE_LABEL_KEY = "fieldiq_device_label";

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

export default function CameraSetupOverlay({ onDismiss, onStart, showEventLeadToggle = false, isTrainer = false }: CameraSetupOverlayProps) {
  const [checked, setChecked] = useState<boolean[]>([false, false, false, false, false]);
  const [coverage, setCoverage] = useState<FieldCoverage>("full");
  const [eventLeadOnly, setEventLeadOnly] = useState(false);
  const [deviceLabel, setDeviceLabel] = useState<string>("");

  // Restore last-used label, fallback to a sensible default per role.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DEVICE_LABEL_KEY);
      if (stored && stored.trim().length > 0) { setDeviceLabel(stored); return; }
    } catch { /* ignore */ }
    setDeviceLabel(isTrainer ? "Trainer-Gerät" : "Helfer-Kamera");
  }, [isTrainer]);

  const allChecked = checked.every(Boolean);

  const handleStart = () => {
    const finalLabel = (deviceLabel || "").trim() || (isTrainer ? "Trainer-Gerät" : "Helfer-Kamera");
    try { localStorage.setItem(DEVICE_LABEL_KEY, finalLabel); } catch { /* ignore */ }
    onStart(coverage, eventLeadOnly, finalLabel);
  };

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

        {/* Device label — helps trainer identify each camera in the remote panel */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Tag className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Geräte-Name</p>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                {isTrainer
                  ? "So erkennst du dieses Gerät später im Bericht."
                  : "So sieht der Trainer, welche Kamera du bist (z. B. „Tribüne", „Sven's iPhone")."}
              </p>
              <Input
                value={deviceLabel}
                onChange={(e) => setDeviceLabel(e.target.value.slice(0, 40))}
                placeholder={isTrainer ? "z. B. Trainer-iPhone" : "z. B. Tribüne links"}
                className="h-9 text-sm"
                maxLength={40}
              />
            </div>
          </div>
        </div>

        {/* Event-Lead toggle (trainer-only) */}
        {showEventLeadToggle && (
          <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <UserCheck className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Nur ich protokolliere Events</p>
                <Switch checked={eventLeadOnly} onCheckedChange={setEventLeadOnly} />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Helfer-Geräte zeigen die Tor-/Karten-Buttons nicht an. Du behältst die volle Kontrolle, sie filmen nur.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2 sticky bottom-0 bg-background/95 backdrop-blur-sm pt-2">
        <Button onClick={handleStart} size="lg" className="w-full gap-2 h-14 text-base">
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
