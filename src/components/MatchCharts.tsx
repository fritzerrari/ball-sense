import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, Legend,
} from "recharts";

interface TeamStats {
  total_distance_km?: number | null;
  avg_distance_km?: number | null;
  top_speed_kmh?: number | null;
  possession_pct?: number | null;
}

interface PlayerStat {
  id: string;
  distance_km?: number | null;
  top_speed_kmh?: number | null;
  sprint_count?: number | null;
  avg_speed_kmh?: number | null;
  players?: { name: string; number?: number | null } | null;
}

interface MatchChartsProps {
  homeTeamStats: TeamStats | null | undefined;
  awayTeamStats: TeamStats | null | undefined;
  homePlayerStats: PlayerStat[];
  awayPlayerStats: PlayerStat[];
  homeName: string;
  awayName: string;
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-card border border-border p-3 shadow-lg text-sm">
      <p className="font-semibold font-display text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-muted-foreground">
          {p.name}: <span className="font-medium text-foreground">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

function normalize(val: number | null | undefined, max: number): number {
  if (!val || !max) return 0;
  return Math.round((val / max) * 100);
}

export function MatchRadarChart({ homeTeamStats, awayTeamStats, homeName, awayName }: Pick<MatchChartsProps, "homeTeamStats" | "awayTeamStats" | "homeName" | "awayName">) {
  if (!homeTeamStats && !awayTeamStats) return null;

  const maxDist = Math.max(homeTeamStats?.total_distance_km ?? 0, awayTeamStats?.total_distance_km ?? 0, 1);
  const maxSpeed = Math.max(homeTeamStats?.top_speed_kmh ?? 0, awayTeamStats?.top_speed_kmh ?? 0, 1);
  const maxAvgDist = Math.max(homeTeamStats?.avg_distance_km ?? 0, awayTeamStats?.avg_distance_km ?? 0, 1);

  const data = [
    { metric: "Distanz", home: normalize(homeTeamStats?.total_distance_km, maxDist), away: normalize(awayTeamStats?.total_distance_km, maxDist) },
    { metric: "Top Speed", home: normalize(homeTeamStats?.top_speed_kmh, maxSpeed), away: normalize(awayTeamStats?.top_speed_kmh, maxSpeed) },
    { metric: "Ø Distanz", home: normalize(homeTeamStats?.avg_distance_km, maxAvgDist), away: normalize(awayTeamStats?.avg_distance_km, maxAvgDist) },
    { metric: "Ballbesitz", home: homeTeamStats?.possession_pct ?? 0, away: awayTeamStats?.possession_pct ?? 0 },
  ];

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Team-Vergleich</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar name={homeName} dataKey="home" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
            <Radar name={awayName} dataKey="away" stroke="hsl(var(--accent))" fill="hsl(var(--accent))" fillOpacity={0.15} strokeWidth={2} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function TopPlayersChart({ stats, title, metric, unit }: { stats: PlayerStat[]; title: string; metric: "distance_km" | "top_speed_kmh" | "sprint_count"; unit: string }) {
  if (!stats.length) return null;

  const sorted = [...stats]
    .filter(s => (s[metric] ?? 0) > 0)
    .sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0))
    .slice(0, 5);

  if (!sorted.length) return null;

  const chartData = sorted.map(s => ({
    name: s.players?.name?.substring(0, 12) ?? "—",
    value: Math.round(((s[metric] as number) ?? 0) * 10) / 10,
  }));

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">{title}</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={90} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="value" name={`${title} (${unit})`} fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ComparisonBarChart({ homeTeamStats, awayTeamStats, homeName, awayName }: Pick<MatchChartsProps, "homeTeamStats" | "awayTeamStats" | "homeName" | "awayName">) {
  if (!homeTeamStats && !awayTeamStats) return null;

  const data = [
    { metric: "Distanz (km)", home: homeTeamStats?.total_distance_km ?? 0, away: awayTeamStats?.total_distance_km ?? 0 },
    { metric: "Top Speed", home: homeTeamStats?.top_speed_kmh ?? 0, away: awayTeamStats?.top_speed_kmh ?? 0 },
    { metric: "Ø km", home: homeTeamStats?.avg_distance_km ?? 0, away: awayTeamStats?.avg_distance_km ?? 0 },
    { metric: "Ballbesitz %", home: homeTeamStats?.possession_pct ?? 0, away: awayTeamStats?.possession_pct ?? 0 },
  ];

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Statistik-Vergleich</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="metric" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="home" name={homeName} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="away" name={awayName} fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
