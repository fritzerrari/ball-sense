import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegendContent, type ChartConfig } from "@/components/ui/chart";
import { Activity, Shield, Goal, Crosshair, Gauge, Trophy } from "lucide-react";

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
  passes_total?: number | null;
  passes_completed?: number | null;
  pass_accuracy?: number | null;
  duels_won?: number | null;
  duels_total?: number | null;
  tackles?: number | null;
  interceptions?: number | null;
  ball_recoveries?: number | null;
  shots_total?: number | null;
  shots_on_target?: number | null;
  goals?: number | null;
  assists?: number | null;
  fouls_committed?: number | null;
  yellow_cards?: number | null;
  red_cards?: number | null;
  aerial_won?: number | null;
  crosses?: number | null;
  ball_contacts?: number | null;
  rating?: number | null;
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

const comparisonConfig = {
  home: { label: "Heim", color: "hsl(var(--primary))", icon: Trophy },
  away: { label: "Auswärts", color: "hsl(var(--accent))", icon: Shield },
} satisfies ChartConfig;

function normalize(val: number | null | undefined, max: number): number {
  if (!val || !max) return 0;
  return Math.round((val / max) * 100);
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function aggregatePlayerMetrics(stats: PlayerStat[]) {
  const totals = stats.reduce(
    (acc, player) => {
      acc.passesTotal += player.passes_total ?? 0;
      acc.passesCompleted += player.passes_completed ?? 0;
      acc.duelsWon += player.duels_won ?? 0;
      acc.duelsTotal += player.duels_total ?? 0;
      acc.tackles += player.tackles ?? 0;
      acc.interceptions += player.interceptions ?? 0;
      acc.ballRecoveries += player.ball_recoveries ?? 0;
      acc.shots += player.shots_total ?? 0;
      acc.shotsOnTarget += player.shots_on_target ?? 0;
      acc.goals += player.goals ?? 0;
      acc.assists += player.assists ?? 0;
      acc.fouls += player.fouls_committed ?? 0;
      acc.yellow += player.yellow_cards ?? 0;
      acc.red += player.red_cards ?? 0;
      acc.sprints += player.sprint_count ?? 0;
      acc.ballContacts += player.ball_contacts ?? 0;
      acc.aerialWon += player.aerial_won ?? 0;
      acc.crosses += player.crosses ?? 0;
      return acc;
    },
    {
      passesTotal: 0,
      passesCompleted: 0,
      duelsWon: 0,
      duelsTotal: 0,
      tackles: 0,
      interceptions: 0,
      ballRecoveries: 0,
      shots: 0,
      shotsOnTarget: 0,
      goals: 0,
      assists: 0,
      fouls: 0,
      yellow: 0,
      red: 0,
      sprints: 0,
      ballContacts: 0,
      aerialWon: 0,
      crosses: 0,
    },
  );

  return {
    ...totals,
    passAccuracy: totals.passesTotal > 0 ? round((totals.passesCompleted / totals.passesTotal) * 100, 0) : 0,
    duelRate: totals.duelsTotal > 0 ? round((totals.duelsWon / totals.duelsTotal) * 100, 0) : 0,
  };
}

function leadingTeam(homeValue: number, awayValue: number, homeName: string, awayName: string) {
  if (homeValue === awayValue) return "Ausgeglichen";
  return homeValue > awayValue ? homeName : awayName;
}

function formatMetricValue(value: number, unit?: string) {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.abs(value) >= 100 ? Math.round(value) : round(value, 1);
  return unit ? `${rounded}${unit}` : String(rounded);
}

export function MatchKpiStrip({
  homeTeamStats,
  awayTeamStats,
  homePlayerStats,
  awayPlayerStats,
  homeName,
  awayName,
}: MatchChartsProps) {
  const homeAgg = aggregatePlayerMetrics(homePlayerStats);
  const awayAgg = aggregatePlayerMetrics(awayPlayerStats);

  const cards = [
    {
      label: "Kontrolle",
      value: Math.max(homeTeamStats?.possession_pct ?? 0, awayTeamStats?.possession_pct ?? 0),
      unit: "%",
      winner: leadingTeam(homeTeamStats?.possession_pct ?? 0, awayTeamStats?.possession_pct ?? 0, homeName, awayName),
      icon: Gauge,
    },
    {
      label: "Passquote",
      value: Math.max(homeAgg.passAccuracy, awayAgg.passAccuracy),
      unit: "%",
      winner: leadingTeam(homeAgg.passAccuracy, awayAgg.passAccuracy, homeName, awayName),
      icon: Activity,
    },
    {
      label: "Zweikampfquote",
      value: Math.max(homeAgg.duelRate, awayAgg.duelRate),
      unit: "%",
      winner: leadingTeam(homeAgg.duelRate, awayAgg.duelRate, homeName, awayName),
      icon: Shield,
    },
    {
      label: "Ballgewinne",
      value: Math.max(homeAgg.ballRecoveries, awayAgg.ballRecoveries),
      winner: leadingTeam(homeAgg.ballRecoveries, awayAgg.ballRecoveries, homeName, awayName),
      icon: Trophy,
    },
    {
      label: "Schüsse",
      value: Math.max(homeAgg.shots, awayAgg.shots),
      winner: leadingTeam(homeAgg.shots, awayAgg.shots, homeName, awayName),
      icon: Crosshair,
    },
    {
      label: "Scorer",
      value: Math.max(homeAgg.goals + homeAgg.assists, awayAgg.goals + awayAgg.assists),
      winner: leadingTeam(homeAgg.goals + homeAgg.assists, awayAgg.goals + awayAgg.assists, homeName, awayName),
      icon: Goal,
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      {cards.map(({ label, value, unit, winner, icon: Icon }) => (
        <div key={label} className="glass-card p-4 space-y-3 overflow-hidden relative">
          <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Momentum</span>
          </div>
          <div className="relative space-y-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold font-display">{formatMetricValue(value, unit)}</p>
            <p className="text-xs text-primary font-medium truncate">{winner}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MatchRadarChart({ homeTeamStats, awayTeamStats, homePlayerStats, awayPlayerStats, homeName, awayName }: MatchChartsProps) {
  if (!homeTeamStats && !awayTeamStats) return null;

  const homeAgg = aggregatePlayerMetrics(homePlayerStats);
  const awayAgg = aggregatePlayerMetrics(awayPlayerStats);

  const maxDist = Math.max(homeTeamStats?.total_distance_km ?? 0, awayTeamStats?.total_distance_km ?? 0, 1);
  const maxPossession = 100;
  const maxPass = Math.max(homeAgg.passAccuracy, awayAgg.passAccuracy, 1);
  const maxDuel = Math.max(homeAgg.duelRate, awayAgg.duelRate, 1);
  const maxRecoveries = Math.max(homeAgg.ballRecoveries, awayAgg.ballRecoveries, 1);
  const maxShots = Math.max(homeAgg.shots, awayAgg.shots, 1);

  const data = [
    { metric: "Intensität", home: normalize(homeTeamStats?.total_distance_km, maxDist), away: normalize(awayTeamStats?.total_distance_km, maxDist) },
    { metric: "Kontrolle", home: normalize(homeTeamStats?.possession_pct, maxPossession), away: normalize(awayTeamStats?.possession_pct, maxPossession) },
    { metric: "Passspiel", home: normalize(homeAgg.passAccuracy, maxPass), away: normalize(awayAgg.passAccuracy, maxPass) },
    { metric: "Duelle", home: normalize(homeAgg.duelRate, maxDuel), away: normalize(awayAgg.duelRate, maxDuel) },
    { metric: "Ballgewinne", home: normalize(homeAgg.ballRecoveries, maxRecoveries), away: normalize(awayAgg.ballRecoveries, maxRecoveries) },
    { metric: "Chancen", home: normalize(homeAgg.shots, maxShots), away: normalize(awayAgg.shots, maxShots) },
  ];

  return (
    <div className="glass-card p-5 sm:p-6 space-y-4">
      <div>
        <h3 className="text-base font-semibold font-display">Wirkungsprofil</h3>
        <p className="text-sm text-muted-foreground">Vergleich der Spielidentität über Intensität, Kontrolle, Duelle und Chance-Erzeugung.</p>
      </div>
      <ChartContainer config={{ ...comparisonConfig, home: { ...comparisonConfig.home, label: homeName }, away: { ...comparisonConfig.away, label: awayName } }} className="h-72 w-full aspect-auto">
        <RadarChart data={data}>
          <ChartTooltip content={<ChartTooltipContent />} />
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis dataKey="metric" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar name="home" dataKey="home" stroke="var(--color-home)" fill="var(--color-home)" fillOpacity={0.18} strokeWidth={2.5} />
          <Radar name="away" dataKey="away" stroke="var(--color-away)" fill="var(--color-away)" fillOpacity={0.14} strokeWidth={2.5} />
          <Legend content={<ChartLegendContent />} />
        </RadarChart>
      </ChartContainer>
    </div>
  );
}

export function TopPlayersChart({
  stats,
  title,
  metric,
  unit,
}: {
  stats: PlayerStat[];
  title: string;
  metric:
    | "distance_km"
    | "top_speed_kmh"
    | "sprint_count"
    | "passes_total"
    | "tackles"
    | "ball_recoveries"
    | "goals"
    | "assists"
    | "shots_total"
    | "aerial_won";
  unit: string;
}) {
  if (!stats.length) return null;

  const sorted = [...stats]
    .filter((s) => (s[metric] ?? 0) > 0)
    .sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0))
    .slice(0, 5);

  if (!sorted.length) return null;

  const chartData = sorted.map((s) => ({
    name: s.players?.name?.substring(0, 14) ?? "—",
    value: Math.round(((s[metric] as number) ?? 0) * 10) / 10,
  }));

  return (
    <div className="glass-card p-5 sm:p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold font-display">{title}</h3>
        <p className="text-xs text-muted-foreground">Top 5 Spieler im aktuellen Match</p>
      </div>
      <ChartContainer config={{ value: { label: title, color: "hsl(var(--primary))" } }} className="h-52 w-full aspect-auto">
        <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={96} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
          <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${value}${unit ? ` ${unit}` : ""}`} />} />
          <Bar dataKey="value" name="value" fill="var(--color-value)" radius={[0, 8, 8, 0]} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

export function ComparisonBarChart({ homeTeamStats, awayTeamStats, homePlayerStats, awayPlayerStats, homeName, awayName }: MatchChartsProps) {
  if (!homeTeamStats && !awayTeamStats) return null;

  const homeAgg = aggregatePlayerMetrics(homePlayerStats);
  const awayAgg = aggregatePlayerMetrics(awayPlayerStats);

  const data = [
    { metric: "Distanz", home: round(homeTeamStats?.total_distance_km ?? 0), away: round(awayTeamStats?.total_distance_km ?? 0) },
    { metric: "Ballbesitz", home: round(homeTeamStats?.possession_pct ?? 0), away: round(awayTeamStats?.possession_pct ?? 0) },
    { metric: "Passquote", home: homeAgg.passAccuracy, away: awayAgg.passAccuracy },
    { metric: "Zweikämpfe", home: homeAgg.duelRate, away: awayAgg.duelRate },
    { metric: "Ballgewinne", home: homeAgg.ballRecoveries, away: awayAgg.ballRecoveries },
    { metric: "Schüsse", home: homeAgg.shots, away: awayAgg.shots },
  ];

  return (
    <div className="glass-card p-5 sm:p-6 space-y-4">
      <div>
        <h3 className="text-base font-semibold font-display">Statistik-Vergleich</h3>
        <p className="text-sm text-muted-foreground">Direkter Vergleich von Match-Kontrolle, Duellstärke und Offensivproduktion.</p>
      </div>
      <ChartContainer config={{ home: { label: homeName, color: "hsl(var(--primary))" }, away: { label: awayName, color: "hsl(var(--accent))" } }} className="h-72 w-full aspect-auto">
        <BarChart data={data} margin={{ left: 0, right: 12, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="metric" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Legend content={<ChartLegendContent />} />
          <Bar dataKey="home" name="home" fill="var(--color-home)" radius={[8, 8, 0, 0]} />
          <Bar dataKey="away" name="away" fill="var(--color-away)" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
