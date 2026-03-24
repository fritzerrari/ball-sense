import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, Loader2, Copy, X, Dumbbell, Activity, Trash2, Clock, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import {
  useLatestAiReport,
  useSaveAiReport,
  useDeleteAiReport,
  usePollAiReport,
  useQueuePosition,
} from "@/hooks/use-ai-reports";

const PROCESS_QUEUE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-ai-queue`;

interface Props {
  type: "player" | "team";
  playerId?: string;
  matchId?: string;
  playerName?: string;
}

export function PerformanceAnalysis({ type, playerId, matchId, playerName }: Props) {
  const { user, isSuperAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"analysis" | "training">("analysis");
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  const reportType = mode === "training" ? "training" : type === "team" ? "team" : "analysis";
  const { data: savedReport, isLoading: loadingReport } = useLatestAiReport(reportType, playerId, matchId);
  const saveMutation = useSaveAiReport();
  const deleteMutation = useDeleteAiReport();

  // Poll active report for live updates
  const { data: polledReport } = usePollAiReport(activeReportId);
  const isActive = polledReport?.status === "queued" || polledReport?.status === "generating";
  const { data: queueInfo } = useQueuePosition(
    isActive ? activeReportId : null,
    isActive ? polledReport?.created_at ?? null : null
  );

  // Show saved report on mount
  useEffect(() => {
    if (savedReport && !activeReportId) {
      setIsOpen(true);
      setMode(savedReport.report_type === "training" ? "training" : "analysis");
      setActiveReportId(savedReport.id);
    }
  }, [savedReport?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerQueueProcessing = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      await fetch(PROCESS_QUEUE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
    } catch { /* ignore trigger errors */ }
  }, []);

  const generate = async (genMode: "analysis" | "training" = "analysis", depth: "quick" | "deep" = "quick") => {
    if (!user) { toast.error("Bitte erneut anmelden."); return; }

    setIsOpen(true);
    setMode(genMode);

    const rType = genMode === "training" ? "training" : type === "team" ? "team" : "analysis";

    try {
      const id = await saveMutation.mutateAsync({
        user_id: user.id,
        match_id: matchId,
        player_id: playerId,
        report_type: rType,
        content: "",
        status: "queued",
        depth,
      });
      setActiveReportId(id);
      toast.success(depth === "quick" ? "Schnell-Analyse gestartet" : "Tiefenanalyse in die Warteschlange eingereiht");

      // Trigger background processing
      triggerQueueProcessing();
    } catch {
      toast.error("Konnte Analyse nicht starten");
    }
  };

  const handleCancel = async () => {
    if (!activeReportId) return;
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      await fetch(PROCESS_QUEUE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "cancel", reportId: activeReportId }),
      });
      toast.success("Analyse abgebrochen");
    } catch {
      toast.error("Abbrechen fehlgeschlagen");
    }
  };

  const handleDelete = async () => {
    if (activeReportId) {
      deleteMutation.mutate(activeReportId);
    }
    setActiveReportId(null);
    setIsOpen(false);
  };

  // Determine display content
  const displayReport = polledReport ?? savedReport;
  const content = displayReport?.content || "";
  const status = displayReport?.status || "";
  const isGenerating = status === "generating";
  const isQueued = status === "queued";
  const isProcessing = isQueued || isGenerating;

  const title = mode === "training" ? "KI-Trainingsplan" : "KI-Leistungsanalyse";
  const subtitle = mode === "training"
    ? "Positionsspezifische Maßnahmen, Belastungssteuerung und konkrete Wochenplanung."
    : "Moderne Leistungsdiagnostik mit Physis, Ballarbeit, Duellen, Offensive und Disziplin.";

  if (loadingReport) return null;

  return (
    <div>
      {!isOpen ? (
        <div className="flex gap-2 flex-wrap">
          <Button variant="heroOutline" size="sm" onClick={() => generate("analysis", "quick")} disabled={isProcessing}>
            <Sparkles className="h-4 w-4 mr-1" />
            Schnell-Analyse {playerName ? `für ${playerName}` : ""}
          </Button>
          <Button variant="outline" size="sm" onClick={() => generate("analysis", "deep")} disabled={isProcessing}>
            <Activity className="h-4 w-4 mr-1" />
            Tiefenanalyse
          </Button>
          {type === "player" && (
            <Button variant="heroOutline" size="sm" onClick={() => generate("training", "quick")} disabled={isProcessing}>
              <Dumbbell className="h-4 w-4 mr-1" />
              Trainingsplan
            </Button>
          )}
        </div>
      ) : (
        <div className="glass-card p-5 sm:p-6 space-y-5 overflow-hidden relative">
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-primary/10 via-accent/10 to-transparent pointer-events-none" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-[0.18em]">
                {mode === "training" ? <Dumbbell className="h-3.5 w-3.5 text-primary" /> : <Activity className="h-3.5 w-3.5 text-primary" />}
                {mode === "training" ? "Coach Mode" : "Match Intelligence"}
              </div>
              <div>
                <h3 className="font-semibold font-display flex items-center gap-2 text-lg">
                  {mode === "training" ? <Dumbbell className="h-4 w-4 text-primary" /> : <Sparkles className="h-4 w-4 text-primary" />}
                  {title} {playerName && `— ${playerName}`}
                </h3>
                <p className="text-sm text-muted-foreground max-w-2xl">{subtitle}</p>
              </div>
            </div>

            <div className="flex gap-2 shrink-0">
              {isProcessing && isSuperAdmin ? (
                <Button variant="ghost" size="sm" onClick={handleCancel} title="Abbrechen (Admin)">
                  <Ban className="h-4 w-4" />
                </Button>
              ) : null}
              {!isProcessing && (
                <>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => { navigator.clipboard.writeText(content); toast.success("Kopiert!"); }}
                    disabled={!content}
                    title="Kopieren"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleDelete} title="Löschen">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} title="Schließen">
                    <X className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="relative flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-primary/10 text-primary px-2.5 py-1">Physis</span>
            <span className="rounded-full bg-secondary text-secondary-foreground px-2.5 py-1">Ballarbeit</span>
            <span className="rounded-full bg-secondary text-secondary-foreground px-2.5 py-1">Duelle</span>
            <span className="rounded-full bg-secondary text-secondary-foreground px-2.5 py-1">Offensive</span>
            <span className="rounded-full bg-secondary text-secondary-foreground px-2.5 py-1">Disziplin</span>
          </div>

          {/* Queue status */}
          {isQueued && (
            <div className="relative flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 text-primary" />
              <div>
                <span className="font-medium text-foreground">In der Warteschlange</span>
                {queueInfo && (
                  <span className="ml-2">
                    — Position {queueInfo.position} von {queueInfo.total}
                    {queueInfo.position > 1 && (
                      <span className="text-xs ml-1">(ca. {(queueInfo.position - 1) * 2} Min. Wartezeit)</span>
                    )}
                  </span>
                )}
                <p className="text-xs mt-1 text-muted-foreground">
                  Du kannst die Seite verlassen — die Analyse läuft im Hintergrund weiter.
                </p>
              </div>
            </div>
          )}

          {/* Generating status */}
          {isGenerating && (
            <div className="relative flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <div>
                <span className="font-medium text-foreground">
                  {mode === "training" ? "Trainingsplan wird erstellt…" : "Analyse läuft…"}
                </span>
                <p className="text-xs mt-1 text-muted-foreground">
                  Die Ergebnisse erscheinen live. Du kannst die Seite verlassen und später zurückkehren.
                </p>
              </div>
            </div>
          )}

          {/* Error status */}
          {status === "error" && (
            <div className="relative flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm text-destructive">
              <X className="h-4 w-4" />
              <span>{content || "Analyse fehlgeschlagen"}</span>
            </div>
          )}

          {/* Cancelled status */}
          {status === "cancelled" && (
            <div className="relative flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
              <Ban className="h-4 w-4" />
              <span>Analyse wurde abgebrochen</span>
            </div>
          )}

          {content && status !== "error" && (
            <div className="relative rounded-2xl border border-border bg-background/70 p-4 sm:p-5">
              <div className="prose prose-sm prose-invert max-w-none text-foreground max-h-[640px] overflow-y-auto dark:prose-headings:text-foreground dark:prose-strong:text-foreground dark:prose-p:text-foreground/90 dark:prose-li:text-foreground/90 dark:prose-ul:text-foreground/90 dark:prose-ol:text-foreground/90">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            </div>
          )}

          {!isProcessing && status !== "error" && status !== "cancelled" && content && (
            <div className="relative flex gap-2 flex-wrap">
              <Button variant="heroOutline" size="sm" onClick={() => generate(mode)}>
                <Sparkles className="h-4 w-4 mr-1" /> Neu generieren
              </Button>
              {type === "player" && mode === "analysis" && (
                <Button variant="heroOutline" size="sm" onClick={() => generate("training")}>
                  <Dumbbell className="h-4 w-4 mr-1" /> Trainingsplan
                </Button>
              )}
              {type === "player" && mode === "training" && (
                <Button variant="heroOutline" size="sm" onClick={() => generate("analysis")}>
                  <Sparkles className="h-4 w-4 mr-1" /> Leistungsanalyse
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
