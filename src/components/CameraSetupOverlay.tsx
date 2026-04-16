import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Mountain, Smartphone, CheckCircle2, X, Maximize2 } from "lucide-react";

interface CameraSetupOverlayProps {
  onDismiss: () => void;
  onStart: () => void;
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

export default function CameraSetupOverlay({ onDismiss, onStart }: CameraSetupOverlayProps) {
  const [checked, setChecked] = useState<boolean[]>([false, false, false, false, false]);

  const allChecked = checked.every(Boolean);

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm p-4 safe-area-pad">
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
      </div>

      <div className="mt-4 space-y-2">
        <Button onClick={onStart} size="lg" className="w-full gap-2 h-14 text-base">
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
