import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Radio, Loader2, RefreshCw, AlertTriangle, Shield, Swords, Move, Heart, Brain } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Recommendation {
  icon: "shield" | "swords" | "move" | "heart" | "brain";
  title: string;
  action: string;
}
interface Advice {
  id?: string;
  minute: number;
  half: number;
  headline: string;
  reasoning: string | null;
  urgency: "low" | "medium" | "high";
  recommendations: Recommendation[];
  created_at?: string;
}

const ICONS = { shield: Shield, swords: Swords, move: Move, heart: Heart, brain: Brain } as const;
const URGENCY_STYLE: Record<Advice["urgency"], string> = {
  low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  high: "border-red-500/30 bg-red-500/10 text-red-400",
};

interface Props {
  matchId: string;
  /** current minute of the match — passed in from the live tracker */
  currentMinute: number;
  half?: 1 | 2;
}

export default function LiveCoachingPanel({ matchId, currentMinute, half = 1 }: Props) {
  const [history, setHistory] = useState<Advice[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("live_coaching_advice")
      .select("*")
      .eq("match_id", matchId)
      .order("minute", { ascending: false })
      .limit(10);
    setHistory((data ?? []) as Advice[]);
    setLoading(false);
  };

  useEffect(() => {
    if (matchId) void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  const generate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("live-coaching-advice", {
        body: { match_id: matchId, current_minute: currentMinute, half },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Live-Empfehlung für Minute ${currentMinute}'`);
      await loadHistory();
    } catch (e: any) {
      toast.error(e?.message ?? "Empfehlung fehlgeschlagen");
    } finally {
      setGenerating(false);
    }
  };

  const latest = history[0];

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary animate-pulse" />
            <h3 className="font-semibold font-display text-sm">Live-Coaching</h3>
            <Badge variant="outline" className="text-[10px]">{currentMinute}'</Badge>
          </div>
          <Button size="sm" onClick={generate} disabled={generating} className="gap-1 h-8">
            {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Neue Empfehlung
          </Button>
        </div>

        {loading && !history.length && <Skeleton className="h-32 w-full" />}

        {!loading && !history.length && (
          <div className="text-center py-6 space-y-2">
            <AlertTriangle className="h-8 w-8 text-muted-foreground/30 mx-auto" />
            <p className="text-xs text-muted-foreground">Noch keine Empfehlungen. Tippe auf "Neue Empfehlung" für die KI-Live-Analyse.</p>
          </div>
        )}

        <AnimatePresence>
          {latest && (
            <motion.div
              key={latest.id ?? latest.minute}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-lg border p-3 ${URGENCY_STYLE[latest.urgency]}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm">{latest.headline}</p>
                  {latest.reasoning && <p className="text-xs opacity-80 mt-1">{latest.reasoning}</p>}
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">{latest.minute}' · HZ{latest.half}</Badge>
              </div>
              <div className="space-y-1.5 mt-3">
                {latest.recommendations.map((r, i) => {
                  const Icon = ICONS[r.icon] ?? Brain;
                  return (
                    <div key={i} className="flex items-start gap-2 rounded-md bg-background/40 p-2">
                      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium">{r.title}</p>
                        <p className="text-xs opacity-80">{r.action}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {history.length > 1 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Frühere Empfehlungen ({history.length - 1})
            </summary>
            <div className="space-y-1 mt-2">
              {history.slice(1).map((a) => (
                <div key={a.id ?? `${a.minute}-${a.half}`} className="rounded-md border border-border/50 px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{a.minute}'</Badge>
                    <span className="text-xs font-medium">{a.headline}</span>
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
