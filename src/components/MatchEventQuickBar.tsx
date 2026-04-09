import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
}: Props) {
  const [saving, setSaving] = useState<string | null>(null);
  const [activeTeam, setActiveTeam] = useState<ActiveTeam>("home");

  const isHome = activeTeam === "home";

  // Filter out match-only events for training sessions
  const TRAINING_EXCLUDED: EventType[] = ["substitution", "corner", "free_kick"];
  const visibleButtons = isTraining
    ? EVENT_BUTTONS.filter(b => !TRAINING_EXCLUDED.includes(b.type))
    : EVENT_BUTTONS;

  const toggleTeam = useCallback(() => {
    setActiveTeam(prev => {
      const next = prev === "home" ? "away" : "home";
      if (navigator.vibrate) navigator.vibrate([15, 30, 15]);
      return next;
    });
  }, []);

  const handleEvent = useCallback(async (eventType: EventType) => {
    if (saving) return;
    setSaving(eventType);

    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(30);

    const elapsedMin = Math.max(1, Math.round((Date.now() - recordingStartTime) / 60000));
    const minute = halfNumber === 2 ? 45 + elapsedMin : elapsedMin;
    const teamLabel = isHome ? homeTeamName : awayTeamName;

    try {
      let clip: HighlightClip | null = null;
      if (highlightsEnabled && recorderRef.current) {
        clip = recorderRef.current.extractHighlight(eventType, minute);
      }

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
      } else {
        const { error: eventError } = await supabase.from("match_events").insert({
          match_id: matchId,
          event_type: eventType,
          minute,
          team: activeTeam,
          notes: clip ? "Highlight-Clip gespeichert" : undefined,
        });
        if (eventError) throw eventError;

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

      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
      const eventLabel = EVENT_BUTTONS.find(b => b.type === eventType)?.label ?? eventType;
      toast.success(`${eventLabel} (${teamLabel}) ✓`);
    } catch (err: any) {
      toast.error(err.message ?? "Event konnte nicht gespeichert werden");
    } finally {
      setSaving(null);
    }
  }, [matchId, recorderRef, recordingStartTime, saving, sessionToken, highlightsEnabled, halfNumber, activeTeam, isHome, homeTeamName, awayTeamName]);

  return (
    <div className="w-full max-w-xs space-y-2">
      {/* Team toggle */}
      {!isTraining && (
        <button
          onClick={toggleTeam}
          className={`w-full flex items-center justify-center gap-2 rounded-lg py-2 px-3 text-xs font-bold font-display transition-all active:scale-[0.97] border ${
            isHome
              ? "bg-primary/15 border-primary/40 text-primary"
              : "bg-destructive/15 border-destructive/40 text-destructive"
          }`}
        >
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${isHome ? "bg-primary" : "bg-destructive"}`} />
          {isHome ? `🏠 ${homeTeamName}` : `📣 ${awayTeamName}`}
          <span className="text-[10px] font-normal opacity-60 ml-1">Tippe zum Wechseln</span>
        </button>
      )}

      {/* Event buttons */}
      <div className={`grid gap-1.5 w-full ${visibleButtons.length <= 5 ? "grid-cols-3" : "grid-cols-4"}`}>
        {visibleButtons.map((btn) => (
          <Button
            key={btn.type}
            size="sm"
            variant="secondary"
            className={`gap-0.5 text-[10px] md:text-xs h-10 md:h-9 min-w-0 backdrop-blur border active:scale-95 transition-transform flex-col md:flex-row p-1 md:p-2 ${
              isHome
                ? "bg-background/80 border-border/50"
                : "bg-destructive/5 border-destructive/20"
            }`}
            disabled={saving !== null}
            onClick={() => handleEvent(btn.type)}
          >
            {saving === btn.type ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <span className="text-base md:text-sm leading-none">{btn.icon}</span>
            )}
            <span className="leading-none">{btn.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
