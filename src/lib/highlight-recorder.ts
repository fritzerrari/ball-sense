/**
 * HighlightRecorder - Ring-buffer video recording for highlight clips.
 * Records continuously but only saves clips when highlights are detected.
 * Clips are ~20s: 15s before + 5s after the event.
 */

export interface HighlightClip {
  timestamp: number; // ms since tracking start
  eventType: "goal" | "sprint" | "ball_recovery" | "key_moment";
  blob: Blob;
  durationSec: number;
}

export type HighlightEventCallback = (clip: HighlightClip) => void;

const RING_BUFFER_MS = 15_000; // 15s pre-event buffer
const POST_EVENT_MS = 5_000;   // 5s post-event recording
const MAX_CLIPS_PER_MATCH = 20;

export class HighlightRecorder {
  private enabled = false;
  private mediaRecorder: MediaRecorder | null = null;
  private ringBuffer: Blob[] = [];
  private ringStartTimes: number[] = [];
  private isCapturing = false;
  private captureTimeout: number | null = null;
  private clips: HighlightClip[] = [];
  private trackingStartTime = 0;
  private stream: MediaStream | null = null;
  private onClipReady: HighlightEventCallback | null = null;
  private mimeType = "";

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getClips(): HighlightClip[] {
    return this.clips;
  }

  getClipCount(): number {
    return this.clips.length;
  }

  setOnClipReady(cb: HighlightEventCallback | null) {
    this.onClipReady = cb;
  }

  start(stream: MediaStream, trackingStartTime: number) {
    if (!this.enabled || !stream.getVideoTracks().length) return;

    this.stream = stream;
    this.trackingStartTime = trackingStartTime;
    this.clips = [];
    this.ringBuffer = [];
    this.ringStartTimes = [];

    // Determine best supported mime type
    const types = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
      "video/mp4",
    ];
    this.mimeType = types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    if (!this.mimeType) {
      console.warn("[HighlightRecorder] No supported video mime type found");
      this.enabled = false;
      return;
    }

    this.startRingBuffer();
  }

  private startRingBuffer() {
    if (!this.stream || !this.mimeType) return;

    try {
      // Create a low-res stream for recording (480p max)
      const videoTrack = this.stream.getVideoTracks()[0];
      if (!videoTrack) return;

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: this.mimeType,
        videoBitsPerSecond: 1_000_000, // 1 Mbps for 480p
      });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.ringBuffer.push(e.data);
          this.ringStartTimes.push(Date.now());

          // Trim ring buffer to keep only last RING_BUFFER_MS
          const cutoff = Date.now() - RING_BUFFER_MS;
          while (this.ringStartTimes.length > 0 && this.ringStartTimes[0] < cutoff) {
            this.ringBuffer.shift();
            this.ringStartTimes.shift();
          }
        }
      };

      // Record in 1-second chunks for the ring buffer
      this.mediaRecorder.start(1000);
    } catch (err) {
      console.warn("[HighlightRecorder] Failed to start MediaRecorder:", err);
      this.enabled = false;
    }
  }

  /**
   * Trigger a highlight clip capture. Call this when a highlight event is detected.
   * The ring buffer provides the pre-event footage, then we record POST_EVENT_MS more.
   */
  triggerHighlight(eventType: HighlightClip["eventType"]) {
    if (!this.enabled || this.isCapturing) return;
    if (this.clips.length >= MAX_CLIPS_PER_MATCH) return;

    this.isCapturing = true;
    const eventTimestamp = Date.now() - this.trackingStartTime;

    // Capture the current ring buffer (pre-event footage)
    const preEventChunks = [...this.ringBuffer];

    // Wait POST_EVENT_MS then assemble the clip
    this.captureTimeout = window.setTimeout(() => {
      // Grab any additional chunks recorded during the post-event window
      const allChunks = [...preEventChunks, ...this.ringBuffer.filter(b => !preEventChunks.includes(b))];

      if (allChunks.length > 0) {
        const blob = new Blob(allChunks, { type: this.mimeType });
        const durationSec = Math.round((RING_BUFFER_MS + POST_EVENT_MS) / 1000);

        const clip: HighlightClip = {
          timestamp: eventTimestamp,
          eventType,
          blob,
          durationSec,
        };

        this.clips.push(clip);
        this.onClipReady?.(clip);
        console.log(`[HighlightRecorder] Clip captured: ${eventType} at ${(eventTimestamp / 1000).toFixed(0)}s (${(blob.size / 1024).toFixed(0)} KB)`);
      }

      this.isCapturing = false;
    }, POST_EVENT_MS);
  }

  stop() {
    if (this.captureTimeout) {
      clearTimeout(this.captureTimeout);
      this.captureTimeout = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch { /* already stopped */ }
    }

    this.mediaRecorder = null;
    this.isCapturing = false;
    this.ringBuffer = [];
    this.ringStartTimes = [];
  }

  /**
   * Upload all captured clips to storage.
   */
  async uploadClips(
    matchId: string,
    cameraIndex: number,
    supabaseUrl: string,
    anonKey: string,
    onProgress?: (clipIndex: number, total: number) => void,
  ): Promise<string[]> {
    const paths: string[] = [];

    for (let i = 0; i < this.clips.length; i++) {
      const clip = this.clips[i];
      const ext = this.mimeType.includes("mp4") ? "mp4" : "webm";
      const objectPath = `${matchId}/highlights/cam_${cameraIndex}_clip_${i}_${clip.eventType}.${ext}`;
      const uploadUrl = `${supabaseUrl}/storage/v1/object/tracking/${objectPath}`;

      try {
        const resp = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${anonKey}`,
            "Content-Type": clip.blob.type || this.mimeType,
            "x-upsert": "true",
          },
          body: clip.blob,
        });

        if (resp.ok) {
          paths.push(`tracking/${objectPath}`);
        } else {
          console.warn(`[HighlightRecorder] Clip ${i} upload failed: ${resp.status}`);
        }
      } catch (err) {
        console.warn(`[HighlightRecorder] Clip ${i} upload error:`, err);
      }

      onProgress?.(i + 1, this.clips.length);
    }

    return paths;
  }
}
