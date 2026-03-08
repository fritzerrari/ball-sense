import { useState, useRef } from "react";
import { FileText, Sparkles, Download, Copy, Loader2, BookOpen, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

const REPORT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-report`;

interface Props {
  matchId: string;
  matchStatus: string;
  clubName: string;
  awayClubName: string;
  matchDate: string;
}

export default function ReportGenerator({ matchId, matchStatus, clubName, awayClubName, matchDate }: Props) {
  const [reportType, setReportType] = useState<string>(matchStatus === "setup" ? "prematch" : "match");
  const [length, setLength] = useState("medium");
  const [style, setStyle] = useState("professional");
  const [report, setReport] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const generate = async () => {
    setIsGenerating(true);
    setReport("");
    abortRef.current = new AbortController();

    let soFar = "";

    try {
      const resp = await fetch(REPORT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ matchId, reportType, length, style }),
        signal: abortRef.current.signal,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Fehler" }));
        toast.error(err.error || "Fehler bei der Berichtsgenerierung");
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
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const c = JSON.parse(json).choices?.[0]?.delta?.content;
            if (c) { soFar += c; setReport(soFar); }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        console.error(e);
        toast.error("Verbindungsfehler");
      }
    }

    setIsGenerating(false);
  };

  const cancel = () => {
    abortRef.current?.abort();
    setIsGenerating(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(report);
    toast.success("Bericht kopiert!");
  };

  const downloadMarkdown = () => {
    const title = `${reportType === "prematch" ? "Vorbericht" : "Spielbericht"}_${clubName}_vs_${awayClubName}_${matchDate}`;
    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Download gestartet");
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          KI-Bericht generieren
        </CardTitle>
        <CardDescription>
          Erstelle automatisch einen Vor- oder Spielbericht mit KI-Analyse. Max. 5 Berichte pro Tag.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Typ</label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="prematch"><span className="flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Vorbericht</span></SelectItem>
                <SelectItem value="match"><span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Spielbericht</span></SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Länge</label>
            <Select value={length} onValueChange={setLength}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="short">Kurz</SelectItem>
                <SelectItem value="medium">Mittel</SelectItem>
                <SelectItem value="long">Ausführlich</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Stil</label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Analytisch</SelectItem>
                <SelectItem value="journalistic">Journalistisch</SelectItem>
                <SelectItem value="coaching">Trainer-Stil</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Generate Button */}
        <div className="flex gap-2">
          {!isGenerating ? (
            <Button onClick={generate} className="flex-1">
              <Sparkles className="h-4 w-4 mr-1" />
              Bericht generieren
            </Button>
          ) : (
            <Button variant="destructive" onClick={cancel} className="flex-1">
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Abbrechen
            </Button>
          )}
        </div>

        {/* Report Output */}
        {report && (
          <div className="space-y-3">
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={copyToClipboard}>
                <Copy className="h-4 w-4 mr-1" /> Kopieren
              </Button>
              <Button variant="ghost" size="sm" onClick={downloadMarkdown}>
                <Download className="h-4 w-4 mr-1" /> Download
              </Button>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none p-4 rounded-lg bg-muted/30 border border-border max-h-[500px] overflow-y-auto">
              <ReactMarkdown>{report}</ReactMarkdown>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
