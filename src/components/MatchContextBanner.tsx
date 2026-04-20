import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Minus, Trophy, History, RefreshCw, Loader2, Info } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DeltaValue { abs: number | null; pct: number | null; }
interface KpiBlock {
  label: string;
  sample_size: number;
  possession: DeltaValue;
  total_distance: DeltaValue;
  avg_distance: DeltaValue;
  top_speed: DeltaValue;
}
interface MatchContext {
  generated_at: string;
  current: Record<string, number | null>;
  vs_club_history: KpiBlock | null;
  vs_opponent_history: KpiBlock | null;
  vs_league: KpiBlock | null;
  league_participants: number | null;
}

interface Props {
  matchId: string;
  compact?: boolean;
}

const KPI_LABELS: Record<keyof Omit<KpiBlock, "label" | "sample_size">, string> = {
  possession: "Ballbesitz",
  total_distance: "Distanz",
  avg_distance: "Ø Distanz",
  top_speed: "Topspeed",
};

function DeltaPill({ value }: { value: DeltaValue }) {
  if (value.pct == null) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
        <Minus className="h-2.5 w-2.5" />–
      </span>
    );
  }
  const positive = value.pct >= 0;
  const Icon = Math.abs(value.pct) < 1 ? Minus : positive ? TrendingUp : TrendingDown;
  const color =
    Math.abs(value.pct) < 1
      ? "text-muted-foreground"
      : positive
        ? "text-emerald-500"
        : "text-destructive";
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${color}`}>
      <Icon className="h-2.5 w-2.5" />
      {positive ? "+" : ""}
      {value.pct.toFixed(0)}%
    </span>
  );
}

function KpiRow({ block }: { block: KpiBlock }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {(Object.keys(KPI_LABELS) as Array<keyof typeof KPI_LABELS>).map((k) => (
        <div key={k} className="rounded-lg bg-muted/40 px-2 py-1.5 text-center">
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{KPI_LABELS[k]}</p>
          <DeltaPill value={block[k]} />
        </div>
      ))}
    </div>
  );
}

export default function MatchContextBanner({ matchId, compact = false }: Props) {
  const [context, setContext] = useState<MatchContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("match-context", {
        body: { match_id: matchId, force_refresh: force },
      });
      if (error) throw error;
      if (data?.context) setContext(data.context);
    } catch (err) {
      console.error("match-context load error", err);
      if (force) toast.error("Kontext konnte nicht aktualisiert werden");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (matchId) void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  if (loading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (!context) return null;

  const blocks = [
    { key: "club", icon: History, data: context.vs_club_history },
    { key: "opp", icon: Trophy, data: context.vs_opponent_history },
    { key: "league", icon: Trophy, data: context.vs_league },
  ].filter((b) => b.data && b.data.sample_size > 0);

  if (!blocks.length) {
    return (
      <Card className="border-dashed border-border/50">
        <CardContent className="py-3 px-4 flex items-center gap-2">
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground flex-1">
            Noch keine Vergleichsdaten — der Liga-Kontext erscheint nach 2–3 Spielen oder mit Benchmark-Opt-in.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardContent className={compact ? "py-3 px-3 space-y-2" : "py-4 px-4 space-y-3"}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5 text-primary" />
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                Kontext
              </p>
              {context.league_participants && (
                <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                  {context.league_participants} Vereine
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => load(true)}
              disabled={refreshing}
            >
              {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            </Button>
          </div>
          <div className="space-y-2">
            {blocks.map(({ key, data }) => (
              <div key={key} className="space-y-1">
                <p className="text-[10px] text-muted-foreground">
                  vs. <span className="font-semibold">{data!.label}</span>
                  <span className="text-muted-foreground/60"> · n={data!.sample_size}</span>
                </p>
                <KpiRow block={data!} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
