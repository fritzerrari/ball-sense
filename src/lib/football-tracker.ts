/**
 * FootballTracker - Abstraction layer for on-device YOLO tracking.
 * Currently runs as a scaffold/stub. Real ONNX inference will be plugged in later.
 */

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

interface StablePlayer {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  team: "home" | "away";
}

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

export class FootballTracker {
  private modelLoaded = false;
  private tracking = false;
  private paused = false;
  private frames: TrackingFrame[] = [];
  private intervalId: number | null = null;
  private startTime = 0;
  private videoElement: HTMLVideoElement | null = null;
  private stablePlayers: StablePlayer[] = [];
  private ballX = 0.5;
  private ballY = 0.5;
  private ballVx = 0.01;
  private ballVy = 0.005;
  private homeSquadSize = 11;
  private awaySquadSize = 0;

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

  async loadModel(onProgress?: ProgressCallback): Promise<void> {
    for (let i = 0; i <= 100; i += 2) {
      await new Promise(r => setTimeout(r, 30));
      onProgress?.(i);
    }
    this.modelLoaded = true;
  }

  async startCamera(videoElement: HTMLVideoElement, cameraIndex = 0): Promise<void> {
    this.videoElement = videoElement;
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
    // Check every 10s instead of 60s
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

    // Frame-difference analysis every 5s
    this.stabilityCanvas = document.createElement("canvas");
    this.stabilityCanvas.width = 40; // small sampling grid
    this.stabilityCanvas.height = 30;

    this.stabilityIntervalId = window.setInterval(() => {
      this.checkFrameDifference();
    }, 5_000);

    // DeviceMotion for bump detection
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

    // Calculate pixel difference
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
        // Single spike = bump
        this.onStabilityEvent?.("bump", `Bewegung erkannt (${(avgDiff * 100).toFixed(0)}%)`);
      } else if (this.highDiffCount >= 3) {
        // Continuous = drift/pan
        this.onStabilityEvent?.("drift", "Kamera-Position hat sich verändert");
      }
    } else {
      // Reset if stable again
      if (this.highDiffCount > 0) {
        this.highDiffCount = 0;
      }
      // Update reference frame periodically when stable
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
      if (magnitude > 20) { // ~2g
        this.onStabilityEvent?.("bump", `Starker Stoß erkannt (${magnitude.toFixed(1)} m/s²)`);
        // Trigger immediate zoom check
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

  /**
   * Update the calibrated zoom after a recalibration.
   */
  updateCalibratedZoom() {
    const zoom = this.getCurrentZoom();
    if (zoom != null) this.calibratedZoom = zoom;
    this.highDiffCount = 0;
    this.referenceImageData = null; // Reset reference frame
  }

  // ── Tracking simulation ──

  private initStablePlayers() {
    this.stablePlayers = [];
    let id = 0;
    for (let i = 0; i < this.homeSquadSize; i++) {
      this.stablePlayers.push({
        id: id++,
        x: 0.1 + (i / Math.max(1, this.homeSquadSize - 1)) * 0.8,
        y: 0.15 + Math.random() * 0.3,
        vx: (Math.random() - 0.5) * 0.008,
        vy: (Math.random() - 0.5) * 0.005,
        team: "home",
      });
    }
    for (let i = 0; i < this.awaySquadSize; i++) {
      this.stablePlayers.push({
        id: id++,
        x: 0.1 + (i / Math.max(1, this.awaySquadSize - 1)) * 0.8,
        y: 0.55 + Math.random() * 0.3,
        vx: (Math.random() - 0.5) * 0.008,
        vy: (Math.random() - 0.5) * 0.005,
        team: "away",
      });
    }
    this.ballX = 0.5;
    this.ballY = 0.5;
    this.ballVx = (Math.random() - 0.5) * 0.02;
    this.ballVy = (Math.random() - 0.5) * 0.015;
  }

  private updateStablePlayers() {
    for (const p of this.stablePlayers) {
      p.vx += (Math.random() - 0.5) * 0.004;
      p.vy += (Math.random() - 0.5) * 0.003;
      p.vx *= 0.92;
      p.vy *= 0.92;
      const maxV = 0.015;
      p.vx = Math.max(-maxV, Math.min(maxV, p.vx));
      p.vy = Math.max(-maxV, Math.min(maxV, p.vy));
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0.05) { p.x = 0.05; p.vx = Math.abs(p.vx); }
      if (p.x > 0.95) { p.x = 0.95; p.vx = -Math.abs(p.vx); }
      if (p.y < 0.05) { p.y = 0.05; p.vy = Math.abs(p.vy); }
      if (p.y > 0.95) { p.y = 0.95; p.vy = -Math.abs(p.vy); }
    }
    this.ballVx += (Math.random() - 0.5) * 0.006;
    this.ballVy += (Math.random() - 0.5) * 0.006;
    this.ballVx *= 0.9;
    this.ballVy *= 0.9;
    this.ballX += this.ballVx;
    this.ballY += this.ballVy;
    if (this.ballX < 0.02 || this.ballX > 0.98) this.ballVx *= -1;
    if (this.ballY < 0.02 || this.ballY > 0.98) this.ballVy *= -1;
    this.ballX = Math.max(0.02, Math.min(0.98, this.ballX));
    this.ballY = Math.max(0.02, Math.min(0.98, this.ballY));
  }

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

  startTracking(canvasElement: HTMLCanvasElement | null, matchId: string, onDetections?: DetectionCallback): void {
    if (!this.modelLoaded) throw new Error("Modell nicht geladen");
    this.tracking = true;
    this.paused = false;
    this.startTime = Date.now();
    this.frames = [];
    this.initStablePlayers();

    if (this.uploadMode === "live" && this.liveConfig) {
      this.startLiveInterval();
    }

    const loop = () => {
      if (!this.tracking) return;
      if (!this.paused) {
        this.updateStablePlayers();
        const now = Date.now();

        const detections: Detection[] = this.stablePlayers.map(p => ({
          id: p.id,
          x: p.x,
          y: p.y,
          w: 0.02 + Math.random() * 0.005,
          h: 0.04 + Math.random() * 0.01,
          confidence: 0.75 + Math.random() * 0.25,
          label: "person",
          team: p.team,
        }));

        detections.push({
          id: 999,
          x: this.ballX,
          y: this.ballY,
          w: 0.01,
          h: 0.01,
          confidence: 0.6 + Math.random() * 0.3,
          label: "ball",
        });

        const frame: TrackingFrame = { timestamp: now - this.startTime, detections };
        this.frames.push(frame);

        if (this.uploadMode === "live") {
          this.liveBuffer.push(frame);
        }

        onDetections?.(frame);
      }
    };
    this.intervalId = window.setInterval(loop, 500);
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
    if (this.liveIntervalId) {
      clearInterval(this.liveIntervalId);
      this.liveIntervalId = null;
    }
    if (this.zoomCheckIntervalId) {
      clearInterval(this.zoomCheckIntervalId);
      this.zoomCheckIntervalId = null;
    }
    this.stopStabilityMonitoring();

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
    };

    const jsonString = JSON.stringify(sessionData);
    const blob = new Blob([jsonString], { type: "application/json" });
    const sizeMB = (blob.size / (1024 * 1024)).toFixed(1);
    console.log(`[Tracker] Upload vorbereitet: ${this.frames.length} Frames, ${sizeMB} MB`);
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
