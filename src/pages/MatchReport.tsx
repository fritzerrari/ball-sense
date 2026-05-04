import AppLayout from "@/components/AppLayout";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useState, useEffect, lazy, Suspense } from "react";
import {
  ArrowLeft, Brain, Lightbulb, Target, Shield, Zap,
  ClipboardList, AlertTriangle, TrendingUp, Calendar,
  Loader2, RefreshCw, ChevronRight, Swords, Users, Dumbbell,
  Download, Newspaper,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePdfExport, PdfReportType } from "@/hooks/use-pdf-export";
import PostMatchEventEditor from "@/components/PostMatchEventEditor";
import AISuggestionsPanel from "@/components/AISuggestionsPanel";
import VideoBackfillUpload from "@/components/VideoBackfillUpload";
import PendingFramesRecoveryBanner from "@/components/PendingFramesRecoveryBanner";
import PreFlightCheckCard from "@/components/PreFlightCheckCard";
import { useMatch } from "@/hooks/use-matches";
import { useAuth } from "@/components/AuthProvider";
import { SkeletonCard } from "@/components/SkeletonCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useModuleAccess } from "@/hooks/use-module-access";
import { useOpponentHistory } from "@/hooks/use-opponent-history";
import { motion } from "framer-motion";

// Cockpit components
import MatchScorecard from "@/components/MatchScorecard";
import MomentumTimeline from "@/components/MomentumTimeline";
import TacticalGradeMatrix from "@/components/TacticalGradeMatrix";
import RiskRadar from "@/components/RiskRadar";
import PlayerSpotlight from "@/components/PlayerSpotlight";
import PlayerDevelopmentCards from "@/components/PlayerDevelopmentCards";
import DecisionCockpit from "@/components/DecisionCockpit";
import MatchContextBanner from "@/components/MatchContextBanner";
import WhatIfBoard from "@/components/WhatIfBoard";
import AutoPatternClips from "@/components/AutoPatternClips";
import OpponentDNA from "@/components/OpponentDNA";
import TrainingMicroCycle from "@/components/TrainingMicroCycle";
import QuickActionCards from "@/components/QuickActionCards";
import ChanceQualityPanel from "@/components/ChanceQualityPanel";
import TacticalBlueprintBoard from "@/components/TacticalBlueprintBoard";
import ShapeRecommendationCard from "@/components/ShapeRecommendationCard";
import SetPieceBreakdown from "@/components/SetPieceBreakdown";
import HighlightReelGenerator from "@/components/HighlightReelGenerator";
import FoulProbabilityPanel from "@/components/FoulProbabilityPanel";
import LiveCoachingPanel from "@/components/LiveCoachingPanel";
import PressReleaseGenerator from "@/components/PressReleaseGenerator";

// Lazy-loaded analysis components
const CoachingCockpit = lazy(() => import("@/components/CoachingCockpit"));
const HighlightGallery = lazy(() => import("@/components/HighlightGallery"));
const TacticalAIChat = lazy(() => import("@/components/TacticalAIChat"));
const HighlightStory = lazy(() => import("@/components/HighlightStory"));
const TransitionAnalysis = lazy(() => import("@/components/TransitionAnalysis"));
const FormationTimeline = lazy(() => import("@/components/FormationTimeline"));
const FatigueIndicator = lazy(() => import("@/components/FatigueIndicator"));
const OpponentScoutReport = lazy(() => import("@/components/OpponentScoutReport"));
const OpponentHistoryProfile = lazy(() => import("@/components/OpponentHistoryProfile"));
const CameraRemotePanel = lazy(() => import("@/components/CameraRemotePanel"));
const CameraCoverageTimeline = lazy(() => import("@/components/CameraCoverageTimeline"));
const CameraCoverageMap = lazy(() => import("@/components/CameraCoverageMap"));

const CATEGORY_ICONS: Record<string, typeof Target> = {
  offense: Target,
  defense: Shield,
  transition: Zap,
  set_piece: TrendingUp,
  general: Lightbulb,
};

const CONFIDENCE_STYLES: Record<string, { bg: string; text: string; label: string; reason: string }> = {
  high: { bg: "bg-emerald-500/10", text: "text-emerald-500", label: "Belastbar", reason: "Hohe Datendichte und konsistente Muster erkannt" },
  medium: { bg: "bg-amber-500/10", text: "text-amber-500", label: "Eingeschränkt", reason: "Teilweise Datenlücken, Muster plausibel aber nicht eindeutig" },
  estimated: { bg: "bg-orange-500/10", text: "text-orange-500", label: "Geschätzt", reason: "Wenig Datenpunkte, KI-Hochrechnung auf Basis verfügbarer Frames" },
};

interface ReportSection {
  id: string;
  section_type: string;
  title: string;
  content: string;
  confidence: string;
  sort_order: number;
}

interface TrainingRec {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: number;
  linked_pattern: string | null;
}

interface AnalysisResult {
  id: string;
  result_type: string;
  data: any;
  confidence: number;
}

interface AnalysisJob {
  id: string;
  status: string;
  progress: number | null;
  error_message?: string | null;
  created_at?: string;
}

const ACTIVE_JOB_STATUSES = ["queued", "analyzing", "interpreting"] as const;
const TERMINAL_JOB_STATUSES = ["complete", "failed", "cancelled"] as const;

function parseJson(content: string): any {
  try { return JSON.parse(content); } catch { return null; }
}

function resolveActiveJob(jobs: AnalysisJob[] | null | undefined): AnalysisJob | null {
  if (!jobs?.length) return null;
  return jobs.find((candidate) => ACTIVE_JOB_STATUSES.includes(candidate.status as typeof ACTIVE_JOB_STATUSES[number])) ?? null;
}

export default function MatchReport() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { clubName } = useAuth();
  const { data: match, isLoading } = useMatch(id);
  const { hasAccess: hasHighlights } = useModuleAccess("video_highlights");
  const { data: opponentProfile } = useOpponentHistory(match?.away_club_name);
  const { exportPdf, exporting } = usePdfExport();

  const [sections, setSections] = useState<ReportSection[]>([]);
  const [training, setTraining] = useState<TrainingRec[]>([]);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [loadingReport, setLoadingReport] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);
  const VALID_TABS = ["cockpit", "overview", "tactics", "players", "opponent", "training"] as const;
  const [activeTab, setActiveTab] = useState(() => {
    const t = searchParams.get("tab");
    return t && (VALID_TABS as readonly string[]).includes(t) ? t : "cockpit";
  });

  const handleJumpToTab = (tab: string, extra?: Record<string, string>) => {
    setActiveTab(tab);
    if (extra) {
      const next = new URLSearchParams(searchParams);
      next.set("tab", tab);
      Object.entries(extra).forEach(([k, v]) => next.set(k, v));
      setSearchParams(next, { replace: true });
    }
  };

  // Sync tab → URL so the user can share/refresh deep-linked sections
  useEffect(() => {
    const current = searchParams.get("tab");
    if (current === activeTab) return;
    if (activeTab === "cockpit" && !current) return;
    const next = new URLSearchParams(searchParams);
    if (activeTab === "cockpit") next.delete("tab"); else next.set("tab", activeTab);
    setSearchParams(next, { replace: true });
  }, [activeTab, searchParams, setSearchParams]);

  useEffect(() => {
    if (!id) return;
    void loadReportData();
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("analysis_jobs")
        .select("id, status, progress, error_message, created_at")
        .eq("match_id", id)
        .order("created_at", { ascending: false })
        .limit(5);

      const activeJob = resolveActiveJob(data ?? []);
      setJob(activeJob);

      if (!activeJob) {
        clearInterval(interval);
        void loadReportData();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [id]);

  const loadReportData = async () => {
    if (!id) return;
    setLoadingReport(true);
    const [sectionsRes, trainingRes, resultsRes, jobsRes] = await Promise.all([
      supabase.from("report_sections").select("*").eq("match_id", id).order("sort_order"),
      supabase.from("training_recommendations").select("*").eq("match_id", id).order("priority"),
      supabase.from("analysis_results").select("*").eq("match_id", id),
      supabase.from("analysis_jobs").select("id, status, progress, error_message, created_at").eq("match_id", id).order("created_at", { ascending: false }).limit(5),
    ]);
    setSections(sectionsRes.data ?? []);
    setTraining(trainingRes.data ?? []);
    setAnalysisResults(resultsRes.data ?? []);
    setJob(resolveActiveJob(jobsRes.data ?? []));
    setLoadingReport(false);
  };

  const handleReprocess = async () => {
    if (!id) return;
    setReprocessing(true);
    try {
      const { data: newJob, error } = await supabase.from("analysis_jobs").insert({
        match_id: id, status: "queued", progress: 0,
      }).select().single();
      if (error) throw error;
      await supabase.from("matches").update({ status: "processing" }).eq("id", id);
      await supabase.functions.invoke("analyze-match", { body: { match_id: id, job_id: newJob.id } });
      toast.success("Neue Analyse gestartet!");
    } catch (err: any) {
      toast.error(err.message ?? "Fehler");
    } finally {
      setReprocessing(false);
    }
  };

  if (isLoading) return <AppLayout><div className="mx-auto max-w-5xl"><SkeletonCard count={3} /></div></AppLayout>;
  if (!match) return <AppLayout><div className="mx-auto max-w-5xl py-20 text-center text-muted-foreground">Spiel nicht gefunden</div></AppLayout>;

  // Extract sections by type
  const getSection = (type: string) => sections.find(s => s.section_type === type);
  const summary = getSection("summary");
  const insights = sections.filter(s => s.section_type === "insight");
  const coaching = getSection("coaching");
  const matchRating = parseJson(getSection("match_rating")?.content ?? "null");
  const tacticalGrades = parseJson(getSection("tactical_grades")?.content ?? "null");
  const momentumData = parseJson(getSection("momentum")?.content ?? "null");
  const riskMatrix = parseJson(getSection("risk_matrix")?.content ?? "null");
  const playerSpotlight = parseJson(getSection("player_spotlight")?.content ?? "null");
  const opponentDna = parseJson(getSection("opponent_dna")?.content ?? "null");
  const nextMatchActions = parseJson(getSection("next_match_actions")?.content ?? "null");
  const trainingMicroCycle = parseJson(getSection("training_micro_cycle")?.content ?? "null");
  const opponentScouting = getSection("opponent_scouting");
  const chanceQuality = parseJson(getSection("chance_quality")?.content ?? "null");
  const tacticalBlueprint = parseJson(getSection("tactical_blueprint")?.content ?? "null");
  const shapeRecommendation = parseJson(getSection("shape_recommendation")?.content ?? "null");
  const setPieceBreakdown = parseJson(getSection("set_piece_breakdown")?.content ?? "null");

  // Analysis results
  const dangerZones = analysisResults.find(r => r.result_type === "danger_zones");
  const chances = analysisResults.find(r => r.result_type === "chances");
  const framePositions = analysisResults.find(r => r.result_type === "frame_positions");
  const pressingData = analysisResults.find(r => r.result_type === "pressing_data");
  const transitions = analysisResults.find(r => r.result_type === "transitions");
  const passDirections = analysisResults.find(r => r.result_type === "pass_directions");
  const formationTimeline = analysisResults.find(r => r.result_type === "formation_timeline");
  const teamSizeDetected = analysisResults.find(r => r.result_type === "team_size_detected")?.data;

  const isProcessing = !!job?.status && !TERMINAL_JOB_STATUSES.includes(job.status as typeof TERMINAL_JOB_STATUSES[number]);
  const hasReport = sections.length > 0;

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-5">
        <PendingFramesRecoveryBanner />
        {/* Compact Nav */}
        <div className="flex items-center gap-3 flex-wrap">
          <Link to="/matches" className="rounded-lg p-2 transition-colors hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Match Report</p>
          </div>
          {(() => {
            const cov = (match as any)?.fields?.calibration?.coverage as string | undefined;
            if (!cov || cov === "full") return null;
            const label = cov === "left_half" ? "Linke Hälfte" : cov === "right_half" ? "Rechte Hälfte" : "Teilfeld";
            return (
              <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning gap-1">
                <AlertTriangle className="h-3 w-3" />
                Halbfeld-Analyse · {label}
              </Badge>
            );
          })()}
          {id && <PostMatchEventEditor matchId={id} onEventsChanged={loadReportData} />}
          {id && <VideoBackfillUpload matchId={id} onComplete={loadReportData} />}
          {hasReport && id && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5" disabled={exporting}>
                  {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  PDF
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="end">
                <div className="space-y-1">
                  {[
                    { type: "full_report" as PdfReportType, label: "Kompletter Report" },
                    { type: "training_plan" as PdfReportType, label: "Trainingsplan" },
                    { type: "match_prep" as PdfReportType, label: "Gegner-Briefing" },
                    { type: "halftime_tactics" as PdfReportType, label: "Halbzeit-Taktik" },
                  ].map(({ type, label }) => (
                    <button
                      key={type}
                      onClick={() => exportPdf(id, type, { clubName: clubName ?? undefined })}
                      className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-muted transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
          <Button variant="outline" size="sm" onClick={handleReprocess} disabled={reprocessing || !!isProcessing} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${reprocessing ? "animate-spin" : ""}`} />
            Neu analysieren
          </Button>
        </div>

        {/* Camera Remote */}
        {id && <Suspense fallback={null}><CameraRemotePanel matchId={id} /></Suspense>}

        {/* Camera Coverage Timeline (only renders when 2+ cameras contributed) */}
        {id && <Suspense fallback={null}><CameraCoverageTimeline matchId={id} /></Suspense>}

        {/* Camera Coverage Map: visual pitch with detection heatmap, blind zones & camera FOV rectangles */}
        {id && (
          <Suspense fallback={null}>
            <CameraCoverageMap
              matchId={id}
              framePositions={(framePositions?.data as any)?.frames ?? null}
            />
          </Suspense>
        )}

        {/* AI Suggestions: Scenes & Goal candidates from Phase 3 */}
        {id && <AISuggestionsPanel matchId={id} onEventsChanged={loadReportData} />}

        {/* Processing state */}
        {isProcessing && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex items-center gap-4 py-5">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <div>
                <p className="font-medium">Analyse läuft… ({job?.progress ?? 0}%)</p>
                <p className="text-sm text-muted-foreground">
                  {job?.status === "analyzing" && "Spielstruktur wird analysiert"}
                  {job?.status === "interpreting" && "Coaching-Insights werden generiert"}
                  {job?.status === "queued" && "In der Warteschlange"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pre-Match Readiness Check (only when match is in setup phase) */}
        {!hasReport && !isProcessing && match?.status === "setup" && id && (
          <PreFlightCheckCard
            matchId={id}
            homeClubId={match.home_club_id ?? null}
            fieldId={match.field_id ?? null}
            awayClubName={match.away_club_name ?? null}
          />
        )}

        {/* No report yet */}
        {!hasReport && !isProcessing && (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <Brain className="h-12 w-12 text-muted-foreground/30 mx-auto" />
              <div>
                <h2 className="font-semibold font-display text-lg">Noch kein Report</h2>
                <p className="text-sm text-muted-foreground mt-1">Lade ein Video hoch oder starte eine neue Analyse.</p>
              </div>
              <Button onClick={handleReprocess} disabled={reprocessing} className="gap-2">
                <Brain className="h-4 w-4" /> Analyse starten
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ═══════════ COCKPIT REPORT ═══════════ */}
        {hasReport && (
          <>
            {/* HERO SCORECARD */}
            {matchRating && (
              <MatchScorecard
                rating={matchRating}
                homeTeam={clubName ?? "Heim"}
                awayTeam={match.away_club_name || "Gegner"}
                date={match.date}
                kickoff={match.kickoff}
              />
            )}

            {/* QUICK-ACTION CARDS */}
            <QuickActionCards
              insights={insights}
              riskMatrix={riskMatrix}
              nextMatchActions={nextMatchActions}
              onTabChange={setActiveTab}
            />

            {/* TAB NAVIGATION */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="w-full grid grid-cols-3 sm:grid-cols-7 h-auto sm:h-11">
                <TabsTrigger value="cockpit" className="gap-1.5 text-xs sm:text-sm">
                  <Brain className="h-3.5 w-3.5 hidden sm:block" />
                  Cockpit
                </TabsTrigger>
                <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm">
                  <Lightbulb className="h-3.5 w-3.5 hidden sm:block" />
                  Übersicht
                </TabsTrigger>
                <TabsTrigger value="tactics" className="gap-1.5 text-xs sm:text-sm">
                  <Swords className="h-3.5 w-3.5 hidden sm:block" />
                  Taktik
                </TabsTrigger>
                <TabsTrigger value="players" className="gap-1.5 text-xs sm:text-sm">
                  <Users className="h-3.5 w-3.5 hidden sm:block" />
                  Spieler
                </TabsTrigger>
                <TabsTrigger value="opponent" className="gap-1.5 text-xs sm:text-sm">
                  <Shield className="h-3.5 w-3.5 hidden sm:block" />
                  Gegner
                </TabsTrigger>
                <TabsTrigger value="training" className="gap-1.5 text-xs sm:text-sm">
                  <Dumbbell className="h-3.5 w-3.5 hidden sm:block" />
                  Training
                </TabsTrigger>
                <TabsTrigger value="press" className="gap-1.5 text-xs sm:text-sm">
                  <Newspaper className="h-3.5 w-3.5 hidden sm:block" />
                  Presse
                </TabsTrigger>
              </TabsList>

              {/* ═══ COCKPIT TAB — Decision-First ═══ */}
              <TabsContent value="cockpit" className="space-y-4">
                {id && <MatchContextBanner matchId={id} />}
                {id && <DecisionCockpit matchId={id} onJumpToTab={handleJumpToTab} />}
                {id && <LiveCoachingPanel matchId={id} currentMinute={90} half={2} />}
                {id && <AutoPatternClips matchId={id} />}
                {id && <WhatIfBoard matchId={id} />}
                {id && <HighlightReelGenerator matchId={id} />}
                {id && <FoulProbabilityPanel matchId={id} />}
              </TabsContent>


              {/* ═══ OVERVIEW TAB ═══ */}
              <TabsContent value="overview" className="space-y-4">
                {/* Analysis Quality */}
                {(() => {
                  const totalSections = sections.length;
                  const highConf = sections.filter(s => s.confidence === "high").length;
                  const qualityPct = totalSections > 0 ? Math.round((highConf / totalSections) * 100) : 0;
                  const qualityLabel = qualityPct >= 80 ? "Sehr gut" : qualityPct >= 60 ? "Gut" : qualityPct >= 40 ? "Ausreichend" : "Eingeschränkt";
                  const qualityColor = qualityPct >= 80 ? "text-emerald-500" : qualityPct >= 60 ? "text-primary" : qualityPct >= 40 ? "text-amber-500" : "text-orange-500";
                  return (
                    <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        <span className="text-xs font-medium text-muted-foreground">Analyse-Qualität</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold font-display ${qualityColor}`}>{qualityPct}% {qualityLabel}</span>
                        <span className="text-[10px] text-muted-foreground">{highConf}/{totalSections} belastbar</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Executive Summary */}
                {summary && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <Card className="relative overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm">
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary to-primary/50" />
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-2 mb-3">
                          <Brain className="h-5 w-5 text-primary" />
                          <h2 className="font-semibold font-display text-lg">Zusammenfassung</h2>
                        </div>
                        <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{summary.content}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Tactical Grades — nur als Fallback wenn kein Blueprint vorhanden */}
                {tacticalGrades && !tacticalBlueprint && <TacticalGradeMatrix grades={tacticalGrades} />}

                {/* Momentum Timeline */}
                {momentumData && <MomentumTimeline data={momentumData} />}

                {/* Key Insights */}
                {insights.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-5 w-5 text-primary" />
                      <h2 className="font-semibold font-display">Coaching-Insights</h2>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {insights.map((ins, idx) => {
                        const parsed = parseJson(ins.content);
                        const description = parsed?.description ?? ins.content;
                        const impactScore = parsed?.impact_score;
                        const category = parsed?.category;
                        const Icon = CATEGORY_ICONS[category] ?? Lightbulb;
                        const conf = CONFIDENCE_STYLES[ins.confidence] ?? CONFIDENCE_STYLES.medium;
                        return (
                          <motion.div
                            key={ins.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 + idx * 0.05 }}
                          >
                            <Card className="relative overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm h-full">
                              <CardContent className="pt-5">
                                <div className="flex items-start gap-3">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                                    <Icon className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <h3 className="font-medium text-sm flex-1">{ins.title}</h3>
                                      {impactScore && (
                                        <span className={`text-xs font-bold font-display ${
                                          impactScore >= 8 ? "text-emerald-500" : impactScore >= 5 ? "text-amber-500" : "text-muted-foreground"
                                        }`}>
                                          {impactScore}/10
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
                                    <Badge variant="outline" className={`mt-2 text-[10px] ${conf.bg} ${conf.text} border-0 cursor-help`} title={conf.reason}>
                                      {conf.label}
                                    </Badge>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Risk Matrix */}
                {riskMatrix && <RiskRadar risks={riskMatrix} />}

                {/* Chance Quality (Event-basiert, ersetzt alte Chancen-Box wenn vorhanden) */}
                {chanceQuality ? (
                  <ChanceQualityPanel
                    data={chanceQuality}
                    homeName={clubName ?? "Heim"}
                    awayName={match.away_club_name ?? "Gast"}
                  />
                ) : (
                  /* Fallback: Danger Zones + altes Chancen-Layout */
                  (dangerZones || chances) && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {dangerZones && (
                        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                          <CardContent className="pt-5">
                            <div className="flex items-center gap-2 mb-3">
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                              <h3 className="font-medium text-sm">Gefährdungszonen</h3>
                            </div>
                            <div className="space-y-2">
                              <div>
                                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Eigene Angriffe</p>
                                <div className="flex gap-1.5 mt-1">
                                  {(dangerZones.data?.home_attack_zones ?? []).map((z: string) => (
                                    <Badge key={z} variant="secondary" className="capitalize">{z === "left" ? "Links" : z === "right" ? "Rechts" : "Zentrum"}</Badge>
                                  ))}
                                </div>
                              </div>
                              {dangerZones.data?.home_vulnerable_zones?.length > 0 && (
                                <div>
                                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground mt-2">Verwundbar</p>
                                  <div className="flex gap-1.5 mt-1">
                                    {dangerZones.data.home_vulnerable_zones.map((z: string) => (
                                      <Badge key={z} variant="outline" className="text-amber-500 border-amber-500/30">{z}</Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      {chances && (
                        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                          <CardContent className="pt-5">
                            <div className="flex items-center gap-2 mb-3">
                              <Target className="h-4 w-4 text-primary" />
                              <h3 className="font-medium text-sm">Chancen & Abschlüsse</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="rounded-lg bg-muted/30 p-2.5 text-center">
                                <p className="text-2xl font-bold font-display">{chances.data?.home_chances ?? "?"}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">Heim</p>
                              </div>
                              <div className="rounded-lg bg-muted/30 p-2.5 text-center">
                                <p className="text-2xl font-bold font-display">{chances.data?.away_chances ?? "?"}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">Gast</p>
                              </div>
                            </div>
                            {chances.data?.pattern_notes && (
                              <p className="text-xs text-muted-foreground mt-3">{chances.data.pattern_notes}</p>
                            )}
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )
                )}

                {/* Danger Zones zusätzlich, wenn ChanceQuality vorhanden ist */}
                {chanceQuality && dangerZones && (
                  <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                    <CardContent className="pt-5">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <h3 className="font-medium text-sm">Gefährdungszonen</h3>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Eigene Angriffe</p>
                          <div className="flex gap-1.5 mt-1 flex-wrap">
                            {(dangerZones.data?.home_attack_zones ?? []).map((z: string) => (
                              <Badge key={z} variant="secondary" className="capitalize">{z === "left" ? "Links" : z === "right" ? "Rechts" : "Zentrum"}</Badge>
                            ))}
                          </div>
                        </div>
                        {dangerZones.data?.home_vulnerable_zones?.length > 0 && (
                          <div>
                            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Verwundbar</p>
                            <div className="flex gap-1.5 mt-1 flex-wrap">
                              {dangerZones.data.home_vulnerable_zones.map((z: string) => (
                                <Badge key={z} variant="outline" className="text-amber-500 border-amber-500/30">{z}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Coaching Conclusions */}
                {coaching && (
                  <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 mb-3">
                        <ClipboardList className="h-5 w-5 text-primary" />
                        <h2 className="font-semibold font-display">Coaching-Schlussfolgerungen</h2>
                      </div>
                      <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{coaching.content}</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* ═══ TACTICS TAB — neu konzipiert ═══ */}
              <TabsContent value="tactics" className="space-y-4">
                {/* 1. Tactical Blueprint — die wichtigste Erkenntnis zuerst */}
                {tacticalBlueprint && Array.isArray(tacticalBlueprint) && (
                  <TacticalBlueprintBoard blocks={tacticalBlueprint} />
                )}

                {/* 2. Shape Recommendation für nächstes Match */}
                {shapeRecommendation && <ShapeRecommendationCard data={shapeRecommendation} />}

                {/* 3. Set Pieces */}
                {setPieceBreakdown && (
                  <SetPieceBreakdown
                    data={setPieceBreakdown}
                    homeName={clubName ?? "Heim"}
                    awayName={match.away_club_name ?? "Gast"}
                  />
                )}

                {/* 4. Tactical Grades (Schulnoten als sekundäre Sicht, klein) */}
                {tacticalGrades && (
                  <details className="group">
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-1 py-2">
                      <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                      Klassische Bewertungs-Matrix anzeigen
                    </summary>
                    <div className="mt-2">
                      <TacticalGradeMatrix grades={tacticalGrades} />
                    </div>
                  </details>
                )}

                {/* 5. KI-Gamechanger + Visualisierungen */}
                <div className="flex items-center gap-2 pt-2">
                  <div className="h-px flex-1 bg-border/50" />
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">KI-Gamechanger</span>
                  <div className="h-px flex-1 bg-border/50" />
                </div>

                {id && (
                  <Suspense fallback={<SkeletonCard count={1} />}>
                    <CoachingCockpit
                      matchId={id}
                      defaultMoment={match?.status === "complete" ? "fulltime" : "halftime"}
                    />
                  </Suspense>
                )}

                {id && (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Suspense fallback={<SkeletonCard count={1} />}>
                      <TacticalAIChat matchId={id} />
                    </Suspense>
                    <Suspense fallback={<SkeletonCard count={1} />}>
                      <HighlightStory matchId={id} />
                    </Suspense>
                  </div>
                )}

                {(hasHighlights || transitions?.data?.length > 0 || formationTimeline?.data?.length > 0) && (
                  <>
                    <div className="flex items-center gap-2 pt-2">
                      <div className="h-px flex-1 bg-border/50" />
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Visuelle Analysen</span>
                      <div className="h-px flex-1 bg-border/50" />
                    </div>
                    {hasHighlights && id && (
                      <Suspense fallback={<SkeletonCard count={1} />}>
                        <HighlightGallery matchId={id} />
                      </Suspense>
                    )}
                    {transitions?.data?.length > 0 && (
                      <Suspense fallback={<SkeletonCard count={1} />}>
                        <TransitionAnalysis data={transitions.data} intervalSec={framePositions?.data?.interval_sec ?? 30} />
                      </Suspense>
                    )}
                    {formationTimeline?.data?.length > 0 && (
                      <Suspense fallback={<SkeletonCard count={1} />}>
                        <FormationTimeline data={formationTimeline.data} />
                      </Suspense>
                    )}
                  </>
                )}

                {!tacticalBlueprint && !shapeRecommendation && !setPieceBreakdown && !tacticalGrades && !framePositions && !transitions && !formationTimeline && (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    Keine taktischen Daten verfügbar. Starte eine neue Analyse.
                  </div>
                )}
              </TabsContent>

              {/* ═══ PLAYERS TAB ═══ */}
              <TabsContent value="players" className="space-y-4">
                {/* AI Player Development Cards (neu, datenbasiert pro Spieler) */}
                {id && <PlayerDevelopmentCards matchId={id} />}

                {/* Player Spotlight (MVP/Sorgenspieler) — bleibt als Schnell-Übersicht */}
                {playerSpotlight?.mvp && playerSpotlight?.concern && (
                  <PlayerSpotlight mvp={playerSpotlight.mvp} concern={playerSpotlight.concern} />
                )}

                {/* Fatigue */}
                {framePositions?.data?.frames?.length >= 4 && (
                  <Suspense fallback={<SkeletonCard count={1} />}>
                    <FatigueIndicator frames={framePositions.data.frames} intervalSec={framePositions.data.interval_sec ?? 30} />
                  </Suspense>
                )}
              </TabsContent>

              {/* ═══ OPPONENT TAB ═══ */}
              <TabsContent value="opponent" className="space-y-4">
                {/* Opponent DNA */}
                {opponentDna && (
                  <OpponentDNA dna={opponentDna} actions={nextMatchActions ?? undefined} />
                )}

                {/* Opponent Scouting */}
                {opponentScouting && (() => {
                  try {
                    const scoutData = JSON.parse(opponentScouting.content);
                    return (
                      <Suspense fallback={<SkeletonCard count={1} />}>
                        <OpponentScoutReport data={scoutData} />
                      </Suspense>
                    );
                  } catch { return null; }
                })()}

                {/* Opponent History */}
                {opponentProfile && opponentProfile.matchCount >= 1 && (
                  <Suspense fallback={<SkeletonCard count={1} />}>
                    <OpponentHistoryProfile profile={opponentProfile} />
                  </Suspense>
                )}

                {!opponentDna && !opponentScouting && !opponentProfile && (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    Keine Gegner-Daten verfügbar.
                  </div>
                )}
              </TabsContent>

              {/* ═══ TRAINING TAB ═══ */}
              <TabsContent value="training" className="space-y-4">
                {/* Training Micro-Cycle */}
                {trainingMicroCycle && <TrainingMicroCycle sessions={trainingMicroCycle} />}

                {/* Legacy Training Recommendations */}
                {training.length > 0 && !trainingMicroCycle && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-primary" />
                      <h2 className="font-semibold font-display">Trainingsempfehlungen</h2>
                    </div>
                    {training.map((rec) => {
                      const Icon = CATEGORY_ICONS[rec.category] ?? Zap;
                      return (
                        <Card key={rec.id} className="border-border/50 bg-card/80 backdrop-blur-sm">
                          <CardContent className="pt-5">
                            <div className="flex items-start gap-3">
                              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${rec.priority === 1 ? "bg-primary/15" : "bg-muted"}`}>
                                <Icon className={`h-4 w-4 ${rec.priority === 1 ? "text-primary" : "text-muted-foreground"}`} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-medium text-sm">{rec.title}</h3>
                                  {rec.priority === 1 && (
                                    <Badge className="bg-primary/10 text-primary border-0 text-[10px]">Priorität</Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{rec.description}</p>
                                {rec.linked_pattern && (
                                  <p className="text-[10px] text-muted-foreground/70 mt-2 flex items-center gap-1">
                                    <ChevronRight className="h-3 w-3" />
                                    Basiert auf: {rec.linked_pattern}
                                  </p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {!trainingMicroCycle && training.length === 0 && (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    Keine Trainingsempfehlungen verfügbar.
                  </div>
                )}
              </TabsContent>

              {/* ═══ PRESS TAB — Vor- & Nachbericht ═══ */}
              <TabsContent value="press" className="space-y-4">
                {id && (
                  <PressReleaseGenerator
                    matchId={id}
                    matchStatus={match?.status ?? "setup"}
                    homeTeam={(match as any)?.home_club?.name}
                    awayTeam={match?.away_club_name ?? undefined}
                  />
                )}
              </TabsContent>
            </Tabs>

            {/* Confidence disclaimer */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4 text-center">
              <p className="text-xs text-muted-foreground">
                Diese Analyse basiert auf KI-gestützter Video-Auswertung. Alle Erkenntnisse sind als Coaching-Hilfe gedacht,
                nicht als exakte Messwerte. Vertraue deiner Erfahrung als Trainer.
              </p>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
