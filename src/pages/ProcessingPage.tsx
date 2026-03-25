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

type JobStatus = "queued" | "analyzing" | "interpreting" | "complete" | "failed";

export default function ProcessingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<JobStatus>("queued");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!id) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("analysis_jobs")
        .select("status, progress, error_message")
        .eq("match_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setStatus(data.status as JobStatus);
        setProgress(data.progress ?? 0);
        if (data.error_message) setErrorMessage(data.error_message);
        if (data.status === "complete" || data.status === "failed") clearInterval(interval);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [id]);

  const handleRetry = async () => {
    if (!id) return;
    setRetrying(true);
    try {
      // Get the latest job
      const { data: job } = await supabase
        .from("analysis_jobs")
        .select("id")
        .eq("match_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (job) {
        // Reset job status
        await supabase.from("analysis_jobs").update({
          status: "queued",
          progress: 0,
          error_message: null,
          started_at: null,
        }).eq("id", job.id);

        setStatus("queued");
        setProgress(0);
        setErrorMessage(null);
        toast.info("Analyse wird erneut gestartet…");
      }
    } catch {
      toast.error("Retry fehlgeschlagen");
    } finally {
      setRetrying(false);
    }
  };

  const currentStageIndex = STAGES.findIndex(s => s.key === status);
  const isComplete = status === "complete";
  const isFailed = status === "failed";

  return (
    <AppLayout>
      <div className="mx-auto max-w-xl py-12">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-display font-bold">
            {isComplete ? "Analyse abgeschlossen" : isFailed ? "Analyse fehlgeschlagen" : "Analyse läuft"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isComplete ? "Dein Spielbericht ist fertig." :
             isFailed ? "Es gab ein Problem bei der Analyse." :
             "Dein Spielbericht wird automatisch erstellt."}
          </p>
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
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-center">
                  <p className="text-sm text-destructive font-medium">
                    {errorMessage || "Analyse fehlgeschlagen. Bitte versuche es erneut."}
                  </p>
                </div>
                <Button onClick={handleRetry} disabled={retrying} variant="outline" className="w-full gap-2">
                  {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Erneut versuchen
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
