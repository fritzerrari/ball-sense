import { useState, useRef } from "react";
import { Sparkles, Loader2, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

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
  const abortRef = useRef<AbortController | null>(null);

  const generate = async () => {
    setIsGenerating(true);
    setReport("");
    setIsOpen(true);
    abortRef.current = new AbortController();
    let soFar = "";

    try {
      const resp = await fetch(ANALYZE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ type, playerId, matchId }),
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
          } catch {}
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

  return (
    <div>
      {!isOpen ? (
        <Button variant="heroOutline" size="sm" onClick={generate} disabled={isGenerating}>
          <Sparkles className="h-4 w-4 mr-1" />
          KI-Analyse {playerName ? `für ${playerName}` : ""}
        </Button>
      ) : (
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold font-display flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              KI-Leistungsanalyse {playerName && `— ${playerName}`}
            </h3>
            <div className="flex gap-2">
              {isGenerating ? (
                <Button variant="ghost" size="sm" onClick={cancel}><X className="h-4 w-4" /></Button>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(report); toast.success("Kopiert!"); }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {isGenerating && !report && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Analysiere Leistungsdaten...
            </div>
          )}

          {report && (
            <div className="prose prose-sm prose-invert max-w-none text-foreground">
              <ReactMarkdown>{report}</ReactMarkdown>
            </div>
          )}

          {!isGenerating && report && (
            <Button variant="heroOutline" size="sm" onClick={generate}>
              <Sparkles className="h-4 w-4 mr-1" /> Neu analysieren
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
