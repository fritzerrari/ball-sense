import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";

interface StatEntry {
  id: string;
  distance_km?: number | null;
  top_speed_kmh?: number | null;
  sprint_count?: number | null;
  avg_speed_kmh?: number | null;
  pass_accuracy?: number | null;
  duels_won?: number | null;
  duels_total?: number | null;
  goals?: number | null;
  assists?: number | null;
  rating?: number | null;
  matches?: { date: string; away_club_name?: string | null } | null;
}

interface PlayerChartsProps {
  stats: StatEntry[];
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

export function PlayerCharts({ stats }: PlayerChartsProps) {
  if (!stats.length) return null;

  const chronological = [...stats].reverse().slice(-20);

  const chartData = chronological.map(s => ({
    label: s.matches?.away_club_name?.substring(0, 8) ||
      (s.matches?.date ? new Date(s.matches.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) : "—"),
    km: Math.round((s.distance_km ?? 0) * 10) / 10,
    topSpeed: Math.round((s.top_speed_kmh ?? 0) * 10) / 10,
    sprints: s.sprint_count ?? 0,
    avgSpeed: Math.round((s.avg_speed_kmh ?? 0) * 10) / 10,
    passAccuracy: s.pass_accuracy ? Math.round(s.pass_accuracy) : null,
    duelRate: s.duels_total && s.duels_total > 0 ? Math.round(((s.duels_won ?? 0) / s.duels_total) * 100) : null,
    goals: s.goals ?? 0,
    assists: s.assists ?? 0,
    rating: s.rating ? Math.round(s.rating * 10) / 10 : null,
  }));

  const avgKm = chartData.length > 0
    ? Math.round(chartData.reduce((s, d) => s + d.km, 0) / chartData.length * 10) / 10
    : 0;

  const hasPassData = chartData.some(d => d.passAccuracy !== null);
  const hasDuelData = chartData.some(d => d.duelRate !== null);
  const hasRatingData = chartData.some(d => d.rating !== null);
  const hasGoalData = chartData.some(d => d.goals > 0 || d.assists > 0);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold font-display">Leistungsentwicklung</h2>
      <div className="grid md:grid-cols-2 gap-4">
        {/* Distance trend */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Laufleistung (km)</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <defs>
                  <linearGradient id="kmGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine y={avgKm} stroke="hsl(var(--accent))" strokeDasharray="3 3" label={{ value: `Ø ${avgKm}`, fill: "hsl(var(--muted-foreground))", fontSize: 10, position: "insideTopRight" }} />
                <Bar dataKey="km" name="Distanz (km)" fill="url(#kmGrad)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top speed trend */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Top Speed (km/h)</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="topSpeed" name="Top Speed" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sprint trend */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Sprints pro Spiel</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="sprintGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="sprints" name="Sprints" stroke="hsl(var(--accent))" fill="url(#sprintGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pass accuracy trend */}
        {hasPassData && (
          <div className="glass-card p-5">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Passgenauigkeit (%)</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="passAccuracy" name="Passquote %" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Duel win rate trend */}
        {hasDuelData && (
          <div className="glass-card p-5">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Zweikampfquote (%)</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="duelGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="duelRate" name="Zweikampf %" stroke="hsl(var(--primary))" fill="url(#duelGrad)" strokeWidth={2} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Goals + Assists */}
        {hasGoalData && (
          <div className="glass-card p-5">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Tore & Assists</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="goals" name="Tore" fill="hsl(var(--primary))" stackId="ga" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="assists" name="Assists" fill="hsl(var(--accent))" stackId="ga" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Rating trend */}
        {hasRatingData && (
          <div className="glass-card p-5">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Bewertung</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis domain={[0, 10]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <ReferenceLine y={7} stroke="hsl(var(--accent))" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="rating" name="Rating" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 4 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
