import { Card, CardContent } from "@/components/ui/card";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { Check, X, Crosshair } from "lucide-react";
import { motion } from "framer-motion";

interface OpponentProfile {
  possession_control: number;
  pressing_intensity: number;
  counter_attack_threat: number;
  defensive_discipline: number;
  set_piece_danger: number;
  transition_speed: number;
  style_label: string;
}

interface NextMatchActions {
  do_actions: string[];
  dont_actions: string[];
}

interface Props {
  dna: OpponentProfile;
  actions?: NextMatchActions;
}

const DIMENSION_LABELS: Record<string, string> = {
  possession_control: "Ballbesitz",
  pressing_intensity: "Pressing",
  counter_attack_threat: "Konter",
  defensive_discipline: "Def. Disziplin",
  set_piece_danger: "Standards",
  transition_speed: "Umschaltspeed",
};

export default function OpponentDNA({ dna, actions }: Props) {
  const chartData = Object.entries(DIMENSION_LABELS).map(([key, label]) => ({
    dimension: label,
    value: (dna as any)[key] ?? 0,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
    >
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Crosshair className="h-5 w-5 text-primary" />
              <h2 className="font-semibold font-display">Gegner-DNA</h2>
            </div>
            <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              {dna.style_label}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-6">
            {/* Spider Chart */}
            <div className="flex-1 min-h-[220px]">
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar
                    dataKey="value"
                    stroke="hsl(160, 84%, 32%)"
                    fill="hsl(160, 84%, 32%)"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Do / Don't */}
            {actions && (
              <div className="flex-1 space-y-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-emerald-500 font-semibold mb-2">Nächstes Spiel — DO</p>
                  <div className="space-y-1.5">
                    {actions.do_actions.map((a, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                        <span>{a}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-red-400 font-semibold mb-2">Nächstes Spiel — DON'T</p>
                  <div className="space-y-1.5">
                    {actions.dont_actions.map((a, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <X className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                        <span>{a}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
