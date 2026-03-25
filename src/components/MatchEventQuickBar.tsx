import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { VideoRecorderHandle, HighlightClip } from "@/lib/video-recorder";

interface Props {
  matchId: string;
  recorderRef: React.MutableRefObject<VideoRecorderHandle | null>;
  recordingStartTime: number; // Date.now() when recording started
}

const EVENT_BUTTONS = [
  { type: "goal" as const, label: "⚽ Tor", icon: "⚽" },
  { type: "shot_on_target" as const, label: "⚡ Chance", icon: "⚡" },
  { type: "yellow_card" as const, label: "🟡 Karte", icon: "🟡" },
  { type: "corner" as const, label: "📐 Ecke", icon: "📐" },
] as const;

type EventType = typeof EVENT_BUTTONS[number]["type"];

export default function MatchEventQuickBar({ matchId, recorderRef, recordingStartTime }: Props) {
  const [saving, setSaving] = useState<string | null>(null);

  const handleEvent = useCallback(async (eventType: EventType) => {
    if (saving) return;
    setSaving(eventType);

    const minute = Math.max(1, Math.round((Date.now() - recordingStartTime) / 60000));

    try {
      // 1. Extract highlight clip from ring buffer
      let clip: HighlightClip | null = null;
      if (recorderRef.current) {
        clip = recorderRef.current.extractHighlight(eventType, minute);
      }

      // 2. Insert match event
      const { error: eventError } = await supabase.from("match_events").insert({
        match_id: matchId,
        event_type: eventType,
        minute,
        team: "home",
        notes: clip ? "Highlight-Clip gespeichert" : undefined,
      });
      if (eventError) throw eventError;

      // 3. Upload highlight clip if available
      if (clip) {
        const ext = clip.mimeType.includes("mp4") ? "mp4" : "webm";
        const filePath = `${matchId}/highlight_${eventType}_${minute}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("match-videos")
          .upload(filePath, clip.blob, {
            contentType: clip.mimeType,
            upsert: true,
          });
        if (uploadError) throw uploadError;

        // 4. Record in match_videos table
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

      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
      toast.success(clip ? "Highlight gespeichert ✓" : "Event gespeichert ✓");
    } catch (err: any) {
      toast.error(err.message ?? "Event konnte nicht gespeichert werden");
    } finally {
      setSaving(null);
    }
  }, [matchId, recorderRef, recordingStartTime, saving]);

  return (
    <div className="flex gap-2 flex-wrap">
      {EVENT_BUTTONS.map((btn) => (
        <Button
          key={btn.type}
          size="sm"
          variant="secondary"
          className="gap-1.5 text-xs h-9 bg-background/80 backdrop-blur border border-border/50"
          disabled={saving !== null}
          onClick={() => handleEvent(btn.type)}
        >
          {saving === btn.type ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <span>{btn.icon}</span>
          )}
          {btn.label.split(" ")[1]}
        </Button>
      ))}
    </div>
  );
}
