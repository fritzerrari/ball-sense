/**
 * LiveStatsEngine — Client-side real-time stats computation.
 * Processes every detection frame instantly to provide immediate feedback.
 * Running totals are kept in memory and synced to backend every 30s.
 */

import type { Detection, TrackingFrame } from "./football-tracker";

export interface RunningPlayerStats {
  trackId: number;
  team: "home" | "away" | "unknown";
  distanceM: number;
  topSpeedKmh: number;
  sprintCount: number;
  sprintDistanceM: number;
  frameCount: number;
  lastX: number;
  lastY: number;
  lastTimestamp: number;
  inSprint: boolean;
  // Heatmap accumulator (7x10 grid)
  heatmap: number[][];
}

export interface LiveTeamStats {
  team: "home" | "away";
  totalDistanceKm: number;
  avgDistanceKm: number;
  topSpeedKmh: number;
  totalSprints: number;
  playerCount: number;
}

export interface LiveSnapshot {
  players: RunningPlayerStats[];
  teams: LiveTeamStats[];
  elapsedSec: number;
  totalFrames: number;
  lastUpdated: number;
}

const SPRINT_THRESHOLD_KMH = 20;
const TRACK_THRESHOLD = 0.12; // max distance for track association
const TRACK_TIMEOUT_MS = 5000;
const HEATMAP_ROWS = 7;
const HEATMAP_COLS = 10;

export class LiveStatsEngine {
  private tracks = new Map<number, RunningPlayerStats>();
  private activePositions = new Map<number, { x: number; y: number; t: number }>();
  private nextTrackId = 0;
  private totalFrames = 0;
  private startTime = 0;
  private fieldW = 105;
  private fieldH = 68;
  private onUpdate: ((snapshot: LiveSnapshot) => void) | null = null;
  private updateThrottleMs = 1000; // Throttle UI updates to 1/sec
  private lastUpdateTime = 0;

  constructor(fieldW = 105, fieldH = 68) {
    this.fieldW = fieldW;
    this.fieldH = fieldH;
  }

  setFieldDimensions(w: number, h: number) {
    this.fieldW = w;
    this.fieldH = h;
  }

  setOnUpdate(cb: ((snapshot: LiveSnapshot) => void) | null) {
    this.onUpdate = cb;
  }

  reset() {
    this.tracks.clear();
    this.activePositions.clear();
    this.nextTrackId = 0;
    this.totalFrames = 0;
    this.startTime = 0;
    this.lastUpdateTime = 0;
  }

  /**
   * Process a single tracking frame. Called every ~500ms from FootballTracker.
   * This is the hot path — keep it fast.
   */
  processFrame(frame: TrackingFrame) {
    if (this.startTime === 0) this.startTime = frame.timestamp;
    this.totalFrames++;

    const personDetections = frame.detections.filter(d => d.label === "person");
    const used = new Set<number>();
    const matched = new Set<number>();

    // Match existing tracks to detections (nearest neighbor)
    const activeEntries = Array.from(this.activePositions.entries());
    for (const [tid, pos] of activeEntries) {
      let bestIdx = -1;
      let bestDist = TRACK_THRESHOLD;
      for (let i = 0; i < personDetections.length; i++) {
        if (used.has(i)) continue;
        const dx = personDetections[i].x - pos.x;
        const dy = personDetections[i].y - pos.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      if (bestIdx >= 0) {
        const det = personDetections[bestIdx];
        this.updateTrackStats(tid, det.x, det.y, frame.timestamp, det.team);
        this.activePositions.set(tid, { x: det.x, y: det.y, t: frame.timestamp });
        used.add(bestIdx);
        matched.add(tid);
      }
    }

    // Create new tracks for unmatched detections
    for (let i = 0; i < personDetections.length; i++) {
      if (used.has(i)) continue;
      const det = personDetections[i];
      const tid = this.nextTrackId++;
      this.tracks.set(tid, {
        trackId: tid,
        team: det.team ?? "unknown",
        distanceM: 0,
        topSpeedKmh: 0,
        sprintCount: 0,
        sprintDistanceM: 0,
        frameCount: 1,
        lastX: det.x,
        lastY: det.y,
        lastTimestamp: frame.timestamp,
        inSprint: false,
        heatmap: Array.from({ length: HEATMAP_ROWS }, () => Array(HEATMAP_COLS).fill(0)),
      });
      this.activePositions.set(tid, { x: det.x, y: det.y, t: frame.timestamp });
      // Add to heatmap
      this.addToHeatmap(tid, det.x, det.y);
    }

    // Remove stale tracks
    for (const [tid, pos] of this.activePositions) {
      if (!matched.has(tid) && frame.timestamp - pos.t > TRACK_TIMEOUT_MS) {
        this.activePositions.delete(tid);
      }
    }

    // Throttled UI update
    const now = Date.now();
    if (now - this.lastUpdateTime >= this.updateThrottleMs && this.onUpdate) {
      this.lastUpdateTime = now;
      this.onUpdate(this.getSnapshot());
    }
  }

  private updateTrackStats(tid: number, x: number, y: number, timestamp: number, team?: "home" | "away") {
    const track = this.tracks.get(tid);
    if (!track) return;

    const dx = (x - track.lastX) * this.fieldW;
    const dy = (y - track.lastY) * this.fieldH;
    const distM = Math.sqrt(dx * dx + dy * dy);
    const dtSec = (timestamp - track.lastTimestamp) / 1000;

    if (dtSec > 0 && distM < 50) { // Sanity: max 50m between frames
      track.distanceM += distM;
      const speedKmh = (distM / dtSec) * 3.6;

      // Cap unrealistic speeds
      const cappedSpeed = Math.min(speedKmh, 45);
      if (cappedSpeed > track.topSpeedKmh) track.topSpeedKmh = cappedSpeed;

      if (cappedSpeed >= SPRINT_THRESHOLD_KMH) {
        track.sprintDistanceM += distM;
        if (!track.inSprint) { track.sprintCount++; track.inSprint = true; }
      } else {
        track.inSprint = false;
      }
    }

    if (team && track.team === "unknown") track.team = team;
    track.lastX = x;
    track.lastY = y;
    track.lastTimestamp = timestamp;
    track.frameCount++;
    this.addToHeatmap(tid, x, y);
  }

  private addToHeatmap(tid: number, x: number, y: number) {
    const track = this.tracks.get(tid);
    if (!track) return;
    const col = Math.min(HEATMAP_COLS - 1, Math.max(0, Math.floor(x * HEATMAP_COLS)));
    const row = Math.min(HEATMAP_ROWS - 1, Math.max(0, Math.floor(y * HEATMAP_ROWS)));
    track.heatmap[row][col]++;
  }

  /**
   * Get current snapshot for UI display and backend sync.
   */
  getSnapshot(): LiveSnapshot {
    // Filter to significant tracks (>10 frames = actually tracked)
    const significantTracks = [...this.tracks.values()].filter(t => t.frameCount > 10);

    const teams: LiveTeamStats[] = [];
    for (const team of ["home", "away"] as const) {
      const teamPlayers = significantTracks.filter(t => t.team === team);
      if (teamPlayers.length === 0) continue;
      const totalDist = teamPlayers.reduce((s, p) => s + p.distanceM, 0);
      teams.push({
        team,
        totalDistanceKm: Math.round(totalDist / 10) / 100,
        avgDistanceKm: Math.round((totalDist / teamPlayers.length) / 10) / 100,
        topSpeedKmh: Math.round(Math.max(...teamPlayers.map(p => p.topSpeedKmh)) * 10) / 10,
        totalSprints: teamPlayers.reduce((s, p) => s + p.sprintCount, 0),
        playerCount: teamPlayers.length,
      });
    }

    return {
      players: significantTracks,
      teams,
      elapsedSec: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
      totalFrames: this.totalFrames,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Export frames suitable for backend micro-batch upload.
   * Returns the accumulated frames since start in a compact format.
   */
  getStatsForSync(): {
    playerStats: Array<{
      trackId: number;
      team: string;
      distanceKm: number;
      topSpeedKmh: number;
      sprintCount: number;
      sprintDistanceM: number;
      heatmapGrid: number[][];
      minutesPlayed: number;
    }>;
    teamStats: LiveTeamStats[];
    totalFrames: number;
    elapsedSec: number;
  } {
    const snapshot = this.getSnapshot();
    return {
      playerStats: snapshot.players.map(p => ({
        trackId: p.trackId,
        team: p.team,
        distanceKm: Math.round(p.distanceM / 10) / 100,
        topSpeedKmh: Math.round(p.topSpeedKmh * 10) / 10,
        sprintCount: p.sprintCount,
        sprintDistanceM: Math.round(p.sprintDistanceM),
        heatmapGrid: this.normalizeHeatmap(p.heatmap),
        minutesPlayed: Math.max(1, Math.round((p.lastTimestamp - this.startTime) / 60000)),
      })),
      teamStats: snapshot.teams,
      totalFrames: this.totalFrames,
      elapsedSec: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
    };
  }

  private normalizeHeatmap(grid: number[][]): number[][] {
    const maxVal = Math.max(1, ...grid.flat());
    return grid.map(row => row.map(v => Math.round((v / maxVal) * 100) / 100));
  }
}
