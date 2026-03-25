import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Battery, TrendingDown } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface FramePosition {
  frame_index: number;
  players: Array<{ team: string; x: number; y: number; role?: string }>;
  frame_type: string;
}

interface Props {
  frames: FramePosition[];
  intervalSec: number;
}

export default function FatigueIndicator({ frames, intervalSec }: Props) {
  const { language } = useTranslation();
  const de = language === "de";

  const tacticalFrames = frames.filter(f => f.frame_type === "tactical");
  if (tacticalFrames.length < 4) return null;

  // Split into 15-minute intervals
  const intervals: { label: string; homePlayers: number[][]; awayPlayers: number[][] }[] = [];
  const intervalMinutes = 15;

  for (let min = 0; min < 90; min += intervalMinutes) {
    const framesInInterval = tacticalFrames.filter(f => {
      const frameMin = (f.frame_index * intervalSec) / 60;
      return frameMin >= min && frameMin < min + intervalMinutes;
    });

    if (framesInInterval.length === 0) continue;

    const homePositions = framesInInterval.flatMap(f => f.players.filter(p => p.team === "home").map(p => [p.x, p.y]));
    const awayPositions = framesInInterval.flatMap(f => f.players.filter(p => p.team === "away").map(p => [p.x, p.y]));

    intervals.push({
      label: `${min}-${min + intervalMinutes}'`,
      homePlayers: homePositions,
      awayPlayers: awayPositions,
    });
  }

  // Calculate "intensity" as average spread (higher spread = more movement coverage)
  const chartData = intervals.map((interval, i) => {
    const homeSpread = interval.homePlayers.length > 1
      ? Math.sqrt(
          interval.homePlayers.reduce((s, p) => s + (p[0] - 50) ** 2 + (p[1] - 34) ** 2, 0) / interval.homePlayers.length
        )
      : 30;

    const awaySpread = interval.awayPlayers.length > 1
      ? Math.sqrt(
          interval.awayPlayers.reduce((s, p) => s + (p[0] - 50) ** 2 + (p[1] - 34) ** 2, 0) / interval.awayPlayers.length
        )
      : 30;

    return {
      label: interval.label,
      homeIntensity: Math.round(homeSpread),
      awayIntensity: Math.round(awaySpread),
    };
  });

  // Detect fatigue: declining intensity in second half
  const firstHalf = chartData.slice(0, Math.ceil(chartData.length / 2));
  const secondHalf = chartData.slice(Math.ceil(chartData.length / 2));
  const avgFirst = firstHalf.reduce((s, d) => s + d.homeIntensity, 0) / (firstHalf.length || 1);
  const avgSecond = secondHalf.reduce((s, d) => s + d.homeIntensity, 0) / (secondHalf.length || 1);
  const fatigueDrop = avgFirst > 0 ? Math.round(((avgFirst - avgSecond) / avgFirst) * 100) : 0;

  // Position drift: average y position per interval
  const driftData = intervals.map(interval => {
    const avgY = interval.homePlayers.length > 0
      ? interval.homePlayers.reduce((s, p) => s + p[1], 0) / interval.homePlayers.length
      : 34;
    return { label: interval.label, avgY: Math.round(avgY) };
  });

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Battery className="h-5 w-5 text-primary" />
          <h2 className="font-semibold font-display">{de ? "Ermüdungs-Indikator" : "Fatigue Indicator"}</h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{de ? "Intensitäts-Abfall" : "Intensity drop"}</p>
            <p className={`text-2xl font-bold font-display mt-1 ${fatigueDrop > 15 ? "text-destructive" : fatigueDrop > 5 ? "text-warning" : "text-primary"}`}>
              {fatigueDrop > 0 ? `-${fatigueDrop}%` : `+${Math.abs(fatigueDrop)}%`}
            </p>
            <p className="text-[10px] text-muted-foreground">{de ? "2. vs 1. Halbzeit" : "2nd vs 1st half"}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{de ? "Positionsdrift" : "Position drift"}</p>
            {driftData.length >= 2 && (
              <>
                <p className="text-2xl font-bold font-display mt-1 flex items-center gap-1">
                  {driftData[driftData.length - 1].avgY > driftData[0].avgY + 3 ? (
                    <><TrendingDown className="h-5 w-5 text-destructive" /> {de ? "Tiefer" : "Deeper"}</>
                  ) : (
                    <>{de ? "Stabil" : "Stable"}</>
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground">{de ? "Ø y-Position im Spielverlauf" : "Avg y-position over time"}</p>
              </>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-2">{de ? "Bewegungsintensität pro 15-Min-Intervall" : "Movement intensity per 15-min interval"}</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="homeIntensity" name={de ? "Heim" : "Home"} radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={i >= chartData.length / 2 ? "hsl(var(--primary) / 0.5)" : "hsl(var(--primary))"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
