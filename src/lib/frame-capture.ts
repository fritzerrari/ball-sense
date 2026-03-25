/**
 * Captures JPEG frames from a video element at regular intervals.
 * Returns an array of base64-encoded JPEG strings (without data URI prefix).
 */

const FRAME_INTERVAL_SEC = 30;
const MAX_FRAMES = 180;
const CAPTURE_WIDTH = 640;
const JPEG_QUALITY = 0.6;

export interface FrameCaptureResult {
  frames: string[]; // base64 JPEG strings
  durationSec: number;
}

/**
 * Extract frames from a File (user-uploaded video).
 * Plays the video in a hidden element, seeking every FRAME_INTERVAL_SEC.
 */
export async function captureFramesFromFile(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<FrameCaptureResult> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Video konnte nicht geladen werden"));
  });

  const duration = video.duration;
  if (!duration || !isFinite(duration)) {
    URL.revokeObjectURL(url);
    throw new Error("Video-Dauer konnte nicht ermittelt werden");
  }

  const canvas = document.createElement("canvas");
  const aspectRatio = video.videoHeight / video.videoWidth;
  canvas.width = CAPTURE_WIDTH;
  canvas.height = Math.round(CAPTURE_WIDTH * aspectRatio);
  const ctx = canvas.getContext("2d")!;

  const frames: string[] = [];
  const totalFrames = Math.min(Math.ceil(duration / FRAME_INTERVAL_SEC), MAX_FRAMES);

  for (let i = 0; i < totalFrames; i++) {
    const seekTime = i * FRAME_INTERVAL_SEC;
    video.currentTime = seekTime;

    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    frames.push(dataUrl.split(",")[1]); // strip data:image/jpeg;base64,

    onProgress?.(Math.round(((i + 1) / totalFrames) * 100));
  }

  URL.revokeObjectURL(url);
  return { frames, durationSec: Math.round(duration) };
}

/**
 * Live frame capture during recording.
 * Call startLiveCapture with the video element showing the camera stream.
 * Call stop() on the returned object when recording ends.
 */
export function startLiveCapture(videoEl: HTMLVideoElement) {
  const frames: string[] = [];
  const canvas = document.createElement("canvas");
  let interval: ReturnType<typeof setInterval> | null = null;
  const startTime = Date.now();

  const capture = () => {
    if (frames.length >= MAX_FRAMES) return;
    if (videoEl.videoWidth === 0) return;

    const aspectRatio = videoEl.videoHeight / videoEl.videoWidth;
    canvas.width = CAPTURE_WIDTH;
    canvas.height = Math.round(CAPTURE_WIDTH * aspectRatio);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    frames.push(dataUrl.split(",")[1]);
  };

  // Capture first frame immediately
  capture();
  interval = setInterval(capture, FRAME_INTERVAL_SEC * 1000);

  return {
    stop: (): FrameCaptureResult => {
      if (interval) clearInterval(interval);
      const durationSec = Math.round((Date.now() - startTime) / 1000);
      return { frames, durationSec };
    },
    /** Returns a snapshot of frames captured so far WITHOUT stopping the capture */
    getSnapshot: (): FrameCaptureResult => {
      const durationSec = Math.round((Date.now() - startTime) / 1000);
      return { frames: [...frames], durationSec };
    },
    getFrameCount: () => frames.length,
  };
}
