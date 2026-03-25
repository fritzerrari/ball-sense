/**
 * Ring-buffer video recorder for highlight clip extraction.
 * Records at 480p using MediaRecorder, keeping the last ~30s in memory.
 * When an event occurs, the buffer contents are flushed into a highlight Blob.
 */

const CHUNK_DURATION_MS = 10_000; // 10s chunks
const MAX_BUFFER_CHUNKS = 3; // keep last 30s
const MAX_HIGHLIGHTS = 20;
const CAPTURE_HEIGHT = 480;

function pickMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "";
}

export interface HighlightClip {
  blob: Blob;
  eventType: string;
  minute: number;
  mimeType: string;
}

export interface VideoRecorderHandle {
  /** Extract a highlight from the current ring buffer */
  extractHighlight: (eventType: string, minute: number) => HighlightClip | null;
  /** Stop recording and clean up — no full video is saved */
  stop: () => void;
  /** Number of highlights extracted so far */
  highlightCount: () => number;
  /** Whether MediaRecorder is supported and active */
  isActive: () => boolean;
}

/**
 * Start a ring-buffer video recorder on a media stream.
 * Returns null if MediaRecorder is not supported.
 */
export function startVideoRecorder(stream: MediaStream): VideoRecorderHandle | null {
  const mimeType = pickMimeType();
  if (!mimeType) {
    console.warn("[VideoRecorder] No supported MIME type found");
    return null;
  }

  // Constrain to 480p if possible
  const videoTrack = stream.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.applyConstraints({ height: { ideal: CAPTURE_HEIGHT } }).catch(() => {});
  }

  const buffer: Blob[] = [];
  let highlights = 0;
  let stopped = false;

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 1_000_000, // 1 Mbps for 480p
    });
  } catch (e) {
    console.warn("[VideoRecorder] Failed to create MediaRecorder:", e);
    return null;
  }

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      buffer.push(e.data);
      // Keep only last N chunks (ring buffer)
      while (buffer.length > MAX_BUFFER_CHUNKS) {
        buffer.shift();
      }
    }
  };

  recorder.onerror = () => {
    console.warn("[VideoRecorder] Recorder error");
  };

  recorder.start(CHUNK_DURATION_MS);

  return {
    extractHighlight(eventType: string, minute: number): HighlightClip | null {
      if (stopped || highlights >= MAX_HIGHLIGHTS || buffer.length === 0) return null;

      // Take all buffered chunks as the highlight (~10-30s)
      const blob = new Blob([...buffer], { type: mimeType });
      highlights++;

      return { blob, eventType, minute, mimeType };
    },

    stop() {
      if (stopped) return;
      stopped = true;
      if (recorder.state !== "inactive") {
        try { recorder.stop(); } catch {}
      }
      buffer.length = 0;
    },

    highlightCount: () => highlights,
    isActive: () => !stopped && recorder.state === "recording",
  };
}
