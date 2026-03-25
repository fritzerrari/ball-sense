import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dumbbell, Flame, BrainCircuit, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

interface Drill {
  name: string;
  duration_min: number;
  description: string;
  linked_pattern?: string;
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
  if (!sessions?.length) return null;

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

          {/* Timeline connector */}
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
                    {/* Timeline dot */}
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
                        {session.drills.map((drill, j) => (
                          <div key={j} className="flex items-start gap-2 rounded-lg bg-card/60 border border-border/30 p-2.5">
                            <div className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-mono font-bold">
                              {drill.duration_min}'
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium">{drill.name}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">{drill.description}</p>
                              {drill.linked_pattern && (
                                <p className="text-[10px] text-primary/70 mt-1 flex items-center gap-0.5">
                                  <ChevronRight className="h-3 w-3" />
                                  {drill.linked_pattern}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
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
