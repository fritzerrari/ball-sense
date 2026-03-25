import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

interface RecordingGuardProps {
  isRecording: boolean;
  frameCount: number;
  onVisibilityLost?: () => void;
}

/**
 * Invisible component that provides recording stability:
 * - Orientation lock (landscape) during recording
 * - Visibility change warnings (browser tab switch)
 * - Wake lock to prevent screen sleep
 */
export default function RecordingGuard({ isRecording, frameCount, onVisibilityLost }: RecordingGuardProps) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const visibilityToastShown = useRef(false);

  // Orientation lock
  useEffect(() => {
    if (!isRecording) return;
    const lockOrientation = async () => {
      try {
        await (screen.orientation as any)?.lock?.("landscape");
      } catch {
        // Not supported on all browsers — that's OK
      }
    };
    lockOrientation();
    return () => {
      try { (screen.orientation as any)?.unlock?.(); } catch {}
    };
  }, [isRecording]);

  // Wake lock
  useEffect(() => {
    if (!isRecording) return;
    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        }
      } catch {}
    };
    requestWakeLock();
    return () => {
      wakeLockRef.current?.release();
      wakeLockRef.current = null;
    };
  }, [isRecording]);

  // Visibility change warning
  const handleVisibility = useCallback(() => {
    if (document.hidden && isRecording && !visibilityToastShown.current) {
      visibilityToastShown.current = true;
      toast.warning("App im Vordergrund halten! Sonst werden keine Frames erfasst.", {
        duration: 6000,
      });
      onVisibilityLost?.();
      // Reset after 10s so it can warn again
      setTimeout(() => { visibilityToastShown.current = false; }, 10000);
    }
  }, [isRecording, onVisibilityLost]);

  useEffect(() => {
    if (!isRecording) return;
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [isRecording, handleVisibility]);

  // Warn on page unload during recording
  useEffect(() => {
    if (!isRecording) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Aufnahme läuft — wirklich verlassen?";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isRecording]);

  return null; // Invisible — only side effects
}

/** Minimum frames required before stop is allowed */
export const MIN_FRAMES_FOR_ANALYSIS = 1;

/** Recommended frames for good analysis (~full half) */
export const RECOMMENDED_FRAMES = 30;

/** Check if we have enough frames — always allowed after 1 frame */
export function canStopRecording(frameCount: number): boolean {
  return frameCount >= MIN_FRAMES_FOR_ANALYSIS;
}
