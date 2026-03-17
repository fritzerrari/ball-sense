import { useState, useRef } from "react";
import { FileText, Sparkles, Download, Copy, Loader2, BookOpen, Clock, Share2, Mail, MessageCircle, Twitter, Dumbbell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";

const REPORT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-report`;

interface Props {
  matchId: string;
  matchStatus: string;
  clubName: string;
  awayClubName: string;
  matchDate: string;
}

export default function ReportGenerator({ matchId, matchStatus, clubName, awayClubName, matchDate }: Props) {
  const defaultType = matchStatus === "setup" ? "prematch" : matchStatus === "live" ? "halftime" : "match";
  const [reportType, setReportType] = useState<string>(defaultType);
  const [length, setLength] = useState("medium");
  const [style, setStyle] = useState("professional");
  const [report, setReport] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const { t } = useTranslation();

  const generate = async () => {
    setIsGenerating(true);
    setReport("");
    abortRef.current = new AbortController();
    let soFar = "";

    try {
      const resp = await fetch(REPORT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ matchId, reportType, length, style }),
        signal: abortRef.current.signal,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: t("common.error") }));
        toast.error(err.error || t("report.error"));
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
          } catch { buf = line + "\n" + buf; break; }
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") { console.error(e); toast.error(t("report.connectionError")); }
    }
    setIsGenerating(false);
  };

  const cancel = () => { abortRef.current?.abort(); setIsGenerating(false); };
  const copyToClipboard = () => { navigator.clipboard.writeText(report); toast.success(t("report.copied")); };

  const getTitle = () => {
    const typeLabel = reportType === "prematch" ? "Vorbericht" : reportType === "halftime" ? "Halbzeitbericht" : reportType === "training" ? "Trainingsplan" : "Spielbericht";
    return `${typeLabel}_${clubName}_vs_${awayClubName}_${matchDate}`;
  };

  const downloadMarkdown = () => {
    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${getTitle().replace(/\s+/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("report.downloadStarted"));
  };

  const downloadPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Popup blockiert"); return; }
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${getTitle()}</title><style>body{font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;padding:20px;line-height:1.6;color:#1a1a1a}h1,h2,h3{margin-top:1.5em}h1{font-size:1.5em;border-bottom:2px solid #10b981;padding-bottom:8px}h2{font-size:1.2em;color:#059669}h3{font-size:1em}@media print{body{margin:0}}</style></head><body>${report.replace(/\n/g, "<br>")}</body></html>`);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const shareEmail = () => {
    const subject = encodeURIComponent(getTitle());
    const body = encodeURIComponent(report.substring(0, 2000));
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(`${getTitle()}\n\n${report.substring(0, 1000)}...`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const shareTwitter = () => {
    const text = encodeURIComponent(`${getTitle()}\n\n${report.substring(0, 250)}...`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          {t("report.title")}
        </CardTitle>
        <CardDescription>{t("report.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("report.type")}</label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="prematch"><span className="flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Vorbericht</span></SelectItem>
                <SelectItem value="halftime"><span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Halbzeitbericht</span></SelectItem>
                <SelectItem value="match"><span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Spielbericht</span></SelectItem>
                <SelectItem value="training"><span className="flex items-center gap-1.5"><Dumbbell className="h-3.5 w-3.5" /> Trainingsplan</span></SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("report.length")}</label>
            <Select value={length} onValueChange={setLength}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="short">{t("report.short")}</SelectItem>
                <SelectItem value="medium">{t("report.medium")}</SelectItem>
                <SelectItem value="long">{t("report.long")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("report.style")}</label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">{t("report.analytical")}</SelectItem>
                <SelectItem value="journalistic">{t("report.journalistic")}</SelectItem>
                <SelectItem value="coaching">{t("report.coaching")}</SelectItem>
                <SelectItem value="social">Social Media</SelectItem>
                <SelectItem value="newspaper">Zeitungsbericht</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2">
          {!isGenerating ? (
            <Button onClick={generate} className="flex-1"><Sparkles className="h-4 w-4 mr-1" />{t("report.generate")}</Button>
          ) : (
            <Button variant="destructive" onClick={cancel} className="flex-1"><Loader2 className="h-4 w-4 mr-1 animate-spin" />{t("report.cancel")}</Button>
          )}
        </div>

        {report && (
          <div className="space-y-3">
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={copyToClipboard}><Copy className="h-4 w-4 mr-1" /> {t("common.copy")}</Button>
              <Button variant="ghost" size="sm" onClick={downloadMarkdown}><Download className="h-4 w-4 mr-1" /> Markdown</Button>
              <Button variant="ghost" size="sm" onClick={downloadPDF}><FileText className="h-4 w-4 mr-1" /> PDF</Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm"><Share2 className="h-4 w-4 mr-1" /> {t("common.share")}</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={shareEmail}><Mail className="h-4 w-4 mr-2" /> E-Mail</DropdownMenuItem>
                  <DropdownMenuItem onClick={shareWhatsApp}><MessageCircle className="h-4 w-4 mr-2" /> WhatsApp</DropdownMenuItem>
                  <DropdownMenuItem onClick={shareTwitter}><Twitter className="h-4 w-4 mr-2" /> Twitter/X</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
