import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useTranslation, useLocale } from "@/lib/i18n";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Area, AreaChart,
} from "recharts";

export function DashboardCharts() {
  const { clubId } = useAuth();
  const { t } = useTranslation();
  const locale = useLocale();

  const { data: distanceData } = useQuery({
    queryKey: ["dashboard_chart_distance", clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data: matches } = await supabase
        .from("matches")
        .select("id, date, away_club_name")
        .eq("home_club_id", clubId)
        .eq("status", "done")
        .order("date", { ascending: true })
        .limit(20);

      if (!matches?.length) return [];

      const matchIds = matches.map((m) => m.id);
      const { data: teamStats } = await supabase
        .from("team_match_stats")
        .select("match_id, total_distance_km, top_speed_kmh, possession_pct")
        .in("match_id", matchIds)
        .eq("team", "home");

      const statsMap = new Map(teamStats?.map((s) => [s.match_id, s]) ?? []);

      return matches.map((m) => {
        const s = statsMap.get(m.id);
        return {
          label: m.away_club_name?.substring(0, 10) || new Date(m.date).toLocaleDateString(locale, { day: "2-digit", month: "2-digit" }),
          date: new Date(m.date).toLocaleDateString(locale, { day: "2-digit", month: "2-digit" }),
          distanz: s?.total_distance_km ? Math.round(s.total_distance_km * 10) / 10 : 0,
          topSpeed: s?.top_speed_kmh ? Math.round(s.top_speed_kmh * 10) / 10 : 0,
          ballbesitz: s?.possession_pct ? Math.round(s.possession_pct) : 0,
        };
      });
    },
    enabled: !!clubId,
  });

  if (!distanceData?.length) return null;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg bg-card border border-border p-3 shadow-lg text-sm">
        <p className="font-semibold font-display text-foreground mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} className="text-muted-foreground">
            {p.name}: <span className="font-medium text-foreground">{p.value}{p.name === t("dashboard.possession") ? "%" : p.name === t("dashboard.topSpeedChart") ? " km/h" : " km"}</span>
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold font-display">{t("dashboard.seasonTrend")}</h2>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">{t("dashboard.distance")}</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={distanceData}>
                <defs>
                  <linearGradient id="distGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="distanz" name={t("matchReport.distance")} stroke="hsl(var(--primary))" fill="url(#distGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">{t("dashboard.topSpeedChart")}</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="topSpeed" name={t("dashboard.topSpeedChart")} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-5 md:col-span-2">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">{t("dashboard.possession")}</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={distanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="ballbesitz" name={t("dashboard.possession")} stroke="hsl(var(--accent))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
