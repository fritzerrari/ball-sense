import { useCallback, useRef, useState } from "react";

/** Detect iOS — getDisplayMedia is not supported on iOS Safari */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // iPhone, iPad, iPod, plus iPadOS that masquerades as Mac with touch
  return /iPad|iPhone|iPod/.test(ua) || (/Mac/.test(ua) && "ontouchend" in document);
}

/** Whether the browser supports `getDisplayMedia()` */
export function isDisplayCaptureSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === "function" &&
    !isIOS()
  );
}

interface UseDisplayCaptureOptions {
  /** Called when the user (or the OS) ends the screen share. */
  onTrackEnded?: () => void;
}

/**
 * Wrapper around `navigator.mediaDevices.getDisplayMedia()`.
 * Used to capture the phone's screen so an external WiFi-camera app
 * (e.g. SafetyCam, V380) can act as the video source for FieldIQ.
 */
export function useDisplayCapture(opts: UseDisplayCaptureOptions = {}) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setStream(null);
  }, []);

  const start = useCallback(async (): Promise<MediaStream | null> => {
    setError(null);

    if (isIOS()) {
      const msg = "iOS unterstützt Bildschirm-Capture im Browser nicht. Bitte nutze ein Android-Gerät.";
      setError(msg);
      return null;
    }
    if (!isDisplayCaptureSupported()) {
      const msg = "Dein Browser unterstützt Bildschirm-Capture nicht. Nutze Chrome auf Android.";
      setError(msg);
      return null;
    }

    setStarting(true);
    try {
      const ds = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } } as MediaTrackConstraints,
        audio: false,
      });

      // Listen for user-initiated stop (system "Stop sharing" button)
      ds.getVideoTracks().forEach((track) => {
        track.addEventListener("ended", () => {
          streamRef.current = null;
          setStream(null);
          opts.onTrackEnded?.();
        });
      });

      streamRef.current = ds;
      setStream(ds);
      return ds;
    } catch (err: any) {
      const msg =
        err?.name === "NotAllowedError"
          ? "Bildschirm-Freigabe abgelehnt."
          : err?.message ?? "Bildschirm-Capture fehlgeschlagen.";
      setError(msg);
      return null;
    } finally {
      setStarting(false);
    }
  }, [opts]);

  return {
    stream,
    error,
    starting,
    start,
    stop,
    getStream: () => streamRef.current,
    supported: isDisplayCaptureSupported(),
    isIOS: isIOS(),
  };
}
