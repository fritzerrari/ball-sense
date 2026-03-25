import { Card, CardContent } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface PressingFrame {
  frame_index: number;
  pressing_line_home: number;
  pressing_line_away: number;
  compactness_home: number;
  compactness_away: number;
}

interface Props {
  data: PressingFrame[];
  intervalSec: number;
}

export default function PressingChart({ data, intervalSec }: Props) {
  const { language } = useTranslation();
  const de = language === "de";

  const chartData = data.map((d, i) => ({
    minute: Math.round((d.frame_index * intervalSec) / 60),
    homePress: Math.round(100 - d.pressing_line_home),
    awayPress: Math.round(100 - d.pressing_line_away),
    homeCompact: d.compactness_home,
    awayCompact: d.compactness_away,
  }));

  const avgHomePressing = chartData.reduce((s, d) => s + d.homePress, 0) / chartData.length;
  const avgAwayPressing = chartData.reduce((s, d) => s + d.awayPress, 0) / chartData.length;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <ArrowUp className="h-5 w-5 text-primary" />
          <h2 className="font-semibold font-display">{de ? "Pressing-Analyse" : "Pressing Analysis"}</h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mb-2">
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{de ? "Ø Pressing-Höhe Heim" : "Avg pressing height home"}</p>
            <p className="text-lg font-bold font-display mt-1">{avgHomePressing.toFixed(0)}%</p>
            <p className="text-[10px] text-muted-foreground">{avgHomePressing > 60 ? (de ? "Hohes Pressing" : "High pressing") : avgHomePressing > 40 ? (de ? "Mittleres Pressing" : "Medium pressing") : (de ? "Tiefes Pressing" : "Low pressing")}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{de ? "Ø Pressing-Höhe Gast" : "Avg pressing height away"}</p>
            <p className="text-lg font-bold font-display mt-1">{avgAwayPressing.toFixed(0)}%</p>
            <p className="text-[10px] text-muted-foreground">{avgAwayPressing > 60 ? (de ? "Hohes Pressing" : "High pressing") : avgAwayPressing > 40 ? (de ? "Mittleres Pressing" : "Medium pressing") : (de ? "Tiefes Pressing" : "Low pressing")}</p>
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-2">{de ? "Pressing-Höhe im Spielverlauf" : "Pressing height over time"}</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <XAxis dataKey="minute" tick={{ fontSize: 10 }} label={{ value: "Min", position: "insideBottomRight", offset: -5, fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Line type="monotone" dataKey="homePress" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name={de ? "Heim" : "Home"} />
              <Line type="monotone" dataKey="awayPress" stroke="hsl(0,70%,55%)" strokeWidth={2} dot={{ r: 3 }} name={de ? "Gast" : "Away"} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-2">{de ? "Kompaktheit (je niedriger, desto kompakter)" : "Compactness (lower = more compact)"}</p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData}>
              <XAxis dataKey="minute" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 80]} tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Area type="monotone" dataKey="homeCompact" fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--primary))" strokeWidth={1.5} name={de ? "Heim" : "Home"} />
              <Area type="monotone" dataKey="awayCompact" fill="hsl(0,70%,55%, 0.1)" stroke="hsl(0,70%,55%)" strokeWidth={1.5} name={de ? "Gast" : "Away"} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
