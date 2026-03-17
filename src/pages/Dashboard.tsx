import AppLayout from "@/components/AppLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronRight, Map, Users, Swords, BarChart3, Zap, Trophy, Calendar, Clock } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useMatches } from "@/hooks/use-matches";
import { useSeasonStats } from "@/hooks/use-match-stats";
import { usePlayers } from "@/hooks/use-players";
import { useFields } from "@/hooks/use-fields";
import { StatusBadge } from "@/components/StatusBadge";
import { SkeletonCard } from "@/components/SkeletonCard";
import { PlanBadge } from "@/components/PlanBadge";
import { SetupChecklist } from "@/components/SetupChecklist";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { DashboardCharts } from "@/components/DashboardCharts";
import { MatchFlowGuide } from "@/components/MatchFlowGuide";
import { useTranslation, useLocale } from "@/lib/i18n";

export default function Dashboard() {
  const { clubName, clubPlan, clubLogoUrl } = useAuth();
  const { data: matches, isLoading: matchesLoading } = useMatches();
  const { data: stats, isLoading: statsLoading } = useSeasonStats();
  const { data: players } = usePlayers();
  const { data: fields } = useFields();
  const { t } = useTranslation();
  const locale = useLocale();

  const hasMatches = matches && matches.length > 0;
  const lastMatch = matches?.[0];
  const nextMatch = matches?.find(m => m.status === "setup");
  const doneMatches = matches?.filter(m => m.status === "done") ?? [];
  const hasPlayers = players && players.length > 0;
  const hasFields = fields && fields.length > 0;

  if (matchesLoading || statsLoading) {
    return <AppLayout><div className="max-w-5xl mx-auto"><SkeletonCard count={3} /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {clubLogoUrl && (
              <img src={clubLogoUrl} alt={clubName || "Logo"} className="w-12 h-12 rounded-xl object-cover border border-border shadow-sm" />
            )}
            <div>
              <h1 className="text-2xl md:text-3xl font-bold font-display">{t("dashboard.title")}</h1>
              <p className="text-muted-foreground mt-1">
                {clubName ? t("dashboard.welcome", { name: clubName }) : t("dashboard.welcomeDefault")}
              </p>
            </div>
          </div>
          {clubPlan && <PlanBadge plan={clubPlan} />}
        </div>

        <PwaInstallPrompt />
        <SetupChecklist hasPlayers={!!hasPlayers} hasFields={!!hasFields} />

        {!hasMatches && (
          <div className="glass-card p-6 glow-border">
            <h2 className="text-lg font-semibold font-display mb-1">{t("dashboard.readyFirst")}</h2>
            <p className="text-sm text-muted-foreground mb-6">{t("dashboard.startIn3Steps")}</p>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { step: "1", label: t("dashboard.calibrateField"), icon: Map, href: "/fields", done: hasFields },
                { step: "2", label: t("dashboard.addSquad"), icon: Users, href: "/players", done: hasPlayers },
                { step: "3", label: t("dashboard.startMatch"), icon: Swords, href: "/matches/new", done: false },
              ].map((s) => (
                <Link
                  key={s.step}
                  to={s.href}
                  className={`glass-card p-5 flex items-center gap-4 hover:border-primary/30 transition-all group ${s.done ? "border-primary/20" : ""}`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold font-display transition-colors ${
                    s.done ? "bg-emerald-500/20 text-emerald-400" : "bg-primary/10 text-primary group-hover:bg-primary/20"
                  }`}>
                    {s.done ? "✓" : s.step}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{s.label}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      {s.done ? t("dashboard.done") : <>{t("dashboard.setup")} <ChevronRight className="h-3 w-3" /></>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-4 gap-4">
          {[
            { label: t("dashboard.matchesTracked"), value: String(stats?.matchesTracked ?? 0), icon: Trophy },
            { label: t("dashboard.totalKm"), value: stats?.totalKm ? `${stats.totalKm}` : "0", icon: BarChart3 },
            { label: t("dashboard.topSpeed"), value: stats?.topSpeed ? `${stats.topSpeed} km/h` : "— km/h", icon: Zap },
            { label: t("dashboard.activePlayers"), value: String(stats?.playerCount ?? 0), icon: Users },
          ].map((stat) => (
            <div key={stat.label} className="glass-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <div className="text-2xl font-bold font-display">{stat.value}</div>
            </div>
          ))}
        </div>

        {lastMatch && doneMatches.length > 0 ? (
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">{t("dashboard.lastMatch")}</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold font-display">
                  {clubName} vs {doneMatches[0].away_club_name || t("dashboard.unknown")}
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                  <Calendar className="h-3.5 w-3.5" /> {new Date(doneMatches[0].date).toLocaleDateString(locale)}
                  <StatusBadge status={doneMatches[0].status} />
                </p>
              </div>
              <Button variant="heroOutline" size="sm" asChild>
                <Link to={`/matches/${doneMatches[0].id}`}>{t("dashboard.report")} <ChevronRight className="h-4 w-4 ml-1" /></Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="glass-card p-8 text-center">
            <Swords className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">{t("dashboard.noMatches")}</p>
            <Button variant="hero" asChild>
              <Link to="/matches/new">{t("dashboard.createFirst")}</Link>
            </Button>
          </div>
        )}

        {nextMatch && (
          <div className="glass-card p-6 glow-border">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">{t("dashboard.nextMatch")}</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold font-display">
                  {clubName} vs {nextMatch.away_club_name || t("dashboard.tbd")}
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{new Date(nextMatch.date).toLocaleDateString(locale)}</span>
                  {nextMatch.kickoff && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{nextMatch.kickoff}</span>}
                </p>
              </div>
              <Button variant="hero" size="sm" asChild>
                <Link to={`/matches/${nextMatch.id}`}>{t("dashboard.setup")}</Link>
              </Button>
            </div>
          </div>
        )}

        {stats?.topPlayerName && (
          <div className="glass-card p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{t("dashboard.topRunner")}</div>
              <div className="font-semibold font-display">{stats.topPlayerName}</div>
            </div>
          </div>
        )}

        <DashboardCharts />
      </div>
    </AppLayout>
  );
}
