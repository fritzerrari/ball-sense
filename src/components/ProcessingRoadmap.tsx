import { useState, useEffect, useMemo, useCallback } from "react";
import { CheckCircle2, Circle, Loader2, Clock, Cpu, Users, BarChart3, Grid3X3, Sparkles, RefreshCw, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProcessingPhase {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  durationMin: number; // estimated minutes
}

const PHASES: ProcessingPhase[] = [
  { key: "upload", label: "Upload empfangen", description: "Videodaten wurden erfolgreich übertragen", icon: <CheckCircle2 className="h-4 w-4" />, durationMin: 0 },
  { key: "detection", label: "Spielererkennung", description: "KI identifiziert Spieler in jedem Frame", icon: <Users className="h-4 w-4" />, durationMin: 3 },
  { key: "tracking", label: "Positionsverfolgung", description: "Laufwege und Bewegungsmuster werden berechnet", icon: <Cpu className="h-4 w-4" />, durationMin: 4 },
  { key: "stats", label: "Statistik-Berechnung", description: "Distanz, Geschwindigkeit, Sprints & Metriken", icon: <BarChart3 className="h-4 w-4" />, durationMin: 2 },
  { key: "heatmaps", label: "Heatmaps & Analyse", description: "Formations-Heatmaps und taktische Auswertung", icon: <Grid3X3 className="h-4 w-4" />, durationMin: 1 },
  { key: "finalize", label: "Fertigstellung", description: "Datenvalidierung und Qualitätsprüfung", icon: <Sparkles className="h-4 w-4" />, durationMin: 1 },
];

const TOTAL_ESTIMATED_MIN = PHASES.reduce((sum, p) => sum + p.durationMin, 0);

interface ProcessingRoadmapProps {
  matchId: string;
  matchCreatedAt?: string;
  uploadCount?: number;
}

interface ProcessingProgress {
  phase: string;
  progress: number;
  detail: string | null;
  updated_at: string;
}

export function ProcessingRoadmap({ matchId, matchCreatedAt, uploadCount = 1 }: ProcessingRoadmapProps) {
  const [elapsed, setElapsed] = useState(0);
  const [dbProgress, setDbProgress] = useState<ProcessingProgress | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Tick every second for elapsed counter
  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Poll DB for real progress every 3 seconds
  useEffect(() => {
    if (!matchId) return;
    const poll = async () => {
      const { data } = await supabase
        .from("matches")
        .select("processing_progress, status")
        .eq("id", matchId)
        .single();
      if (data && (data as any).processing_progress) {
        setDbProgress((data as any).processing_progress as ProcessingProgress);
      }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [matchId]);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      const { error } = await supabase.functions.invoke("process-tracking", {
        body: { matchId, action: "retry" },
      });
      if (!error) {
        toast.success("Verarbeitung wird erneut gestartet");
        setDbProgress({ phase: "upload", progress: 0, detail: "Erneut gestartet", updated_at: new Date().toISOString() });
        setElapsed(0);
      } else {
        toast.error("Retry fehlgeschlagen");
      }
    } catch {
      toast.error("Verbindungsfehler");
    } finally {
      setIsRetrying(false);
    }
  }, [matchId]);

  // Use DB progress if available, otherwise fall back to time-based estimation
  const { currentPhaseIndex, phaseProgress, overallProgress, estimatedEnd, isError, isComplete } = useMemo(() => {
    const phaseKeys = PHASES.map(p => p.key);

    if (dbProgress) {
      if (dbProgress.phase === "error") {
        return { currentPhaseIndex: 0, phaseProgress: 0, overallProgress: 0, estimatedEnd: new Date(), isError: true, isComplete: false };
      }
      if (dbProgress.phase === "complete") {
        return { currentPhaseIndex: PHASES.length - 1, phaseProgress: 100, overallProgress: 100, estimatedEnd: new Date(), isError: false, isComplete: true };
      }

      const phaseIdx = Math.max(0, phaseKeys.indexOf(dbProgress.phase));
      const phaseProg = Math.min(100, ((dbProgress.progress - (phaseIdx > 0 ? phaseIdx * 15 : 0)) / 15) * 100);
      const remaining = Math.max(0, (100 - dbProgress.progress) / 100 * TOTAL_ESTIMATED_MIN * 60);

      return {
        currentPhaseIndex: phaseIdx,
        phaseProgress: Math.max(0, Math.min(100, phaseProg)),
        overallProgress: dbProgress.progress,
        estimatedEnd: new Date(Date.now() + remaining * 1000),
        isError: false,
        isComplete: false,
      };
    }

    // Fallback: time-based
    const totalSec = TOTAL_ESTIMATED_MIN * 60 * Math.max(1, uploadCount * 0.7);
    const progress = Math.min((elapsed / totalSec) * 100, 95);
    let accumulated = 0, phaseIdx = 0, phaseProg = 100;
    const cameraMultiplier = Math.max(1, uploadCount * 0.7);
    for (let i = 0; i < PHASES.length; i++) {
      const phaseSec = PHASES[i].durationMin * 60 * cameraMultiplier;
      if (elapsed < accumulated + phaseSec) { phaseIdx = i; phaseProg = phaseSec > 0 ? Math.min(((elapsed - accumulated) / phaseSec) * 100, 100) : 100; break; }
      accumulated += phaseSec;
      if (i === PHASES.length - 1) { phaseIdx = i; phaseProg = 95; }
    }
    const remainingSec = Math.max(0, totalSec - elapsed);

    return {
      currentPhaseIndex: phaseIdx, phaseProgress: phaseProg, overallProgress: progress,
      estimatedEnd: new Date(Date.now() + remainingSec * 1000), isError: false, isComplete: false,
    };
  }, [elapsed, uploadCount, dbProgress]);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

  const formatRemaining = () => {
    if (isComplete) return "Fertig!";
    if (isError) return "Fehler";
    const totalSec = TOTAL_ESTIMATED_MIN * 60 * Math.max(1, uploadCount * 0.7);
    const remaining = dbProgress
      ? Math.max(0, (100 - (dbProgress.progress || 0)) / 100 * totalSec)
      : Math.max(0, totalSec - elapsed);
    const mins = Math.floor(remaining / 60);
    const secs = Math.floor(remaining % 60);
    if (mins > 0) return `~${mins} Min ${secs > 0 ? `${secs}s` : ""} verbleibend`;
    return secs > 0 ? `~${secs}s verbleibend` : "Fast fertig...";
  };


  if (isComplete) {
    return (
      <div className="glass-card p-5 sm:p-6 glow-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <CheckCircle2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold font-display">Verarbeitung abgeschlossen</h3>
            <p className="text-xs text-muted-foreground">Alle Daten wurden erfolgreich analysiert.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card space-y-5 p-5 sm:p-6 glow-border">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          {isError ? <AlertTriangle className="h-5 w-5 text-destructive" /> : <Loader2 className="h-5 w-5 animate-spin text-primary" />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold font-display">{isError ? "Verarbeitung fehlgeschlagen" : "KI-Analyse läuft"}</h3>
          <p className="text-xs text-muted-foreground">
            {isError
              ? (dbProgress?.detail || "Ein Fehler ist aufgetreten")
              : uploadCount > 1
              ? `${uploadCount} Kamera-Uploads werden parallel verarbeitet`
              : "Tracking-Daten werden analysiert und aufbereitet"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isError && (
            <Button variant="outline" size="sm" onClick={handleRetry} disabled={isRetrying}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isRetrying ? "animate-spin" : ""}`} />
              Erneut versuchen
            </Button>
          )}
          {!isError && (
            <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <Clock className="h-3 w-3" />
              {formatRemaining()}
            </div>
          )}

      {/* Detail from DB */}
      {dbProgress?.detail && !isError && (
        <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
          {dbProgress.detail}
        </div>
      )}
        </div>
      </div>

      {/* Overall progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-foreground">Gesamtfortschritt</span>
          <span className="text-muted-foreground">{Math.round(overallProgress)}%</span>
        </div>
        <Progress value={overallProgress} className="h-2.5" />
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Geschätzte Fertigstellung: <span className="font-medium text-foreground">{formatTime(estimatedEnd)}</span></span>
          <span>{Math.floor(elapsed / 60)}:{String(Math.floor(elapsed % 60)).padStart(2, "0")} vergangen</span>
        </div>
      </div>

      {/* Phase timeline */}
      <div className="space-y-0">
        {PHASES.map((phase, i) => {
          const isDone = i < currentPhaseIndex;
          const isCurrent = i === currentPhaseIndex;
          const isPending = i > currentPhaseIndex;

          return (
            <div key={phase.key} className="flex gap-3">
              {/* Vertical line connector */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all ${
                    isDone
                      ? "bg-primary/15 text-primary"
                      : isCurrent
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : isCurrent ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Circle className="h-3.5 w-3.5" />
                  )}
                </div>
                {i < PHASES.length - 1 && (
                  <div
                    className={`w-0.5 flex-1 min-h-[16px] transition-colors ${
                      isDone ? "bg-primary/30" : "bg-border"
                    }`}
                  />
                )}
              </div>

              {/* Phase content */}
              <div className={`pb-4 pt-0.5 min-w-0 flex-1 ${isPending ? "opacity-50" : ""}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${isCurrent ? "text-primary" : isDone ? "text-foreground" : "text-muted-foreground"}`}>
                    {phase.label}
                  </span>
                  {isCurrent && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      Aktiv
                    </span>
                  )}
                  {isDone && (
                    <span className="text-[10px] text-muted-foreground">✓</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{phase.description}</p>
                {isCurrent && (
                  <div className="mt-1.5">
                    <Progress value={phaseProgress} className="h-1.5" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
