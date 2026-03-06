import { useParams, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Pause, Play, Users, RefreshCw, Flag, Timer, Signal, SignalHigh, SignalLow } from "lucide-react";

type Phase = "loading" | "camera" | "calibration" | "tracking" | "ended";

export default function TrackingPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const cam = searchParams.get("cam") || "0";
  const [phase, setPhase] = useState<Phase>("loading");
  const [progress, setProgress] = useState(67);
  const [paused, setPaused] = useState(false);
  const [time, setTime] = useState("00:00");
  const [detections, setDetections] = useState(14);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
        <div className="font-display font-bold text-sm">
          <span className="gradient-text">Field</span>IQ
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
          Kamera {parseInt(cam) + 1}
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {phase === "loading" && (
          <div className="w-full max-w-sm space-y-6 text-center">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center animate-glow-pulse">
              <Camera className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display mb-2">KI wird geladen...</h2>
              <p className="text-sm text-muted-foreground">Einmalig ~20 MB. Danach offline verfügbar.</p>
            </div>
            <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-sm text-muted-foreground">{progress}%</p>
            <Button variant="hero" size="xl" onClick={() => setPhase("tracking")} className="w-full">
              Weiter (Demo)
            </Button>
          </div>
        )}

        {phase === "tracking" && (
          <div className="w-full max-w-lg space-y-6">
            {/* Timer */}
            <div className="text-center">
              <div className="text-6xl font-bold font-display tracking-tight gradient-text">{time}</div>
              <div className="text-sm text-muted-foreground mt-1">Spielzeit</div>
            </div>

            {/* Camera preview placeholder */}
            <div className="aspect-video bg-muted/30 rounded-xl border border-border relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30">
                <Camera className="h-12 w-12" />
              </div>
              {/* Detection count */}
              <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/80 backdrop-blur-sm border border-border text-sm">
                <Users className="h-4 w-4 text-primary" />
                <span className="font-medium">{detections} erkannt</span>
              </div>
              {/* Quality indicator */}
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-card/80 backdrop-blur-sm border border-border text-xs">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-muted-foreground">Gut</span>
              </div>
            </div>

            {/* Big action buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="tracking"
                onClick={() => setPaused(!paused)}
                className="flex items-center justify-center gap-2"
              >
                {paused ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
                {paused ? "WEITER" : "PAUSE"}
              </Button>
              <Button variant="tracking" className="flex items-center justify-center gap-2">
                <Timer className="h-6 w-6" /> HALBZEIT
              </Button>
              <Button variant="tracking" className="flex items-center justify-center gap-2">
                <RefreshCw className="h-6 w-6" /> WECHSEL
              </Button>
              <Button
                variant="trackingDanger"
                onClick={() => setPhase("ended")}
                className="flex items-center justify-center gap-2"
              >
                <Flag className="h-6 w-6" /> ENDE
              </Button>
            </div>
          </div>
        )}

        {phase === "ended" && (
          <div className="w-full max-w-sm space-y-6 text-center">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
              <Flag className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display mb-2">Spiel beendet — 90:00</h2>
              <p className="text-sm text-muted-foreground">2.700 Frames · {detections} Spieler erkannt</p>
            </div>

            {/* Player mapping */}
            <div className="text-left space-y-3">
              <h3 className="text-sm font-semibold">Spieler zuordnen</h3>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 glass-card p-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground">
                    #{i + 1}
                  </div>
                  <select className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm">
                    <option>Nicht zugeordnet</option>
                    <option>M. Müller (#10)</option>
                    <option>T. Werner (#9)</option>
                  </select>
                </div>
              ))}
            </div>

            <Button variant="hero" size="xl" className="w-full">
              ✅ Hochladen & Report erstellen
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
