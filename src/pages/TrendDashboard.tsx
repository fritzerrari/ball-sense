import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import AppLayout from "@/components/AppLayout";
import { useTranslation } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, BarChart3, AlertTriangle, Brain, Target, Zap } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine } from "recharts";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonCard } from "@/components/SkeletonCard";

interface AnalysisData {
  match_id: string;
  result_type: string;
  data: Record<string, unknown>;
  confidence: number | null;
  created_at: string;
}

interface MatchInfo {
  id: string;
  date: string;
  away_club_name: string | null;
  status: string;
}

export default function TrendDashboard() {
  const { clubId } = useAuth();
  const { language } = useTranslation();

  const { data: matches, isLoading: matchesLoading } = useQuery({
    queryKey: ["trend-matches", clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data } = await supabase
        .from("matches")
        .select("id, date, away_club_name, status")
        .eq("home_club_id", clubId)
        .eq("status", "done")
        .order("date", { ascending: true })
        .limit(20);
      return (data ?? []) as MatchInfo[];
    },
    enabled: !!clubId,
  });

  const matchIds = matches?.map((m) => m.id) ?? [];

  const { data: analysisResults, isLoading: analysisLoading } = useQuery({
    queryKey: ["trend-analysis", matchIds],
    queryFn: async () => {
      if (!matchIds.length) return [];
      const { data } = await supabase
        .from("analysis_results")
        .select("match_id, result_type, data, confidence, created_at")
        .in("match_id", matchIds)
        .in("result_type", ["tactical_insights", "frame_positions"]);
      return (data ?? []) as AnalysisData[];
    },
    enabled: matchIds.length > 0,
  });

  // Fetch match events for fatigue-goal correlation
  const { data: matchEvents } = useQuery({
    queryKey: ["trend-events", matchIds],
    queryFn: async () => {
      if (!matchIds.length) return [];
      const { data } = await supabase
        .from("match_events")
        .select("match_id, minute, event_type, team")
        .in("match_id", matchIds)
        .in("event_type", ["goal", "conceded_goal"]);
      return data ?? [];
    },
    enabled: matchIds.length > 0,
  });

  const { data: reportSections } = useQuery({
    queryKey: ["trend-reports", matchIds],
    queryFn: async () => {
      if (!matchIds.length) return [];
      const { data } = await supabase
        .from("report_sections")
        .select("match_id, section_type, title, content, confidence")
        .in("match_id", matchIds);
      return data ?? [];
    },
    enabled: matchIds.length > 0,
  });

  const isLoading = matchesLoading || analysisLoading;

  // Build trend data per match
  const trendData = (matches ?? []).map((match) => {
    const insights = analysisResults?.find(
      (a) => a.match_id === match.id && a.result_type === "tactical_insights"
    );
    const insightData = insights?.data as Record<string, unknown> | undefined;
    const matchStructure = insightData?.match_structure as Record<string, unknown> | undefined;
    const dangerZones = insightData?.danger_zones as Record<string, unknown> | undefined;
    const ballLossPatterns = insightData?.ball_loss_patterns as Array<Record<string, unknown>> | undefined;

    const dominanceMap: Record<string, number> = {
      dominant: 90, controlled: 70, balanced: 50, passive: 30, overwhelmed: 10,
    };
    const dominance = dominanceMap[String(matchStructure?.dominance ?? "balanced")] ?? 50;
    const tempoMap: Record<string, number> = {
      high: 85, medium: 55, low: 25,
    };
    const tempo = tempoMap[String(matchStructure?.tempo ?? "medium")] ?? 55;

    const matchReports = reportSections?.filter((r) => r.match_id === match.id) ?? [];
    const confidence = insights?.confidence ?? null;

    return {
      date: new Date(match.date).toLocaleDateString(language === "de" ? "de-DE" : "en-US", { day: "2-digit", month: "short" }),
      opponent: match.away_club_name ?? "?",
      dominance,
      tempo,
      confidence: confidence ? Math.round(Number(confidence) * 100) : null,
      ballLossCount: ballLossPatterns?.length ?? 0,
      attackLeft: dangerZones?.attack_left ? 1 : 0,
      attackCenter: dangerZones?.attack_center ? 1 : 0,
      attackRight: dangerZones?.attack_right ? 1 : 0,
      insightCount: matchReports.length,
      matchId: match.id,
    };
  });

  // Extract recurring patterns from report sections
  const allInsights = (reportSections ?? [])
    .filter((r) => r.section_type === "coaching_insight" || r.section_type === "tactical")
    .map((r) => r.title);
  const insightFrequency: Record<string, number> = {};
  allInsights.forEach((title) => {
    insightFrequency[title] = (insightFrequency[title] || 0) + 1;
  });
  const topInsights = Object.entries(insightFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const hasData = trendData.length >= 2;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-display">
            {language === "de" ? "Match-Trends" : "Match Trends"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "de"
              ? "Entwicklung deines Teams über mehrere Spiele hinweg."
              : "Your team's development across multiple matches."}
          </p>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : !hasData ? (
          <EmptyState
            icon={<TrendingUp className="h-12 w-12 text-muted-foreground/50" />}
            title={language === "de" ? "Noch nicht genug Daten" : "Not enough data yet"}
            description={
              language === "de"
                ? "Mindestens 2 analysierte Spiele werden benötigt, um Trends anzuzeigen."
                : "At least 2 analyzed matches are needed to show trends."
            }
          />
        ) : (
          <>
            {/* Dominance + Tempo trend */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-display flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    {language === "de" ? "Formkurve: Dominanz" : "Form curve: Dominance"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={trendData}>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Line type="monotone" dataKey="dominance" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} name={language === "de" ? "Dominanz" : "Dominance"} />
                      <Line type="monotone" dataKey="tempo" stroke="hsl(var(--accent-foreground))" strokeWidth={1.5} dot={{ r: 3 }} strokeDasharray="4 4" name="Tempo" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-display flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    {language === "de" ? "Ballverlust-Muster pro Spiel" : "Ball loss patterns per match"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={trendData}>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                      />
                      <Bar dataKey="ballLossCount" name={language === "de" ? "Ballverluste" : "Ball losses"} radius={[4, 4, 0, 0]}>
                        {trendData.map((_, i) => (
                          <Cell key={i} fill={`hsl(var(--primary) / ${0.4 + (i / trendData.length) * 0.6})`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Confidence trend */}
            {trendData.some((d) => d.confidence !== null) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-display flex items-center gap-2">
                    <Brain className="h-4 w-4 text-primary" />
                    {language === "de" ? "KI-Confidence pro Analyse" : "AI confidence per analysis"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={trendData.filter((d) => d.confidence !== null)}>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Line type="monotone" dataKey="confidence" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} name="Confidence %" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Fatigue-Goal Correlation */}
            {(() => {
              const allConceded = (matchEvents ?? []).filter(
                (e: any) => e.event_type === "goal" && e.team === "away" || e.event_type === "conceded_goal"
              );
              if (allConceded.length < 2) return null;

              const fatigueWindows = [35, 40, 45, 75, 80, 85, 90];
              const inFatigue = allConceded.filter((e: any) =>
                fatigueWindows.some((fp) => Math.abs(e.minute - fp) <= 5)
              ).length;
              const pct = Math.round((inFatigue / allConceded.length) * 100);
              const isSignificant = pct > 50;

              // Build minute distribution
              const minuteBuckets: Record<number, number> = {};
              allConceded.forEach((e: any) => {
                const bucket = Math.floor(e.minute / 15) * 15;
                minuteBuckets[bucket] = (minuteBuckets[bucket] || 0) + 1;
              });
              const bucketData = [0, 15, 30, 45, 60, 75, 90].map((m) => ({
                label: `${m}'`,
                count: minuteBuckets[m] || 0,
                isFatigue: m >= 30 && m <= 45 || m >= 75,
              }));

              return (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-display flex items-center gap-2">
                      <Zap className="h-4 w-4 text-destructive" />
                      {language === "de" ? "Ermüdungs-Gegentor-Korrelation" : "Fatigue-Goal Correlation"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl font-bold font-display">{pct}%</span>
                      <span className="text-xs text-muted-foreground">
                        {language === "de"
                          ? `der Gegentore (${inFatigue}/${allConceded.length}) fallen in typische Ermüdungsphasen`
                          : `of goals conceded (${inFatigue}/${allConceded.length}) fall in fatigue windows`}
                      </span>
                      {isSignificant && (
                        <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive text-[10px]">
                          {language === "de" ? "Auffällig" : "Significant"}
                        </Badge>
                      )}
                    </div>
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={bucketData}>
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                        <Tooltip contentStyle={{ fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                        <Bar dataKey="count" name={language === "de" ? "Gegentore" : "Goals conceded"} radius={[4, 4, 0, 0]}>
                          {bucketData.map((d, i) => (
                            <Cell key={i} fill={d.isFatigue ? "hsl(var(--destructive))" : "hsl(var(--primary) / 0.5)"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    {isSignificant && (
                      <p className="text-xs text-destructive mt-2">
                        ⚠️ {language === "de"
                          ? "Mehr als die Hälfte der Gegentore fallen in Ermüdungsphasen. Fitness-Schwerpunkt und taktische Anpassungen in Minute 35-45 und 75-90 empfohlen."
                          : "Over half of goals conceded fall in fatigue phases. Consider fitness focus and tactical adjustments in minutes 35-45 and 75-90."}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Top recurring insights */}
            {topInsights.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-display flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    {language === "de" ? "Wiederkehrende Coaching-Themen" : "Recurring coaching themes"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topInsights.map(([title, count]) => (
                      <div key={title} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="text-sm text-foreground">{title}</div>
                          <div className="text-xs text-muted-foreground">
                            {count}× {language === "de" ? "erwähnt" : "mentioned"}
                          </div>
                        </div>
                        <div className="w-24 h-2 rounded-full bg-muted/30 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min((count / (topInsights[0]?.[1] || 1)) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Match list */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display">
                  {language === "de" ? "Analysierte Spiele" : "Analyzed matches"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {trendData.map((d) => (
                    <div key={d.matchId} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/20 border border-border/30">
                      <div>
                        <span className="text-foreground font-medium">{d.date}</span>
                        <span className="text-muted-foreground ml-2">vs. {d.opponent}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{language === "de" ? "Dominanz" : "Dominance"}: {d.dominance}%</span>
                        {d.confidence !== null && <span>Conf: {d.confidence}%</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
