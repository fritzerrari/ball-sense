import AppLayout from "@/components/AppLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronRight, Users, Swords, Zap, Calendar, Clock, Plus, Loader2, CheckCircle2, AlertTriangle, Sparkles, Brain } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useMatches } from "@/hooks/use-matches";
import { usePlayers } from "@/hooks/use-players";
import { useFields } from "@/hooks/use-fields";
import { StatusBadge } from "@/components/StatusBadge";
import { SkeletonCard } from "@/components/SkeletonCard";
import { PlanBadge } from "@/components/PlanBadge";

import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { MatchFlowGuide } from "@/components/MatchFlowGuide";
import { CoachWelcomeTour } from "@/components/CoachWelcomeTour";
import { useTranslation, useLocale } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface TrainingRec {
  id: string;
  title: string;
  description: string;
  category: string | null;
  priority: number | null;
  match_id: string;
}

export default function Dashboard() {
  const { clubName, clubPlan, clubLogoUrl, clubId } = useAuth();
  const { data: matches, isLoading: matchesLoading } = useMatches();
  const { data: players } = usePlayers();
  const { data: fields } = useFields();
  const { t } = useTranslation();
  const locale = useLocale();

  // Fetch latest training recommendations
  const { data: recommendations } = useQuery({
    queryKey: ["training-recommendations", clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data } = await supabase
        .from("training_recommendations")
        .select("*")
        .eq("club_id", clubId)
        .order("created_at", { ascending: false })
        .limit(5);
      return (data ?? []) as TrainingRec[];
    },
    enabled: !!clubId,
  });

  const hasMatches = matches && matches.length > 0;
  const hasPlayers = players && players.length > 0;
  const hasFields = fields && fields.length > 0;

  const recentMatches = matches?.slice(0, 3) ?? [];
  const doneCount = matches?.filter(m => m.status === "done").length ?? 0;
  const processingCount = matches?.filter(m => m.status === "processing").length ?? 0;

  if (matchesLoading) {
    return <AppLayout><div className="max-w-5xl mx-auto"><SkeletonCard count={3} /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {clubLogoUrl && (
              <img src={clubLogoUrl} alt={clubName || "Logo"} className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-cover border border-border shadow-sm" />
            )}
            <div className="min-w-0">
              <h1 className="text-xl md:text-3xl font-bold font-display truncate">{t("dashboard.title")}</h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5 truncate">
                {clubName ? t("dashboard.welcome", { name: clubName }) : t("dashboard.welcomeDefault")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {clubPlan && <PlanBadge plan={clubPlan} />}
            <Button variant="hero" size="sm" asChild>
              <Link to="/matches/new"><Plus className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">{t("dashboard.newMatch")}</span><span className="sm:hidden">Neu</span></Link>
            </Button>
          </div>
        </div>

        <PwaInstallPrompt />
        <CoachWelcomeTour />

        {/* Match Preparation CTA */}
        {hasMatches && (
          <div className="glass-card p-4 flex items-center justify-between gap-3 border-primary/20 bg-primary/5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">KI-Spielvorbereitung</p>
                <p className="text-xs text-muted-foreground truncate">Datenbasierter Matchplan für dein nächstes Spiel</p>
              </div>
            </div>
            <Button variant="heroOutline" size="sm" asChild>
              <Link to="/match-prep">Vorbereiten</Link>
            </Button>
          </div>
        )}

        <MatchFlowGuide />
        

        {/* Quick stats — all clickable */}
        <div className="grid sm:grid-cols-3 gap-4">
          <Link
            to="/matches?status=done"
            className="glass-card p-5 group hover:border-primary/40 hover:bg-primary/5 transition-all"
            aria-label={`${doneCount} analysierte Spiele anzeigen`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Swords className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">{t("dashboard.analyzed")}</span>
              <ChevronRight className="h-3 w-3 text-muted-foreground/40 ml-auto group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="text-2xl font-bold font-display">{doneCount}</div>
          </Link>
          <Link
            to="/matches?status=processing"
            className="glass-card p-5 group hover:border-amber-500/40 hover:bg-amber-500/5 transition-all"
            aria-label={`${processingCount} Analysen in Arbeit anzeigen`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className={`h-4 w-4 ${processingCount > 0 ? "text-amber-500 animate-spin" : "text-muted-foreground"}`} />
              <span className="text-xs text-muted-foreground">{t("dashboard.inAnalysis")}</span>
              <ChevronRight className="h-3 w-3 text-muted-foreground/40 ml-auto group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="text-2xl font-bold font-display">{processingCount}</div>
          </Link>
          <Link
            to="/players"
            className="glass-card p-5 group hover:border-primary/40 hover:bg-primary/5 transition-all"
            aria-label={`${players?.length ?? 0} Spieler verwalten`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">{t("dashboard.players")}</span>
              <ChevronRight className="h-3 w-3 text-muted-foreground/40 ml-auto group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="text-2xl font-bold font-display">{players?.length ?? 0}</div>
          </Link>
        </div>

        {/* Recent matches */}
        {recentMatches.length > 0 ? (
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-muted-foreground">{t("dashboard.recentMatches")}</h3>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/matches">{t("dashboard.showAll")} <ChevronRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            </div>
            <div className="space-y-3">
              {recentMatches.map((match) => (
                <Link
                  key={match.id}
                  to={match.status === "processing" ? `/matches/${match.id}/processing` : `/matches/${match.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      match.status === "done" ? "bg-emerald-500/10" :
                      match.status === "processing" ? "bg-amber-500/10" :
                      "bg-muted"
                    }`}>
                      {match.status === "done" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> :
                       match.status === "processing" ? <Loader2 className="h-4 w-4 text-amber-500 animate-spin" /> :
                       match.status === "failed" ? <AlertTriangle className="h-4 w-4 text-destructive" /> :
                       <Swords className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {clubName} vs {match.away_club_name || "TBD"}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-3 w-3" /> {new Date(match.date).toLocaleDateString(locale)}
                        {match.kickoff && <><Clock className="h-3 w-3" /> {match.kickoff}</>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={match.status} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
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

        {/* Last Report — quick deep-links into the latest match's report tabs */}
        {(() => {
          const lastDone = matches?.find(m => m.status === "done");
          if (!lastDone) return null;
          const tabs = [
            { key: "overview", label: "Übersicht", icon: Sparkles },
            { key: "tactics", label: "Taktik", icon: Brain },
            { key: "players", label: "Spieler", icon: Users },
            { key: "training", label: "Training", icon: Zap },
          ];
          return (
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-semibold text-muted-foreground">Letzter Report</h3>
                </div>
                <Link to={`/matches/${lastDone.id}`} className="text-xs text-primary hover:underline">
                  {clubName} vs {lastDone.away_club_name || "TBD"} →
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {tabs.map(({ key, label, icon: Icon }) => (
                  <Link
                    key={key}
                    to={`/matches/${lastDone.id}?tab=${key}`}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border border-border/50 hover:bg-primary/5 hover:border-primary/30 transition-all group"
                  >
                    <Icon className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-medium">{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Training Recommendations — clickable, jump to the matching match */}
        {recommendations && recommendations.length > 0 && (
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-semibold text-muted-foreground">{t("dashboard.trainingRecs")}</h3>
            </div>
            <div className="space-y-3">
              {recommendations.map((rec) => (
                <Link
                  key={rec.id}
                  to={`/matches/${rec.match_id}?tab=training`}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-primary/5 hover:border-primary/30 transition-all group"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5 group-hover:bg-primary/20 transition-colors">
                    <Zap className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium group-hover:text-primary transition-colors">{rec.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{rec.description}</p>
                  </div>
                  {rec.priority && (
                    <span className={`shrink-0 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                      rec.priority === 1 ? "bg-destructive/10 text-destructive" :
                      rec.priority === 2 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      P{rec.priority}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all self-center" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
