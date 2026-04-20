import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dumbbell, Flame, BrainCircuit, ChevronRight, AlertCircle, Pin, X, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams, useParams } from "react-router-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import { clearPinnedTrainingFocus, getPinnedTrainingFocus, type PinnedTrainingFocus } from "@/lib/pinned-training-focus";

interface Drill {
  name: string;
  duration_min: number;
  description: string;
  linked_pattern?: string;
  trigger?: string;
  trigger_minutes?: number[];
  drill_key?: string;
}

interface Session {
  session_number: number;
  session_type: string;
  title: string;
  goal: string;
  drills: Drill[];
}

interface Props {
  sessions: Session[];
}

const SESSION_CONFIG: Record<string, { icon: typeof Dumbbell; color: string; label: string }> = {
  recovery: { icon: Dumbbell, color: "text-blue-400 bg-blue-500/10 border-blue-500/20", label: "Regeneration" },
  intensity: { icon: Flame, color: "text-orange-400 bg-orange-500/10 border-orange-500/20", label: "Intensität" },
  tactical: { icon: BrainCircuit, color: "text-primary bg-primary/10 border-primary/20", label: "Taktik" },
};

export default function TrainingMicroCycle({ sessions }: Props) {
  const [searchParams] = useSearchParams();
  const { id: matchIdParam } = useParams<{ id: string }>();
  const targetDrillKey = searchParams.get("drill");
  const highlightedRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState<PinnedTrainingFocus | null>(null);

  const refreshPinned = useCallback(() => {
    if (matchIdParam) setPinned(getPinnedTrainingFocus(matchIdParam));
  }, [matchIdParam]);

  useEffect(() => {
    refreshPinned();
    const handler = () => refreshPinned();
    window.addEventListener("pinned-training-focus-changed", handler);
    return () => window.removeEventListener("pinned-training-focus-changed", handler);
  }, [refreshPinned]);

  useEffect(() => {
    if (targetDrillKey && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [targetDrillKey]);

  if (!sessions?.length && !pinned) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
    >
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Dumbbell className="h-5 w-5 text-primary" />
            <h2 className="font-semibold font-display">Trainings-Mikrozyklus</h2>
          </div>

          <AnimatePresence>
            {pinned && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-4 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 relative"
              >
                <button
                  type="button"
                  onClick={() => matchIdParam && clearPinnedTrainingFocus(matchIdParam)}
                  className="absolute top-2 right-2 h-6 w-6 rounded-full hover:bg-muted/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Pin entfernen"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                    <Pin className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1 pr-6">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary font-semibold">
                      <Sparkles className="h-3 w-3" />
                      Aus What-if übernommen
                    </div>
                    <p className="text-sm font-semibold mt-1 leading-snug">{pinned.focus}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 italic">"{pinned.scenario}"</p>
                    {pinned.predicted_outcome && (
                      <p className="text-[11px] text-foreground/80 mt-1.5">
                        <span className="text-muted-foreground">Prognose:</span> {pinned.predicted_outcome}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!sessions?.length && pinned && (
            <p className="text-[11px] text-center text-muted-foreground/60 py-4">
              Noch kein KI-Mikrozyklus generiert — der Fokus oben ist deine manuelle Priorität.
            </p>
          )}

          <div className="relative">
            <div className="absolute left-4 top-8 bottom-8 w-0.5 bg-gradient-to-b from-blue-400 via-orange-400 to-primary hidden sm:block" />

            <div className="space-y-4">
              {sessions.map((session, i) => {
                const config = SESSION_CONFIG[session.session_type] ?? SESSION_CONFIG.tactical;
                const Icon = config.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 + i * 0.15 }}
                    className={`rounded-xl border ${config.color.split(" ").slice(2).join(" ")} p-4 sm:ml-10 relative`}
                  >
                    <div className="absolute -left-[2.05rem] top-4 hidden sm:flex h-5 w-5 items-center justify-center rounded-full bg-card border-2 border-current">
                      <Icon className="h-3 w-3" />
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className={`text-[10px] ${config.color.split(" ").slice(0, 2).join(" ")} border-0`}>
                        Tag {session.session_number} — {config.label}
                      </Badge>
                    </div>

                    <h3 className="font-medium text-sm">{session.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{session.goal}</p>

                    {session.drills?.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {session.drills.map((drill, j) => {
                          const isTarget = targetDrillKey && drill.drill_key === targetDrillKey;
                          return (
                            <div
                              key={j}
                              ref={isTarget ? highlightedRef : undefined}
                              className={`flex items-start gap-2 rounded-lg border p-2.5 transition-all ${
                                isTarget
                                  ? "bg-primary/10 border-primary/40 ring-2 ring-primary/30"
                                  : "bg-card/60 border-border/30"
                              }`}
                            >
                              <div className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-mono font-bold">
                                {drill.duration_min}'
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium">{drill.name}</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">{drill.description}</p>

                                {/* Auslöser - der echte Daten-Beleg, warum diese Übung */}
                                {drill.trigger && (
                                  <div className="mt-2 rounded-md bg-amber-500/5 border border-amber-500/20 px-2 py-1.5">
                                    <p className="text-[10px] text-amber-500 font-semibold flex items-center gap-1 mb-0.5">
                                      <AlertCircle className="h-3 w-3" />
                                      Auslöser im Spiel
                                    </p>
                                    <p className="text-[11px] text-foreground/90 leading-relaxed">
                                      {drill.trigger}
                                      {drill.trigger_minutes && drill.trigger_minutes.length > 0 && (
                                        <span className="text-muted-foreground"> (Min {drill.trigger_minutes.join(", ")})</span>
                                      )}
                                    </p>
                                  </div>
                                )}

                                {drill.linked_pattern && !drill.trigger && (
                                  <p className="text-[10px] text-primary/70 mt-1 flex items-center gap-0.5">
                                    <ChevronRight className="h-3 w-3" />
                                    {drill.linked_pattern}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
