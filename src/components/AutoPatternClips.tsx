import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, RefreshCw, Loader2, AlertTriangle, TrendingUp, Info, Target } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PatternClip {
  id?: string;
  event_type: string;
  event_minute: number;
  duration_sec: number;
  label?: string;
  description?: string;
  severity?: "info" | "warn" | "danger" | "good";
}

interface Props {
  matchId: string;
  onJumpToMinute?: (minute: number) => void;
}

const PATTERN_LABELS: Record<string, string> = {
  goal_conceded_buildup: "Gegentor-Aufbau",
  loss_cluster_def: "Ballverlust-Cluster",
  open_center: "Zentrum offen",
  setpiece_cluster: "Standard-Häufung",
  low_possession: "Niedriger Ballbesitz",
  scoring_run: "Torflut",
};

const severityCfg = {
  danger: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/15", border: "border-destructive/30" },
  warn: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/15", border: "border-amber-500/30" },
  good: { icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/15", border: "border-emerald-500/30" },
  info: { icon: Info, color: "text-primary", bg: "bg-primary/15", border: "border-primary/30" },
};

function severityFromKey(key: string): keyof typeof severityCfg {
  if (key === "goal_conceded_buildup") return "danger";
  if (key === "scoring_run") return "good";
  if (key === "loss_cluster_def" || key === "low_possession") return "warn";
  return "info";
}

export default function AutoPatternClips({ matchId, onJumpToMinute }: Props) {
  const [clips, setClips] = useState<PatternClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-clip-detector", {
        body: { match_id: matchId, force_refresh: force },
      });
      if (error) throw error;
      const list: PatternClip[] = (data?.patterns ?? []).map((p: any) => ({
        ...p,
        event_type: p.event_type ?? p.pattern_key,
        event_minute: p.event_minute ?? p.minute,
        duration_sec: p.duration_sec ?? 30,
        label: p.label,
        description: p.description,
        severity: p.severity ?? severityFromKey(p.event_type ?? p.pattern_key),
      }));
      setClips(list);
    } catch (err: any) {
      console.error("auto-clip load error", err);
      toast.error(err?.message ?? "Auto-Clips konnten nicht geladen werden");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (matchId) void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Auto-Clips aus Mustern
          {clips.length > 0 && <Badge variant="secondary" className="text-xs">{clips.length}</Badge>}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => load(true)} disabled={refreshing} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Neu</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        ) : clips.length === 0 ? (
          <div className="py-6 text-center space-y-3">
            <Target className="h-8 w-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">Keine auffälligen Muster erkannt.</p>
            <Button onClick={() => load(true)} disabled={refreshing} size="sm" variant="outline" className="gap-2">
              {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Muster suchen
            </Button>
          </div>
        ) : (
          clips.map((c, idx) => {
            const sev = severityCfg[c.severity ?? "info"];
            const Icon = sev.icon;
            return (
              <motion.button
                key={`${c.event_type}-${c.event_minute}-${idx}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                onClick={() => onJumpToMinute?.(c.event_minute)}
                className={`w-full text-left rounded-lg border ${sev.border} bg-card/60 hover:bg-card transition-colors p-3 flex items-start gap-3`}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${sev.bg}`}>
                  <Icon className={`h-4 w-4 ${sev.color}`} />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-muted-foreground">Min {c.event_minute}</span>
                    <Badge className={`${sev.bg} ${sev.color} border-0 text-[10px]`}>
                      {PATTERN_LABELS[c.event_type] ?? c.event_type}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{c.duration_sec}s</span>
                  </div>
                  <p className="text-sm font-medium leading-snug">{c.label ?? PATTERN_LABELS[c.event_type] ?? c.event_type}</p>
                  {c.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{c.description}</p>
                  )}
                </div>
              </motion.button>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
