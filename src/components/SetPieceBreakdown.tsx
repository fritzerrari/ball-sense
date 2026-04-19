import { Card, CardContent } from "@/components/ui/card";
import { Flag, Goal } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  data: {
    home_corners: number;
    away_corners: number;
    goals_from_set_pieces: number;
    summary: string;
  };
  homeName: string;
  awayName: string;
}

export default function SetPieceBreakdown({ data, homeName, awayName }: Props) {
  if (!data) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-primary" />
            <h2 className="font-semibold font-display">Standards-Bilanz</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">{homeName}</p>
              <p className="text-2xl font-bold font-display text-primary mt-1">{data.home_corners}</p>
              <p className="text-[10px] text-muted-foreground">Ecken</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">{awayName}</p>
              <p className="text-2xl font-bold font-display mt-1">{data.away_corners}</p>
              <p className="text-[10px] text-muted-foreground">Ecken</p>
            </div>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-center">
              <Goal className="h-4 w-4 text-amber-500 mx-auto" />
              <p className="text-2xl font-bold font-display text-amber-500 mt-1">{data.goals_from_set_pieces}</p>
              <p className="text-[10px] text-muted-foreground">Tore aus Standards</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{data.summary}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
