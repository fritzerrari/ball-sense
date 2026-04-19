import { Card, CardContent } from "@/components/ui/card";
import { Users, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

interface Props {
  data: {
    formation: string;
    reasoning: string;
    key_roles: string[];
  };
}

export default function ShapeRecommendationCard({ data }: Props) {
  if (!data?.formation) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
      <Card className="border-border/50 bg-gradient-to-br from-primary/5 via-card/80 to-card/80 backdrop-blur-sm">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="font-semibold font-display">Formations-Empfehlung</h2>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="rounded-2xl bg-primary/10 border border-primary/30 px-5 py-3 text-center min-w-[120px]">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Aufstellung</p>
              <p className="text-3xl font-bold font-display text-primary">{data.formation}</p>
            </div>
            <p className="text-sm leading-relaxed text-foreground/85 flex-1">{data.reasoning}</p>
          </div>
          {data.key_roles?.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/40">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Schlüsselrollen</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.key_roles.map((r, i) => (
                  <Badge key={i} variant="outline" className="bg-primary/5 border-primary/30 text-foreground/90 text-xs">
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
