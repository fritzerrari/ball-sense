import { Link } from "react-router-dom";
import { Users, Map, Crosshair, Swords, Camera, BarChart3, ChevronRight, CheckCircle2, Rocket } from "lucide-react";
import { usePlayers } from "@/hooks/use-players";
import { useFields } from "@/hooks/use-fields";
import { useMatches } from "@/hooks/use-matches";
import { Progress } from "@/components/ui/progress";

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

  const currentIdx = steps.findIndex(s => !s.done);
  const allDone = currentIdx === -1;

  if (allDone) return null;

  const doneCount = steps.filter(s => s.done).length;
  const progressPct = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="glass-card p-6 glow-border space-y-5 border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Rocket className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold font-display text-foreground">Erstes Spiel tracken</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Folge diesen 6 Schritten — du bist fast bereit!</p>
        </div>
        <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full shrink-0">
          {doneCount}/{steps.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <Progress value={progressPct} className="h-2 bg-muted/50" />
        <p className="text-[11px] text-muted-foreground">{progressPct}% abgeschlossen</p>
      </div>

      {/* Steps */}
      <div className="space-y-1.5">
        {steps.map((step, i) => {
          const isCurrent = i === currentIdx;
          const isPast = i < currentIdx;

          return (
            <Link
              key={step.key}
              to={step.href}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all group ${
                isCurrent
                  ? "bg-primary/10 border border-primary/30 shadow-sm shadow-primary/5"
                  : isPast
                    ? "opacity-60"
                    : "opacity-35 pointer-events-none"
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                step.done
                  ? "bg-emerald-500/20 text-emerald-400"
                  : isCurrent
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}>
                {step.done ? <CheckCircle2 className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm truncate ${isCurrent ? "font-semibold text-foreground" : "font-medium"}`}>
                  {step.label}
                </div>
                {isCurrent && <div className="text-xs text-muted-foreground mt-0.5">{step.description}</div>}
              </div>
              {isCurrent && (
                <span className="flex items-center gap-1 text-xs font-medium text-primary shrink-0 group-hover:translate-x-0.5 transition-transform">
                  Los <ChevronRight className="h-3.5 w-3.5" />
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
