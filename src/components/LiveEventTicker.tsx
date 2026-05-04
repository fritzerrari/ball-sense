import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Flag,
  Goal,
  AlertTriangle,
  Shield,
  Crosshair,
  CornerDownRight,
  ArrowRightLeft,
  Hand,
  Circle,
  Footprints,
  X,
  Zap,
  HeartPulse,
  Coffee,
  TriangleAlert,
  Swords,
} from "lucide-react";

interface EventCategory {
  label: string;
  events: EventDef[];
}

interface EventDef {
  type: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  needsPlayer?: boolean;
  team?: "home" | "away" | "both";
}

const EVENT_CATEGORIES: EventCategory[] = [
  {
    label: "Tore & Schüsse",
    events: [
      { type: "goal", label: "Tor", icon: <Goal className="h-4 w-4" />, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", needsPlayer: true },
      { type: "own_goal", label: "Eigentor", icon: <Goal className="h-4 w-4" />, color: "bg-red-500/20 text-red-400 border-red-500/30", needsPlayer: true },
      { type: "shot", label: "Schuss", icon: <Crosshair className="h-4 w-4" />, color: "bg-blue-500/20 text-blue-400 border-blue-500/30", needsPlayer: true },
      { type: "shot_on_target", label: "Torschuss", icon: <Crosshair className="h-4 w-4" />, color: "bg-blue-500/20 text-blue-400 border-blue-500/30", needsPlayer: true },
      { type: "blocked_shot", label: "Geblockter Schuss", icon: <Shield className="h-4 w-4" />, color: "bg-slate-500/20 text-slate-400 border-slate-500/30", needsPlayer: true },
      { type: "header", label: "Kopfball", icon: <Circle className="h-4 w-4" />, color: "bg-blue-500/20 text-blue-400 border-blue-500/30", needsPlayer: true },
      { type: "assist", label: "Vorlage", icon: <Zap className="h-4 w-4" />, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", needsPlayer: true },
      { type: "save", label: "Parade", icon: <Shield className="h-4 w-4" />, color: "bg-amber-500/20 text-amber-400 border-amber-500/30", needsPlayer: true },
    ],
  },
  {
    label: "Standards",
    events: [
      { type: "corner", label: "Ecke", icon: <CornerDownRight className="h-4 w-4" />, color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
      { type: "free_kick", label: "Freistoß", icon: <Flag className="h-4 w-4" />, color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
      { type: "penalty", label: "Elfmeter", icon: <Crosshair className="h-4 w-4" />, color: "bg-amber-500/20 text-amber-400 border-amber-500/30", needsPlayer: true },
      { type: "throw_in", label: "Einwurf", icon: <ArrowRightLeft className="h-4 w-4" />, color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
      { type: "set_piece", label: "Standardsituation", icon: <Flag className="h-4 w-4" />, color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
      { type: "kickoff", label: "Anstoß", icon: <Circle className="h-4 w-4" />, color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
    ],
  },
  {
    label: "Zweikämpfe & Defensive",
    events: [
      { type: "tackle", label: "Tackling", icon: <Swords className="h-4 w-4" />, color: "bg-orange-500/20 text-orange-400 border-orange-500/30", needsPlayer: true },
      { type: "interception", label: "Abfangen", icon: <Shield className="h-4 w-4" />, color: "bg-teal-500/20 text-teal-400 border-teal-500/30", needsPlayer: true },
      { type: "ball_recovery", label: "Ballgewinn", icon: <Zap className="h-4 w-4" />, color: "bg-teal-500/20 text-teal-400 border-teal-500/30", needsPlayer: true },
      { type: "clearance", label: "Klärung", icon: <X className="h-4 w-4" />, color: "bg-slate-500/20 text-slate-400 border-slate-500/30", needsPlayer: true },
      { type: "won_duel", label: "Zweikampf gewonnen", icon: <Swords className="h-4 w-4" />, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", needsPlayer: true },
      { type: "lost_duel", label: "Zweikampf verloren", icon: <Swords className="h-4 w-4" />, color: "bg-red-500/20 text-red-400 border-red-500/30", needsPlayer: true },
      { type: "dribble", label: "Dribbling", icon: <Footprints className="h-4 w-4" />, color: "bg-violet-500/20 text-violet-400 border-violet-500/30", needsPlayer: true },
      { type: "cross", label: "Flanke", icon: <ArrowRightLeft className="h-4 w-4" />, color: "bg-blue-500/20 text-blue-400 border-blue-500/30", needsPlayer: true },
    ],
  },
  {
    label: "Fouls & Karten",
    events: [
      { type: "foul", label: "Foul", icon: <AlertTriangle className="h-4 w-4" />, color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", needsPlayer: true },
      { type: "yellow_card", label: "Gelbe Karte", icon: <AlertTriangle className="h-4 w-4" />, color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", needsPlayer: true },
      { type: "yellow_red_card", label: "Gelb-Rot", icon: <AlertTriangle className="h-4 w-4" />, color: "bg-orange-500/20 text-orange-400 border-orange-500/30", needsPlayer: true },
      { type: "handball", label: "Handspiel", icon: <Hand className="h-4 w-4" />, color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", needsPlayer: true },
      { type: "offside", label: "Abseits", icon: <Flag className="h-4 w-4" />, color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
    ],
  },
  {
    label: "Wechsel & Sonstiges",
    events: [
      { type: "substitution", label: "Auswechslung", icon: <ArrowRightLeft className="h-4 w-4" />, color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30", needsPlayer: true },
      { type: "counter_attack", label: "Konter", icon: <Zap className="h-4 w-4" />, color: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
      { type: "bad_pass", label: "Fehlpass", icon: <X className="h-4 w-4" />, color: "bg-red-500/20 text-red-400 border-red-500/30", needsPlayer: true },
      { type: "injury", label: "Verletzung", icon: <HeartPulse className="h-4 w-4" />, color: "bg-red-500/20 text-red-400 border-red-500/30", needsPlayer: true },
      { type: "drink_break", label: "Trinkpause", icon: <Coffee className="h-4 w-4" />, color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
      { type: "conceded_goal", label: "Gegentor", icon: <TriangleAlert className="h-4 w-4" />, color: "bg-red-500/20 text-red-400 border-red-500/30" },
    ],
  },
];

interface LiveEventTickerProps {
  matchId: string;
  elapsedSec: number;
  homePlayers: Array<{ id: string; player_id: string | null; player_name: string | null; shirt_number: number | null }>;
  awayPlayers?: Array<{ id: string; player_id: string | null; player_name: string | null; shirt_number: number | null }>;
  trackOpponent?: boolean;
  onEventAdded?: () => void;
}

export function LiveEventTicker({ matchId, elapsedSec, homePlayers, awayPlayers, trackOpponent, onEventAdded }: LiveEventTickerProps) {
  const [open, setOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventDef | null>(null);
  const [team, setTeam] = useState<"home" | "away">("home");
  const [playerId, setPlayerId] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [minute, setMinute] = useState("");
  const [notes, setNotes] = useState("");
  const [zone, setZone] = useState("");
  const [saving, setSaving] = useState(false);
  const [recentEvents, setRecentEvents] = useState<Array<{ id?: string; type: string; label: string; minute: number; team: string; auto_detected?: boolean; confidence?: number | null; verified?: boolean }>>([]);

  // Subscribe to DB events (incl. auto-detected from live-event-detector)
  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;

    const eventLabel = (t: string) => {
      for (const cat of EVENT_CATEGORIES) {
        const found = cat.events.find((e) => e.type === t);
        if (found) return found.label;
      }
      return t;
    };

    const load = async () => {
      const { data } = await supabase
        .from("match_events")
        .select("id, event_type, minute, team, auto_detected, confidence, verified")
        .eq("match_id", matchId)
        .order("created_at", { ascending: false })
        .limit(15);
      if (!cancelled && Array.isArray(data)) {
        setRecentEvents(
          data.map((d: any) => ({
            id: d.id,
            type: d.event_type,
            label: eventLabel(d.event_type),
            minute: d.minute,
            team: d.team,
            auto_detected: d.auto_detected,
            confidence: d.confidence,
            verified: d.verified,
          })),
        );
      }
    };

    load();

    const channel = supabase
      .channel(`live-events-${matchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "match_events", filter: `match_id=eq.${matchId}` },
        (payload: any) => {
          const d = payload.new;
          setRecentEvents((prev) => [
            {
              id: d.id,
              type: d.event_type,
              label: eventLabel(d.event_type),
              minute: d.minute,
              team: d.team,
              auto_detected: d.auto_detected,
              confidence: d.confidence,
              verified: d.verified,
            },
            ...prev.slice(0, 14),
          ]);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  const currentMinute = Math.floor(elapsedSec / 60);
  const activePlayers = team === "home" ? homePlayers : (awayPlayers ?? []);

  const handleSelectEvent = (ev: EventDef) => {
    setSelectedEvent(ev);
    setMinute(String(currentMinute));
    setPlayerId("");
    setPlayerName("");
    setNotes("");
    setZone("");
  };

  const handleSave = async () => {
    if (!selectedEvent) return;
    setSaving(true);
    try {
      const min = parseInt(minute) || currentMinute;
      const player = activePlayers.find((p) => p.player_id === playerId);

      const insertData: any = {
        match_id: matchId,
        team,
        minute: min,
        event_type: selectedEvent.type as any,
        player_id: playerId || null,
        player_name: player?.player_name ?? (playerName || null),
        event_zone: zone || null,
        notes: notes || null,
      };
      if (selectedEvent.type === "substitution" && playerName) {
        insertData.related_player_name = playerName;
        insertData.notes = `Raus: ${player?.player_name ?? "?"}, Rein: ${playerName}`;
      }
      await supabase.from("match_events").insert(insertData);

      setRecentEvents((prev) => [
        { type: selectedEvent.type, label: selectedEvent.label, minute: min, team },
        ...prev.slice(0, 9),
      ]);

      toast.success(`${selectedEvent.label} (${min}') erfasst`);
      setSelectedEvent(null);
      onEventAdded?.();
    } catch {
      toast.error("Event konnte nicht gespeichert werden");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="min-h-[60px] text-base font-bold bg-accent/20 hover:bg-accent/30 text-accent-foreground border border-accent/30 rounded-xl col-span-2"
      >
        <Zap className="h-6 w-6 mr-2" /> EVENT ERFASSEN
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Live Event-Ticker · {currentMinute}'
            </DialogTitle>
          </DialogHeader>

          {!selectedEvent ? (
            <div className="space-y-4 mt-2">
              {/* Team selector */}
              <div className="flex gap-2">
                <button
                  onClick={() => setTeam("home")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    team === "home" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Heim
                </button>
                {trackOpponent && (
                  <button
                    onClick={() => setTeam("away")}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      team === "away" ? "border-accent bg-accent/10 text-accent-foreground" : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Gast
                  </button>
                )}
              </div>

              {/* Recent events */}
              {recentEvents.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Letzte Events</p>
                  <div className="flex flex-wrap gap-1.5">
                    {recentEvents.slice(0, 5).map((ev, i) => (
                      <span key={i} className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {ev.minute}' {ev.label} {ev.team === "away" ? "(G)" : ""}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Event categories */}
              {EVENT_CATEGORIES.map((cat) => (
                <div key={cat.label} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cat.label}</p>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {cat.events.map((ev) => (
                      <button
                        key={ev.type}
                        onClick={() => handleSelectEvent(ev)}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all hover:scale-[1.02] ${ev.color}`}
                      >
                        {ev.icon}
                        <span className="truncate">{ev.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              <div className={`flex items-center gap-3 rounded-lg border p-3 ${selectedEvent.color}`}>
                {selectedEvent.icon}
                <span className="font-semibold">{selectedEvent.label}</span>
                <span className="ml-auto text-xs">{team === "home" ? "Heim" : "Gast"}</span>
              </div>

              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Minute</label>
                <input
                  type="number"
                  value={minute}
                  onChange={(e) => setMinute(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground"
                />
              </div>

              {selectedEvent.needsPlayer && (
                <div>
                  <label className="mb-1 block text-sm text-muted-foreground">
                    {selectedEvent.type === "substitution" ? "Spieler raus" : "Spieler"}
                  </label>
                  <select
                    value={playerId}
                    onChange={(e) => setPlayerId(e.target.value)}
                    className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">Optional wählen...</option>
                    {activePlayers.map((p) => (
                      <option key={p.id} value={p.player_id ?? ""}>
                        {p.player_name} {p.shirt_number ? `(#${p.shirt_number})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedEvent.type === "substitution" && (
                <div>
                  <label className="mb-1 block text-sm text-muted-foreground">Spieler rein</label>
                  <select
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">Optional wählen...</option>
                    {activePlayers.map((p) => (
                      <option key={p.id} value={p.player_name ?? ""}>
                        {p.player_name} {p.shirt_number ? `(#${p.shirt_number})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Zone (optional)</label>
                <select
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground"
                >
                  <option value="">Keine Angabe</option>
                  <option value="left">Links</option>
                  <option value="center">Zentrum</option>
                  <option value="right">Rechts</option>
                  <option value="box">Strafraum</option>
                  <option value="midfield">Mittelfeld</option>
                  <option value="defensive">Defensivzone</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Notiz (optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="z.B. Freistoß aus 25m..."
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <div className="flex gap-3">
                <Button variant="heroOutline" className="flex-1" onClick={() => setSelectedEvent(null)}>
                  Zurück
                </Button>
                <Button variant="hero" className="flex-1" onClick={handleSave} disabled={saving}>
                  {saving ? "Speichert..." : "Erfassen"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
