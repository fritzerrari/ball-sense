import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useTranslation, useLocale } from "@/lib/i18n";
import { Link } from "react-router-dom";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegendContent } from "@/components/ui/chart";
import { MetricDetailDialog } from "@/components/MetricDetailDialog";
import { Activity, Gauge, Shield, Trophy } from "lucide-react";

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function DashboardCharts() {
  const { clubId } = useAuth();
  const { t } = useTranslation();
  const locale = useLocale();

  const { data } = useQuery({
    queryKey: ["dashboard_analytics", clubId, locale],
    queryFn: async () => {
      if (!clubId) return null;

      const { data: matches } = await supabase
        .from("matches")
        .select("id, date, away_club_name")
        .eq("home_club_id", clubId)
        .eq("status", "done")
        .order("date", { ascending: true })
        .limit(20);

      if (!matches?.length) return null;

      const matchIds = matches.map((m) => m.id);

      const [{ data: teamStats }, { data: stats }] = await Promise.all([
        supabase
          .from("team_match_stats")
          .select("match_id, total_distance_km, top_speed_kmh, possession_pct")
          .in("match_id", matchIds)
          .eq("team", "home"),
        supabase
          .from("player_match_stats")
          .select("match_id, player_id, distance_km, sprint_count, passes_total, passes_completed, duels_total, duels_won, ball_recoveries, players(name, id)")
          .in("match_id", matchIds)
          .eq("team", "home"),
      ]);

      const teamStatsMap = new Map(teamStats?.map((entry) => [entry.match_id, entry]) ?? []);
      const matchPlayerStats = new Map<string, typeof stats>();

      (stats ?? []).forEach((entry) => {
        const existing = matchPlayerStats.get(entry.match_id) ?? [];
        existing.push(entry);
        matchPlayerStats.set(entry.match_id, existing);
      });

      const trendData = matches.map((match) => {
        const team = teamStatsMap.get(match.id);
        const playerStats = matchPlayerStats.get(match.id) ?? [];

        const totals = playerStats.reduce(
          (acc, item) => {
            acc.sprints += item.sprint_count ?? 0;
            acc.passesTotal += item.passes_total ?? 0;
            acc.passesCompleted += item.passes_completed ?? 0;
            acc.duelsWon += item.duels_won ?? 0;
            acc.duelsTotal += item.duels_total ?? 0;
            acc.recoveries += item.ball_recoveries ?? 0;
            return acc;
          },
          { sprints: 0, passesTotal: 0, passesCompleted: 0, duelsWon: 0, duelsTotal: 0, recoveries: 0 },
        );

        return {
          label:
            match.away_club_name?.substring(0, 10) ||
            new Date(match.date).toLocaleDateString(locale, { day: "2-digit", month: "2-digit" }),
          date: new Date(match.date).toLocaleDateString(locale, { day: "2-digit", month: "2-digit" }),
          distance: round(team?.total_distance_km ?? 0),
          topSpeed: round(team?.top_speed_kmh ?? 0),
          possession: round(team?.possession_pct ?? 0),
          sprints: totals.sprints,
          passAccuracy: totals.passesTotal > 0 ? round((totals.passesCompleted / totals.passesTotal) * 100, 0) : 0,
          duelRate: totals.duelsTotal > 0 ? round((totals.duelsWon / totals.duelsTotal) * 100, 0) : 0,
          recoveries: totals.recoveries,
        };
      });

      const leaderboardMap = new Map<string, { id: string; name: string; totalKm: number; totalPasses: number; totalRecoveries: number }>();
      (stats ?? []).forEach((item) => {
        if (!item.player_id || !item.players) return;
        const existing = leaderboardMap.get(item.player_id) ?? {
          id: item.players.id,
          name: item.players.name,
          totalKm: 0,
          totalPasses: 0,
          totalRecoveries: 0,
        };
        existing.totalKm += item.distance_km ?? 0;
        existing.totalPasses += item.passes_total ?? 0;
        existing.totalRecoveries += item.ball_recoveries ?? 0;
        leaderboardMap.set(item.player_id, existing);
      });

      const leaders = [...leaderboardMap.values()];

      return {
        trendData,
        seasonStats: {
          avgDistance: trendData.length ? round(trendData.reduce((sum, item) => sum + item.distance, 0) / trendData.length) : 0,
          avgPossession: trendData.length ? round(trendData.reduce((sum, item) => sum + item.possession, 0) / trendData.length, 0) : 0,
          avgDuelRate: trendData.length ? round(trendData.reduce((sum, item) => sum + item.duelRate, 0) / trendData.length, 0) : 0,
          totalSprints: trendData.reduce((sum, item) => sum + item.sprints, 0),
        },
        distanceLeaders: [...leaders].sort((a, b) => b.totalKm - a.totalKm).slice(0, 5).map((item) => ({ ...item, totalKm: round(item.totalKm) })),
        passingLeaders: [...leaders].sort((a, b) => b.totalPasses - a.totalPasses).slice(0, 5),
      };
    },
    enabled: !!clubId,
  });

  if (!data?.trendData.length) return null;

  const chartConfig = {
    distance: { label: t("matchReport.distance"), color: "hsl(var(--primary))", icon: Activity },
    sprints: { label: "Sprints", color: "hsl(var(--accent))", icon: Trophy },
    possession: { label: t("dashboard.possession"), color: "hsl(var(--primary))", icon: Gauge },
    passAccuracy: { label: "Passquote", color: "hsl(var(--accent))", icon: Trophy },
    duelRate: { label: "Zweikampfquote", color: "hsl(var(--primary))", icon: Shield },
    recoveries: { label: "Ballgewinne", color: "hsl(var(--accent))", icon: Activity },
  } as const;

  const statCards = [
    {
      label: "Ø Distanz",
      value: `${data.seasonStats.avgDistance} km`,
      icon: Activity,
      insight: "Die durchschnittliche Teamdistanz hilft dir zu erkennen, ob die Intensität über die Saison stabil bleibt oder phasenweise abfällt.",
    },
    {
      label: "Ø Ballbesitz",
      value: `${data.seasonStats.avgPossession}%`,
      icon: Gauge,
      insight: "Ein hoher Ballbesitzwert ist nur dann stark, wenn daraus Kontrolle und sauberer Aufbau entstehen.",
    },
    {
      label: "Ø Zweikampfquote",
      value: `${data.seasonStats.avgDuelRate}%`,
      icon: Shield,
      insight: "Die Zweikampfquote zeigt, wie robust das Team in direkten Duellen über mehrere Spiele hinweg auftritt.",
    },
    {
      label: "Sprints gesamt",
      value: `${data.seasonStats.totalSprints}`,
      icon: Trophy,
      insight: "Sprints über die Saison sind ein guter Marker für Spieltempo, Tiefe und Umschaltintensität.",
    },
  ];

  const recentTrend = [...data.trendData].slice(-6).reverse();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold font-display">{t("dashboard.seasonTrend")}</h2>
        <p className="text-sm text-muted-foreground">Intensität, Kontrolle und Duellstärke der letzten Spiele im modernen Analyse-Look.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, insight }) => (
          <MetricDetailDialog
            key={label}
            title={`${label} im Saisonkontext`}
            subtitle="Die KPI öffnet eine Drilldown-Ansicht, damit du Trends nicht nur siehst, sondern sportlich einordnen kannst."
            chips={["Season KPI", "Trend", "Overview"]}
            insight={insight}
            facts={recentTrend.slice(0, 4).map((item) => ({
              label: item.label,
              value:
                label === "Ø Distanz"
                  ? `${item.distance} km`
                  : label === "Ø Ballbesitz"
                    ? `${item.possession}%`
                    : label === "Ø Zweikampfquote"
                      ? `${item.duelRate}%`
                      : `${item.sprints}`,
              hint: "Jüngste Matchwerte",
            }))}
          >
            <div className="game-panel p-4 space-y-3 h-full">
              <div className="relative flex items-center justify-between pr-16">
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Season</span>
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="relative">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold font-display">{value}</p>
              </div>
            </div>
          </MetricDetailDialog>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <MetricDetailDialog
          title="Teamintensität im Verlauf"
          subtitle="Distanz und Sprintvolumen zeigen, wie hoch die physische Spielschärfe über die letzten Partien war."
          chips={["Tempo", "Belastung", "Rhythmus"]}
          insight="Achte auf fallende Sprints bei stabiler Distanz: Das deutet oft auf weniger Tiefenläufe oder geringere Umschaltintensität hin."
          facts={recentTrend.map((item) => ({
            label: item.label,
            value: `${item.distance} km · ${item.sprints} Sprints`,
            hint: item.date,
          }))}
          contentClassName="sm:max-w-4xl"
        >
          <div className="game-panel p-5 sm:p-6 space-y-4 h-full">
            <div className="relative pr-16">
              <h3 className="text-base font-semibold font-display">Teamintensität</h3>
              <p className="text-sm text-muted-foreground">Distanz und Sprintvolumen pro Spiel im direkten Verlauf.</p>
            </div>
            <ChartContainer config={chartConfig} className="h-64 w-full aspect-auto">
              <AreaChart data={data.trendData}>
                <defs>
                  <linearGradient id="dashboard-distance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-distance)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-distance)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend content={<ChartLegendContent />} />
                <Area type="monotone" dataKey="distance" name="distance" stroke="var(--color-distance)" fill="url(#dashboard-distance)" strokeWidth={2.5} />
                <Line type="monotone" dataKey="sprints" name="sprints" stroke="var(--color-sprints)" strokeWidth={2.5} dot={{ fill: "var(--color-sprints)", r: 3 }} />
              </AreaChart>
            </ChartContainer>
          </div>
        </MetricDetailDialog>

        <MetricDetailDialog
          title="Ballkontrolle im Verlauf"
          subtitle="Ballbesitz und Passquote zeigen, wie sicher das Team Spiele mit Ball strukturiert."
          chips={["Control", "Build-up", "Security"]}
          insight="Wenn Ballbesitz steigt, die Passquote aber nicht mitgeht, fehlt oft die Sauberkeit im Aufbau oder die Qualität der Anschlussaktionen."
          facts={recentTrend.map((item) => ({
            label: item.label,
            value: `${item.possession}% Ballbesitz · ${item.passAccuracy}% Passquote`,
            hint: item.date,
          }))}
          contentClassName="sm:max-w-4xl"
        >
          <div className="game-panel p-5 sm:p-6 space-y-4 h-full">
            <div className="relative pr-16">
              <h3 className="text-base font-semibold font-display">Ballkontrolle</h3>
              <p className="text-sm text-muted-foreground">Ballbesitz und Passquote zeigen, wie sauber das Team mit Ball agiert.</p>
            </div>
            <ChartContainer config={chartConfig} className="h-64 w-full aspect-auto">
              <LineChart data={data.trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${value}%`} />} />
                <Legend content={<ChartLegendContent />} />
                <Line type="monotone" dataKey="possession" name="possession" stroke="var(--color-possession)" strokeWidth={2.5} dot={{ fill: "var(--color-possession)", r: 3 }} />
                <Line type="monotone" dataKey="passAccuracy" name="passAccuracy" stroke="var(--color-passAccuracy)" strokeWidth={2.5} dot={{ fill: "var(--color-passAccuracy)", r: 3 }} />
              </LineChart>
            </ChartContainer>
          </div>
        </MetricDetailDialog>

        <MetricDetailDialog
          title="Defensive Wirkung im Verlauf"
          subtitle="Zweikampfquote und Ballgewinne geben Aufschluss über Zugriff, Timing und Aggressivität gegen den Ball."
          chips={["Defence", "Duels", "Recovery"]}
          insight="Ballgewinne ohne gute Zweikampfquote können auf lose second balls oder ein reaktives Verteidigen hindeuten. Stark wird es, wenn beide Werte parallel steigen."
          facts={recentTrend.map((item) => ({
            label: item.label,
            value: `${item.duelRate}% Zweikampfquote · ${item.recoveries} Ballgewinne`,
            hint: item.date,
          }))}
          contentClassName="sm:max-w-4xl"
        >
          <div className="game-panel p-5 sm:p-6 space-y-4 h-full">
            <div className="relative pr-16">
              <h3 className="text-base font-semibold font-display">Defensive Wirkung</h3>
              <p className="text-sm text-muted-foreground">Zweikampfquote und Ballgewinne im Zeitverlauf.</p>
            </div>
            <ChartContainer config={chartConfig} className="h-64 w-full aspect-auto">
              <BarChart data={data.trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend content={<ChartLegendContent />} />
                <Bar dataKey="duelRate" name="duelRate" fill="var(--color-duelRate)" radius={[8, 8, 0, 0]} />
                <Bar dataKey="recoveries" name="recoveries" fill="var(--color-recoveries)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        </MetricDetailDialog>

        <div className="game-panel p-5 sm:p-6 space-y-4">
          <div className="relative">
            <h3 className="text-base font-semibold font-display">Leaderboards</h3>
            <p className="text-sm text-muted-foreground">Die konstantesten Saisonträger in Laufarbeit und Spielaufbau.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Distanz</p>
              {data.distanceLeaders.map((player, index) => (
                <Link key={player.id} to={`/players/${player.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-background/50 px-3 py-2 hover:border-primary/40 transition-colors">
                  <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{index + 1}</span>
                  <span className="flex-1 text-sm font-medium truncate">{player.name}</span>
                  <span className="text-sm font-bold font-display">{player.totalKm} km</span>
                </Link>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pässe</p>
              {data.passingLeaders.map((player, index) => (
                <Link key={player.id} to={`/players/${player.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-background/50 px-3 py-2 hover:border-primary/40 transition-colors">
                  <span className="w-7 h-7 rounded-full bg-secondary text-secondary-foreground text-xs font-bold flex items-center justify-center">{index + 1}</span>
                  <span className="flex-1 text-sm font-medium truncate">{player.name}</span>
                  <span className="text-sm font-bold font-display">{player.totalPasses}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
