import { Card, CardContent } from "@/components/ui/card";
import { Brain, Eye, Lightbulb, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

interface BlueprintBlock {
  dimension: string;
  headline: string;
  observation: string;
  recommendation: string;
  evidence: string;
}

interface Props {
  blocks: BlueprintBlock[];
}

const DIMENSION_LABELS: Record<string, string> = {
  pressing: "Pressing",
  build_up: "Spielaufbau",
  build_play: "Spielaufbau",
  final_third: "Letztes Drittel",
  defensive_shape: "Defensivformation",
  defense: "Defensive",
  transitions: "Umschaltspiel",
  transition: "Umschaltspiel",
  set_pieces: "Standards",
  offense: "Offensive",
};

export default function TacticalBlueprintBoard({ blocks }: Props) {
  if (!blocks?.length) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h2 className="font-semibold font-display">Taktischer Blueprint</h2>
            <span className="text-[10px] text-muted-foreground ml-auto">{blocks.length} Bausteine</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {blocks.map((b, i) => {
              const label = DIMENSION_LABELS[b.dimension?.toLowerCase()] ?? b.dimension;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 + i * 0.06 }}
                  className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
                      <h3 className="font-semibold text-sm mt-0.5 leading-tight">{b.headline}</h3>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs leading-relaxed">
                    <div className="flex gap-2">
                      <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-foreground/80"><span className="font-semibold text-muted-foreground">Beobachtung: </span>{b.observation}</p>
                    </div>
                    <div className="flex gap-2">
                      <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-foreground/90"><span className="font-semibold text-amber-500">Empfehlung: </span>{b.recommendation}</p>
                    </div>
                    <div className="flex gap-2 pt-1 border-t border-border/40">
                      <BarChart3 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <p className="text-muted-foreground italic"><span className="font-semibold not-italic">Daten: </span>{b.evidence}</p>
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
