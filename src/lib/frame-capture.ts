/**
 * Captures JPEG frames from a video element at regular intervals.
 * Returns an array of base64-encoded JPEG strings (without data URI prefix).
 *
 * Phase 1 Quick Wins:
 *  #1 Adaptive frame rate (15s..60s based on motion).
 *  #2 Extended quality checks (sharpness + duplicate detection via dHash).
 *  #3 Optional Web Worker for off-thread JPEG encoding (with sync fallback).
 *  #4 Smart frame selection — best-N per window before upload via getBestFramesSince().
 *
 * Backwards compatible: existing callers using getNewFramesSince/getNewTimestampsSince
 * continue to work unchanged. Set ENABLE_ADAPTIVE_CAPTURE=false to revert to legacy
 * fixed-interval behavior if any regression is suspected.
 */

import { encodeFrameInWorker, isWorkerEncodingSupported } from "./workers/frame-encoder-client";

// ===== Defaults (legacy) =====
const FRAME_INTERVAL_SEC = 30;
const MAX_FRAMES = 9999;
const CAPTURE_WIDTH = 640;
const JPEG_QUALITY = 0.6;
// Dynamic JPEG quality (Phase B): low motion → smaller files, high motion → sharper
const JPEG_QUALITY_LOW = 0.5;
const JPEG_QUALITY_HIGH = 0.7;

// ===== Quick Win #1 — Adaptive capture =====
const ENABLE_ADAPTIVE_CAPTURE = true;
const ADAPTIVE_MIN_INTERVAL_SEC = 15; // high motion
const ADAPTIVE_MAX_INTERVAL_SEC = 60; // low motion / pause
const MOTION_PROBE_INTERVAL_SEC = 5;  // lightweight probe (no upload)
const MOTION_HIGH_THRESHOLD = 18;     // mean abs pixel diff (0-255) → fast
const MOTION_LOW_THRESHOLD = 4;       // → slow

// ===== Boost-Takt — high-density capture near goal events =====
// Triggered when motion concentrates strongly on one side of the frame
// (likely attack near the box). Falls back to adaptive interval after
// motion calms down again.
const ENABLE_BOOST_CAPTURE = true;
const BOOST_INTERVAL_SEC = 5;
const BOOST_ASYMMETRY_THRESHOLD = 0.35; // |L-R|/(L+R)
const BOOST_MIN_MOTION = 10;            // minimum overall motion to consider

// ===== Quick Win #2 — Quality thresholds =====
const MIN_BRIGHTNESS = 15;
const MIN_VARIANCE = 200;
const MIN_SHARPNESS = 6;            // Sobel-based edge density score
const DUPLICATE_HAMMING_MAX = 3;    // dHash 64-bit; <=3 bits diff = duplicate

// ===== Quick Win #4 — Smart selection =====
const SMART_SELECTION_WINDOW_SEC = 90;
const SMART_SELECTION_KEEP_PER_WINDOW = 3;

export interface FrameQualityScore {
  brightness: number;
  variance: number;
  sharpness: number;
  total: number; // weighted composite 0..1
}

export interface SkipReasons {
  dark: number;
  uniform: number;
  blurry: number;
  duplicate: number;
}

export interface FrameCaptureResult {
  frames: string[]; // base64 JPEG strings
  timestamps: number[];
  durationSec: number;
  skippedFrames?: number;
  /** Detailed skip breakdown (Quick Win #2 telemetry). */
  skippedReasons?: SkipReasons;
  /** Per-frame quality scores aligned to `frames` (Quick Win #4). */
  qualityScores?: FrameQualityScore[];
}

// ============================================================
// Quality assessment (Quick Win #2)
// ============================================================

/** Lightweight Sobel-based sharpness estimate on a downsampled grid. */
function estimateSharpness(data: Uint8ClampedArray, width: number, height: number): number {
  const step = 4; // sample every 4th pixel for speed
  let edgeSum = 0;
  let count = 0;
  for (let y = step; y < height - step; y += step) {
    for (let x = step; x < width - step; x += step) {
      const i = (y * width + x) * 4;
      const center = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const right = (data[i + 4] + data[i + 5] + data[i + 6]) / 3;
      const down = (data[i + width * 4] + data[i + width * 4 + 1] + data[i + width * 4 + 2]) / 3;
      edgeSum += Math.abs(center - right) + Math.abs(center - down);
      count++;
    }
  }
  return count > 0 ? edgeSum / count : 0;
}

/** Compute dHash (8x8 difference hash) → 64-bit fingerprint as BigInt. */
function computeDHash(ctx: CanvasRenderingContext2D, srcW: number, srcH: number): bigint {
  // Downsample to 9x8 grayscale by sampling
  const gw = 9, gh = 8;
  const stepX = srcW / gw;
  const stepY = srcH / gh;
  const img = ctx.getImageData(0, 0, srcW, srcH).data;
  const gray = new Float32Array(gw * gh);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const sx = Math.min(srcW - 1, Math.floor(x * stepX));
      const sy = Math.min(srcH - 1, Math.floor(y * stepY));
      const i = (sy * srcW + sx) * 4;
      gray[y * gw + x] = (img[i] + img[i + 1] + img[i + 2]) / 3;
    }
  }
  let hash = 0n;
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw - 1; x++) {
      hash <<= 1n;
      if (gray[y * gw + x] < gray[y * gw + x + 1]) hash |= 1n;
    }
  }
  return hash;
}

function hammingDistance(a: bigint, b: bigint): number {
  let x = a ^ b;
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

interface QualityResult {
  usable: boolean;
  reason?: keyof SkipReasons;
  score: FrameQualityScore;
  hash: bigint;
}

function assessFrameQuality(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  lastHash: bigint | null,
): QualityResult {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Brightness + variance (sampled)
  const sampleStep = Math.max(1, Math.floor(width / 50));
  let sum = 0, sumSq = 0, count = 0;
  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const i = (y * width + x) * 4;
      const b = (data[i] + data[i + 1] + data[i + 2]) / 3;
      sum += b;
      sumSq += b * b;
      count++;
    }
  }
  const brightness = sum / count;
  const variance = sumSq / count - brightness * brightness;
  const sharpness = estimateSharpness(data, width, height);
  const hash = computeDHash(ctx, width, height);

  // Composite score: normalized 0..1 each, weighted
  const bScore = Math.min(1, brightness / 128);
  const vScore = Math.min(1, variance / 2000);
  const sScore = Math.min(1, sharpness / 30);
  const total = bScore * 0.3 + vScore * 0.3 + sScore * 0.4;
  const score: FrameQualityScore = { brightness, variance, sharpness, total };

  if (brightness < MIN_BRIGHTNESS) return { usable: false, reason: "dark", score, hash };
  if (variance < MIN_VARIANCE) return { usable: false, reason: "uniform", score, hash };
  if (sharpness < MIN_SHARPNESS) return { usable: false, reason: "blurry", score, hash };
  if (lastHash !== null && hammingDistance(hash, lastHash) <= DUPLICATE_HAMMING_MAX) {
    return { usable: false, reason: "duplicate", score, hash };
  }
  return { usable: true, score, hash };
}

// ============================================================
// JPEG encoding (Quick Win #3 — Worker with sync fallback)
// ============================================================

async function encodeJpeg(canvas: HTMLCanvasElement, quality: number = JPEG_QUALITY): Promise<string> {
  // Worker path — only when ImageBitmap + OffscreenCanvas are available.
  if (isWorkerEncodingSupported()) {
    try {
      const bitmap = await createImageBitmap(canvas);
      const base64 = await encodeFrameInWorker(bitmap, quality);
      bitmap.close?.();
      return base64;
    } catch (err) {
      // Silent fallback to sync path — worker path is best-effort only.
      console.warn("[frame-capture] worker encode failed, falling back sync:", err);
    }
  }
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return dataUrl.split(",")[1];
}

// ============================================================
// File-based capture (uploaded video) — unchanged behavior + new quality checks
// ============================================================

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
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  const frames: string[] = [];
  const timestamps: number[] = [];
  const qualityScores: FrameQualityScore[] = [];
  const skippedReasons: SkipReasons = { dark: 0, uniform: 0, blurry: 0, duplicate: 0 };
  let lastHash: bigint | null = null;
  const totalFrames = Math.min(Math.ceil(duration / FRAME_INTERVAL_SEC), MAX_FRAMES);
  const syntheticBase = Date.now();

  for (let i = 0; i < totalFrames; i++) {
    const seekTime = i * FRAME_INTERVAL_SEC;
    video.currentTime = seekTime;
    await new Promise<void>((resolve) => { video.onseeked = () => resolve(); });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const q = assessFrameQuality(ctx, canvas.width, canvas.height, lastHash);
    if (q.usable) {
      const base64 = await encodeJpeg(canvas);
      frames.push(base64);
      timestamps.push(syntheticBase + seekTime * 1000);
      qualityScores.push(q.score);
      lastHash = q.hash;
    } else if (q.reason) {
      skippedReasons[q.reason]++;
    }
    onProgress?.(Math.round(((i + 1) / totalFrames) * 100));
  }

  URL.revokeObjectURL(url);
  const skippedFrames = skippedReasons.dark + skippedReasons.uniform + skippedReasons.blurry + skippedReasons.duplicate;
  return { frames, timestamps, durationSec: Math.round(duration), skippedFrames, skippedReasons, qualityScores };
}

// ============================================================
// Live capture (Quick Wins #1, #2, #3, #4)
// ============================================================

export function startLiveCapture(
  videoEl: HTMLVideoElement,
  initialFrames?: string[],
  initialTimestamps?: number[],
) {
  const frames: string[] = initialFrames ? [...initialFrames] : [];
  const timestamps: number[] = initialTimestamps
    ? [...initialTimestamps]
    : initialFrames
      ? initialFrames.map((_, i) => Date.now() - (initialFrames.length - i) * FRAME_INTERVAL_SEC * 1000)
      : [];
  const qualityScores: FrameQualityScore[] = new Array(frames.length).fill(null).map(() => ({
    brightness: 0, variance: 0, sharpness: 0, total: 0.5, // unknown legacy frames → neutral score
  }));
  const skippedReasons: SkipReasons = { dark: 0, uniform: 0, blurry: 0, duplicate: 0 };

  const canvas = document.createElement("canvas");
  // Tiny canvas for motion probes (Quick Win #1)
  const probeCanvas = document.createElement("canvas");
  probeCanvas.width = 64;
  probeCanvas.height = 36;
  const probeCtx = probeCanvas.getContext("2d", { willReadFrequently: true })!;
  let lastProbe: Uint8ClampedArray | null = null;

  let captureTimer: ReturnType<typeof setTimeout> | null = null;
  let probeTimer: ReturnType<typeof setInterval> | null = null;
  const startTime = Date.now();
  let lastHash: bigint | null = null;
  let currentIntervalSec = FRAME_INTERVAL_SEC;
  let lastCaptureAt = 0;
  let stopped = false;

  let boostActive = false;
  let boostIntervalSec = BOOST_INTERVAL_SEC;

  // ---- Motion probe (drives adaptive interval + boost detection) ----
  const probe = () => {
    if (videoEl.videoWidth === 0) return;
    try {
      probeCtx.drawImage(videoEl, 0, 0, probeCanvas.width, probeCanvas.height);
      const cur = probeCtx.getImageData(0, 0, probeCanvas.width, probeCanvas.height).data;
      if (lastProbe) {
        let diff = 0;
        let leftDiff = 0;
        let rightDiff = 0;
        const w = probeCanvas.width;
        const h = probeCanvas.height;
        const half = Math.floor(w / 2);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const d = Math.abs(cur[i] - lastProbe[i]);
            diff += d;
            if (x < half) leftDiff += d; else rightDiff += d;
          }
        }
        const pixelCount = w * h;
        const meanDiff = diff / pixelCount;
        const asymmetry = (leftDiff + rightDiff) > 0
          ? Math.abs(leftDiff - rightDiff) / (leftDiff + rightDiff)
          : 0;

        // Boost-Takt: strong one-sided motion → likely attack near the box
        if (ENABLE_BOOST_CAPTURE
          && meanDiff >= BOOST_MIN_MOTION
          && asymmetry >= BOOST_ASYMMETRY_THRESHOLD) {
          boostActive = true;
        } else {
          boostActive = false;
        }

        if (ENABLE_ADAPTIVE_CAPTURE) {
          if (meanDiff > MOTION_HIGH_THRESHOLD) currentIntervalSec = ADAPTIVE_MIN_INTERVAL_SEC;
          else if (meanDiff < MOTION_LOW_THRESHOLD) currentIntervalSec = ADAPTIVE_MAX_INTERVAL_SEC;
          else currentIntervalSec = FRAME_INTERVAL_SEC;
        }
      }
      lastProbe = new Uint8ClampedArray(cur);
    } catch {
      // ignore probe errors — not critical
    }
  };

  // ---- Actual capture ----
  const capture = async () => {
    if (stopped) return;
    if (frames.length >= MAX_FRAMES) return;
    if (videoEl.videoWidth === 0) return;

    const aspectRatio = videoEl.videoHeight / videoEl.videoWidth;
    canvas.width = CAPTURE_WIDTH;
    canvas.height = Math.round(CAPTURE_WIDTH * aspectRatio);
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

    const q = assessFrameQuality(ctx, canvas.width, canvas.height, lastHash);
    if (q.usable) {
      try {
        const base64 = await encodeJpeg(canvas);
        if (stopped) return;
        frames.push(base64);
        timestamps.push(Date.now());
        qualityScores.push(q.score);
        lastHash = q.hash;
        lastCaptureAt = Date.now();
      } catch (err) {
        console.warn("[frame-capture] encode failed:", err);
      }
    } else if (q.reason) {
      skippedReasons[q.reason]++;
    }
  };

  // ---- Self-rescheduling loop (supports adaptive interval + boost) ----
  const scheduleNext = () => {
    if (stopped) return;
    const intervalSec = boostActive ? boostIntervalSec : currentIntervalSec;
    captureTimer = setTimeout(async () => {
      await capture();
      scheduleNext();
    }, intervalSec * 1000);
  };

  // Kick off
  void capture().then(() => {
    if (!stopped) scheduleNext();
  });
  probeTimer = setInterval(probe, MOTION_PROBE_INTERVAL_SEC * 1000);

  // ---- Smart selection helper (Quick Win #4) ----
  const selectBestInRange = (startIdx: number): { frames: string[]; timestamps: number[] } => {
    const slicedFrames = frames.slice(startIdx);
    const slicedTs = timestamps.slice(startIdx);
    const slicedScores = qualityScores.slice(startIdx);
    if (slicedFrames.length === 0) return { frames: [], timestamps: [] };

    // Group into windows by timestamp
    const windowMs = SMART_SELECTION_WINDOW_SEC * 1000;
    const baseTs = slicedTs[0];
    const windows = new Map<number, number[]>(); // windowKey → indices
    slicedTs.forEach((ts, i) => {
      const key = Math.floor((ts - baseTs) / windowMs);
      const arr = windows.get(key) ?? [];
      arr.push(i);
      windows.set(key, arr);
    });

    const keepIdx: number[] = [];
    for (const idxs of windows.values()) {
      if (idxs.length <= SMART_SELECTION_KEEP_PER_WINDOW) {
        keepIdx.push(...idxs);
      } else {
        // sort by score descending, keep top N
        const sorted = [...idxs].sort(
          (a, b) => (slicedScores[b]?.total ?? 0) - (slicedScores[a]?.total ?? 0),
        );
        keepIdx.push(...sorted.slice(0, SMART_SELECTION_KEEP_PER_WINDOW));
      }
    }
    keepIdx.sort((a, b) => a - b); // chronological

    return {
      frames: keepIdx.map((i) => slicedFrames[i]),
      timestamps: keepIdx.map((i) => slicedTs[i]),
    };
  };

  return {
    stop: (): FrameCaptureResult => {
      stopped = true;
      if (captureTimer) clearTimeout(captureTimer);
      if (probeTimer) clearInterval(probeTimer);
      const durationSec = Math.round((Date.now() - startTime) / 1000);
      const skippedFrames =
        skippedReasons.dark + skippedReasons.uniform + skippedReasons.blurry + skippedReasons.duplicate;
      return { frames, timestamps, durationSec, skippedFrames, skippedReasons, qualityScores };
    },
    getSnapshot: (): FrameCaptureResult => {
      const durationSec = Math.round((Date.now() - startTime) / 1000);
      const skippedFrames =
        skippedReasons.dark + skippedReasons.uniform + skippedReasons.blurry + skippedReasons.duplicate;
      return {
        frames: [...frames],
        timestamps: [...timestamps],
        durationSec,
        skippedFrames,
        skippedReasons: { ...skippedReasons },
        qualityScores: [...qualityScores],
      };
    },
    getFrameCount: () => frames.length,
    getSkippedCount: () =>
      skippedReasons.dark + skippedReasons.uniform + skippedReasons.blurry + skippedReasons.duplicate,
    /** Skip-reason breakdown for telemetry (Quick Win #2). */
    getSkippedReasons: (): SkipReasons => ({ ...skippedReasons }),
    /** Current adaptive interval in seconds (Quick Win #1). */
    getCurrentIntervalSec: () => (boostActive ? boostIntervalSec : currentIntervalSec),
    /** True when boost-takt is active (one-sided high motion → likely scoring chance). */
    isBoostActive: () => boostActive,
    /** Returns new frames since the given index (raw, for delta uploads). */
    getNewFramesSince: (startIndex: number): string[] => frames.slice(startIndex),
    getNewTimestampsSince: (startIndex: number): number[] => timestamps.slice(startIndex),
    /** Quick Win #4 — best-N per 90s window since startIndex. */
    getBestFramesSince: (startIndex: number) => selectBestInRange(startIndex),
  };
}
