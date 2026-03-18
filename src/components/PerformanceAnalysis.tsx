import { useState, useRef } from "react";
import { Sparkles, Loader2, Copy, X, Dumbbell, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const ANALYZE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-performance`;

interface Props {
  type: "player" | "team";
  playerId?: string;
  matchId?: string;
  playerName?: string;
}

export function PerformanceAnalysis({ type, playerId, matchId, playerName }: Props) {
  const [report, setReport] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"analysis" | "training">("analysis");
  const abortRef = useRef<AbortController | null>(null);

  const generate = async (genMode: "analysis" | "training" = "analysis") => {
    setIsGenerating(true);
    setReport("");
    setIsOpen(true);
    setMode(genMode);
    abortRef.current = new AbortController();
    let soFar = "";

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      const resp = await fetch(ANALYZE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ type: genMode === "training" ? "training" : type, playerId, matchId }),
        signal: abortRef.current.signal,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Fehler" }));
        if (resp.status === 429) toast.error("Rate-Limit erreicht. Bitte versuche es gleich nochmal.");
        else if (resp.status === 402) toast.error("KI-Kontingent erschöpft. Bitte Credits aufladen.");
        else toast.error(err.error || "Analyse fehlgeschlagen");
        setIsGenerating(false);
        return;
      }

      if (!resp.body) throw new Error("No stream");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              soFar += content;
              setReport(soFar);
            }
          } catch {
            // ignore partial SSE chunks
          }
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") toast.error("Analyse fehlgeschlagen");
    } finally {
      setIsGenerating(false);
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setIsGenerating(false);
  };

  const title = mode === "training" ? "KI-Trainingsplan" : "KI-Leistungsanalyse";
  const subtitle = mode === "training"
    ? "Positionsspezifische Maßnahmen, Belastungssteuerung und konkrete Wochenplanung."
    : "Moderne Leistungsdiagnostik mit Physis, Ballarbeit, Duellen, Offensive und Disziplin.";

  return (
    <div>
      {!isOpen ? (
        <div className="flex gap-2 flex-wrap">
          <Button variant="heroOutline" size="sm" onClick={() => generate("analysis")} disabled={isGenerating}>
            <Sparkles className="h-4 w-4 mr-1" />
            KI-Analyse {playerName ? `für ${playerName}` : ""}
          </Button>
          {type === "player" && (
            <Button variant="heroOutline" size="sm" onClick={() => generate("training")} disabled={isGenerating}>
              <Dumbbell className="h-4 w-4 mr-1" />
              Trainingsplan generieren
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
              {isGenerating ? (
                <Button variant="ghost" size="sm" onClick={cancel}>
                  <X className="h-4 w-4" />
                </Button>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(report);
                      toast.success("Kopiert!");
                    }}
                    disabled={!report}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
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

          {isGenerating && !report && (
            <div className="relative flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              {mode === "training" ? "Generiere strukturierten Trainingsplan..." : "Analysiere Leistungsdaten und Muster..."}
            </div>
          )}

          {report && (
            <div className="relative rounded-2xl border border-border bg-background/70 p-4 sm:p-5">
              <div className="prose prose-sm prose-invert max-w-none text-foreground max-h-[640px] overflow-y-auto dark:prose-headings:text-foreground dark:prose-strong:text-foreground dark:prose-p:text-foreground/90 dark:prose-li:text-foreground/90 dark:prose-ul:text-foreground/90 dark:prose-ol:text-foreground/90">
                <ReactMarkdown>{report}</ReactMarkdown>
              </div>
            </div>
          )}

          {!isGenerating && report && (
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
