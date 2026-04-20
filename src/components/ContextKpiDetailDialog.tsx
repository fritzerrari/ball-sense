import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";

export type KpiKey = "possession" | "total_distance" | "avg_distance" | "top_speed";

const KPI_META: Record<KpiKey, { label: string; unit: string; field: string }> = {
  possession: { label: "Ballbesitz", unit: "%", field: "possession_pct" },
  total_distance: { label: "Gesamt-Distanz", unit: "km", field: "total_distance_km" },
  avg_distance: { label: "Ø Distanz", unit: "km", field: "avg_distance_km" },
  top_speed: { label: "Topspeed", unit: "km/h", field: "top_speed_kmh" },
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchId: string;
  clubId: string | null;
  kpiKey: KpiKey | null;
  scopeLabel: string;
  currentValue: number | null;
  benchmarkValue: number | null;
}

interface HistoryRow {
  date: string;
  value: number | null;
  label: string;
  isCurrent: boolean;
}

export default function ContextKpiDetailDialog({
  open, onOpenChange, matchId, clubId, kpiKey, scopeLabel, currentValue, benchmarkValue,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  useEffect(() => {
    if (!open || !kpiKey || !clubId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const meta = KPI_META[kpiKey];
        // Fetch last 10 home matches of the club
        const { data: matches } = await supabase
          .from("matches")
          .select("id,date,away_club_name")
          .eq("home_club_id", clubId)
          .order("date", { ascending: false })
          .limit(10);

        const ids = (matches ?? []).map((m) => m.id);
        if (ids.length === 0) {
          if (!cancelled) setHistory([]);
          return;
        }

        const { data: stats } = await supabase
          .from("team_match_stats")
          .select(`match_id, team, ${meta.field}`)
          .in("match_id", ids)
          .eq("team", "home");

        const valueByMatch = new Map<string, number | null>();
        for (const s of stats ?? []) {
          const v = (s as any)[meta.field];
          valueByMatch.set((s as any).match_id, typeof v === "number" ? v : null);
        }

        const rows: HistoryRow[] = (matches ?? [])
          .slice()
          .reverse()
          .map((m) => ({
            date: m.date,
            value: valueByMatch.get(m.id) ?? null,
            label: `${m.date.slice(5)} · ${m.away_club_name ?? "?"}`,
            isCurrent: m.id === matchId,
          }));

        if (!cancelled) setHistory(rows);
      } catch (e) {
        console.error("kpi history load error", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [open, kpiKey, clubId, matchId]);

  const stats = useMemo(() => {
    const values = history.map((h) => h.value).filter((v): v is number => v != null);
    if (values.length === 0) return null;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { avg, min, max, count: values.length };
  }, [history]);

  if (!kpiKey) return null;
  const meta = KPI_META[kpiKey];
  const delta = currentValue != null && benchmarkValue != null && benchmarkValue !== 0
    ? ((currentValue - benchmarkValue) / benchmarkValue) * 100
    : null;
  const TrendIcon = delta == null ? Minus : Math.abs(delta) < 1 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  const trendColor = delta == null ? "text-muted-foreground" : Math.abs(delta) < 1 ? "text-muted-foreground" : delta > 0 ? "text-emerald-500" : "text-destructive";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px]">vs. {scopeLabel}</Badge>
            <Badge variant="secondary" className="text-[10px]">Letzte {history.length} Heimspiele</Badge>
          </div>
          <DialogTitle className="font-display text-lg break-words">{meta.label} im Verlauf</DialogTitle>
          <DialogDescription className="text-sm">
            Vergleich des aktuellen Spiels mit deinen letzten Heimspielen und dem Benchmark.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Top stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="text-[10px] uppercase tracking-wider text-primary">Aktuell</p>
              <p className="text-lg font-bold font-display">
                {currentValue != null ? currentValue.toFixed(1) : "–"}
                <span className="text-xs font-normal text-muted-foreground ml-1">{meta.unit}</span>
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Benchmark</p>
              <p className="text-lg font-bold font-display">
                {benchmarkValue != null ? benchmarkValue.toFixed(1) : "–"}
                <span className="text-xs font-normal text-muted-foreground ml-1">{meta.unit}</span>
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Delta</p>
              <p className={`text-lg font-bold font-display flex items-center gap-1 ${trendColor}`}>
                <TrendIcon className="h-4 w-4" />
                {delta != null ? `${delta > 0 ? "+" : ""}${delta.toFixed(0)}%` : "–"}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ø letzte 10</p>
              <p className="text-lg font-bold font-display">
                {stats ? stats.avg.toFixed(1) : "–"}
                <span className="text-xs font-normal text-muted-foreground ml-1">{meta.unit}</span>
              </p>
            </div>
          </div>

          {/* Chart */}
          <div className="rounded-xl border border-border bg-card/40 p-3">
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : history.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-12">
                Keine historischen Daten verfügbar.
              </p>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(d) => d.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelFormatter={(_, p) => (p[0]?.payload as HistoryRow | undefined)?.label ?? ""}
                      formatter={(v: number) => [`${v?.toFixed(1)} ${meta.unit}`, meta.label]}
                    />
                    {benchmarkValue != null && (
                      <ReferenceLine y={benchmarkValue} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: "Benchmark", fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                    )}
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "hsl(var(--primary))" }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {stats && (
            <p className="text-[11px] text-muted-foreground text-center">
              Spanne: <span className="font-semibold text-foreground">{stats.min.toFixed(1)} – {stats.max.toFixed(1)} {meta.unit}</span> · n={stats.count}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
