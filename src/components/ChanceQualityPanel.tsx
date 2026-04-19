import { Card, CardContent } from "@/components/ui/card";
import { Target, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

interface TeamChance {
  shots_total: number;
  shots_on_target: number;
  accuracy_pct: number;
  conversion_pct: number;
  summary: string;
}

interface Props {
  data: {
    home: TeamChance;
    away: TeamChance;
    verdict: string;
  };
  homeName: string;
  awayName: string;
}

function TeamColumn({ team, name, accent }: { team: TeamChance; name: string; accent: string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm truncate">{name}</h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-muted/30 p-2.5">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Schüsse</p>
          <p className={`text-2xl font-bold font-display ${accent}`}>{team.shots_total}</p>
          <p className="text-[10px] text-muted-foreground">{team.shots_on_target} aufs Tor</p>
        </div>
        <div className="rounded-lg bg-muted/30 p-2.5">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Genauigkeit</p>
          <p className={`text-2xl font-bold font-display ${accent}`}>{Math.round(team.accuracy_pct)}%</p>
          <p className="text-[10px] text-muted-foreground">{Math.round(team.conversion_pct)}% verwertet</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{team.summary}</p>
    </div>
  );
}

export default function ChanceQualityPanel({ data, homeName, awayName }: Props) {
  if (!data?.home || !data?.away) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardContent className="pt-6 space-y-5">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="font-semibold font-display">Chancenqualität</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <TeamColumn team={data.home} name={homeName} accent="text-primary" />
            <TeamColumn team={data.away} name={awayName} accent="text-foreground" />
          </div>
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex gap-2">
            <TrendingUp className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed"><span className="font-semibold">Verdict:</span> {data.verdict}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
