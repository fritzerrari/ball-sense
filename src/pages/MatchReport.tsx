import AppLayout from "@/components/AppLayout";
import { useParams, Link } from "react-router-dom";
import { useState, useEffect, lazy, Suspense } from "react";
import {
  ArrowLeft, Brain, Lightbulb, Target, Shield, Zap,
  ClipboardList, AlertTriangle, TrendingUp, Calendar,
  Loader2, RefreshCw, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMatch } from "@/hooks/use-matches";
import { useAuth } from "@/components/AuthProvider";
import { SkeletonCard } from "@/components/SkeletonCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TacticalReplay = lazy(() => import("@/components/TacticalReplay"));

const CATEGORY_ICONS: Record<string, typeof Target> = {
  offense: Target,
  defense: Shield,
  transition: Zap,
  set_piece: TrendingUp,
  general: Lightbulb,
};

const CATEGORY_LABELS: Record<string, string> = {
  offense: "Angriff",
  defense: "Verteidigung",
  transition: "Umschaltspiel",
  set_piece: "Standards",
  general: "Allgemein",
};

const CONFIDENCE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: "bg-emerald-500/10", text: "text-emerald-500", label: "Belastbar" },
  medium: { bg: "bg-amber-500/10", text: "text-amber-500", label: "Eingeschränkt" },
  estimated: { bg: "bg-orange-500/10", text: "text-orange-500", label: "Geschätzt" },
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
  progress: number;
}

export default function MatchReport() {
  const { id } = useParams();
  const { clubName } = useAuth();
  const { data: match, isLoading } = useMatch(id);

  const [sections, setSections] = useState<ReportSection[]>([]);
  const [training, setTraining] = useState<TrainingRec[]>([]);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [loadingReport, setLoadingReport] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadReportData();
    // Poll if not complete
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("analysis_jobs")
        .select("id, status, progress")
        .eq("match_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setJob(data);
        if (data.status === "complete") {
          clearInterval(interval);
          loadReportData();
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [id]);

  const loadReportData = async () => {
    if (!id) return;
    setLoadingReport(true);

    const [sectionsRes, trainingRes, resultsRes, jobRes] = await Promise.all([
      supabase.from("report_sections").select("*").eq("match_id", id).order("sort_order"),
      supabase.from("training_recommendations").select("*").eq("match_id", id).order("priority"),
      supabase.from("analysis_results").select("*").eq("match_id", id),
      supabase.from("analysis_jobs").select("id, status, progress").eq("match_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    setSections(sectionsRes.data ?? []);
    setTraining(trainingRes.data ?? []);
    setAnalysisResults(resultsRes.data ?? []);
    setJob(jobRes.data ?? null);
    setLoadingReport(false);
  };

  const handleReprocess = async () => {
    if (!id) return;
    setReprocessing(true);
    try {
      const { data: newJob, error } = await supabase.from("analysis_jobs").insert({
        match_id: id,
        status: "queued",
        progress: 0,
      }).select().single();
      if (error) throw error;

      await supabase.from("matches").update({ status: "processing" }).eq("id", id);

      // Trigger analysis — frames will be loaded from storage by the edge function
      await supabase.functions.invoke("analyze-match", {
        body: { match_id: id, job_id: newJob.id },
      });
      toast.success("Neue Analyse gestartet!");
    } catch (err: any) {
      toast.error(err.message ?? "Fehler");
    } finally {
      setReprocessing(false);
    }
  };

  if (isLoading) return <AppLayout><div className="mx-auto max-w-4xl"><SkeletonCard count={3} /></div></AppLayout>;
  if (!match) return <AppLayout><div className="mx-auto max-w-4xl py-20 text-center text-muted-foreground">Spiel nicht gefunden</div></AppLayout>;

  const summary = sections.find(s => s.section_type === "summary");
  const insights = sections.filter(s => s.section_type === "insight");
  const coaching = sections.find(s => s.section_type === "coaching");
  const dangerZones = analysisResults.find(r => r.result_type === "danger_zones");
  const chances = analysisResults.find(r => r.result_type === "chances");
  const matchStructure = analysisResults.find(r => r.result_type === "match_structure");
  const isProcessing = job?.status && !["complete", "failed"].includes(job.status);
  const hasReport = sections.length > 0;

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/matches" className="rounded-lg p-2 transition-colors hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold font-display truncate">
              {clubName} vs {match.away_club_name || "Gegner"}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(match.date).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              {match.kickoff && <span>· {match.kickoff}</span>}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReprocess}
            disabled={reprocessing || isProcessing}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${reprocessing ? "animate-spin" : ""}`} />
            Neu analysieren
          </Button>
        </div>

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

        {/* Report content */}
        {hasReport && (
          <>
            {/* Executive Summary */}
            {summary && (
              <Card className="relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary to-primary/50" />
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold font-display text-lg">Zusammenfassung</h2>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">{summary.content}</p>
                </CardContent>
              </Card>
            )}

            {/* Match Structure */}
            {matchStructure && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold font-display">Spielverlauf</h2>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 mb-4">
                    <div className="rounded-xl border border-border bg-muted/30 p-3">
                      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Dominanz</p>
                      <p className="text-lg font-bold font-display mt-1 capitalize">
                        {matchStructure.data?.dominant_team === "home" ? "Heim" :
                         matchStructure.data?.dominant_team === "away" ? "Auswärts" : "Ausgeglichen"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/30 p-3">
                      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Tempo</p>
                      <p className="text-lg font-bold font-display mt-1 capitalize">
                        {matchStructure.data?.tempo === "high" ? "Hoch" :
                         matchStructure.data?.tempo === "medium" ? "Mittel" : "Niedrig"}
                      </p>
                    </div>
                  </div>
                  {matchStructure.data?.phases?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">Phasen</p>
                      {matchStructure.data.phases.map((phase: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 rounded-lg border border-border/50 p-3">
                          <div className={`mt-0.5 h-2.5 w-2.5 rounded-full shrink-0 ${
                            phase.momentum === "home" ? "bg-primary" :
                            phase.momentum === "away" ? "bg-destructive" : "bg-muted-foreground"
                          }`} />
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">{phase.period}</p>
                            <p className="text-sm">{phase.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <ConfidenceBadge confidence={matchStructure.confidence} />
                </CardContent>
              </Card>
            )}

            {/* Key Insights */}
            {insights.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  <h2 className="font-semibold font-display">Coaching-Insights</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {insights.map((ins) => {
                    const Icon = CATEGORY_ICONS[ins.title?.toLowerCase().includes("verteidigung") ? "defense" : "offense"] ?? Lightbulb;
                    const conf = CONFIDENCE_STYLES[ins.confidence] ?? CONFIDENCE_STYLES.medium;
                    return (
                      <Card key={ins.id} className="relative overflow-hidden">
                        <CardContent className="pt-5">
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                              <Icon className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-medium text-sm">{ins.title}</h3>
                              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{ins.content}</p>
                              <Badge variant="outline" className={`mt-2 text-[10px] ${conf.bg} ${conf.text} border-0`}>
                                {conf.label}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Danger Zones + Chances */}
            {(dangerZones || chances) && (
              <div className="grid gap-4 sm:grid-cols-2">
                {dangerZones && (
                  <Card>
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
                  <Card>
                    <CardContent className="pt-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Target className="h-4 w-4 text-primary" />
                        <h3 className="font-medium text-sm">Chancen & Abschlüsse</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-muted/30 p-2.5 text-center">
                          <p className="text-2xl font-bold font-display">{chances.data?.home_chances ?? "?"}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">Heim Chancen</p>
                        </div>
                        <div className="rounded-lg bg-muted/30 p-2.5 text-center">
                          <p className="text-2xl font-bold font-display">{chances.data?.away_chances ?? "?"}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">Gast Chancen</p>
                        </div>
                      </div>
                      {chances.data?.pattern_notes && (
                        <p className="text-xs text-muted-foreground mt-3">{chances.data.pattern_notes}</p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Coaching Conclusions */}
            {coaching && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <ClipboardList className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold font-display">Coaching-Schlussfolgerungen</h2>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{coaching.content}</p>
                </CardContent>
              </Card>
            )}

            {/* Training Recommendations */}
            {training.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  <h2 className="font-semibold font-display">Trainingsempfehlungen</h2>
                </div>
                {training.map((rec) => {
                  const Icon = CATEGORY_ICONS[rec.category] ?? Zap;
                  return (
                    <Card key={rec.id}>
                      <CardContent className="pt-5">
                        <div className="flex items-start gap-3">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                            rec.priority === 1 ? "bg-primary/15" : "bg-muted"
                          }`}>
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
                            <Badge variant="outline" className="mt-2 text-[10px]">
                              {CATEGORY_LABELS[rec.category] ?? rec.category}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

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

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const level = confidence >= 0.7 ? "high" : confidence >= 0.4 ? "medium" : "estimated";
  const style = CONFIDENCE_STYLES[level];
  return (
    <div className="mt-3 flex justify-end">
      <Badge variant="outline" className={`text-[10px] ${style.bg} ${style.text} border-0`}>
        Konfidenz: {Math.round(confidence * 100)}% — {style.label}
      </Badge>
    </div>
  );
}
