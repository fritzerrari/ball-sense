import type { PositionEntry, HeatmapGrid } from "./types";
import { HEATMAP_COLS, HEATMAP_ROWS } from "./constants";

/**
 * Calculate distance in km from position entries
 */
export function calculateDistance(positions: PositionEntry[], fieldWidth: number, fieldHeight: number): number {
  if (!positions || positions.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < positions.length; i++) {
    const dx = (positions[i].x - positions[i - 1].x) * fieldWidth;
    const dy = (positions[i].y - positions[i - 1].y) * fieldHeight;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total / 1000; // m to km
}

/**
 * Calculate speed in km/h between two consecutive position entries
 */
export function calculateSpeed(p1: PositionEntry, p2: PositionEntry, fieldWidth: number, fieldHeight: number): number {
  const dt = (p2.t - p1.t) / 1000; // seconds
  if (dt <= 0) return 0;
  const dx = (p2.x - p1.x) * fieldWidth;
  const dy = (p2.y - p1.y) * fieldHeight;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return (dist / dt) * 3.6; // m/s to km/h
}

/**
 * Get top speed from positions
 */
export function calculateTopSpeed(positions: PositionEntry[], fieldWidth: number, fieldHeight: number): number {
  if (!positions || positions.length < 2) return 0;
  let maxSpeed = 0;
  for (let i = 1; i < positions.length; i++) {
    const speed = calculateSpeed(positions[i - 1], positions[i], fieldWidth, fieldHeight);
    if (speed > maxSpeed && speed < 45) maxSpeed = speed; // cap at 45 km/h
  }
  return maxSpeed;
}

/**
 * Count sprints (speed > 25 km/h for at least 1 second)
 */
export function countSprints(positions: PositionEntry[], fieldWidth: number, fieldHeight: number): { count: number; distanceM: number } {
  if (!positions || positions.length < 2) return { count: 0, distanceM: 0 };
  const SPRINT_THRESHOLD = 25; // km/h
  let count = 0;
  let distanceM = 0;
  let inSprint = false;

  for (let i = 1; i < positions.length; i++) {
    const speed = calculateSpeed(positions[i - 1], positions[i], fieldWidth, fieldHeight);
    if (speed >= SPRINT_THRESHOLD) {
      if (!inSprint) {
        count++;
        inSprint = true;
      }
      const dx = (positions[i].x - positions[i - 1].x) * fieldWidth;
      const dy = (positions[i].y - positions[i - 1].y) * fieldHeight;
      distanceM += Math.sqrt(dx * dx + dy * dy);
    } else {
      inSprint = false;
    }
  }
  return { count, distanceM };
}

/**
 * Build heatmap grid from positions
 */
export function buildHeatmapGrid(positions: PositionEntry[]): number[][] {
  const grid: number[][] = Array.from({ length: HEATMAP_ROWS }, () =>
    Array(HEATMAP_COLS).fill(0)
  );
  if (!positions) return grid;

  for (const p of positions) {
    const col = Math.min(Math.floor(p.x * HEATMAP_COLS), HEATMAP_COLS - 1);
    const row = Math.min(Math.floor(p.y * HEATMAP_ROWS), HEATMAP_ROWS - 1);
    if (col >= 0 && row >= 0) grid[row][col]++;
  }

  // Normalize
  const max = Math.max(...grid.flat(), 1);
  return grid.map(row => row.map(v => v / max));
}

/**
 * Merge multiple heatmap grids into an average
 */
export function mergeHeatmaps(grids: number[][][]): number[][] {
  if (!grids.length) {
    return Array.from({ length: HEATMAP_ROWS }, () => Array(HEATMAP_COLS).fill(0));
  }
  const merged = Array.from({ length: HEATMAP_ROWS }, () => Array(HEATMAP_COLS).fill(0));
  for (const grid of grids) {
    for (let r = 0; r < HEATMAP_ROWS; r++) {
      for (let c = 0; c < HEATMAP_COLS; c++) {
        merged[r][c] += (grid[r]?.[c] ?? 0);
      }
    }
  }
  const max = Math.max(...merged.flat(), 1);
  return merged.map(row => row.map(v => v / max));
}

/**
 * Calculate average speed from positions
 */
export function calculateAvgSpeed(positions: PositionEntry[], fieldWidth: number, fieldHeight: number): number {
  if (!positions || positions.length < 2) return 0;
  let totalSpeed = 0;
  let count = 0;
  for (let i = 1; i < positions.length; i++) {
    const speed = calculateSpeed(positions[i - 1], positions[i], fieldWidth, fieldHeight);
    if (speed < 45) { // ignore impossible speeds
      totalSpeed += speed;
      count++;
    }
  }
  return count > 0 ? totalSpeed / count : 0;
}
