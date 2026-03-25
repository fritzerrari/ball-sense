import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

interface TacticalGrade {
  dimension: string;
  grade: string;
  reasoning: string;
}

interface Props {
  grades: TacticalGrade[];
}

const DIMENSION_LABELS: Record<string, string> = {
  pressing: "Pressing",
  build_up: "Spielaufbau",
  final_third: "Letztes Drittel",
  defensive_shape: "Defensivformation",
  transitions: "Umschaltspiel",
  set_pieces: "Standards",
};

const GRADE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: "bg-emerald-500/15", text: "text-emerald-500", border: "border-emerald-500/30" },
  B: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/30" },
  C: { bg: "bg-amber-500/15", text: "text-amber-500", border: "border-amber-500/30" },
  D: { bg: "bg-orange-500/15", text: "text-orange-500", border: "border-orange-500/30" },
  E: { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-400/30" },
  F: { bg: "bg-red-600/20", text: "text-red-500", border: "border-red-500/40" },
};

export default function TacticalGradeMatrix({ grades }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  if (!grades?.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardContent className="pt-6">
          <h2 className="font-semibold font-display mb-4">Taktische Bewertung</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {grades.map((g, i) => {
              const style = GRADE_STYLES[g.grade] ?? GRADE_STYLES.C;
              const label = DIMENSION_LABELS[g.dimension] ?? g.dimension;
              return (
                <motion.div
                  key={g.dimension}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + i * 0.08 }}
                >
                  <Collapsible open={openIdx === i} onOpenChange={(o) => setOpenIdx(o ? i : null)}>
                    <CollapsibleTrigger className="w-full text-left">
                      <div className={`rounded-xl border ${style.border} ${style.bg} p-4 transition-all hover:scale-[1.02] cursor-pointer`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
                          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openIdx === i ? "rotate-180" : ""}`} />
                        </div>
                        <div className={`text-3xl font-black font-display mt-1 ${style.text}`}>{g.grade}</div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-2 py-2 text-xs text-muted-foreground leading-relaxed">
                        {g.reasoning}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
