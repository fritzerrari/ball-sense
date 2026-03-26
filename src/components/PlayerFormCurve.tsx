import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

interface FormDataPoint {
  date: string;
  opponent: string;
  rating: number | null;
  distance_km: number | null;
  sprint_count: number | null;
}

interface PlayerFormCurveProps {
  data: FormDataPoint[];
}

export default function PlayerFormCurve({ data }: PlayerFormCurveProps) {
  if (data.length < 2) return null;

  const chartData = data.map((d) => ({
    label: `${new Date(d.date).toLocaleDateString("de-DE", { day: "2-digit", month: "short" })}`,
    rating: d.rating ? Math.round(d.rating * 10) / 10 : null,
    distance: d.distance_km ? Math.round(d.distance_km * 10) / 10 : null,
    sprints: d.sprint_count ?? null,
    opponent: d.opponent,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-display flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Formkurve (letzte {data.length} Spiele)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="left" domain={[0, 10]} tick={{ fontSize: 10 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} hide />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
              }}
              labelFormatter={(_, payload) => {
                const item = payload?.[0]?.payload;
                return item ? `vs ${item.opponent}` : "";
              }}
            />
            <Line yAxisId="left" type="monotone" dataKey="rating" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} name="Rating" connectNulls />
            <Line yAxisId="right" type="monotone" dataKey="distance" stroke="hsl(var(--accent-foreground))" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 3 }} name="Distanz (km)" connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
