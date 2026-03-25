import AppLayout from "@/components/AppLayout";
import { useParams, Link } from "react-router-dom";
import { useState, useEffect, Fragment } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  EyeOff,
  FileText,
  KeyRound,
  Loader2,
  Radio,
  Share2,
  Sparkles,
  Zap,
} from "lucide-react";
import ReportGenerator from "@/components/ReportGenerator";
import { ProcessingRoadmap } from "@/components/ProcessingRoadmap";
import ApiFootballStatsCard from "@/components/ApiFootballStatsCard";
import { MatchKpiStrip, MatchRadarChart, TopPlayersChart, ComparisonBarChart } from "@/components/MatchCharts";
import { MatchInsightsPanel } from "@/components/MatchInsightsPanel";
import { MatchEventStats } from "@/components/MatchEventStats";
import { PerformanceAnalysis } from "@/components/PerformanceAnalysis";
import { useMatch, useTrackingUploads, useMatchEvents } from "@/hooks/use-matches";
import { usePlayerMatchStats, useTeamMatchStats, useApiFootballStats } from "@/hooks/use-match-stats";
import { useAuth } from "@/components/AuthProvider";
import { HeatmapField } from "@/components/HeatmapField";
import { StatusBadge } from "@/components/StatusBadge";
import { SkeletonCard } from "@/components/SkeletonCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ConsentStatusBadge } from "@/components/ConsentStatusBadge";
import { CoachSummary } from "@/components/CoachSummary";
import { WhatIfBoard } from "@/components/WhatIfBoard";
import { supabase } from "@/integrations/supabase/client";
import { getAnalysisStage } from "@/lib/analysis-status";
import { AnalysisStatusBanner, MetricStatusIndicator } from "@/components/AnalysisStatusBanner";

const tabs = ["Übersicht", "Heim", "Auswärts", "Vergleich", "Berichte & Presse"];

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function aggregatePlayerMetrics(stats: any[]) {
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
      acc.ballContacts += player.ball_contacts ?? 0;
      acc.aerialWon += player.aerial_won ?? 0;
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
      ballContacts: 0,
      aerialWon: 0,
    },
  );

  return {
    ...totals,
    passAccuracy: totals.passesTotal > 0 ? round((totals.passesCompleted / totals.passesTotal) * 100, 0) : 0,
    duelRate: totals.duelsTotal > 0 ? round((totals.duelsWon / totals.duelsTotal) * 100, 0) : 0,
  };
}

function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
      <h2 className="text-xl font-semibold font-display">{title}</h2>
      <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default function MatchReport() {
  const { id } = useParams();
  const { clubName, clubId, session } = useAuth();
  const { data: match, isLoading } = useMatch(id);
  const { data: playerStats, refetch: refetchPlayerStats } = usePlayerMatchStats(id);
  const { data: teamStats, refetch: refetchTeamStats } = useTeamMatchStats(id);
  const { data: uploads } = useTrackingUploads(id);
  const { data: apiStats } = useApiFootballStats(id);
  const { data: events } = useMatchEvents(id);
  const [activeTab, setActiveTab] = useState("Übersicht");
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string>("distance_km");
  const [sortAsc, setSortAsc] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);

  // Realtime subscription for live stats updates
  const isLive = match?.status === "live" || match?.status === "processing";
  const hasPartialData = (playerStats ?? []).some((s: any) => s.period === "partial");

  useEffect(() => {
    if (!id || !isLive) return;
    const channel = supabase
      .channel(`live-stats-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "player_match_stats", filter: `match_id=eq.${id}` }, () => {
        refetchPlayerStats();
        refetchTeamStats();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "team_match_stats", filter: `match_id=eq.${id}` }, () => {
        refetchTeamStats();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, isLive, refetchPlayerStats, refetchTeamStats]);

  const handleGenerateCode = async () => {
    if (!clubId || !session?.user?.id || !id) return;
    setGeneratingCode(true);
    try {
      // Deactivate old codes for this club first (keep max 3)
      const { data: existingCodes } = await supabase
        .from("camera_access_codes")
        .select("id, created_at")
        .eq("club_id", clubId)
        .eq("active", true)
        .order("created_at", { ascending: true });

      if (existingCodes && existingCodes.length >= 3) {
        // Deactivate oldest code to make room
        await supabase
          .from("camera_access_codes")
          .update({ active: false })
          .eq("id", existingCodes[0].id);
      }

      const values = new Uint32Array(1);
      crypto.getRandomValues(values);
      const code = String(values[0] % 1_000_000).padStart(6, "0");
      const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
      const hash = Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
      const { error } = await supabase.from("camera_access_codes").insert({
        club_id: clubId,
        code_hash: hash,
        label: `Kamera – ${match?.away_club_name || "Spiel"} ${match?.date || ""}`,
        created_by_user_id: session.user.id,
      });
      if (error) throw error;
      setNewCode(code);
      toast.success("Neuer Kamera-Code generiert!");
    } catch (err) {
      console.error("Camera code generation error:", err);
      toast.error("Code konnte nicht generiert werden");
    } finally {
      setGeneratingCode(false);
    }
  };

  const homeTeamStats = teamStats?.find((t) => t.team === "home");
  const awayTeamStats = teamStats?.find((t) => t.team === "away");
  const homePlayerStats = (playerStats ?? []).filter((s) => s.team === "home");
  const awayPlayerStats = (playerStats ?? []).filter((s) => s.team === "away");
  const hasStats = (playerStats?.length ?? 0) > 0;
  const homeAgg = aggregatePlayerMetrics(homePlayerStats);
  const awayAgg = aggregatePlayerMetrics(awayPlayerStats);

  // Check if data was extrapolated (partial field coverage)
  const coverageRatio = homeTeamStats?.raw_metrics && typeof homeTeamStats.raw_metrics === "object"
    ? (homeTeamStats.raw_metrics as any)?.coverage_ratio ?? 1
    : 1;
  const isExtrapolated = coverageRatio < 0.9;
  
  // Check if tactical stats are estimated (not from manual events)
  const isTacticalEstimated = (playerStats ?? []).some((s: any) => 
    (s.raw_metrics as any)?.tactical_estimated === true
  );
  const hasBallDetections = (playerStats ?? []).some((s: any) => 
    (s.raw_metrics as any)?.ball_detections_available === true
  );

  // Analysis stage determination
  const analysisStage = getAnalysisStage(
    match?.status ?? "setup",
    hasPartialData ? "partial" : "full",
    isExtrapolated,
    homeTeamStats?.quality_score,
  );

  // Enrich goals/assists from match events (manual input is more accurate than estimation)
  const homeGoalsFromEvents = (events ?? []).filter((e: any) => e.team === "home" && e.event_type === "goal").length;
  const awayGoalsFromEvents = (events ?? []).filter((e: any) => e.team === "away" && e.event_type === "goal").length;
  const homeAssistsFromEvents = (events ?? []).filter((e: any) => e.team === "home" && e.event_type === "assist").length;
  const awayAssistsFromEvents = (events ?? []).filter((e: any) => e.team === "away" && e.event_type === "assist").length;

  // Override aggregated goals/assists with event data when available
  if (homeGoalsFromEvents > 0 || awayGoalsFromEvents > 0) {
    homeAgg.goals = homeGoalsFromEvents;
    homeAgg.assists = homeAssistsFromEvents;
    awayAgg.goals = awayGoalsFromEvents;
    awayAgg.assists = awayAssistsFromEvents;
  }

  const coachLinks = {
    recoveries: [...homePlayerStats]
      .filter((item: any) => item.player_id && item.players?.name)
      .sort((a: any, b: any) => (b.ball_recoveries ?? 0) - (a.ball_recoveries ?? 0))
      .slice(0, 3),
    passing: [...homePlayerStats]
      .filter((item) => item.player_id && item.players?.name)
      .sort((a, b) => (b.passes_total ?? 0) - (a.passes_total ?? 0))
      .slice(0, 3),
  };

  if (isLoading) return <AppLayout><div className="mx-auto max-w-6xl"><SkeletonCard count={3} /></div></AppLayout>;
  if (!match) return <AppLayout><div className="mx-auto max-w-6xl py-20 text-center text-muted-foreground">Spiel nicht gefunden</div></AppLayout>;

  const sortPlayers = (stats: any[]) => {
    return [...stats].sort((a, b) => {
      const va = a[sortKey] ?? 0;
      const vb = b[sortKey] ?? 0;
      return sortAsc ? va - vb : vb - va;
    });
  };

  const handleSort = (key: string) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const SortHeader = ({ label, field }: { label: string; field: string }) => (
    <th className="cursor-pointer px-4 py-3 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground" onClick={() => handleSort(field)}>
      <span className="flex items-center gap-1">{label} <ArrowUpDown className="h-3 w-3" /></span>
    </th>
  );

  const renderTeamCard = (label: string, stats: any, agg: ReturnType<typeof aggregatePlayerMetrics>, focusPlayers: any[]) => (
    <div className="glass-card relative space-y-4 overflow-hidden p-5 sm:p-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-r from-primary/10 to-transparent" />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="break-words text-lg font-semibold font-display">{label}</h3>
          <p className="text-sm text-muted-foreground">Interaktive Match-Zusammenfassung mit direkten Wegen in Spielerprofile.</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
      </div>
      <div className="relative grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: "Gesamtdistanz", value: stats?.total_distance_km ? `${stats.total_distance_km.toFixed(1)} km` : "—" },
          { label: "Ballbesitz", value: stats?.possession_pct ? `${round(stats.possession_pct, 0)}%` : "—" },
          { label: "Passquote", value: agg.passAccuracy ? `${agg.passAccuracy}%` : "—" },
          { label: "Zweikampfquote", value: agg.duelRate ? `${agg.duelRate}%` : "—" },
          { label: "Ballgewinne", value: String(agg.ballRecoveries) },
          { label: "Schüsse", value: String(agg.shots) },
          { label: "Scorer", value: String(agg.goals + agg.assists) },
          { label: "Fouls / Karten", value: `${agg.fouls} / ${agg.yellow + agg.red}` },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-background/50 p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
            <p className="mt-2 break-words text-lg font-bold font-display">{item.value}</p>
          </div>
        ))}
      </div>
      <div className="relative space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Direkte Spieler-Drilldowns</p>
          <div className="flex flex-wrap gap-2">
            {focusPlayers.map((player) => (
              <Button key={player.player_id} variant="heroOutline" size="sm" asChild>
                <Link to={`/players/${player.player_id}`} className="max-w-full">
                  <span className="block max-w-[10rem] truncate sm:max-w-[12rem]">{player.players?.name}</span>
                </Link>
              </Button>
            ))}
          </div>
      </div>
    </div>
  );

  const renderPlayerTable = (stats: any[]) => {
    if (stats.length === 0) {
      return (
        <div className="glass-card p-8 text-center">
          <Activity className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Noch keine Spielerstatistiken verfügbar.</p>
        </div>
      );
    }

    return (
      <div className="glass-card overflow-x-auto">
        <table className="min-w-[980px] w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">Spieler</th>
              <th className="px-2 py-3 text-left text-xs font-medium text-muted-foreground">Consent</th>
              <th className="px-2 py-3 text-left text-xs font-medium text-muted-foreground">#</th>
              <SortHeader label="km" field="distance_km" />
              <SortHeader label="Top" field="top_speed_kmh" />
              <SortHeader label="Pässe" field="passes_total" />
              <SortHeader label="Pass%" field="pass_accuracy" />
              <SortHeader label="Zwk%" field="duels_won" />
              <SortHeader label="Ballgew." field="ball_recoveries" />
              <SortHeader label="Tore" field="goals" />
              <SortHeader label="Ass." field="assists" />
              <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">Profil</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {sortPlayers(stats).map((p: any) => {
              const duelPct = p.duels_total > 0 ? Math.round((p.duels_won / p.duels_total) * 100) : null;
              return (
                <Fragment key={p.id}>
                    <tr className="cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/20" onClick={() => setExpandedPlayer(expandedPlayer === p.id ? null : p.id)}>
                     <td className="px-3 py-3 font-medium">
                       <span className="flex items-center gap-1.5">
                         <span className="block max-w-[170px] truncate">{p.players?.name ?? (p.raw_metrics as any)?.player_name ?? "—"}</span>
                         {!p.player_id && (p.raw_metrics as any)?.auto_discovered && <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary uppercase tracking-wider">KI</span>}
                       </span>
                     </td>
                    <td className="px-2 py-3"><ConsentStatusBadge status={p.players?.tracking_consent_status} compact /></td>
                    <td className="px-2 py-3 text-muted-foreground">{p.players?.number ?? "—"}</td>
                    <td className="px-3 py-3 font-semibold">{p.distance_km?.toFixed(1) ?? "—"}</td>
                    <td className="px-3 py-3">{p.top_speed_kmh?.toFixed(1) ?? "—"}</td>
                    <td className="px-3 py-3">{p.passes_total ?? 0}</td>
                    <td className="px-3 py-3">{p.pass_accuracy ? `${Math.round(p.pass_accuracy)}%` : "—"}</td>
                    <td className="px-3 py-3">{duelPct !== null ? `${duelPct}%` : "—"}</td>
                    <td className="px-3 py-3">{p.ball_recoveries ?? 0}</td>
                    <td className="px-3 py-3 font-semibold">{p.goals ?? 0}</td>
                    <td className="px-3 py-3">{p.assists ?? 0}</td>
                    <td className="px-3 py-3">
                      {p.player_id ? (
                        <Button variant="ghost" size="sm" asChild onClick={(event) => event.stopPropagation()}>
                          <Link to={`/players/${p.player_id}`}>Öffnen</Link>
                        </Button>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-2 py-3">{expandedPlayer === p.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</td>
                  </tr>
                  {expandedPlayer === p.id && (
                    <tr>
                      <td colSpan={13} className="bg-muted/10 p-4">
                        <div className="grid gap-4 lg:grid-cols-[1.1fr,1fr,1fr]">
                          <HeatmapField label="Heatmap" grid={p.heatmap_grid as number[][] | null} />
                          <div className="space-y-3">
                            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Physis & Ball</div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="rounded-xl border border-border bg-background/50 p-3"><div className="text-[10px] text-muted-foreground">Ø Speed</div><div className="text-sm font-bold font-display">{p.avg_speed_kmh?.toFixed(1) ?? "—"} km/h</div></div>
                              <div className="rounded-xl border border-border bg-background/50 p-3"><div className="text-[10px] text-muted-foreground">Sprint-Distanz</div><div className="text-sm font-bold font-display">{p.sprint_distance_m ? `${Math.round(p.sprint_distance_m)} m` : "—"}</div></div>
                              <div className="rounded-xl border border-border bg-background/50 p-3"><div className="text-[10px] text-muted-foreground">Ballkontakte</div><div className="text-sm font-bold font-display">{p.ball_contacts ?? "—"}</div></div>
                              <div className="rounded-xl border border-border bg-background/50 p-3"><div className="text-[10px] text-muted-foreground">Rating</div><div className="text-sm font-bold font-display">{p.rating ? p.rating.toFixed(1) : "—"}</div></div>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Coach-Navigation</div>
                            <div className="rounded-xl border border-border bg-background/50 p-3 text-sm text-muted-foreground">Von hier aus springst du direkt in die Einzelanalyse und den Trainingsplan des Spielers.</div>
                            {p.player_id && (
                              <Button variant="heroOutline" size="sm" asChild>
                                <Link to={`/players/${p.player_id}`}>Zur Spieleranalyse <ArrowRight className="ml-1 h-4 w-4" /></Link>
                              </Button>
                            )}
                            <PerformanceAnalysis type="player" playerId={p.player_id} playerName={p.players?.name} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6 px-0">
        <Link to="/matches" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Zurück zu Spiele</Link>

        <div className="glass-card relative overflow-hidden p-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-primary/10 via-accent/10 to-transparent" />
          <div className="relative mb-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={match.status} />
              <ConsentStatusBadge status={match.opponent_consent_confirmed ? "granted" : "denied"} compact className="max-w-none" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={() => toast.info("PDF-Export wird vorbereitet...")}><FileText className="mr-1 h-4 w-4" /> PDF</Button>
              <Button variant="ghost" size="sm" onClick={() => toast.info("Excel-Export wird vorbereitet...")}><Download className="mr-1 h-4 w-4" /> Excel</Button>
              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link kopiert!"); }}><Share2 className="mr-1 h-4 w-4" /> Teilen</Button>
            </div>
          </div>
          <div className="relative space-y-2">
            <h1 className="break-words text-2xl font-bold font-display sm:text-3xl">{clubName} vs {match.away_club_name || "TBD"}</h1>
            <p className="text-sm text-muted-foreground">{new Date(match.date).toLocaleDateString("de-DE")}{match.kickoff && ` · ${match.kickoff}`}{match.fields && ` · ${(match.fields as any).name}`}</p>
          </div>
          {(match.status === "setup" || match.status === "ready") && (
            <div className="relative mt-4 space-y-3">
              <Button variant="tracking" className="w-full" asChild><Link to={`/matches/${id}/track?cam=0`}><Camera className="mr-2 h-5 w-5" /> Tracking starten</Link></Button>
              
              {/* Generate new camera code */}
              {newCode ? (
                <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
                  <p className="text-sm font-medium text-foreground">Neuer Kamera-Code:</p>
                  <div className="text-center py-3 bg-muted rounded-xl">
                    <span className="text-3xl font-mono font-bold tracking-[0.3em] text-foreground">{newCode}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => { navigator.clipboard.writeText(newCode); toast.success("Code kopiert!"); }}>
                      <Copy className="mr-1.5 h-3.5 w-3.5" /> Kopieren
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => {
                      const text = `FieldIQ Kamera-Code: ${newCode}`;
                      if (navigator.share) navigator.share({ title: "Kamera-Code", text }).catch(() => {});
                      else { navigator.clipboard.writeText(text); toast.success("Code kopiert!"); }
                    }}>
                      <Share2 className="mr-1.5 h-3.5 w-3.5" /> Teilen
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setNewCode(null); }}>
                    <KeyRound className="mr-1 h-3.5 w-3.5" /> Weiteren Code generieren
                  </Button>
                </div>
              ) : (
                <Button variant="outline" className="w-full" onClick={handleGenerateCode} disabled={generatingCode}>
                  {generatingCode ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                  Neuen Kamera-Code generieren
                </Button>
              )}

              <details className="group">
                <summary className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"><ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" /> Weitere Kameras hinzufügen (Multi-Kamera)</summary>
                <div className="mt-2 space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                  <p className="mb-2 text-xs text-muted-foreground">Kopiere diese Links auf weitere Smartphones. Beim Öffnen wird ein 6-stelliger Kamera-Code abgefragt:</p>
                  {[1, 2].map((i) => (<button key={i} onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/camera/${id}/track?cam=${i}`); toast.success(`Link Kamera ${i + 1} kopiert!`); }} className="flex w-full items-center gap-2 rounded-md p-2 text-left text-xs font-mono text-muted-foreground transition-colors hover:bg-muted/50 hover:text-primary"><Camera className="h-3.5 w-3.5 shrink-0" /> Kamera {i + 1} — Link kopieren</button>))}
                </div>
              </details>
            </div>
          )}
        </div>

        {/* Unified Analysis Status Banner */}
        {hasStats && (
          <AnalysisStatusBanner
            stage={analysisStage}
            coverageRatio={coverageRatio}
            isExtrapolated={isExtrapolated}
            playerCount={(playerStats ?? []).length}
            matchStatus={match.status}
          />
        )}

        {/* Estimation disclaimer for tactical stats */}
        {isTacticalEstimated && hasStats && analysisStage !== "prognose" && (
          <div className="glass-card border-blue-500/20 bg-blue-500/5 p-3">
            <div className="flex items-start gap-2.5">
              <Activity className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
              <div>
                <p className="text-xs font-medium text-blue-700 dark:text-blue-300">Taktische Werte sind Schätzungen</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Pässe, Zweikämpfe und Ballkontakte werden aus Positionsdaten geschätzt. 
                  Fouls, Karten und Tore stammen ausschließlich aus manuell erfassten Spielereignissen.
                  {!hasBallDetections && " Ballerkennung nicht verfügbar — taktische Werte eingeschränkt."}
                </p>
              </div>
            </div>
          </div>
        )}

        {uploads && uploads.length > 0 && match.status !== "processing" && !isLive && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{uploads.map((u: any) => <div key={u.id} className="glass-card min-w-[160px] p-3"><div className="text-xs text-muted-foreground">Kamera {u.camera_index + 1}</div><StatusBadge status={u.status} /></div>)}</div>}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList data-testid="match-report-tabs" className="scrollbar-none flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg bg-muted/30 p-1">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="shrink-0 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium sm:flex-1"
              >
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="Übersicht" className="mt-0">
            <div className="space-y-8">
              <div data-testid="coach-summary-section">
                <CoachSummary
                  clubName={clubName ?? "Heim"}
                  awayName={match.away_club_name ?? "Auswärts"}
                  homeTeamStats={homeTeamStats}
                  awayTeamStats={awayTeamStats}
                  homePlayerStats={homePlayerStats}
                  awayPlayerStats={awayPlayerStats}
                />
              </div>

              {apiStats && <ApiFootballStatsCard stats={apiStats} homeLabel={clubName ?? "Heim"} awayLabel={match.away_club_name ?? "Auswärts"} />}

              {hasStats ? (
                <>
                  <section className="space-y-4">
                    <SectionHeader eyebrow="Match Pulse" title="Kern-KPIs" description="Die wichtigsten Matchhebel zuerst – kompakt genug zum Scannen, detailliert genug für die Halbzeitansprache." />
                    <MatchKpiStrip homeTeamStats={homeTeamStats} awayTeamStats={awayTeamStats} homePlayerStats={homePlayerStats} awayPlayerStats={awayPlayerStats} homeName={clubName ?? "Heim"} awayName={match.away_club_name ?? "Auswärts"} />
                  </section>

                  <section className="space-y-4">
                    <SectionHeader eyebrow="Head to Head" title="Teamvergleich" description="Ein primärer Vergleichsblock für Kontrolle, Intensität und Wirkung – vor den Detailmodulen." />
                    <div className="grid gap-4 2xl:grid-cols-[1.1fr,0.9fr]">
                      <ComparisonBarChart homeTeamStats={homeTeamStats} awayTeamStats={awayTeamStats} homePlayerStats={homePlayerStats} awayPlayerStats={awayPlayerStats} homeName={clubName ?? "Heim"} awayName={match.away_club_name ?? "Auswärts"} />
                      <MatchRadarChart homeTeamStats={homeTeamStats} awayTeamStats={awayTeamStats} homePlayerStats={homePlayerStats} awayPlayerStats={awayPlayerStats} homeName={clubName ?? "Heim"} awayName={match.away_club_name ?? "Auswärts"} />
                    </div>
                  </section>

                  <section className="space-y-4">
                    <SectionHeader eyebrow="Bench View" title="Schnellvergleich je Team" description="Kompakte Teamkarten für das schnelle Lesen von Belastung, Passspiel und Ballgewinnen." />
                    <div className="grid gap-4 xl:grid-cols-2">
                      {renderTeamCard(clubName ?? "Heim", homeTeamStats, homeAgg, coachLinks.recoveries)}
                      {renderTeamCard(match.away_club_name ?? "Auswärts", awayTeamStats, awayAgg, coachLinks.passing)}
                    </div>
                  </section>

                  <section className="space-y-4">
                    <SectionHeader eyebrow="Leaderboards" title="Top-Spieler & Indikatoren" description="Modernisierte Rankings mit Peak-Einordnung, Ausreißer-Indikator und stabilerem Responsive-Verhalten." />
                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                      <TopPlayersChart stats={[...homePlayerStats, ...awayPlayerStats]} title="Top Laufdistanz" metric="distance_km" unit="km" />
                      <TopPlayersChart stats={[...homePlayerStats, ...awayPlayerStats]} title="Top Speed" metric="top_speed_kmh" unit="km/h" />
                      <TopPlayersChart stats={[...homePlayerStats, ...awayPlayerStats]} title="Top Sprints" metric="sprint_count" unit="" />
                      <TopPlayersChart stats={[...homePlayerStats, ...awayPlayerStats]} title="Top Passgeber" metric="passes_total" unit="" />
                      <TopPlayersChart stats={[...homePlayerStats, ...awayPlayerStats]} title="Top Tackles" metric="tackles" unit="" />
                      <TopPlayersChart stats={[...homePlayerStats, ...awayPlayerStats]} title="Top Ballgewinne" metric="ball_recoveries" unit="" />
                    </div>
                  </section>

                  <section className="space-y-4">
                    <SectionHeader eyebrow="Tactical Read" title="Taktische Insights" description="Heatmaps, Gegentor-Muster und Spieler-Navigation in einem klarer priorisierten Analyseblock." />
                    <MatchInsightsPanel matchId={match.id} homeHeatmap={homeTeamStats?.formation_heatmap as number[][] | null} awayHeatmap={awayTeamStats?.formation_heatmap as number[][] | null} homePlayerStats={homePlayerStats} awayPlayerStats={awayPlayerStats} apiStats={apiStats} events={(events ?? []) as any[]} />
                  </section>

                  {(events?.length ?? 0) > 0 && (
                    <section className="space-y-4">
                      <SectionHeader eyebrow="Match Events" title="Spielereignisse" description="Alle erfassten Ereignisse – von Ecken über Freistöße bis Zweikämpfe – im direkten Teamvergleich." />
                      <MatchEventStats events={(events ?? []) as any[]} homeName={clubName ?? "Heim"} awayName={match.away_club_name ?? "Auswärts"} />
                    </section>
                  )}

                  <section className="space-y-4">
                    <SectionHeader eyebrow="Field View" title="Heatmaps & Teamanalyse" description="Die Gesamtbewegung beider Teams plus vertiefende Analyse für den Staff." />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <HeatmapField label="Team-Heatmap Heim" grid={homeTeamStats?.formation_heatmap as number[][] | null} />
                      <HeatmapField label="Team-Heatmap Auswärts" grid={awayTeamStats?.formation_heatmap as number[][] | null} />
                    </div>
                    <PerformanceAnalysis type="team" matchId={match.id} />
                  </section>

                  <section className="space-y-4">
                    <SectionHeader eyebrow="What If" title="Formationen & Optionen" description="Die Was-wäre-wenn-Analyse sitzt jetzt bewusst nach den Fakten – als nächster Coaching-Schritt, nicht davor." />
                    <WhatIfBoard players={homePlayerStats} />
                  </section>
                </>
              ) : (
                <div className="glass-card p-8 text-center"><Activity className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" /><p className="text-muted-foreground">Statistiken werden nach dem Tracking verfügbar.</p></div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="Berichte & Presse" className="mt-0">
            <ReportGenerator matchId={match.id} matchStatus={match.status} clubName={clubName ?? "Heim"} awayClubName={match.away_club_name ?? "Gegner"} matchDate={match.date} />
          </TabsContent>
          <TabsContent value="Heim" className="mt-0 space-y-4">
            <div className="glass-card flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold font-display text-sm">H</div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold font-display">{clubName ?? "Heimmannschaft"}</h3>
                <p className="text-xs text-muted-foreground">{homePlayerStats.length} Spieler getrackt · Formation: {match.home_formation ?? "—"}</p>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Activity className="h-3 w-3" /> Eigenes Team
              </div>
            </div>
            {renderPlayerTable(homePlayerStats)}
          </TabsContent>
          <TabsContent value="Auswärts" className="mt-0 space-y-4">
            <div className="glass-card flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent-foreground font-bold font-display text-sm">G</div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold font-display">{match.away_club_name ?? "Gegner"}</h3>
                <p className="text-xs text-muted-foreground">
                  {match.track_opponent
                    ? `${awayPlayerStats.length} Spieler getrackt · Formation: ${match.away_formation ?? "—"}`
                    : "Gegner-Tracking ist für dieses Spiel deaktiviert"}
                </p>
              </div>
              <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                match.track_opponent && match.opponent_consent_confirmed
                  ? "border-primary/20 bg-primary/10 text-primary"
                  : "border-destructive/20 bg-destructive/10 text-destructive"
              }`}>
                {match.track_opponent ? <Activity className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                {match.track_opponent ? "Getrackt" : "Nicht getrackt"}
              </div>
            </div>
            {!match.track_opponent ? (
              <div className="glass-card p-8 text-center">
                <EyeOff className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                <h3 className="mb-1 font-semibold font-display">Gegner-Tracking deaktiviert</h3>
                <p className="text-sm text-muted-foreground">Für dieses Spiel wurde kein Tracking der gegnerischen Mannschaft aktiviert oder die Einwilligung fehlt.</p>
              </div>
            ) : renderPlayerTable(awayPlayerStats)}
          </TabsContent>
          <TabsContent value="Vergleich" className="mt-0">
            <div className="space-y-6">{hasStats ? <><ComparisonBarChart homeTeamStats={homeTeamStats} awayTeamStats={awayTeamStats} homePlayerStats={homePlayerStats} awayPlayerStats={awayPlayerStats} homeName={clubName ?? "Heim"} awayName={match.away_club_name ?? "Auswärts"} /><MatchRadarChart homeTeamStats={homeTeamStats} awayTeamStats={awayTeamStats} homePlayerStats={homePlayerStats} awayPlayerStats={awayPlayerStats} homeName={clubName ?? "Heim"} awayName={match.away_club_name ?? "Auswärts"} /></> : <div className="glass-card p-8 text-center"><Activity className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" /><p className="text-muted-foreground">Vergleichs-Charts werden nach dem ersten Tracking verfügbar.</p></div>}</div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
