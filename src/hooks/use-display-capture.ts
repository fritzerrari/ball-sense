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

/**
 * Display-Capture is effectively blocked when the app runs inside an iframe
 * without `allow="display-capture"` permission policy (e.g. Lovable editor preview).
 * In that case the user must open the live URL in a standalone tab.
 */
export function isDisplayCaptureBlockedByFrame(): boolean {
  return isInIframe();
}

export type DisplayCaptureStatus =
  | "success"
  | "iframe_blocked"
  | "ios_unsupported"
  | "api_missing"
  | "permission_denied"
  | "selection_cancelled"
  | "no_source"
  | "unknown_error";

export interface DisplayCaptureResult {
  status: DisplayCaptureStatus;
  stream: MediaStream | null;
  message: string | null;
}

const STATUS_MESSAGES: Record<Exclude<DisplayCaptureStatus, "success">, string> = {
  iframe_blocked:
    "Bildschirm-Capture ist im Editor-Vorschau-Fenster blockiert. Bitte öffne FieldIQ über die Live-URL (z.B. demo6.time2rise.de) in Chrome/Edge/Firefox.",
  ios_unsupported:
    "iOS unterstützt Bildschirm-Capture im Browser nicht. Bitte nutze ein Android-Gerät oder einen Desktop-Browser.",
  api_missing:
    "Dein Browser unterstützt Bildschirm-Capture nicht. Nutze Chrome, Edge oder Firefox (Desktop oder Android).",
  permission_denied:
    'Bildschirm-Freigabe abgelehnt. Bitte direkt erneut aus diesem Dialog starten und „Gesamten Bildschirm" wählen.',
  selection_cancelled: "Bildschirm-Auswahl abgebrochen. Bitte erneut starten.",
  no_source: "Kein freigebbarer Bildschirm gefunden. Bitte Browser auf neueste Version aktualisieren.",
  unknown_error: "Bildschirm-Capture fehlgeschlagen. Bitte erneut versuchen.",
};

interface UseDisplayCaptureOptions {
  onTrackEnded?: () => void;
}

/**
 * Wrapper around `navigator.mediaDevices.getDisplayMedia()`.
 * Used to capture the phone's screen so an external WiFi-camera app
 * (e.g. SafetyCam, V380) can act as the video source for FieldIQ.
 *
 * IMPORTANT: `start()` MUST be called synchronously from a user gesture
 * (click/touch handler). Any `await` before this call will lose the
 * transient activation on Android Chrome/Edge and cause failures that
 * masquerade as "browser not supported".
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

  const start = useCallback(async (): Promise<DisplayCaptureResult> => {
    setError(null);

    // Pre-flight checks — return classified status without invoking API
    if (isIOS()) {
      const message = STATUS_MESSAGES.ios_unsupported;
      setError(message);
      return { status: "ios_unsupported", stream: null, message };
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      const status: DisplayCaptureStatus = isInIframe() ? "iframe_blocked" : "api_missing";
      const message = STATUS_MESSAGES[status];
      setError(message);
      return { status, stream: null, message };
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
      return { status: "success", stream: ds, message: null };
    } catch (err: any) {
      const name = err?.name;
      let status: DisplayCaptureStatus;
      if (name === "NotAllowedError") {
        // Iframe permission policy denials also surface as NotAllowedError
        status = isInIframe() ? "iframe_blocked" : "permission_denied";
      } else if (name === "NotFoundError" || name === "NotSupportedError") {
        status = "no_source";
      } else if (name === "AbortError") {
        status = "selection_cancelled";
      } else {
        status = "unknown_error";
      }
      const message = STATUS_MESSAGES[status];
      setError(message);
      return { status, stream: null, message };
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
