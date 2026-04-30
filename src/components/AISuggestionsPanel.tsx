import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Goal, Flag, ChevronDown, ChevronUp, Plus, Loader2 } from "lucide-react";

interface SceneItem {
  minute: number;
  type: string; // open_play | corner_kick | free_kick | throw_in | kickoff | penalty | stoppage | goal_celebration
  team?: "home" | "away" | "unknown";
  confidence?: number;
  evidence?: string;
}

interface GoalCandidate {
  minute: number;
  team?: "home" | "away" | "unknown";
  confidence?: number;
  scorer_jersey?: number;
  assist_jersey?: number;
  evidence?: string;
}

interface Props {
  matchId: string;
  onEventsChanged?: () => void;
}

const SCENE_LABELS: Record<string, { label: string; icon: string }> = {
  open_play: { label: "Spielzug", icon: "⚽" },
  corner_kick: { label: "Ecke", icon: "📐" },
  free_kick: { label: "Freistoß", icon: "🎯" },
  throw_in: { label: "Einwurf", icon: "🤾" },
  kickoff: { label: "Anstoß", icon: "🏁" },
  penalty: { label: "Elfmeter", icon: "🥅" },
  stoppage: { label: "Unterbrechung", icon: "⏸️" },
  goal_celebration: { label: "Torjubel", icon: "🎉" },
};

const SCENE_TO_EVENT: Record<string, string | null> = {
  corner_kick: "corner",
  free_kick: "free_kick",
  penalty: "penalty",
  goal_celebration: "goal",
  // open_play / throw_in / kickoff / stoppage → no direct event
  open_play: null,
  throw_in: null,
  kickoff: null,
  stoppage: null,
};

export default function AISuggestionsPanel({ matchId, onEventsChanged }: Props) {
  const [loading, setLoading] = useState(true);
  const [scenes, setScenes] = useState<SceneItem[]>([]);
  const [goals, setGoals] = useState<GoalCandidate[]>([]);
  const [open, setOpen] = useState(true);
  const [importingKey, setImportingKey] = useState<string | null>(null);
  const [imported, setImported] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("analysis_results")
        .select("result_type, data")
        .eq("match_id", matchId)
        .in("result_type", ["scenes", "goal_candidates"]);
      if (cancelled) return;
      if (error) {
        console.warn("[AISuggestions] load failed:", error);
        setLoading(false);
        return;
      }
      const sceneRow = data?.find((r) => r.result_type === "scenes");
      const goalRow = data?.find((r) => r.result_type === "goal_candidates");
      const s = Array.isArray(sceneRow?.data) ? (sceneRow!.data as unknown as SceneItem[]) : [];
      const g = Array.isArray(goalRow?.data) ? (goalRow!.data as unknown as GoalCandidate[]) : [];
      setScenes(
        s
          .filter((x) => typeof x?.minute === "number" && typeof x?.type === "string")
          .sort((a, b) => a.minute - b.minute),
      );
      setGoals(
        g
          .filter((x) => typeof x?.minute === "number")
          .sort((a, b) => a.minute - b.minute),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const totalCount = scenes.length + goals.length;

  const importGoal = async (g: GoalCandidate, key: string) => {
    setImportingKey(key);
    try {
      const payload: any = {
        match_id: matchId,
        event_type: "goal",
        minute: g.minute,
        team: g.team && g.team !== "unknown" ? g.team : "home",
        player_name: g.scorer_jersey ? `#${g.scorer_jersey}` : null,
        related_player_name: g.assist_jersey ? `#${g.assist_jersey}` : null,
        notes: `KI-Vorschlag (Konfidenz ${(g.confidence ?? 0).toFixed(2)})${
          g.evidence ? ` · ${g.evidence}` : ""
        }`,
      };
      const { error } = await supabase.from("match_events").insert(payload);
      if (error) throw error;
      setImported((prev) => new Set(prev).add(key));
      toast.success("Tor-Event übernommen");
      onEventsChanged?.();
    } catch (e: any) {
      toast.error(e.message ?? "Konnte nicht übernehmen");
    } finally {
      setImportingKey(null);
    }
  };

  const importScene = async (s: SceneItem, key: string) => {
    const eventType = SCENE_TO_EVENT[s.type];
    if (!eventType) {
      toast.info("Diese Szene hat kein direktes Event-Mapping");
      return;
    }
    setImportingKey(key);
    try {
      const { error } = await supabase.from("match_events").insert({
        match_id: matchId,
        event_type: eventType,
        minute: s.minute,
        team: s.team && s.team !== "unknown" ? s.team : "home",
        notes: `KI-Vorschlag · ${SCENE_LABELS[s.type]?.label ?? s.type}${
          s.evidence ? ` · ${s.evidence}` : ""
        }`,
      });
      if (error) throw error;
      setImported((prev) => new Set(prev).add(key));
      toast.success("Szene als Event übernommen");
      onEventsChanged?.();
    } catch (e: any) {
      toast.error(e.message ?? "Konnte nicht übernehmen");
    } finally {
      setImportingKey(null);
    }
  };

  // Hide entirely if nothing to show (avoid layout noise)
  if (!loading && totalCount === 0) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5">
      <CardHeader className="cursor-pointer pb-3" onClick={() => setOpen((o) => !o)}>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            KI-Vorschläge
            {!loading && totalCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {totalCount}
              </Badge>
            )}
          </CardTitle>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4 pt-0">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Lade Vorschläge…
            </div>
          )}

          {/* Goal candidates first — most actionable */}
          {goals.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Goal className="h-3.5 w-3.5" /> Tor-Kandidaten
              </div>
              <ul className="space-y-1.5">
                {goals.map((g, i) => {
                  const key = `goal-${i}-${g.minute}`;
                  const done = imported.has(key);
                  return (
                    <li
                      key={key}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card/50 p-2.5"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-sm">
                          <Badge variant="outline" className="font-mono">
                            {g.minute}'
                          </Badge>
                          <Badge
                            variant={g.team === "away" ? "destructive" : "default"}
                            className="text-xs"
                          >
                            {g.team === "away" ? "Auswärts" : g.team === "home" ? "Heim" : "?"}
                          </Badge>
                          {g.scorer_jersey != null && (
                            <span className="text-xs text-muted-foreground">
                              Schütze #{g.scorer_jersey}
                              {g.assist_jersey != null ? ` · Assist #${g.assist_jersey}` : ""}
                            </span>
                          )}
                          {typeof g.confidence === "number" && (
                            <span className="text-xs text-muted-foreground">
                              · {(g.confidence * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                        {g.evidence && (
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {g.evidence}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant={done ? "secondary" : "default"}
                        disabled={done || importingKey === key}
                        onClick={() => importGoal(g, key)}
                        className="gap-1"
                      >
                        {importingKey === key ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                        {done ? "Übernommen" : "Als Tor"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Scenes */}
          {scenes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Flag className="h-3.5 w-3.5" /> Szenen
              </div>
              <ul className="space-y-1.5">
                {scenes.map((s, i) => {
                  const key = `scene-${i}-${s.minute}-${s.type}`;
                  const done = imported.has(key);
                  const meta = SCENE_LABELS[s.type] ?? { label: s.type, icon: "•" };
                  const mappable = !!SCENE_TO_EVENT[s.type];
                  return (
                    <li
                      key={key}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card/50 p-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-sm">
                          <Badge variant="outline" className="font-mono">
                            {s.minute}'
                          </Badge>
                          <span>
                            {meta.icon} {meta.label}
                          </span>
                          {s.team && s.team !== "unknown" && (
                            <Badge
                              variant={s.team === "away" ? "destructive" : "default"}
                              className="text-xs"
                            >
                              {s.team === "away" ? "Auswärts" : "Heim"}
                            </Badge>
                          )}
                          {typeof s.confidence === "number" && (
                            <span className="text-xs text-muted-foreground">
                              · {(s.confidence * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                        {s.evidence && (
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {s.evidence}
                          </p>
                        )}
                      </div>
                      {mappable && (
                        <Button
                          size="sm"
                          variant={done ? "secondary" : "outline"}
                          disabled={done || importingKey === key}
                          onClick={() => importScene(s, key)}
                          className="gap-1"
                        >
                          {importingKey === key ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Plus className="h-3.5 w-3.5" />
                          )}
                          {done ? "Übernommen" : "Übernehmen"}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
