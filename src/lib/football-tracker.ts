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
  private awaySquadSize = 0; // 0 = don't track away

  /**
   * Configure the number of players to simulate.
   */
  setSquadSizes(home: number, away: number) {
    this.homeSquadSize = home;
    this.awaySquadSize = away;
  }

  /**
   * Load the YOLO model. Currently simulates download progress.
   */
  async loadModel(onProgress?: ProgressCallback): Promise<void> {
    for (let i = 0; i <= 100; i += 2) {
      await new Promise(r => setTimeout(r, 30));
      onProgress?.(i);
    }
    this.modelLoaded = true;
  }

  /**
   * Start camera and attach to video element.
   */
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
          }
        } catch {
          // zoom constraint not supported
        }
      }

      videoElement.srcObject = stream;
      await videoElement.play();
    } catch (err) {
      console.warn("Kamera nicht verfügbar, nutze Platzhalter-Modus");
    }
  }

  /**
   * Load calibration data for a field.
   */
  async loadCalibration(fieldId: string): Promise<any | null> {
    const cached = localStorage.getItem(`calibration_${fieldId}`);
    if (cached) {
      try { return JSON.parse(cached); } catch { /* ignore */ }
    }
    return null;
  }

  private initStablePlayers() {
    this.stablePlayers = [];
    let id = 0;

    // Home team — lower half (y: 0.1–0.5)
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

    // Away team — upper half (y: 0.5–0.9)
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

    // Init ball
    this.ballX = 0.5;
    this.ballY = 0.5;
    this.ballVx = (Math.random() - 0.5) * 0.02;
    this.ballVy = (Math.random() - 0.5) * 0.015;
  }

  private updateStablePlayers() {
    for (const p of this.stablePlayers) {
      // Small random walk with drift
      p.vx += (Math.random() - 0.5) * 0.004;
      p.vy += (Math.random() - 0.5) * 0.003;
      // Dampen velocity
      p.vx *= 0.92;
      p.vy *= 0.92;
      // Clamp speed
      const maxV = 0.015;
      p.vx = Math.max(-maxV, Math.min(maxV, p.vx));
      p.vy = Math.max(-maxV, Math.min(maxV, p.vy));

      p.x += p.vx;
      p.y += p.vy;

      // Bounce off edges
      if (p.x < 0.05) { p.x = 0.05; p.vx = Math.abs(p.vx); }
      if (p.x > 0.95) { p.x = 0.95; p.vx = -Math.abs(p.vx); }
      if (p.y < 0.05) { p.y = 0.05; p.vy = Math.abs(p.vy); }
      if (p.y > 0.95) { p.y = 0.95; p.vy = -Math.abs(p.vy); }
    }

    // Update ball
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

  /**
   * Start tracking loop with realistic mock detections.
   */
  startTracking(canvasElement: HTMLCanvasElement | null, matchId: string, onDetections?: DetectionCallback): void {
    if (!this.modelLoaded) throw new Error("Modell nicht geladen");
    this.tracking = true;
    this.paused = false;
    this.startTime = Date.now();
    this.frames = [];
    this.initStablePlayers();

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

        // Add ball detection
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

  /**
   * Upload tracking session data to storage.
   * Uses XMLHttpRequest for real upload progress reporting.
   * Includes retry logic (up to 5 attempts) and timeout (120s per attempt).
   */
  async uploadMatch(
    matchId: string,
    cameraIndex: number,
    supabaseUrl: string,
    supabaseAnonKey: string,
    onProgress?: (stage: string, pct: number) => void,
  ): Promise<{ filePath: string; framesCount: number; durationSec: number }> {
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
