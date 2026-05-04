import { useState, useCallback, useRef, useEffect } from "react";
import { Loader2, Check, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import VoiceEventButton from "@/components/VoiceEventButton";

/**
 * Large, always-visible event card for helper cameras.
 * Lives below the video frame on the camera tracking page so the helper
 * can tap big buttons without fighting with the video overlay.
 *
 * Always-visible buttons: Tor, Chance, Ecke, Foul (the four most common
 * events). Team toggle at the top so the helper can switch sides.
 *
 * All inserts go through the camera-ops edge function and are server-side
 * deduplicated against trainer events within an 8s window.
 */

interface Props {
  matchId: string;
  sessionToken: string;
  recordingStartTime: number;
  halfNumber: number;
  homeTeamName: string;
  awayTeamName: string;
  isTraining?: boolean;
}

const EVENTS = [
  { type: "goal", label: "Tor", icon: "⚽", color: "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white" },
  { type: "shot_on_target", label: "Chance", icon: "⚡", color: "bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white" },
  { type: "corner", label: "Ecke", icon: "📐", color: "bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white" },
  { type: "foul", label: "Foul", icon: "🦵", color: "bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white" },
] as const;

interface Recent {
  id: string;
  type: string;
  team: "home" | "away";
  minute: number;
  label: string;
}

export default function HelperQuickEvents({
  matchId,
  sessionToken,
  recordingStartTime,
  halfNumber,
  homeTeamName,
  awayTeamName,
  isTraining = false,
}: Props) {
  const [team, setTeam] = useState<"home" | "away">("home");
  const [saving, setSaving] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const localIds = useRef<Set<string>>(new Set());

  // ── Realtime sync so the helper sees what the trainer logged too ──
  useEffect(() => {
    const channel = supabase
      .channel(`helper-events-${matchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "match_events", filter: `match_id=eq.${matchId}` },
        (payload) => {
          const row = payload.new as { id: string; event_type: string; team: string; minute: number };
          if (!row?.id || localIds.current.has(row.id)) {
            localIds.current.delete(row.id);
            return;
          }
          const label = EVENTS.find(e => e.type === row.event_type)?.label ?? row.event_type;
          const evTeam: "home" | "away" = row.team === "away" ? "away" : "home";
          setRecent(prev => [
            { id: row.id, type: row.event_type, team: evTeam, minute: row.minute, label },
            ...prev.filter(e => e.id !== row.id),
          ].slice(0, 5));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "match_events", filter: `match_id=eq.${matchId}` },
        (payload) => {
          const oldRow = payload.old as { id?: string };
          if (oldRow?.id) setRecent(prev => prev.filter(e => e.id !== oldRow.id));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [matchId]);

  const logEvent = useCallback(async (eventType: string, eventLabel: string) => {
    if (saving) return;
    setSaving(eventType);
    if (navigator.vibrate) navigator.vibrate(40);

    const elapsedMin = Math.max(1, Math.round((Date.now() - recordingStartTime) / 60000));
    const minute = halfNumber === 2 ? 45 + elapsedMin : elapsedMin;

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camera-ops`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            action: "log-event",
            session_token: sessionToken,
            match_id: matchId,
            event_type: eventType,
            minute,
            team,
          }),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Speichern fehlgeschlagen");
      }

      const data = await res.json();
      const id = data?.id as string | undefined;
      const dedup = !!data?.deduplicated;
      if (id) localIds.current.add(id);

      setSuccess(eventType);
      setTimeout(() => setSuccess(null), 800);

      const teamLabel = team === "home" ? homeTeamName : awayTeamName;
      if (dedup) {
        toast.info(`${eventLabel} (${teamLabel}) — bereits erfasst`, { duration: 2000 });
      } else {
        toast.success(`${eventLabel} (${teamLabel}, Min. ${minute}) ✓`);
        if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
      }

      if (id) {
        setRecent(prev => [
          { id, type: eventType, team, minute, label: eventLabel },
          ...prev.filter(e => e.id !== id),
        ].slice(0, 5));
      }
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Speichern");
    } finally {
      setSaving(null);
    }
  }, [saving, recordingStartTime, halfNumber, matchId, sessionToken, team, homeTeamName, awayTeamName]);

  const deleteEvent = useCallback(async (ev: Recent) => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camera-ops`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            action: "delete-event",
            session_token: sessionToken,
            match_id: matchId,
            event_id: ev.id,
          }),
        },
      );
      if (!res.ok) throw new Error("Löschen fehlgeschlagen");
      setRecent(prev => prev.filter(e => e.id !== ev.id));
      toast.success(`${ev.label} (Min. ${ev.minute}) gelöscht`);
    } catch (err: any) {
      toast.error(err.message ?? "Löschen fehlgeschlagen");
    }
  }, [matchId, sessionToken]);

  return (
    <div className="bg-card border-t border-border p-3 space-y-3">
      {/* Header + team toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Users className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-semibold truncate">Schnell-Events</span>
        </div>
        {!isTraining && (
          <button
            onClick={() => {
              setTeam(t => t === "home" ? "away" : "home");
              if (navigator.vibrate) navigator.vibrate([15, 30, 15]);
            }}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold border transition-colors active:scale-95 ${
              team === "home"
                ? "bg-primary/15 border-primary/40 text-primary"
                : "bg-destructive/15 border-destructive/40 text-destructive"
            }`}
          >
            <span className={`inline-block w-2 h-2 rounded-full ${team === "home" ? "bg-primary" : "bg-destructive"}`} />
            <span className="truncate max-w-[120px]">
              {team === "home" ? homeTeamName : awayTeamName}
            </span>
            <span className="text-[9px] font-normal opacity-60">tippen zum Wechseln</span>
          </button>
        )}
      </div>

      {/* Voice-Event */}
      {!isTraining && (
        <VoiceEventButton
          matchId={matchId}
          sessionToken={sessionToken}
          recordingStartTime={recordingStartTime}
          halfNumber={halfNumber}
          homeTeamName={homeTeamName}
          awayTeamName={awayTeamName}
        />
      )}

      {/* Big buttons grid — 2x2 on mobile, 4x1 on tablet+ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {EVENTS.map(ev => {
          const isSaving = saving === ev.type;
          const isSuccess = success === ev.type;
          return (
            <button
              key={ev.type}
              onClick={() => logEvent(ev.type, ev.label)}
              disabled={!!saving}
              className={`${ev.color} rounded-xl px-3 py-4 flex flex-col items-center justify-center gap-1 font-bold transition-all active:scale-[0.96] disabled:opacity-50 shadow-md min-h-[68px]`}
            >
              {isSaving ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : isSuccess ? (
                <Check className="h-6 w-6" />
              ) : (
                <span className="text-2xl leading-none">{ev.icon}</span>
              )}
              <span className="text-xs leading-none">{ev.label}</span>
            </button>
          );
        })}
      </div>

      {/* Recent events */}
      {recent.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Zuletzt erfasst</p>
          <div className="flex flex-wrap gap-1.5">
            {recent.map(ev => (
              <button
                key={ev.id}
                onClick={() => deleteEvent(ev)}
                className="flex items-center gap-1 rounded-full bg-muted hover:bg-destructive/20 border border-border px-2 py-1 text-[11px] transition-colors group"
                title="Antippen zum Löschen"
              >
                <span className="font-mono font-bold">{ev.minute}'</span>
                <span>{ev.label}</span>
                <span className={`text-[9px] px-1 rounded ${ev.team === "home" ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"}`}>
                  {ev.team === "home" ? homeTeamName.slice(0, 3) : awayTeamName.slice(0, 3)}
                </span>
                <Trash2 className="h-2.5 w-2.5 opacity-40 group-hover:opacity-100 group-hover:text-destructive" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
