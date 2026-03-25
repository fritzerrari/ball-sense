import { Card, CardContent } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from "recharts";
import { TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

interface MomentumPhase {
  minute: number;
  score: number;
  event?: string;
}

interface Props {
  data: MomentumPhase[];
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-bold font-display">{d.minute}'</p>
      <p className={d.score > 0 ? "text-emerald-500" : d.score < 0 ? "text-red-400" : "text-muted-foreground"}>
        Momentum: {d.score > 0 ? "+" : ""}{d.score}
      </p>
      {d.event && <p className="text-muted-foreground mt-1">{d.event}</p>}
    </div>
  );
}

export default function MomentumTimeline({ data }: Props) {
  if (!data?.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Card className="relative overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="font-semibold font-display">Momentum-Verlauf</h2>
          </div>

          <div className="flex justify-between text-[10px] text-muted-foreground mb-1 px-2">
            <span>← Gast-Dominanz</span>
            <span>Heim-Dominanz →</span>
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="momentumPos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(160, 84%, 32%)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(160, 84%, 32%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="momentumNeg" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="hsl(0, 70%, 55%)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(0, 70%, 55%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
              <XAxis dataKey="minute" tick={{ fontSize: 10 }} tickFormatter={v => `${v}'`} />
              <YAxis domain={[-100, 100]} tick={{ fontSize: 10 }} ticks={[-100, -50, 0, 50, 100]} />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.4} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="score"
                stroke="hsl(160, 84%, 32%)"
                strokeWidth={2}
                fill="url(#momentumPos)"
                baseLine={0}
              />
            </AreaChart>
          </ResponsiveContainer>

          {/* Event markers */}
          {data.filter(d => d.event).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {data.filter(d => d.event).map((d, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-muted/30 px-2 py-0.5 text-[10px]">
                  <span className="font-bold">{d.minute}'</span>
                  <span className="text-muted-foreground">{d.event}</span>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
