/**
 * Captures JPEG frames from a video element at regular intervals.
 * Returns an array of base64-encoded JPEG strings (without data URI prefix).
 * Includes frame quality checks to skip black/blurry frames.
 */

const FRAME_INTERVAL_SEC = 30;
const MAX_FRAMES = 180;
const CAPTURE_WIDTH = 640;
const JPEG_QUALITY = 0.6;

/** Minimum average brightness (0-255) to accept a frame */
const MIN_BRIGHTNESS = 15;
/** Minimum variance in pixel values to detect non-uniform (non-black) frames */
const MIN_VARIANCE = 200;

export interface FrameCaptureResult {
  frames: string[]; // base64 JPEG strings
  durationSec: number;
  skippedFrames?: number; // number of frames skipped due to quality
}

/**
 * Check if a frame is usable (not black, not completely uniform).
 * Samples pixels from the canvas to compute average brightness and variance.
 */
function isFrameUsable(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const sampleSize = 50;
  const stepX = Math.max(1, Math.floor(width / sampleSize));
  const stepY = Math.max(1, Math.floor(height / sampleSize));
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const i = (y * width + x) * 4;
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      sum += brightness;
      sumSq += brightness * brightness;
      count++;
    }
  }

  const avg = sum / count;
  const variance = (sumSq / count) - (avg * avg);

  return avg >= MIN_BRIGHTNESS && variance >= MIN_VARIANCE;
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
  let skippedFrames = 0;
  const totalFrames = Math.min(Math.ceil(duration / FRAME_INTERVAL_SEC), MAX_FRAMES);

  for (let i = 0; i < totalFrames; i++) {
    const seekTime = i * FRAME_INTERVAL_SEC;
    video.currentTime = seekTime;

    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (isFrameUsable(ctx, canvas.width, canvas.height)) {
      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      frames.push(dataUrl.split(",")[1]);
    } else {
      skippedFrames++;
    }

    onProgress?.(Math.round(((i + 1) / totalFrames) * 100));
  }

  URL.revokeObjectURL(url);
  return { frames, durationSec: Math.round(duration), skippedFrames };
}

/**
 * Live frame capture during recording.
 * Call startLiveCapture with the video element showing the camera stream.
 * Call stop() on the returned object when recording ends.
 */
export function startLiveCapture(videoEl: HTMLVideoElement) {
  const frames: string[] = [];
  let skippedFrames = 0;
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

    if (isFrameUsable(ctx, canvas.width, canvas.height)) {
      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      frames.push(dataUrl.split(",")[1]);
    } else {
      skippedFrames++;
    }
  };

  // Capture first frame immediately
  capture();
  interval = setInterval(capture, FRAME_INTERVAL_SEC * 1000);

  return {
    stop: (): FrameCaptureResult => {
      if (interval) clearInterval(interval);
      const durationSec = Math.round((Date.now() - startTime) / 1000);
      return { frames, durationSec, skippedFrames };
    },
    /** Returns a snapshot of frames captured so far WITHOUT stopping the capture */
    getSnapshot: (): FrameCaptureResult => {
      const durationSec = Math.round((Date.now() - startTime) / 1000);
      return { frames: [...frames], durationSec, skippedFrames };
    },
    getFrameCount: () => frames.length,
    getSkippedCount: () => skippedFrames,
  };
}
