import { Link } from "react-router-dom";
import { Users, Map, Swords, Camera, BarChart3, ChevronRight, CheckCircle2, Rocket, BrainCircuit, ShieldAlert, Sparkles } from "lucide-react";
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
  
  const hasMatch = (matches?.length ?? 0) > 0;
  const hasTracking = (matches ?? []).some((m) => m.status === "done" || m.status === "processing");
  const hasDone = (matches ?? []).some((m) => m.status === "done");
  const latestDone = (matches ?? []).find((m) => m.status === "done");
  const setupMatch = (matches ?? []).find((m) => m.status === "setup");
  const consentOpenCount = (players ?? []).filter((player) => player.tracking_consent_status !== "granted").length;

  const steps: StepDef[] = [
    { key: "players", label: "Kader anlegen", description: "Mindestens 11 Spieler hinzufügen", icon: Users, href: "/players", done: hasPlayers },
    { key: "field", label: "Spielfeld erstellen", description: "Einen Platz mit Maßen anlegen", icon: Map, href: "/fields", done: hasFields },
    
    { key: "match", label: "Spiel anlegen", description: "Gegner, Datum & Aufstellung festlegen", icon: Swords, href: "/matches/new", done: hasMatch },
    { key: "track", label: "Tracking starten", description: "Smartphones positionieren & aufzeichnen", icon: Camera, href: hasMatch ? `/matches/${matches?.[0]?.id}` : "/matches", done: hasTracking },
    { key: "report", label: "Report ansehen", description: "Heatmaps, Laufdistanzen & Sprints", icon: BarChart3, href: hasDone ? `/matches/${(matches ?? []).find((m) => m.status === "done")?.id}` : "/matches", done: hasDone },
  ];

  const currentIdx = steps.findIndex((s) => !s.done);
  const allDone = currentIdx === -1;
  const doneCount = steps.filter((s) => s.done).length;
  const progressPct = Math.round((doneCount / steps.length) * 100);

  const coachCards = [
    latestDone
      ? {
          label: "Neueste Analyse öffnen",
          description: "Springe direkt in Schwachstellen-Heatmap und Gegentor-Analyse des letzten Spiels.",
          icon: BrainCircuit,
          href: `/matches/${latestDone.id}`,
        }
      : null,
    setupMatch
      ? {
          label: "Offenes Setup fortsetzen",
          description: "Das nächste Spiel ist angelegt und wartet auf Tracking und Kader-Feinschliff.",
          icon: Sparkles,
          href: `/matches/${setupMatch.id}`,
        }
      : null,
    consentOpenCount > 0
      ? {
          label: "Einwilligungen klären",
          description: `${consentOpenCount} Spieler sind noch nicht eindeutig für Tracking freigegeben.`,
          icon: ShieldAlert,
          href: "/players",
        }
      : null,
  ].filter(Boolean) as { label: string; description: string; icon: React.ElementType; href: string }[];

  return (
    <div className="glass-card space-y-5 border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent p-6 glow-border">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15">
          <Rocket className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold font-display text-foreground">Coach Guide</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {allDone ? "Du bist live im Coaching-Cockpit – hier sind die schnellsten nächsten Schritte." : "Folge diesen 6 Schritten – du bist fast bereit!"}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          {doneCount}/{steps.length}
        </span>
      </div>

      <div className="space-y-1.5">
        <Progress value={progressPct} className="h-2 bg-muted/50" />
        <p className="text-[11px] text-muted-foreground">{progressPct}% abgeschlossen</p>
      </div>

      {!allDone && (
        <div className="space-y-1.5">
          {steps.map((step, i) => {
            const isCurrent = i === currentIdx;
            const isPast = i < currentIdx;

            return (
              <Link
                key={step.key}
                to={step.href}
                className={`group flex items-center gap-3 rounded-xl p-3 transition-all ${
                  isCurrent
                    ? "border border-primary/30 bg-primary/10 shadow-sm shadow-primary/5"
                    : isPast
                      ? "opacity-60"
                      : "pointer-events-none opacity-35"
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    step.done
                      ? "bg-emerald-500/20 text-emerald-400"
                      : isCurrent
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step.done ? <CheckCircle2 className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-sm ${isCurrent ? "font-semibold text-foreground" : "font-medium"}`}>{step.label}</div>
                  {isCurrent && <div className="mt-0.5 text-xs text-muted-foreground">{step.description}</div>}
                </div>
                {isCurrent && (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary transition-transform group-hover:translate-x-0.5">
                    Los <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {coachCards.length > 0 && (
        <div className="grid gap-3 md:grid-cols-3">
          {coachCards.map((card) => (
            <Link key={card.label} to={card.href} className="rounded-2xl border border-border bg-background/60 p-4 transition-colors hover:border-primary/40">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <card.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold font-display break-words">{card.label}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{card.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
