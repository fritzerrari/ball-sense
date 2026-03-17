import { Link } from "react-router-dom";
import { Users, Map, Crosshair, Swords, Camera, BarChart3, ChevronRight, CheckCircle2 } from "lucide-react";
import { usePlayers } from "@/hooks/use-players";
import { useFields } from "@/hooks/use-fields";
import { useMatches } from "@/hooks/use-matches";

interface StepDef {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  href: string;
  done: boolean;
}

export function MatchFlowGuide() {
  const { data: players } = usePlayers();
  const { data: fields } = useFields();
  const { data: matches } = useMatches();

  const hasPlayers = (players?.length ?? 0) > 0;
  const hasFields = (fields?.length ?? 0) > 0;
  const hasCalibrated = (fields ?? []).some(f => f.calibration != null);
  const hasMatch = (matches?.length ?? 0) > 0;
  const hasTracking = (matches ?? []).some(m => m.status === "done" || m.status === "processing");
  const hasDone = (matches ?? []).some(m => m.status === "done");

  const steps: StepDef[] = [
    { key: "players", label: "Kader anlegen", description: "Mindestens 11 Spieler hinzufügen", icon: Users, href: "/players", done: hasPlayers },
    { key: "field", label: "Spielfeld erstellen", description: "Einen Platz mit Maßen anlegen", icon: Map, href: "/fields", done: hasFields },
    { key: "calibrate", label: "Feld kalibrieren", description: "Foto hochladen & 4 Ecken markieren", icon: Crosshair, href: hasFields ? `/fields/${fields?.[0]?.id}/calibrate` : "/fields", done: hasCalibrated },
    { key: "match", label: "Spiel anlegen", description: "Gegner, Datum & Aufstellung festlegen", icon: Swords, href: "/matches/new", done: hasMatch },
    { key: "track", label: "Tracking starten", description: "Smartphones positionieren & aufzeichnen", icon: Camera, href: hasMatch ? `/matches/${matches?.[0]?.id}` : "/matches", done: hasTracking },
    { key: "report", label: "Report ansehen", description: "Heatmaps, Laufdistanzen & Sprints", icon: BarChart3, href: hasDone ? `/matches/${(matches ?? []).find(m => m.status === "done")?.id}` : "/matches", done: hasDone },
  ];

  // Find current active step
  const currentIdx = steps.findIndex(s => !s.done);
  const allDone = currentIdx === -1;

  if (allDone) return null;

  return (
    <div className="glass-card p-5 glow-border space-y-4">
      <div>
        <h3 className="text-sm font-bold font-display text-primary">Nächster Schritt</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Folge diesen Schritten, um dein erstes Spiel zu tracken</p>
      </div>

      <div className="space-y-1.5">
        {steps.map((step, i) => {
          const isCurrent = i === currentIdx;
          const isPast = i < currentIdx;

          return (
            <Link
              key={step.key}
              to={step.href}
              className={`flex items-center gap-3 p-3 rounded-lg transition-all group ${
                isCurrent
                  ? "bg-primary/10 border border-primary/30 shadow-sm"
                  : isPast
                    ? "opacity-60"
                    : "opacity-40 pointer-events-none"
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                step.done
                  ? "bg-emerald-500/20 text-emerald-400"
                  : isCurrent
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}>
                {step.done ? <CheckCircle2 className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{step.label}</div>
                {isCurrent && <div className="text-xs text-muted-foreground">{step.description}</div>}
              </div>
              {isCurrent && <ChevronRight className="h-4 w-4 text-primary shrink-0 group-hover:translate-x-0.5 transition-transform" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
