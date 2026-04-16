import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { VideoRecorderHandle, HighlightClip } from "@/lib/video-recorder";

interface Props {
  matchId: string;
  recorderRef: React.MutableRefObject<VideoRecorderHandle | null>;
  recordingStartTime: number;
  sessionToken?: string;
  highlightsEnabled?: boolean;
  halfNumber?: number;
  isTraining?: boolean;
  homeTeamName?: string;
  awayTeamName?: string;
  onGoalEvent?: (team: "home" | "away") => void;
  onEventDeleted?: (eventType: string, team: string) => void;
}

const EVENT_BUTTONS = [
  { type: "goal" as const, label: "Tor", icon: "⚽" },
  { type: "shot_on_target" as const, label: "Chance", icon: "⚡" },
  { type: "yellow_card" as const, label: "Gelb", icon: "🟡" },
  { type: "red_card" as const, label: "Rot", icon: "🔴" },
  { type: "substitution" as const, label: "Wechsel", icon: "🔄" },
  { type: "corner" as const, label: "Ecke", icon: "📐" },
  { type: "foul" as const, label: "Foul", icon: "🦵" },
  { type: "free_kick" as const, label: "Freistoß", icon: "🎯" },
] as const;

type EventType = typeof EVENT_BUTTONS[number]["type"];
type ActiveTeam = "home" | "away";

interface RecentEvent {
  id: string;
  type: EventType;
  team: ActiveTeam;
  minute: number;
  label: string;
}

const COOLDOWN_MS = 3000;

export default function MatchEventQuickBar({
  matchId,
  recorderRef,
  recordingStartTime,
  sessionToken,
  highlightsEnabled = false,
  halfNumber = 1,
  isTraining = false,
  homeTeamName = "Heim",
  awayTeamName = "Gegner",
  onGoalEvent,
  onEventDeleted,
}: Props) {
  const [savingSet, setSavingSet] = useState<Set<string>>(new Set());
  const [successSet, setSuccessSet] = useState<Set<string>>(new Set());
  const [cooldownSet, setCooldownSet] = useState<Set<string>>(new Set());
  const [activeTeam, setActiveTeam] = useState<ActiveTeam>("home");
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<RecentEvent | null>(null);
  const debounceRef = useRef<Record<string, number>>({});

  const isHome = activeTeam === "home";

  const TRAINING_EXCLUDED: EventType[] = ["substitution", "corner", "free_kick"];
  const visibleButtons = isTraining
    ? EVENT_BUTTONS.filter(b => !TRAINING_EXCLUDED.includes(b.type))
    : EVENT_BUTTONS;

  // Cooldown timer cleanup
  useEffect(() => {
    if (cooldownSet.size === 0) return;
    const timer = setTimeout(() => setCooldownSet(new Set()), COOLDOWN_MS);
    return () => clearTimeout(timer);
  }, [cooldownSet]);

  const toggleTeam = useCallback(() => {
    setActiveTeam(prev => {
      const next = prev === "home" ? "away" : "home";
      if (navigator.vibrate) navigator.vibrate([15, 30, 15]);
      return next;
    });
  }, []);

  const handleEvent = useCallback(async (eventType: EventType) => {
    const now = Date.now();
    if (debounceRef.current[eventType] && now - debounceRef.current[eventType] < 500) return;
    debounceRef.current[eventType] = now;

    if (savingSet.has(eventType) || cooldownSet.has(eventType)) return;

    setSavingSet(prev => new Set(prev).add(eventType));

    if (navigator.vibrate) navigator.vibrate(30);

    const elapsedMin = Math.max(1, Math.round((Date.now() - recordingStartTime) / 60000));
    const minute = halfNumber === 2 ? 45 + elapsedMin : elapsedMin;
    const teamLabel = isHome ? homeTeamName : awayTeamName;

    try {
      let clip: HighlightClip | null = null;
      if (highlightsEnabled && recorderRef.current) {
        clip = recorderRef.current.extractHighlight(eventType, minute);
      }

      let insertedId: string | undefined;

      if (sessionToken) {
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
              team: activeTeam,
            }),
          },
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Event konnte nicht gespeichert werden");
        }
        const resData = await res.json();
        insertedId = resData?.id;
      } else {
        const { data: inserted, error: eventError } = await supabase.from("match_events").insert({
          match_id: matchId,
          event_type: eventType,
          minute,
          team: activeTeam,
          notes: clip ? "Highlight-Clip gespeichert" : undefined,
        }).select("id").single();
        if (eventError) throw eventError;
        insertedId = inserted?.id;

        if (clip) {
          const ext = clip.mimeType.includes("mp4") ? "mp4" : "webm";
          const filePath = `${matchId}/highlight_${eventType}_${minute}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from("match-videos")
            .upload(filePath, clip.blob, { contentType: clip.mimeType, upsert: true });
          if (uploadError) throw uploadError;

          const { data: { user } } = await supabase.auth.getUser();
          const { data: profile } = await supabase
            .from("profiles")
            .select("club_id")
            .eq("user_id", user?.id ?? "")
            .maybeSingle();

          if (profile?.club_id) {
            await supabase.from("match_videos").insert({
              match_id: matchId,
              club_id: profile.club_id,
              file_path: filePath,
              duration_sec: 20,
              file_size_bytes: clip.blob.size,
              status: "uploaded",
              video_type: "highlight",
              event_type: eventType,
              event_minute: minute,
            });
          }
        }
      }

      // Success flash
      setSuccessSet(prev => new Set(prev).add(eventType));
      setTimeout(() => {
        setSuccessSet(prev => {
          const next = new Set(prev);
          next.delete(eventType);
          return next;
        });
      }, 800);

      // Cooldown
      setCooldownSet(prev => new Set(prev).add(eventType));
      setTimeout(() => {
        setCooldownSet(prev => {
          const next = new Set(prev);
          next.delete(eventType);
          return next;
        });
      }, COOLDOWN_MS);

      // Add to recent events
      const eventLabel = EVENT_BUTTONS.find(b => b.type === eventType)?.label ?? eventType;
      if (insertedId) {
        setRecentEvents(prev => [
          { id: insertedId!, type: eventType, team: activeTeam, minute, label: eventLabel },
          ...prev,
        ].slice(0, 3));
      }

      // Notify parent about goals
      if (eventType === "goal" && onGoalEvent) {
        onGoalEvent(activeTeam);
      }

      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
      toast.success(`${eventLabel} (${teamLabel}) ✓`);
    } catch (err: any) {
      toast.error(err.message ?? "Event konnte nicht gespeichert werden");
    } finally {
      setSavingSet(prev => {
        const next = new Set(prev);
        next.delete(eventType);
        return next;
      });
    }
  }, [matchId, recorderRef, recordingStartTime, savingSet, cooldownSet, sessionToken, highlightsEnabled, halfNumber, activeTeam, isHome, homeTeamName, awayTeamName, onGoalEvent]);

  const handleDeleteEvent = useCallback(async (event: RecentEvent) => {
    try {
      if (sessionToken) {
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
              event_id: event.id,
            }),
          },
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Löschen fehlgeschlagen");
        }
      } else {
        const { error } = await supabase.from("match_events").delete().eq("id", event.id);
        if (error) throw error;
      }

      setRecentEvents(prev => prev.filter(e => e.id !== event.id));
      if (event.type === "goal" && onEventDeleted) {
        onEventDeleted(event.type, event.team);
      }
      toast.success(`${event.label} (Min. ${event.minute}) gelöscht`);
    } catch (err: any) {
      toast.error(err.message ?? "Löschen fehlgeschlagen");
    }
    setDeleteTarget(null);
  }, [matchId, sessionToken, onEventDeleted]);

  return (
    <div className="w-full max-w-sm space-y-1.5">
      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Event löschen?"
        description={deleteTarget ? `${deleteTarget.label} (${deleteTarget.team === "home" ? homeTeamName : awayTeamName}, Min. ${deleteTarget.minute}) wirklich entfernen?` : ""}
        confirmLabel="Löschen"
        onConfirm={() => deleteTarget && handleDeleteEvent(deleteTarget)}
        destructive
      />

      {/* Team toggle — compact */}
      {!isTraining && (
        <button
          onClick={toggleTeam}
          className={`w-full flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-3 text-[11px] font-bold font-display transition-all active:scale-[0.97] border ${
            isHome
              ? "bg-primary/15 border-primary/40 text-primary"
              : "bg-destructive/15 border-destructive/40 text-destructive"
          }`}
        >
          <span className={`inline-block w-2 h-2 rounded-full ${isHome ? "bg-primary" : "bg-destructive"}`} />
          {isHome ? `🏠 ${homeTeamName}` : `📣 ${awayTeamName}`}
          <span className="text-[9px] font-normal opacity-60 ml-1">Wechseln</span>
        </button>
      )}

      {/* Event buttons — horizontal scrollable row */}
      <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-hide">
        {visibleButtons.map((btn) => {
          const isSaving = savingSet.has(btn.type);
          const isSuccess = successSet.has(btn.type);
          const isCooldown = cooldownSet.has(btn.type);

          return (
            <Button
              key={btn.type}
              size="sm"
              variant="secondary"
              className={`flex-shrink-0 gap-0.5 text-[10px] h-8 min-w-0 backdrop-blur border active:scale-95 transition-all flex-col p-1 px-2 ${
                isSuccess
                  ? "bg-primary/20 border-primary/50 text-primary"
                  : isCooldown
                    ? "bg-muted/60 border-border/30 opacity-60"
                    : isHome
                      ? "bg-background/80 border-border/50"
                      : "bg-destructive/5 border-destructive/20"
              }`}
              disabled={isSaving || isCooldown}
              onClick={() => handleEvent(btn.type)}
            >
              {isSaving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : isSuccess ? (
                <Check className="h-3 w-3 text-primary" />
              ) : (
                <span className="text-sm leading-none">{btn.icon}</span>
              )}
              <span className="leading-none text-[9px]">{btn.label}</span>
            </Button>
          );
        })}
      </div>

      {/* Recent events (undo chips) */}
      {recentEvents.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {recentEvents.map((ev) => (
            <Badge
              key={ev.id}
              variant="secondary"
              className="gap-1 text-[10px] py-0.5 px-2 cursor-pointer hover:bg-destructive/10 hover:border-destructive/30 transition-colors"
              onClick={() => setDeleteTarget(ev)}
            >
              {ev.minute}' {ev.label}
              <X className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
