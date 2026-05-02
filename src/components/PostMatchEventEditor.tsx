import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus, Trash2, ClipboardEdit, Camera, Loader2, CheckCircle2, X,
  ArrowRightLeft,
} from "lucide-react";

interface MatchEvent {
  id: string;
  event_type: string;
  minute: number;
  team: string;
  player_name: string | null;
  related_player_name: string | null;
  notes: string | null;
}

interface Props {
  matchId: string;
  onEventsChanged?: () => void;
}

const EVENT_OPTIONS = [
  { value: "goal", label: "Tor ⚽" },
  { value: "yellow_card", label: "Gelbe Karte 🟡" },
  { value: "red_card", label: "Rote Karte 🔴" },
  { value: "yellow_red_card", label: "Gelb-Rot 🟠" },
  { value: "substitution", label: "Auswechslung 🔄" },
  { value: "corner", label: "Ecke 📐" },
  { value: "free_kick", label: "Freistoß 🎯" },
  { value: "foul", label: "Foul 🦵" },
  { value: "offside", label: "Abseits 🚩" },
  { value: "penalty", label: "Elfmeter" },
  { value: "shot_on_target", label: "Torschuss" },
  { value: "own_goal", label: "Eigentor" },
  { value: "injury", label: "Verletzung" },
];

const EVENT_LABELS: Record<string, string> = Object.fromEntries(
  EVENT_OPTIONS.map((e) => [e.value, e.label])
);

interface SuggestedEvent {
  event_type: string;
  minute: number;
  team: string;
  player_name?: string;
  related_player_name?: string;
  notes?: string;
  confidence?: number;
}

export default function PostMatchEventEditor({ matchId, onEventsChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [eventType, setEventType] = useState("goal");
  const [minute, setMinute] = useState("");
  const [team, setTeam] = useState<"home" | "away">("home");
  const [playerName, setPlayerName] = useState("");
  const [relatedPlayerName, setRelatedPlayerName] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedEvent[]>([]);
  const [importingIdx, setImportingIdx] = useState<number | null>(null);

  // Score correction
  const [homeScore, setHomeScore] = useState<string>("");
  const [awayScore, setAwayScore] = useState<string>("");
  const [scoreSaving, setScoreSaving] = useState(false);
  const [scoreLoaded, setScoreLoaded] = useState(false);

  const loadEvents = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("match_events")
      .select("id, event_type, minute, team, player_name, related_player_name, notes")
      .eq("match_id", matchId)
      .order("minute");
    setEvents((data ?? []) as MatchEvent[]);
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      loadEvents();
      // Load existing score
      if (!scoreLoaded) {
        supabase.from("matches").select("home_score, away_score").eq("id", matchId).maybeSingle().then(({ data }) => {
          if (data) {
            setHomeScore(data.home_score != null ? String(data.home_score) : "");
            setAwayScore(data.away_score != null ? String(data.away_score) : "");
          }
          setScoreLoaded(true);
        });
      }
    }
  }, [open, matchId]);

  const handleAdd = async () => {
    if (!minute) { toast.error("Minute angeben"); return; }
    setSaving(true);
    try {
      const insertData: any = {
        match_id: matchId,
        event_type: eventType,
        minute: parseInt(minute),
        team,
        player_name: playerName || null,
        notes: notes || null,
      };
      if (eventType === "substitution") {
        insertData.related_player_name = relatedPlayerName || null;
        insertData.notes = `Raus: ${playerName || "?"}, Rein: ${relatedPlayerName || "?"}`;
      }
      const { error } = await supabase.from("match_events").insert(insertData);
      if (error) throw error;
      toast.success("Event hinzugefügt");
      setAddOpen(false);
      setMinute(""); setPlayerName(""); setRelatedPlayerName(""); setNotes("");
      loadEvents();
      onEventsChanged?.();
    } catch (err: any) {
      toast.error(err.message ?? "Fehler");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("match_events").delete().eq("id", id);
    if (error) { toast.error("Löschen fehlgeschlagen"); return; }
    toast.success("Event gelöscht");
    loadEvents();
    onEventsChanged?.();
  };

  const handlePhotoScan = async (file: File) => {
    setScanning(true);
    setSuggestions([]);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("parse-match-report-photo", {
        body: { image_base64: base64, match_id: matchId },
      });
      if (error) throw error;
      if (data?.events?.length) {
        setSuggestions(data.events);
        toast.success(`${data.events.length} Events erkannt`);
      } else {
        toast.info("Keine Events im Spielbericht erkannt");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Scan fehlgeschlagen");
    } finally {
      setScanning(false);
    }
  };

  const importSuggestion = async (idx: number) => {
    const ev = suggestions[idx];
    setImportingIdx(idx);
    try {
      const { error } = await supabase.from("match_events").insert({
        match_id: matchId,
        event_type: ev.event_type as any,
        minute: ev.minute,
        team: ev.team,
        player_name: ev.player_name || null,
        related_player_name: ev.related_player_name || null,
        notes: ev.notes || null,
      });
      if (error) throw error;
      setSuggestions((prev) => prev.filter((_, i) => i !== idx));
      loadEvents();
      onEventsChanged?.();
      toast.success("Event importiert");
    } catch (err: any) {
      toast.error(err.message ?? "Import fehlgeschlagen");
    } finally {
      setImportingIdx(null);
    }
  };

  const isSubstitution = eventType === "substitution";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ClipboardEdit className="h-3.5 w-3.5" />
          Events nacherfassen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <ClipboardEdit className="h-5 w-5 text-primary" />
            Events nacherfassen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setAddOpen(!addOpen)} className="gap-1.5 flex-1">
              <Plus className="h-3.5 w-3.5" /> Event hinzufügen
            </Button>
            <label className="flex-1">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handlePhotoScan(f);
                  e.target.value = "";
                }}
              />
              <Button size="sm" variant="secondary" className="gap-1.5 w-full" disabled={scanning} asChild>
                <span>
                  {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                  {scanning ? "Wird gescannt…" : "Spielbericht scannen"}
                </span>
              </Button>
            </label>
          </div>

          {addOpen && (
            <Card className="border-primary/20">
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Typ</label>
                    <select
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value)}
                      className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground"
                    >
                      {EVENT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Minute</label>
                    <input
                      type="number"
                      value={minute}
                      onChange={(e) => setMinute(e.target.value)}
                      placeholder="z.B. 67"
                      className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setTeam("home")}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      team === "home" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                    }`}
                  >
                    Heim
                  </button>
                  <button
                    onClick={() => setTeam("away")}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      team === "away" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                    }`}
                  >
                    Gast
                  </button>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    {isSubstitution ? "Spieler raus" : "Spieler (optional)"}
                  </label>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Name eingeben…"
                    className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground"
                  />
                </div>

                {isSubstitution && (
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Spieler rein</label>
                    <input
                      type="text"
                      value={relatedPlayerName}
                      onChange={(e) => setRelatedPlayerName(e.target.value)}
                      placeholder="Name eingeben…"
                      className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground"
                    />
                  </div>
                )}

                {!isSubstitution && (
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Notiz (optional)</label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground"
                    />
                  </div>
                )}

                <Button onClick={handleAdd} disabled={saving} className="w-full gap-1.5">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Erfassen
                </Button>
              </CardContent>
            </Card>
          )}

          {suggestions.length > 0 && (
            <Card className="border-amber-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <Camera className="h-4 w-4 text-amber-500" />
                  Erkannte Events ({suggestions.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {suggestions.map((ev, idx) => {
                  const lowConfidence = typeof ev.confidence === "number" && ev.confidence < 0.7;
                  return (
                    <div key={idx} className="flex items-center gap-3 rounded-lg border border-border/50 p-2.5 text-sm">
                      <span className="text-xs font-mono text-muted-foreground w-8">{ev.minute}'</span>
                      <span className="flex-1 truncate">
                        {EVENT_LABELS[ev.event_type] ?? ev.event_type}
                        {ev.player_name && ` · ${ev.player_name}`}
                        {lowConfidence && (
                          <span className="ml-2 inline-flex items-center rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                            Bitte prüfen
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{ev.team === "home" ? "H" : "G"}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        disabled={importingIdx === idx}
                        onClick={() => importSuggestion(idx)}
                      >
                        {importingIdx === idx ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => setSuggestions((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  );
                })}
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full gap-1.5"
                  disabled={importingIdx !== null}
                  onClick={async () => {
                    for (let i = 0; i < suggestions.length; i++) {
                      await importSuggestion(0);
                    }
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Alle importieren
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Score correction */}
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display">Endergebnis korrigieren</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">Heim</label>
                  <input
                    type="number"
                    min="0"
                    value={homeScore}
                    onChange={(e) => setHomeScore(e.target.value)}
                    placeholder="–"
                    className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-center text-lg font-bold text-foreground"
                  />
                </div>
                <span className="text-lg font-bold text-muted-foreground mt-5">:</span>
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">Gast</label>
                  <input
                    type="number"
                    min="0"
                    value={awayScore}
                    onChange={(e) => setAwayScore(e.target.value)}
                    placeholder="–"
                    className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-center text-lg font-bold text-foreground"
                  />
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="w-full gap-1.5"
                disabled={scoreSaving}
                onClick={async () => {
                  setScoreSaving(true);
                  try {
                    const { error } = await supabase.from("matches").update({
                      home_score: homeScore ? parseInt(homeScore) : null,
                      away_score: awayScore ? parseInt(awayScore) : null,
                    } as any).eq("id", matchId);
                    if (error) throw error;
                    toast.success("Ergebnis gespeichert");
                    onEventsChanged?.();
                  } catch (err: any) {
                    toast.error(err.message ?? "Fehler beim Speichern");
                  } finally {
                    setScoreSaving(false);
                  }
                }}
              >
                {scoreSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Ergebnis speichern
              </Button>
              <p className="text-[10px] text-muted-foreground">
                Das korrigierte Ergebnis wird in der Analyse als „Ground Truth" verwendet.
              </p>
            </CardContent>
          </Card>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Erfasste Events ({events.length})
            </p>
            {loading ? (
              <div className="py-4 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
            ) : events.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Keine Events vorhanden</p>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {events.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2 text-sm">
                    <span className="text-xs font-mono text-muted-foreground w-8">{ev.minute}'</span>
                    <span className="flex-1 truncate">
                      {EVENT_LABELS[ev.event_type] ?? ev.event_type}
                      {ev.player_name && ` · ${ev.player_name}`}
                      {ev.event_type === "substitution" && ev.related_player_name && (
                        <span className="text-muted-foreground"> → {ev.related_player_name}</span>
                      )}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{ev.team === "home" ? "H" : "G"}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(ev.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
