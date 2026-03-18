import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegendContent } from "@/components/ui/chart";
import { Activity, Shield, Goal, Gauge, Trophy } from "lucide-react";

interface StatEntry {
  id: string;
  distance_km?: number | null;
  top_speed_kmh?: number | null;
  sprint_count?: number | null;
  sprint_distance_m?: number | null;
  avg_speed_kmh?: number | null;
  pass_accuracy?: number | null;
  passes_total?: number | null;
  passes_completed?: number | null;
  duels_won?: number | null;
  duels_total?: number | null;
  tackles?: number | null;
  interceptions?: number | null;
  ball_recoveries?: number | null;
  shots_total?: number | null;
  shots_on_target?: number | null;
  fouls_committed?: number | null;
  yellow_cards?: number | null;
  red_cards?: number | null;
  ball_contacts?: number | null;
  aerial_won?: number | null;
  goals?: number | null;
  assists?: number | null;
  rating?: number | null;
  matches?: { date: string; away_club_name?: string | null } | null;
}

interface PlayerChartsProps {
  stats: StatEntry[];
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function PlayerCharts({ stats }: PlayerChartsProps) {
  if (!stats.length) return null;

  const chronological = [...stats].reverse().slice(-12);

  const chartData = chronological.map((s) => ({
    label:
      s.matches?.away_club_name?.substring(0, 8) ||
      (s.matches?.date ? new Date(s.matches.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) : "—"),
    km: round(s.distance_km ?? 0),
    topSpeed: round(s.top_speed_kmh ?? 0),
    sprints: s.sprint_count ?? 0,
    sprintDistance: round((s.sprint_distance_m ?? 0) / 1000, 2),
    avgSpeed: round(s.avg_speed_kmh ?? 0),
    passAccuracy: s.pass_accuracy ? Math.round(s.pass_accuracy) : null,
    passesTotal: s.passes_total ?? 0,
    duelRate: s.duels_total && s.duels_total > 0 ? Math.round(((s.duels_won ?? 0) / s.duels_total) * 100) : null,
    tackles: s.tackles ?? 0,
    interceptions: s.interceptions ?? 0,
    recoveries: s.ball_recoveries ?? 0,
    shots: s.shots_total ?? 0,
    shotsOnTarget: s.shots_on_target ?? 0,
    goals: s.goals ?? 0,
    assists: s.assists ?? 0,
    fouls: s.fouls_committed ?? 0,
    cards: (s.yellow_cards ?? 0) + (s.red_cards ?? 0) * 2,
    aerialWon: s.aerial_won ?? 0,
    ballContacts: s.ball_contacts ?? 0,
    rating: s.rating ? round(s.rating, 1) : null,
  }));

  const totalPasses = chartData.reduce((sum, entry) => sum + entry.passesTotal, 0);
  const totalRecoveries = chartData.reduce((sum, entry) => sum + entry.recoveries, 0);
  const avgPassAccuracy = chartData.filter((entry) => entry.passAccuracy !== null).length
    ? Math.round(
        chartData.filter((entry) => entry.passAccuracy !== null).reduce((sum, entry) => sum + (entry.passAccuracy ?? 0), 0) /
          chartData.filter((entry) => entry.passAccuracy !== null).length,
      )
    : 0;
  const avgDuelRate = chartData.filter((entry) => entry.duelRate !== null).length
    ? Math.round(
        chartData.filter((entry) => entry.duelRate !== null).reduce((sum, entry) => sum + (entry.duelRate ?? 0), 0) /
          chartData.filter((entry) => entry.duelRate !== null).length,
      )
    : 0;
  const scorerPoints = chartData.reduce((sum, entry) => sum + entry.goals + entry.assists, 0);
  const avgRating = chartData.filter((entry) => entry.rating !== null).length
    ? round(
        chartData.filter((entry) => entry.rating !== null).reduce((sum, entry) => sum + (entry.rating ?? 0), 0) /
          chartData.filter((entry) => entry.rating !== null).length,
        1,
      )
    : 0;

  const chartConfig = {
    km: { label: "Distanz", color: "hsl(var(--primary))", icon: Activity },
    rating: { label: "Rating", color: "hsl(var(--accent))", icon: Trophy },
    passesTotal: { label: "Pässe", color: "hsl(var(--primary))", icon: Gauge },
    passAccuracy: { label: "Passquote", color: "hsl(var(--accent))", icon: Trophy },
    duelRate: { label: "Zweikampfquote", color: "hsl(var(--primary))", icon: Shield },
    tackles: { label: "Tackles", color: "hsl(var(--accent))", icon: Activity },
    interceptions: { label: "Interceptions", color: "hsl(var(--primary))", icon: Shield },
    recoveries: { label: "Ballgewinne", color: "hsl(var(--accent))", icon: Trophy },
    shots: { label: "Schüsse", color: "hsl(var(--primary))", icon: Goal },
    shotsOnTarget: { label: "Aufs Tor", color: "hsl(var(--accent))", icon: Goal },
    goals: { label: "Tore", color: "hsl(var(--primary))", icon: Goal },
    assists: { label: "Assists", color: "hsl(var(--accent))", icon: Trophy },
    fouls: { label: "Fouls", color: "hsl(var(--primary))", icon: Shield },
    cards: { label: "Kartenindex", color: "hsl(var(--accent))", icon: Trophy },
    aerialWon: { label: "Kopfballduelle", color: "hsl(var(--primary))", icon: Shield },
  } as const;

  const statCards = [
    { label: "Ø Passquote", value: avgPassAccuracy ? `${avgPassAccuracy}%` : "—", icon: Gauge },
    { label: "Ø Zweikampfquote", value: avgDuelRate ? `${avgDuelRate}%` : "—", icon: Shield },
    { label: "Ballgewinne", value: String(totalRecoveries), icon: Activity },
    { label: "Scorer", value: String(scorerPoints), icon: Goal },
    { label: "Pässe gesamt", value: String(totalPasses), icon: Trophy },
    { label: "Ø Rating", value: avgRating ? String(avgRating) : "—", icon: Trophy },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold font-display">Leistungsentwicklung</h2>
        <p className="text-sm text-muted-foreground">Spielprofil mit moderner Formkurve für Physis, Ballarbeit, Defensive und Offensivwirkung.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {statCards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="glass-card p-4 space-y-3 overflow-hidden relative">
            <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />
            <div className="relative flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Profile</span>
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <div className="relative">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold font-display">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="glass-card p-5 sm:p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold font-display">Formindex</h3>
            <p className="text-sm text-muted-foreground">Laufleistung und Bewertung zeigen, wie stabil der Spieler zuletzt performt hat.</p>
          </div>
          <ChartContainer config={chartConfig} className="h-64 w-full aspect-auto">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="player-km" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-km)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-km)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend content={<ChartLegendContent />} />
              <Area type="monotone" dataKey="km" name="km" stroke="var(--color-km)" fill="url(#player-km)" strokeWidth={2.5} />
              <Line type="monotone" dataKey="rating" name="rating" stroke="var(--color-rating)" strokeWidth={2.5} dot={{ fill: "var(--color-rating)", r: 3 }} connectNulls />
            </AreaChart>
          </ChartContainer>
        </div>

        <div className="glass-card p-5 sm:p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold font-display">Aufbau & Passspiel</h3>
            <p className="text-sm text-muted-foreground">Passvolumen und Genauigkeit im Spielaufbau.</p>
          </div>
          <ChartContainer config={chartConfig} className="h-64 w-full aspect-auto">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend content={<ChartLegendContent />} />
              <Bar dataKey="passesTotal" name="passesTotal" fill="var(--color-passesTotal)" radius={[8, 8, 0, 0]} />
              <Line type="monotone" dataKey="passAccuracy" name="passAccuracy" stroke="var(--color-passAccuracy)" strokeWidth={2.5} dot={{ fill: "var(--color-passAccuracy)", r: 3 }} connectNulls />
            </BarChart>
          </ChartContainer>
        </div>

        <div className="glass-card p-5 sm:p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold font-display">Defensive Präsenz</h3>
            <p className="text-sm text-muted-foreground">Zweikämpfe, Tackles, Interceptions und Ballgewinne als Defensivprofil.</p>
          </div>
          <ChartContainer config={chartConfig} className="h-64 w-full aspect-auto">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend content={<ChartLegendContent />} />
              <Line type="monotone" dataKey="duelRate" name="duelRate" stroke="var(--color-duelRate)" strokeWidth={2.5} dot={{ fill: "var(--color-duelRate)", r: 3 }} connectNulls />
              <Line type="monotone" dataKey="tackles" name="tackles" stroke="var(--color-tackles)" strokeWidth={2.5} dot={{ fill: "var(--color-tackles)", r: 3 }} />
              <Line type="monotone" dataKey="interceptions" name="interceptions" stroke="var(--color-interceptions)" strokeWidth={2.5} dot={{ fill: "var(--color-interceptions)", r: 3 }} />
              <Line type="monotone" dataKey="recoveries" name="recoveries" stroke="var(--color-recoveries)" strokeWidth={2.5} dot={{ fill: "var(--color-recoveries)", r: 3 }} />
            </LineChart>
          </ChartContainer>
        </div>

        <div className="glass-card p-5 sm:p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold font-display">Offensivbeitrag</h3>
            <p className="text-sm text-muted-foreground">Schussvolumen, Tore und Assists pro Spiel.</p>
          </div>
          <ChartContainer config={chartConfig} className="h-64 w-full aspect-auto">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend content={<ChartLegendContent />} />
              <Bar dataKey="shots" name="shots" fill="var(--color-shots)" radius={[8, 8, 0, 0]} />
              <Bar dataKey="shotsOnTarget" name="shotsOnTarget" fill="var(--color-shotsOnTarget)" radius={[8, 8, 0, 0]} />
              <Line type="monotone" dataKey="goals" name="goals" stroke="var(--color-goals)" strokeWidth={2.5} dot={{ fill: "var(--color-goals)", r: 3 }} />
              <Line type="monotone" dataKey="assists" name="assists" stroke="var(--color-assists)" strokeWidth={2.5} dot={{ fill: "var(--color-assists)", r: 3 }} />
            </BarChart>
          </ChartContainer>
        </div>

        <div className="glass-card p-5 sm:p-6 space-y-4 xl:col-span-2">
          <div>
            <h3 className="text-base font-semibold font-display">Disziplin & Luftduelle</h3>
            <p className="text-sm text-muted-foreground">Fouls, Kartenindex und gewonnene Kopfballduelle als ergänzendes Wirkungsbild.</p>
          </div>
          <ChartContainer config={chartConfig} className="h-64 w-full aspect-auto">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend content={<ChartLegendContent />} />
              <Line type="monotone" dataKey="fouls" name="fouls" stroke="var(--color-fouls)" strokeWidth={2.5} dot={{ fill: "var(--color-fouls)", r: 3 }} />
              <Line type="monotone" dataKey="cards" name="cards" stroke="var(--color-cards)" strokeWidth={2.5} dot={{ fill: "var(--color-cards)", r: 3 }} />
              <Line type="monotone" dataKey="aerialWon" name="aerialWon" stroke="var(--color-aerialWon)" strokeWidth={2.5} dot={{ fill: "var(--color-aerialWon)", r: 3 }} />
            </LineChart>
          </ChartContainer>
        </div>
      </div>
    </div>
  );
}
