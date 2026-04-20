import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { HeatmapField } from "@/components/HeatmapField";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Activity, Clock } from "lucide-react";
import { HEATMAP_COLS, HEATMAP_ROWS } from "@/lib/constants";

interface PatternClip {
  event_type: string;
  event_minute: number;
  duration_sec: number;
  label?: string;
  description?: string;
  severity?: "info" | "warn" | "danger" | "good";
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchId: string;
  pattern: PatternClip | null;
}

interface MatchEvent {
  id: string;
  minute: number;
  event_type: string;
  team: string;
  player_name: string | null;
  notes: string | null;
}

interface PositionEntry { t: number; x: number; y: number; }

const SEVERITY_BADGE: Record<string, string> = {
  danger: "bg-destructive/15 text-destructive border-destructive/30",
  warn: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  good: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  info: "bg-primary/15 text-primary border-primary/30",
};

function buildHeatmapForWindow(positions: PositionEntry[], minuteCenter: number, windowMin = 2): number[][] {
  const grid: number[][] = Array.from({ length: HEATMAP_ROWS }, () => Array(HEATMAP_COLS).fill(0));
  const tStart = (minuteCenter - windowMin) * 60;
  const tEnd = (minuteCenter + windowMin) * 60;
  for (const p of positions) {
    if (p.t < tStart || p.t > tEnd) continue;
    const col = Math.min(HEATMAP_COLS - 1, Math.max(0, Math.floor((p.x / 105) * HEATMAP_COLS)));
    const row = Math.min(HEATMAP_ROWS - 1, Math.max(0, Math.floor((p.y / 68) * HEATMAP_ROWS)));
    grid[row][col] += 1;
  }
  return grid;
}

export default function PatternDetailDialog({ open, onOpenChange, matchId, pattern }: Props) {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [heatmapGrid, setHeatmapGrid] = useState<number[][] | null>(null);
  const [positionPoints, setPositionPoints] = useState<number>(0);

  useEffect(() => {
    if (!open || !pattern) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const minMin = Math.max(0, pattern.event_minute - 2);
        const maxMin = pattern.event_minute + 2;

        const [{ data: evData }, { data: statsData }] = await Promise.all([
          supabase
            .from("match_events")
            .select("id,minute,event_type,team,player_name,notes")
            .eq("match_id", matchId)
            .gte("minute", minMin)
            .lte("minute", maxMin)
            .order("minute", { ascending: true }),
          supabase
            .from("player_match_stats")
            .select("positions_raw,team")
            .eq("match_id", matchId)
            .eq("team", "home")
            .limit(50),
        ]);

        if (cancelled) return;
        setEvents((evData ?? []) as MatchEvent[]);

        const allPositions: PositionEntry[] = [];
        for (const row of statsData ?? []) {
          const raw = (row as any).positions_raw;
          if (Array.isArray(raw)) allPositions.push(...raw);
        }
        setPositionPoints(allPositions.length);
        if (allPositions.length > 0) {
          setHeatmapGrid(buildHeatmapForWindow(allPositions, pattern.event_minute, 2));
        } else {
          setHeatmapGrid(null);
        }
      } catch (e) {
        console.error("pattern-detail load error", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [open, pattern, matchId]);

  if (!pattern) return null;
  const sevClass = SEVERITY_BADGE[pattern.severity ?? "info"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Clock className="h-3 w-3" /> Min {pattern.event_minute}
            </Badge>
            <Badge className={`${sevClass} border text-[10px]`}>{pattern.event_type}</Badge>
            <Badge variant="outline" className="text-[10px]">±2 min Fenster</Badge>
          </div>
          <DialogTitle className="font-display text-lg break-words">
            {pattern.label ?? pattern.event_type}
          </DialogTitle>
          {pattern.description && (
            <DialogDescription className="text-sm leading-relaxed break-words">
              {pattern.description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Heatmap section */}
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
                Positions-Hotspots im Zeitfenster
              </h3>
            </div>
            {loading ? (
              <Skeleton className="aspect-[105/68] w-full rounded-xl" />
            ) : heatmapGrid ? (
              <>
                <HeatmapField grid={heatmapGrid} small />
                <p className="text-[10px] text-muted-foreground">
                  Aggregiert aus {positionPoints} Positions-Samples (Heimteam, ±2 min um Min {pattern.event_minute})
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground py-6 text-center border border-dashed border-border/50 rounded-lg">
                Keine Positionsdaten für dieses Zeitfenster verfügbar.
              </p>
            )}
          </section>

          {/* Events section */}
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-amber-500" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-500">
                Beteiligte Events
              </h3>
              {events.length > 0 && (
                <Badge variant="secondary" className="text-[9px] h-4 px-1.5">{events.length}</Badge>
              )}
            </div>
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : events.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border/50 rounded-lg">
                Keine Events im Zeitfenster ±2 min erfasst.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {events.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2"
                  >
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0 mt-0.5">Min {e.minute}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold capitalize">
                        {e.event_type.replace(/_/g, " ")}
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                          {e.team}
                        </span>
                      </p>
                      {e.player_name && <p className="text-[11px] text-muted-foreground truncate">{e.player_name}</p>}
                      {e.notes && <p className="text-[10px] text-muted-foreground/80 leading-snug mt-0.5 break-words">{e.notes}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
