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

export default function MatchEventQuickBar({
  matchId,
  recorderRef,
  recordingStartTime,
  sessionToken,
  highlightsEnabled = false,
  halfNumber = 1,
}: Props) {
  const [saving, setSaving] = useState<string | null>(null);

  const handleEvent = useCallback(async (eventType: EventType) => {
    if (saving) return;
    setSaving(eventType);

    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(30);

    const elapsedMin = Math.max(1, Math.round((Date.now() - recordingStartTime) / 60000));
    const minute = halfNumber === 2 ? 45 + elapsedMin : elapsedMin;

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
              team: "home",
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
          team: "home",
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
      toast.success("Event gespeichert ✓");
    } catch (err: any) {
      toast.error(err.message ?? "Event konnte nicht gespeichert werden");
    } finally {
      setSaving(null);
    }
  }, [matchId, recorderRef, recordingStartTime, saving, sessionToken, highlightsEnabled, halfNumber]);

  return (
    <div className="grid grid-cols-4 gap-1.5 w-full max-w-xs">
      {EVENT_BUTTONS.map((btn) => (
        <Button
          key={btn.type}
          size="sm"
          variant="secondary"
          className="gap-0.5 text-[10px] md:text-xs h-10 md:h-9 min-w-0 bg-background/80 backdrop-blur border border-border/50 active:scale-95 transition-transform flex-col md:flex-row p-1 md:p-2"
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
  );
}
