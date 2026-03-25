import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, ArrowRightLeft } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useTranslation } from "@/lib/i18n";

interface Transition {
  frame_index: number;
  type: "ball_win_counter" | "ball_loss_gegenpressing";
  speed: "fast" | "medium" | "slow";
  players_in_new_phase: number;
  description: string;
}

interface Props {
  data: Transition[];
  intervalSec: number;
}

const SPEED_COLORS: Record<string, string> = {
  fast: "hsl(var(--primary))",
  medium: "hsl(40,80%,50%)",
  slow: "hsl(0,70%,55%)",
};

export default function TransitionAnalysis({ data, intervalSec }: Props) {
  const { language } = useTranslation();
  const de = language === "de";

  const counters = data.filter(t => t.type === "ball_win_counter");
  const gegenpressing = data.filter(t => t.type === "ball_loss_gegenpressing");

  const barData = [
    { name: de ? "Konter" : "Counters", count: counters.length, fill: "hsl(var(--primary))" },
    { name: de ? "Gegenpressing" : "Gegenpressing", count: gegenpressing.length, fill: "hsl(var(--accent-foreground))" },
  ];

  const avgSpeed = (items: Transition[]) => {
    if (!items.length) return "—";
    const scores = items.map(i => i.speed === "fast" ? 3 : i.speed === "medium" ? 2 : 1);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return avg >= 2.5 ? (de ? "Schnell" : "Fast") : avg >= 1.5 ? (de ? "Mittel" : "Medium") : (de ? "Langsam" : "Slow");
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5 text-primary" />
          <h2 className="font-semibold font-display">{de ? "Umschaltmomente" : "Transitions"}</h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{de ? "Konter (Ballgewinn)" : "Counters (ball win)"}</p>
            <p className="text-2xl font-bold font-display mt-1">{counters.length}</p>
            <p className="text-[10px] text-muted-foreground">{de ? "Ø Geschwindigkeit" : "Avg speed"}: {avgSpeed(counters)}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{de ? "Gegenpressing (Ballverlust)" : "Gegenpressing (ball loss)"}</p>
            <p className="text-2xl font-bold font-display mt-1">{gegenpressing.length}</p>
            <p className="text-[10px] text-muted-foreground">{de ? "Ø Geschwindigkeit" : "Avg speed"}: {avgSpeed(gegenpressing)}</p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={barData} layout="vertical">
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
            <Tooltip contentStyle={{ fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
            <Bar dataKey="count" radius={[0, 6, 6, 0]} name={de ? "Anzahl" : "Count"}>
              {barData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {data.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{de ? "Letzte Umschaltmomente" : "Recent transition moments"}</p>
            {data.slice(0, 5).map((t, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-border/50 p-3">
                <Badge variant="outline" className={`text-[9px] shrink-0 ${t.type === "ball_win_counter" ? "border-primary/30 text-primary" : "border-destructive/30 text-destructive"}`}>
                  {t.type === "ball_win_counter" ? (de ? "Konter" : "Counter") : "Gegenpressing"}
                </Badge>
                <div className="min-w-0">
                  <p className="text-sm">{t.description}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">~{Math.round((t.frame_index * intervalSec) / 60)}'</span>
                    <Badge variant="secondary" className="text-[9px]" style={{ color: SPEED_COLORS[t.speed] }}>
                      {t.speed === "fast" ? "⚡" : t.speed === "medium" ? "→" : "◌"} {t.speed}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{t.players_in_new_phase} {de ? "Spieler" : "players"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
