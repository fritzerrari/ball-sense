/**
 * FootballTracker — Real-time player detection via Gemini Vision AI.
 * Captures video frames every ~2.5s, sends to analyze-frame edge function,
 * and returns real detected player positions.
 */

import { HighlightRecorder } from "./highlight-recorder";

export interface Detection {
  id: number;
  x: number; // 0-1 normalized
  y: number;
  w: number;
  h: number;
  confidence: number;
  label: string; // "person" | "ball"
  team?: "home" | "away";
}

export interface TrackingFrame {
  timestamp: number;
  detections: Detection[];
}

type ProgressCallback = (pct: number) => void;
type DetectionCallback = (frame: TrackingFrame) => void;

export type UploadMode = "batch" | "live";

interface LiveStreamConfig {
  matchId: string;
  cameraIndex: number;
  supabaseUrl: string;
  sessionToken: string;
  onChunkSent?: (seq: number, ok: boolean) => void;
}

export type StabilityEvent = "bump" | "drift" | "zoom_change";
export type StabilityCallback = (event: StabilityEvent, detail?: string) => void;

const ANALYZE_FRAME_URL = `${typeof import.meta !== "undefined" ? import.meta.env?.VITE_SUPABASE_URL ?? "" : ""}/functions/v1/analyze-frame`;
const AI_FRAME_INTERVAL_MS = 2500; // Send frame to AI every 2.5s
const FALLBACK_REUSE_MS = 8000; // Reuse last AI result for up to 8s on failure

export class FootballTracker {
  private modelLoaded = false;
  private tracking = false;
  private paused = false;
  private frames: TrackingFrame[] = [];
  private intervalId: number | null = null;
  private aiIntervalId: number | null = null;
  private startTime = 0;
  private videoElement: HTMLVideoElement | null = null;
  private homeSquadSize = 0;
  private awaySquadSize = 0;

  // AI detection state
  private lastAIDetections: Detection[] = [];
  private lastAITimestamp = 0;
  private aiInFlight = false;
  private aiFrameCanvas: HTMLCanvasElement | null = null;
  private fieldCoverage = 1;
  private aiErrorCount = 0;
  private totalAIFrames = 0;
  private successfulAIFrames = 0;

  // Live streaming state
  private uploadMode: UploadMode = "batch";
  private liveConfig: LiveStreamConfig | null = null;
  private liveBuffer: TrackingFrame[] = [];
  private liveSequence = 0;
  private liveIntervalId: number | null = null;
  private chunksSent = 0;
  private chunksOk = 0;
  private pendingChunks: { seq: number; frames: TrackingFrame[] }[] = [];

  // Zoom monitoring
  private calibratedZoom: number | null = null;
  private zoomCheckIntervalId: number | null = null;
  private onZoomChange: ((currentZoom: number, calibratedZoom: number) => void) | null = null;

  // Stability monitoring
  private stabilityIntervalId: number | null = null;
  private referenceImageData: ImageData | null = null;
  private highDiffCount = 0;
  private motionListenerActive = false;
  private onStabilityEvent: StabilityCallback | null = null;
  private stabilityCanvas: HTMLCanvasElement | null = null;

  // Highlight recording
  private highlightRecorder = new HighlightRecorder();
  private lastBallZone: "left" | "center" | "right" = "center";
  private lastBallZoneTime = 0;

  // Match context for AI calls
  private matchId = "";
  private cameraIndex = 0;

  setSquadSizes(home: number, away: number) {
    this.homeSquadSize = home;
    this.awaySquadSize = away;
  }

  setUploadMode(mode: UploadMode) {
    this.uploadMode = mode;
  }

  getUploadMode(): UploadMode {
    return this.uploadMode;
  }

  getChunkStats() {
    return { sent: this.chunksSent, ok: this.chunksOk, pending: this.pendingChunks.length };
  }

  getHighlightRecorder(): HighlightRecorder {
    return this.highlightRecorder;
  }

  getFieldCoverage(): number {
    return this.fieldCoverage;
  }

  getAIStats() {
    return { total: this.totalAIFrames, successful: this.successfulAIFrames, errors: this.aiErrorCount };
  }

  async loadModel(onProgress?: ProgressCallback): Promise<void> {
    // No actual model to load — we use cloud AI. But simulate brief loading for UX continuity.
    for (let i = 0; i <= 100; i += 5) {
      await new Promise(r => setTimeout(r, 20));
      onProgress?.(i);
    }
    this.modelLoaded = true;
  }

  async startCamera(videoElement: HTMLVideoElement, cameraIndex = 0): Promise<void> {
    this.videoElement = videoElement;
    this.cameraIndex = cameraIndex;
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: cameraIndex === 0 ? "environment" : "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          const caps = track.getCapabilities?.() as MediaTrackCapabilities & { zoom?: { min: number; max: number } };
          if (caps?.zoom) {
            await track.applyConstraints({ advanced: [{ zoom: caps.zoom.min } as any] });
            const settings = track.getSettings() as MediaTrackSettings & { zoom?: number };
            this.calibratedZoom = settings.zoom ?? caps.zoom.min;
          }
        } catch { /* zoom not supported */ }
      }
      videoElement.srcObject = stream;
      await videoElement.play();
    } catch {
      console.warn("Kamera nicht verfügbar, nutze Platzhalter-Modus");
    }
  }

  setZoomChangeCallback(cb: ((currentZoom: number, calibratedZoom: number) => void) | null) {
    this.onZoomChange = cb;
  }

  startZoomMonitoring() {
    if (this.zoomCheckIntervalId) return;
    this.zoomCheckIntervalId = window.setInterval(() => {
      if (!this.videoElement?.srcObject) return;
      const stream = this.videoElement.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      if (!track) return;
      try {
        const settings = track.getSettings() as MediaTrackSettings & { zoom?: number };
        if (settings.zoom != null && this.calibratedZoom != null) {
          const diff = Math.abs(settings.zoom - this.calibratedZoom);
          if (diff > 0.1) {
            this.onZoomChange?.(settings.zoom, this.calibratedZoom);
          }
        }
      } catch { /* ignore */ }
    }, 10_000);
  }

  getCurrentZoom(): number | null {
    if (!this.videoElement?.srcObject) return null;
    const stream = this.videoElement.srcObject as MediaStream;
    const track = stream.getVideoTracks()[0];
    if (!track) return null;
    try {
      const settings = track.getSettings() as MediaTrackSettings & { zoom?: number };
      return settings.zoom ?? null;
    } catch { return null; }
  }

  async loadCalibration(fieldId: string): Promise<any | null> {
    const cached = localStorage.getItem(`calibration_${fieldId}`);
    if (cached) {
      try { return JSON.parse(cached); } catch { /* ignore */ }
    }
    return null;
  }

  // ── Stability Monitoring ──

  setStabilityCallback(cb: StabilityCallback | null) {
    this.onStabilityEvent = cb;
  }

  startStabilityMonitoring() {
    if (this.stabilityIntervalId) return;
    this.stabilityCanvas = document.createElement("canvas");
    this.stabilityCanvas.width = 40;
    this.stabilityCanvas.height = 30;
    this.stabilityIntervalId = window.setInterval(() => {
      this.checkFrameDifference();
    }, 5_000);
    this.startDeviceMotionMonitoring();
  }

  stopStabilityMonitoring() {
    if (this.stabilityIntervalId) {
      clearInterval(this.stabilityIntervalId);
      this.stabilityIntervalId = null;
    }
    this.stopDeviceMotionMonitoring();
    this.referenceImageData = null;
    this.highDiffCount = 0;
    this.stabilityCanvas = null;
  }

  private checkFrameDifference() {
    if (!this.videoElement || !this.videoElement.videoWidth || !this.stabilityCanvas) return;
    const ctx = this.stabilityCanvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(this.videoElement, 0, 0, this.stabilityCanvas.width, this.stabilityCanvas.height);
    const currentData = ctx.getImageData(0, 0, this.stabilityCanvas.width, this.stabilityCanvas.height);
    if (!this.referenceImageData) {
      this.referenceImageData = currentData;
      return;
    }
    let totalDiff = 0;
    const pixels = currentData.data.length / 4;
    for (let i = 0; i < currentData.data.length; i += 4) {
      const dr = Math.abs(currentData.data[i] - this.referenceImageData.data[i]);
      const dg = Math.abs(currentData.data[i + 1] - this.referenceImageData.data[i + 1]);
      const db = Math.abs(currentData.data[i + 2] - this.referenceImageData.data[i + 2]);
      totalDiff += (dr + dg + db) / (3 * 255);
    }
    const avgDiff = totalDiff / pixels;
    if (avgDiff > 0.15) {
      this.highDiffCount++;
      if (this.highDiffCount === 1) {
        this.onStabilityEvent?.("bump", `Bewegung erkannt (${(avgDiff * 100).toFixed(0)}%)`);
      } else if (this.highDiffCount >= 3) {
        this.onStabilityEvent?.("drift", "Kamera-Position hat sich verändert");
      }
    } else {
      if (this.highDiffCount > 0) this.highDiffCount = 0;
      this.referenceImageData = currentData;
    }
  }

  private startDeviceMotionMonitoring() {
    if (this.motionListenerActive) return;
    if (typeof window === "undefined" || !("DeviceMotionEvent" in window)) return;
    const handler = (e: DeviceMotionEvent) => {
      const acc = e.acceleration;
      if (!acc) return;
      const magnitude = Math.sqrt((acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2);
      if (magnitude > 20) {
        this.onStabilityEvent?.("bump", `Starker Stoß erkannt (${magnitude.toFixed(1)} m/s²)`);
        this.checkZoomNow();
      }
    };
    window.addEventListener("devicemotion", handler);
    this.motionListenerActive = true;
    (this as any)._motionHandler = handler;
  }

  private stopDeviceMotionMonitoring() {
    if (!this.motionListenerActive) return;
    window.removeEventListener("devicemotion", (this as any)._motionHandler);
    this.motionListenerActive = false;
  }

  private checkZoomNow() {
    if (!this.videoElement?.srcObject) return;
    const stream = this.videoElement.srcObject as MediaStream;
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    try {
      const settings = track.getSettings() as MediaTrackSettings & { zoom?: number };
      if (settings.zoom != null && this.calibratedZoom != null) {
        const diff = Math.abs(settings.zoom - this.calibratedZoom);
        if (diff > 0.1) {
          this.onStabilityEvent?.("zoom_change");
        }
      }
    } catch { /* ignore */ }
  }

  updateCalibratedZoom() {
    const zoom = this.getCurrentZoom();
    if (zoom != null) this.calibratedZoom = zoom;
    this.highDiffCount = 0;
    this.referenceImageData = null;
  }

  // ── Real AI Frame Analysis ──

  /**
   * Capture current video frame as base64 JPEG for AI analysis.
   */
  private captureFrameBase64(): string | null {
    let srcVideo = this.videoElement;
    // Fallback: if primary video has zero dimensions (mobile display:none issue), try finding visible tracking video
    if (!srcVideo || !srcVideo.videoWidth) {
      const fallback = document.querySelector<HTMLVideoElement>("video[data-tracking-video]");
      if (fallback && fallback.videoWidth > 0) {
        srcVideo = fallback;
      } else {
        return null;
      }
    }
    if (!this.aiFrameCanvas) {
      this.aiFrameCanvas = document.createElement("canvas");
    }
    // Resize to 480px wide for faster upload & lower base64 size
    const scale = Math.min(1, 480 / this.videoElement.videoWidth);
    this.aiFrameCanvas.width = Math.round(this.videoElement.videoWidth * scale);
    this.aiFrameCanvas.height = Math.round(this.videoElement.videoHeight * scale);
    const ctx = this.aiFrameCanvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(this.videoElement, 0, 0, this.aiFrameCanvas.width, this.aiFrameCanvas.height);
    // Get as JPEG base64 with lower quality to stay under API limits
    const dataUrl = this.aiFrameCanvas.toDataURL("image/jpeg", 0.5);
    return dataUrl.split(",")[1] ?? null;
  }

  /**
   * Send frame to AI for real player detection.
   */
  private async analyzeCurrentFrame(): Promise<void> {
    if (this.aiInFlight || !this.tracking || this.paused) return;

    const base64 = this.captureFrameBase64();
    if (!base64) return;

    this.aiInFlight = true;
    this.totalAIFrames++;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout

      const resp = await fetch(ANALYZE_FRAME_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": (typeof import.meta !== "undefined" ? import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY : "") ?? "",
        },
        body: JSON.stringify({
          imageBase64: base64,
          matchId: this.matchId,
          cameraIndex: this.cameraIndex,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (resp.status === 429) {
        // Rate limited — back off, reuse last detections
        console.warn("[Tracker] AI rate limited, reusing last detections");
        this.aiErrorCount++;
        return;
      }

      if (!resp.ok) {
        const errText = await resp.text();
        console.warn(`[Tracker] AI analysis failed (${resp.status}):`, errText);
        this.aiErrorCount++;
        return;
      }

      const result = await resp.json();
      if (result.detections && Array.isArray(result.detections)) {
        this.lastAIDetections = result.detections;
        this.lastAITimestamp = Date.now();
        this.fieldCoverage = result.field_coverage ?? 1;
        this.successfulAIFrames++;
        this.aiErrorCount = 0; // Reset error count on success
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        console.warn("[Tracker] AI analysis timed out");
      } else {
        console.warn("[Tracker] AI analysis error:", err);
      }
      this.aiErrorCount++;
    } finally {
      this.aiInFlight = false;
    }
  }

  /**
   * Get current detections — real AI results or last known.
   */
  private getCurrentDetections(): Detection[] {
    const age = Date.now() - this.lastAITimestamp;
    if (this.lastAIDetections.length > 0 && age < FALLBACK_REUSE_MS) {
      return this.lastAIDetections;
    }
    // No recent detections — return empty (don't fabricate)
    return [];
  }

  // ── Live Stream & Upload ──

  configureLiveStream(config: LiveStreamConfig) {
    this.uploadMode = "live";
    this.liveConfig = config;
    this.liveBuffer = [];
    this.liveSequence = 0;
    this.chunksSent = 0;
    this.chunksOk = 0;
    this.pendingChunks = [];
  }

  private async sendChunk(seq: number, frames: TrackingFrame[]) {
    if (!this.liveConfig) return;
    const { matchId, cameraIndex, supabaseUrl, sessionToken, onChunkSent } = this.liveConfig;
    const url = `${supabaseUrl}/functions/v1/stream-tracking`;
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, cameraIndex, sequence: seq, frames, sessionToken }),
      });
      if (resp.ok) {
        this.chunksOk++;
        this.pendingChunks = this.pendingChunks.filter(c => c.seq !== seq);
        onChunkSent?.(seq, true);
      } else {
        console.warn(`Chunk ${seq} failed: ${resp.status}`);
        onChunkSent?.(seq, false);
      }
    } catch {
      console.warn(`Chunk ${seq} network error, will retry`);
      onChunkSent?.(seq, false);
    }
  }

  private startLiveInterval() {
    if (this.liveIntervalId) return;
    this.liveIntervalId = window.setInterval(() => {
      if (this.liveBuffer.length === 0) return;
      const chunk = [...this.liveBuffer];
      this.liveBuffer = [];
      const seq = this.liveSequence++;
      this.chunksSent++;
      this.pendingChunks.push({ seq, frames: chunk });
      this.sendChunk(seq, chunk);
    }, 30_000);
  }

  async retryPendingChunks() {
    const pending = [...this.pendingChunks];
    for (const chunk of pending) {
      await this.sendChunk(chunk.seq, chunk.frames);
    }
  }

  // ── Tracking Lifecycle ──

  startTracking(canvasElement: HTMLCanvasElement | null, matchId: string, onDetections?: DetectionCallback): void {
    if (!this.modelLoaded) throw new Error("Modell nicht geladen");
    this.tracking = true;
    this.paused = false;
    this.startTime = Date.now();
    this.frames = [];
    this.matchId = matchId;
    this.lastAIDetections = [];
    this.lastAITimestamp = 0;
    this.aiErrorCount = 0;
    this.totalAIFrames = 0;
    this.successfulAIFrames = 0;

    if (this.uploadMode === "live" && this.liveConfig) {
      this.startLiveInterval();
    }

    // Start highlight recording if enabled
    if (this.highlightRecorder.isEnabled() && this.videoElement?.srcObject) {
      this.highlightRecorder.start(this.videoElement.srcObject as MediaStream, this.startTime);
    }

    // AI analysis interval — every 2.5s, send frame to Gemini Vision
    this.aiIntervalId = window.setInterval(() => {
      if (!this.paused && this.tracking) {
        this.analyzeCurrentFrame();
      }
    }, AI_FRAME_INTERVAL_MS);

    // Trigger first analysis immediately after a brief delay for camera stability
    setTimeout(() => {
      if (this.tracking && !this.paused) {
        this.analyzeCurrentFrame();
      }
    }, 500);

    // Detection broadcast interval — emit current detections every 500ms for smooth UI
    const loop = () => {
      if (!this.tracking) return;
      if (!this.paused) {
        const now = Date.now();
        const detections = this.getCurrentDetections();

        const frame: TrackingFrame = { timestamp: now - this.startTime, detections };
        this.frames.push(frame);

        if (this.uploadMode === "live") {
          this.liveBuffer.push(frame);
        }

        // Check for highlight events
        this.detectHighlightEvents(frame);

        onDetections?.(frame);
      }
    };
    this.intervalId = window.setInterval(loop, 500);
  }

  private detectHighlightEvents(frame: TrackingFrame) {
    if (!this.highlightRecorder.isEnabled()) return;

    const ball = frame.detections.find(d => d.label === "ball");
    if (!ball) return;

    const newZone: "left" | "center" | "right" =
      ball.x < 0.05 ? "left" : ball.x > 0.95 ? "right" : "center";

    if (newZone !== "center" && this.lastBallZone === "center") {
      this.lastBallZoneTime = frame.timestamp;
    } else if (newZone === "center" && this.lastBallZone !== "center") {
      const duration = frame.timestamp - this.lastBallZoneTime;
      if (duration < 3000 && duration > 200) {
        this.highlightRecorder.triggerHighlight("goal");
      }
    }
    this.lastBallZone = newZone;
  }

  pauseTracking(): void {
    this.paused = true;
  }

  resumeTracking(): void {
    this.paused = false;
  }

  stopTracking(): TrackingFrame[] {
    this.tracking = false;
    this.paused = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.aiIntervalId) {
      clearInterval(this.aiIntervalId);
      this.aiIntervalId = null;
    }
    if (this.liveIntervalId) {
      clearInterval(this.liveIntervalId);
      this.liveIntervalId = null;
    }
    if (this.zoomCheckIntervalId) {
      clearInterval(this.zoomCheckIntervalId);
      this.zoomCheckIntervalId = null;
    }
    this.stopStabilityMonitoring();
    this.highlightRecorder.stop();

    if (this.uploadMode === "live" && this.liveBuffer.length > 0 && this.liveConfig) {
      const chunk = [...this.liveBuffer];
      this.liveBuffer = [];
      const seq = this.liveSequence++;
      this.chunksSent++;
      this.pendingChunks.push({ seq, frames: chunk });
      this.sendChunk(seq, chunk);
    }
    if (this.videoElement?.srcObject) {
      const stream = this.videoElement.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
    }
    return this.frames;
  }

  getElapsedSeconds(): number {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  getFrameCount(): number {
    return this.frames.length;
  }

  /** Return a copy of all frames collected so far */
  getRecentFrames(): TrackingFrame[] {
    return [...this.frames];
  }

  isTracking(): boolean {
    return this.tracking;
  }

  isPaused(): boolean {
    return this.paused;
  }

  async uploadMatch(
    matchId: string,
    cameraIndex: number,
    supabaseUrl: string,
    supabaseAnonKey: string,
    onProgress?: (stage: string, pct: number) => void,
  ): Promise<{ filePath: string; framesCount: number; durationSec: number }> {
    if (this.uploadMode === "live") {
      await this.retryPendingChunks();
      onProgress?.("upload", 100);
      return {
        filePath: `tracking/${matchId}/cam_${cameraIndex}/`,
        framesCount: this.frames.length,
        durationSec: this.getElapsedSeconds(),
      };
    }

    onProgress?.("compress", 0);
    const sessionData = {
      matchId,
      cameraIndex,
      frames: this.frames,
      framesCount: this.frames.length,
      durationSec: this.getElapsedSeconds(),
      createdAt: new Date().toISOString(),
      aiStats: this.getAIStats(),
      fieldCoverage: this.fieldCoverage,
    };

    const jsonString = JSON.stringify(sessionData);
    const blob = new Blob([jsonString], { type: "application/json" });
    const sizeMB = (blob.size / (1024 * 1024)).toFixed(1);
    console.log(`[Tracker] Upload vorbereitet: ${this.frames.length} Frames, ${sizeMB} MB, AI: ${this.successfulAIFrames}/${this.totalAIFrames} erfolgreich`);
    onProgress?.("compress", 100);

    const objectPath = `${matchId}/cam_${cameraIndex}.json`;
    const filePath = `tracking/${objectPath}`;
    const uploadUrl = `${supabaseUrl}/storage/v1/object/tracking/${objectPath}`;

    onProgress?.("upload", 0);
    const MAX_RETRIES = 5;
    const TIMEOUT_MS = 120_000;
    let lastError: Error | null = null;
    let uploaded = false;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", uploadUrl);
          xhr.setRequestHeader("Authorization", `Bearer ${supabaseAnonKey}`);
          xhr.setRequestHeader("Content-Type", "application/json");
          xhr.setRequestHeader("x-upsert", "true");
          xhr.timeout = TIMEOUT_MS;

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              onProgress?.("upload", Math.round((e.loaded / e.total) * 100));
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              onProgress?.("upload", 100);
              resolve();
            } else {
              reject(new Error(`Upload HTTP ${xhr.status}: ${xhr.statusText}`));
            }
          };

          xhr.onerror = () => reject(new Error("Netzwerkfehler beim Upload"));
          xhr.ontimeout = () => reject(new Error("Upload-Timeout (120s)"));

          xhr.send(blob);
        });
        uploaded = true;
        console.log(`[Tracker] Upload erfolgreich (Versuch ${attempt})`);
        break;
      } catch (err) {
        lastError = err as Error;
        console.warn(`[Tracker] Upload Versuch ${attempt}/${MAX_RETRIES} fehlgeschlagen:`, lastError.message);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, attempt * 1500));
          onProgress?.("upload", 0);
        }
      }
    }

    if (!uploaded) {
      console.warn("[Tracker] Alle Upload-Versuche fehlgeschlagen, lokaler Fallback");
      try {
        localStorage.setItem(`tracking_${matchId}_cam${cameraIndex}`, jsonString);
        const pendingUploads = JSON.parse(localStorage.getItem("pending_uploads") ?? "[]");
        pendingUploads.push({
          matchId,
          cameraIndex,
          filePath,
          framesCount: this.frames.length,
          durationSec: this.getElapsedSeconds(),
          savedAt: new Date().toISOString(),
          error: lastError?.message,
        });
        localStorage.setItem("pending_uploads", JSON.stringify(pendingUploads));
      } catch {
        console.error("[Tracker] localStorage voll — Daten gehen verloren!");
      }
    }

    onProgress?.("register", 0);

    return {
      filePath,
      framesCount: this.frames.length,
      durationSec: this.getElapsedSeconds(),
    };
  }
}
