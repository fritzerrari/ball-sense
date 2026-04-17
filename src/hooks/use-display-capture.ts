import { useCallback, useRef, useState } from "react";

/** Detect iOS — getDisplayMedia is not supported on iOS Safari */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (/Mac/.test(ua) && "ontouchend" in document);
}

/** Detect if app runs inside an iframe (e.g. Lovable preview editor) */
export function isInIframe(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** Whether the browser exposes `getDisplayMedia()` at all */
export function isDisplayCaptureSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === "function" &&
    !isIOS()
  );
}

interface UseDisplayCaptureOptions {
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
      const msg =
        "iOS unterstützt Bildschirm-Capture im Browser nicht. Bitte nutze ein Android-Gerät oder einen Desktop-Browser.";
      setError(msg);
      return null;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      const msg = isInIframe()
        ? "Bildschirm-Capture ist im Editor-Vorschau-Fenster blockiert. Bitte öffne FieldIQ über die Live-URL (z.B. demo6.time2rise.de) in Chrome/Edge/Firefox."
        : "Dein Browser unterstützt Bildschirm-Capture nicht. Nutze Chrome, Edge oder Firefox (Desktop oder Android).";
      setError(msg);
      return null;
    }

    setStarting(true);
    try {
      // Triggered directly from the user gesture — no awaits before this call.
      const ds = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } } as MediaTrackConstraints,
        audio: false,
      });

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
      let msg: string;
      const name = err?.name;
      if (name === "NotAllowedError") {
        // This also fires when iframe permission policy blocks display-capture
        msg = isInIframe()
          ? "Bildschirm-Freigabe wurde abgelehnt oder ist im Editor-Vorschau blockiert. Bitte öffne FieldIQ über die Live-URL (demo6.time2rise.de)."
          : "Bildschirm-Freigabe abgelehnt. Bitte erneut versuchen und „Gesamten Bildschirm" wählen.";
      } else if (name === "NotFoundError" || name === "NotSupportedError") {
        msg = "Kein freigebbarer Bildschirm gefunden. Bitte Browser auf neueste Version aktualisieren.";
      } else if (name === "AbortError") {
        msg = "Bildschirm-Auswahl abgebrochen.";
      } else {
        msg = err?.message ?? "Bildschirm-Capture fehlgeschlagen.";
      }
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
    isInIframe: isInIframe(),
  };
}
