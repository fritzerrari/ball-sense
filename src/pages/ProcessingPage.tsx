import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Loader2, Upload, Brain, Lightbulb, ClipboardList, ArrowRight, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STAGES = [
  { key: "uploaded", label: "Frames empfangen", icon: Upload },
  { key: "analyzing", label: "Spielstruktur analysieren", icon: Brain },
  { key: "interpreting", label: "Coaching-Insights generieren", icon: Lightbulb },
  { key: "complete", label: "Report erstellen", icon: ClipboardList },
] as const;

type JobStatus = "queued" | "analyzing" | "interpreting" | "complete" | "failed" | "cancelled";

const ACTIVE_JOB_STATUSES: JobStatus[] = ["queued", "analyzing", "interpreting"];
const TERMINAL_JOB_STATUSES: JobStatus[] = ["complete", "failed", "cancelled"];

export default function ProcessingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<JobStatus>("queued");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [jobStartedAt, setJobStartedAt] = useState<number | null>(null);
  const [showSlowBanner, setShowSlowBanner] = useState(false);
  const [frameDiagnostics, setFrameDiagnostics] = useState<{
    total: number; cameras: number; recordingMin: number | null;
  } | null>(null);

  // Poll-only: no client-side triggering of generate-insights (server handles it)
  useEffect(() => {
    if (!id) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("analysis_jobs")
        .select("id, status, progress, error_message, job_kind")
        .eq("match_id", id)
        .eq("job_kind", "final")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        const nextStatus = data.status as JobStatus;
        setStatus(nextStatus);
        setProgress(data.progress ?? 0);
        setErrorMessage(data.error_message ?? null);
        if (TERMINAL_JOB_STATUSES.includes(nextStatus)) clearInterval(interval);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [id]);

  // Load frame diagnostics when analysis fails so the user gets a meaningful explanation
  useEffect(() => {
    if (status !== "failed" || !id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camera-ops`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ action: "list-coverage", match_id: id }),
          },
        );
        if (!res.ok) return;
        const cov = await res.json();
        if (cancelled) return;
        const cams = Array.isArray(cov?.cameras) ? cov.cameras : [];
        const total = cams.reduce((s: number, c: { frame_count?: number }) => s + (c.frame_count ?? 0), 0);
        let recordingMin: number | null = null;
        if (cov?.recording_started_at && cov?.recording_ended_at) {
          const ms = new Date(cov.recording_ended_at).getTime() - new Date(cov.recording_started_at).getTime();
          if (ms > 0) recordingMin = Math.round(ms / 60000);
        }
        setFrameDiagnostics({ total, cameras: cams.length, recordingMin });
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [status, id]);

  const handleRetry = async () => {
    if (!id) return;
    setRetrying(true);
    try {
      // Check if there's already an active final job
      const { data: activeJob } = await supabase
        .from("analysis_jobs")
        .select("id, status")
        .eq("match_id", id)
        .eq("job_kind", "final")
        .in("status", ACTIVE_JOB_STATUSES)
        .maybeSingle();

      if (activeJob) {
        toast.info("Analyse läuft bereits…");
        setStatus(activeJob.status as JobStatus);
        setRetrying(false);
        return;
      }

      // Create new job
      const { data: newJob, error: jobError } = await supabase.from("analysis_jobs").insert({
        match_id: id,
        status: "queued",
        progress: 0,
        job_kind: "final",
      }).select().single();
      if (jobError) throw jobError;

      await supabase.from("matches").update({ status: "processing" }).eq("id", id);

      // Trigger analyze-match WITHOUT frames — edge function loads from storage
      const { error: fnError } = await supabase.functions.invoke("analyze-match", {
        body: { match_id: id, job_id: newJob.id },
      });
      if (fnError) console.error("retry analyze-match error:", fnError);

      setStatus("queued");
      setProgress(0);
      setErrorMessage(null);
      toast.info("Analyse wird erneut gestartet…");
    } catch {
      toast.error("Retry fehlgeschlagen");
    } finally {
      setRetrying(false);
    }
  };

  const currentStageIndex = STAGES.findIndex(s => s.key === status);
  const isComplete = status === "complete";
  const isFailed = status === "failed" || status === "cancelled";
  const statusHeading = isComplete
    ? "Analyse abgeschlossen"
    : isFailed
      ? "Analyse fehlgeschlagen"
      : "Analyse läuft";
  const statusDescription = isComplete
    ? "Dein Spielbericht ist fertig."
    : isFailed
      ? "Es gab ein Problem bei der Analyse."
      : "Dein Spielbericht wird automatisch erstellt.";

  return (
    <AppLayout>
      <div className="mx-auto max-w-xl py-12">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-display font-bold">{statusHeading}</h1>
          <p className="text-muted-foreground mt-2">{statusDescription}</p>
        </div>

        <Card className="border-border bg-card">
          <CardContent className="pt-6 space-y-6">
            {STAGES.map((stage, i) => {
              const done = i < currentStageIndex || isComplete;
              const active = i === currentStageIndex && !isComplete && !isFailed;
              const Icon = stage.icon;
              return (
                <div key={stage.key} className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                    done ? "border-primary bg-primary text-primary-foreground" :
                    active ? "border-primary bg-primary/10 text-primary" :
                    "border-muted bg-muted/30 text-muted-foreground"
                  }`}>
                    {done ? <CheckCircle2 className="h-5 w-5" /> :
                     active ? <Loader2 className="h-5 w-5 animate-spin" /> :
                     <Icon className="h-5 w-5" />}
                  </div>
                  <span className={`text-sm font-medium ${done ? "text-foreground" : active ? "text-primary" : "text-muted-foreground"}`}>
                    {stage.label}
                  </span>
                </div>
              );
            })}

            {!isComplete && !isFailed && (
              <Progress value={progress} className="mt-4" />
            )}

            {isFailed && (
              <div className="space-y-3">
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
                  <p className="text-sm text-destructive font-medium text-center">
                    {errorMessage || "Analyse fehlgeschlagen. Bitte versuche es erneut."}
                  </p>
                </div>

                {frameDiagnostics && (
                  <div className="rounded-lg bg-muted/40 border border-border p-4 space-y-2">
                    <p className="text-xs font-semibold text-foreground">Diagnose</p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">Frames</div>
                        <div className="font-semibold">{frameDiagnostics.total}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Kameras</div>
                        <div className="font-semibold">{frameDiagnostics.cameras}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Aufnahme</div>
                        <div className="font-semibold">{frameDiagnostics.recordingMin != null ? `${frameDiagnostics.recordingMin} min` : "—"}</div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1 border-t border-border">
                      {(() => {
                        const { total, cameras, recordingMin } = frameDiagnostics;
                        if (total === 0) return "Keine Frames empfangen — die Kamera hat vermutlich keine Daten hochgeladen. Prüfe Internetverbindung & Kamera-Setup.";
                        if (total < 15) return `Zu wenige Frames (${total}) für eine zuverlässige Analyse. Empfohlen: mindestens 15 Frames pro Halbzeit. Bitte länger aufnehmen oder Kamera-Setup prüfen.`;
                        if (cameras === 0) return "Keine aktive Kamera erkannt. Stelle sicher, dass mindestens ein Gerät während des Spiels aufgenommen hat.";
                        if (recordingMin != null && recordingMin < 5) return `Aufnahmedauer (${recordingMin} min) zu kurz für eine vollständige Spielanalyse.`;
                        return "Daten sind vorhanden — der Fehler liegt wahrscheinlich an einem temporären KI-Gateway-Problem. Erneut versuchen sollte funktionieren.";
                      })()}
                    </p>
                  </div>
                )}

                <Button onClick={handleRetry} disabled={retrying} variant="outline" className="w-full gap-2">
                  {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Erneut versuchen
                </Button>
                <Button onClick={() => navigate(`/matches/${id}`)} variant="ghost" className="w-full text-xs">
                  Zum Match-Bericht (manuell prüfen)
                </Button>
              </div>
            )}

            {isComplete && (
              <Button onClick={() => navigate(`/matches/${id}`)} className="w-full gap-2">
                Report ansehen <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
