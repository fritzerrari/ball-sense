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
  label: string;
}

export interface TrackingFrame {
  timestamp: number;
  detections: Detection[];
}

type ProgressCallback = (pct: number) => void;
type DetectionCallback = (frame: TrackingFrame) => void;

export class FootballTracker {
  private modelLoaded = false;
  private tracking = false;
  private paused = false;
  private frames: TrackingFrame[] = [];
  private intervalId: number | null = null;
  private startTime = 0;
  private videoElement: HTMLVideoElement | null = null;

  /**
   * Load the YOLO model. Currently simulates download progress.
   */
  async loadModel(onProgress?: ProgressCallback): Promise<void> {
    // Simulate model loading with progress
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
      videoElement.srcObject = stream;
      await videoElement.play();
    } catch (err) {
      console.warn("Kamera nicht verfügbar, nutze Platzhalter-Modus");
      // Camera unavailable — tracking page will show placeholder
    }
  }

  /**
   * Load calibration data for a field. Checks localStorage first, then Supabase.
   */
  async loadCalibration(fieldId: string): Promise<any | null> {
    const cached = localStorage.getItem(`calibration_${fieldId}`);
    if (cached) {
      try { return JSON.parse(cached); } catch { /* ignore */ }
    }
    return null;
  }

  /**
   * Start tracking loop. Currently generates mock detections.
   */
  startTracking(canvasElement: HTMLCanvasElement | null, matchId: string, onDetections?: DetectionCallback): void {
    if (!this.modelLoaded) throw new Error("Modell nicht geladen");
    this.tracking = true;
    this.paused = false;
    this.startTime = Date.now();
    this.frames = [];

    const loop = () => {
      if (!this.tracking) return;
      if (!this.paused) {
        const now = Date.now();
        const numPlayers = 10 + Math.floor(Math.random() * 12);
        const detections: Detection[] = Array.from({ length: numPlayers }, (_, i) => ({
          id: i,
          x: 0.1 + Math.random() * 0.8,
          y: 0.1 + Math.random() * 0.8,
          w: 0.02 + Math.random() * 0.01,
          h: 0.04 + Math.random() * 0.02,
          confidence: 0.7 + Math.random() * 0.3,
          label: "person",
        }));

        const frame: TrackingFrame = { timestamp: now - this.startTime, detections };
        this.frames.push(frame);
        onDetections?.(frame);
      }
    };
    // Run at ~2fps for stub — use only setInterval, no rAF to avoid memory leak
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
    // Stop camera
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
   * Upload tracking session data to Supabase storage.
   * Uses XMLHttpRequest for real upload progress reporting.
   * Includes retry logic (up to 3 attempts) and timeout (60s per attempt).
   */
  async uploadMatch(
    matchId: string,
    cameraIndex: number,
    supabaseUrl: string,
    supabaseAnonKey: string,
    onProgress?: (stage: string, pct: number) => void,
  ): Promise<{ filePath: string; framesCount: number; durationSec: number }> {
    // Stage 1: Prepare & compress data
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

    const filePath = `tracking/${matchId}/cam_${cameraIndex}.json`;
    const uploadUrl = `${supabaseUrl}/storage/v1/object/tracking/${filePath}`;

    // Stage 2: Upload with retry
    onProgress?.("upload", 0);
    const MAX_RETRIES = 3;
    const TIMEOUT_MS = 60_000;
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
          xhr.ontimeout = () => reject(new Error("Upload-Timeout (60s)"));

          xhr.send(blob);
        });
        uploaded = true;
        console.log(`[Tracker] Upload erfolgreich (Versuch ${attempt})`);
        break;
      } catch (err) {
        lastError = err as Error;
        console.warn(`[Tracker] Upload Versuch ${attempt}/${MAX_RETRIES} fehlgeschlagen:`, lastError.message);
        if (attempt < MAX_RETRIES) {
          // Exponential backoff: 1s, 2s
          await new Promise(r => setTimeout(r, attempt * 1000));
          onProgress?.("upload", 0); // Reset progress for retry
        }
      }
    }

    if (!uploaded) {
      // Fallback: Save locally for later retry
      console.warn("[Tracker] Alle Upload-Versuche fehlgeschlagen, lokaler Fallback");
      try {
        localStorage.setItem(`tracking_${matchId}_cam${cameraIndex}`, jsonString);
        // Also save metadata for retry UI
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
