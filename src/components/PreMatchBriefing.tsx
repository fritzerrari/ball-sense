import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Loader2, Sparkles, Download, Target, AlertTriangle, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BriefingPage {
  title: string;
  bullets?: string[];
  tactical_keywords?: string[];
  key_players?: { name: string; role: string; threat: string }[];
  phases?: { phase: string; approach: string; focus: string }[];
  set_pieces?: string;
}
interface Briefing {
  title: string;
  summary_1_sentence: string;
  pages: BriefingPage[];
}
interface Stored {
  id: string;
  briefing: Briefing;
  generated_at: string;
}

interface Props {
  matchId: string;
}

export default function PreMatchBriefing({ matchId }: Props) {
  const [data, setData] = useState<Stored | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: row } = await supabase
        .from("prematch_briefings")
        .select("*")
        .eq("match_id", matchId)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!alive) return;
      setData((row as any) ?? null);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [matchId]);

  const generate = async () => {
    setGenerating(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("generate-prematch-briefing", {
        body: { match_id: matchId },
      });
      if (error) throw error;
      if (res?.error) throw new Error(res.error);
      setData(res.briefing);
      toast.success("Pre-Match-Briefing erstellt!");
    } catch (e: any) {
      toast.error(e?.message ?? "Briefing fehlgeschlagen");
    } finally {
      setGenerating(false);
    }
  };

  const downloadPDF = () => {
    if (!data?.briefing) return;
    // Print the rendered HTML — browser's "Save as PDF" handles the rest.
    window.print();
  };

  if (loading) return <Skeleton className="h-40 w-full" />;

  if (!data) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center space-y-3">
          <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">Noch kein Pre-Match-Briefing erstellt.</p>
          <Button onClick={generate} disabled={generating} className="gap-2">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Briefing generieren
          </Button>
        </CardContent>
      </Card>
    );
  }

  const b = data.briefing;
  return (
    <Card>
      <CardContent className="p-4 space-y-4 print:shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-primary" />
              <h3 className="font-semibold font-display">Pre-Match-Briefing</h3>
              <Badge variant="outline" className="text-[10px]">3 Seiten</Badge>
            </div>
            <h2 className="text-lg font-bold font-display">{b.title}</h2>
            <p className="text-sm text-muted-foreground italic mt-1">"{b.summary_1_sentence}"</p>
          </div>
          <div className="flex gap-1 print:hidden">
            <Button onClick={generate} disabled={generating} size="sm" variant="ghost">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            </Button>
            <Button onClick={downloadPDF} size="sm" variant="outline" className="gap-1">
              <Download className="h-3 w-3" /> PDF
            </Button>
          </div>
        </div>

        {b.pages?.map((page, i) => {
          const Icon = i === 0 ? Layers : i === 1 ? AlertTriangle : Target;
          return (
            <div key={i} className="rounded-lg border border-border/50 bg-card/60 p-3 space-y-2 print:break-inside-avoid">
              <div className="flex items-center gap-2 pb-1 border-b border-border/40">
                <Icon className="h-4 w-4 text-primary" />
                <h4 className="font-semibold font-display text-sm">{page.title}</h4>
              </div>

              {page.bullets && (
                <ul className="space-y-1">
                  {page.bullets.map((bul, j) => (
                    <li key={j} className="text-xs flex gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{bul}</span>
                    </li>
                  ))}
                </ul>
              )}

              {page.tactical_keywords && (
                <div className="flex flex-wrap gap-1">
                  {page.tactical_keywords.map((k, j) => (
                    <Badge key={j} variant="outline" className="text-[10px]">{k}</Badge>
                  ))}
                </div>
              )}

              {page.key_players && (
                <div className="space-y-1.5 mt-2">
                  {page.key_players.map((p, j) => (
                    <div key={j} className="rounded-md bg-amber-500/10 border border-amber-500/30 p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-amber-400">{p.name}</span>
                        <Badge variant="outline" className="text-[10px]">{p.role}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">{p.threat}</p>
                    </div>
                  ))}
                </div>
              )}

              {page.phases && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {page.phases.map((ph, j) => (
                    <div key={j} className="rounded-md border border-border/40 p-2">
                      <Badge variant="outline" className="text-[10px] mb-1">{ph.phase}</Badge>
                      <p className="text-xs font-medium">{ph.approach}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{ph.focus}</p>
                    </div>
                  ))}
                </div>
              )}

              {page.set_pieces && (
                <div className="rounded-md bg-primary/5 border border-primary/20 p-2 text-xs">
                  <span className="font-semibold">Standards:</span> {page.set_pieces}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
