import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, CalendarDays, Eye } from "lucide-react";
import { motion } from "framer-motion";

interface Risk {
  title: string;
  description: string;
  severity: number;
  urgency: string;
  affected_zone?: string;
}

interface Props {
  risks: Risk[];
}

const URGENCY_CONFIG: Record<string, { icon: typeof Clock; label: string; color: string }> = {
  immediate: { icon: Clock, label: "Sofort", color: "text-red-400 bg-red-500/10 border-red-500/30" },
  next_week: { icon: CalendarDays, label: "Nächste Woche", color: "text-amber-500 bg-amber-500/10 border-amber-500/30" },
  monitor: { icon: Eye, label: "Beobachten", color: "text-muted-foreground bg-muted border-border" },
};

export default function RiskRadar({ risks }: Props) {
  if (!risks?.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
    >
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="font-semibold font-display">Risiko-Matrix</h2>
          </div>

          <div className="space-y-3">
            {risks.map((risk, i) => {
              const urg = URGENCY_CONFIG[risk.urgency] ?? URGENCY_CONFIG.monitor;
              const UrgIcon = urg.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className="rounded-xl border border-border/50 bg-muted/20 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm">{risk.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{risk.description}</p>
                      {risk.affected_zone && (
                        <span className="text-[10px] text-muted-foreground/70 mt-1 block">
                          Zone: {risk.affected_zone}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {/* Severity bar */}
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(n => (
                          <div
                            key={n}
                            className={`h-3 w-2 rounded-sm ${
                              n <= risk.severity ? "bg-red-500" : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                      <Badge variant="outline" className={`text-[9px] gap-1 ${urg.color}`}>
                        <UrgIcon className="h-3 w-3" />
                        {urg.label}
                      </Badge>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
