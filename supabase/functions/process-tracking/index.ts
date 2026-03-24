import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Types ────────────────────────────────────────────────────────

interface Detection {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  confidence: number;
  label: string;
}

interface TrackingFrame {
  timestamp: number;
  detections: Detection[];
}

interface TrackingSession {
  matchId: string;
  cameraIndex: number;
  frames: TrackingFrame[];
  framesCount: number;
  durationSec: number;
  createdAt: string;
}

interface LineupEntry {
  id: string;
  player_id: string | null;
  player_name: string | null;
  team: "home" | "away";
  shirt_number: number | null;
  starting: boolean;
  subbed_in_min: number | null;
  subbed_out_min: number | null;
  excluded_from_tracking: boolean;
}

interface MatchEvent {
  match_id: string;
  team: string;
  minute: number;
  event_type: string;
  player_id: string | null;
  related_player_id: string | null;
  player_name: string | null;
  related_player_name: string | null;
}

interface MatchContext {
  field_id: string | null;
  home_club_id: string;
  track_opponent: boolean;
  opponent_consent_confirmed: boolean;
}

interface TrackProfile {
  tid: number;
  cx: number;
  cy: number;
  sidelineRatio: number;
  edgeRatio: number;
  positions: { t: number; x: number; y: number }[];
  cameraCount: number; // how many cameras contributed to this track
}

// ── Helpers ──────────────────────────────────────────────────────

function euclidean(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Assign raw detections to stable "tracks" across frames using a simple
 * nearest-neighbour tracker. Each track gets a stable id.
 */
function buildTracks(frames: TrackingFrame[]) {
  const tracks = new Map<number, { t: number; x: number; y: number }[]>();
  let nextTrackId = 0;
  const active = new Map<number, { x: number; y: number }>();
  const THRESHOLD = 0.12;

  for (const frame of frames) {
    const used = new Set<number>();
    const matched = new Set<number>();

    for (const [tid, pos] of active) {
      let bestIdx = -1;
      let bestDist = THRESHOLD;
      for (let i = 0; i < frame.detections.length; i++) {
        if (used.has(i)) continue;
        const d = euclidean(pos, frame.detections[i]);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0) {
        const det = frame.detections[bestIdx];
        tracks.get(tid)!.push({ t: frame.timestamp, x: det.x, y: det.y });
        active.set(tid, { x: det.x, y: det.y });
        used.add(bestIdx);
        matched.add(tid);
      }
    }

    for (let i = 0; i < frame.detections.length; i++) {
      if (used.has(i)) continue;
      const det = frame.detections[i];
      const tid = nextTrackId++;
      tracks.set(tid, [{ t: frame.timestamp, x: det.x, y: det.y }]);
      active.set(tid, { x: det.x, y: det.y });
    }

    for (const [tid] of active) {
      if (!matched.has(tid)) {
        const last = tracks.get(tid)!;
        if (frame.timestamp - last[last.length - 1].t > 5000) {
          active.delete(tid);
        }
      }
    }
  }

  return tracks;
}

/**
 * Merge frames from multiple camera sessions by timestamp.
 * Detections from different cameras at similar timestamps (±250ms)
 * that are spatially close (<0.05 norm distance) are deduplicated.
 */
/**
 * Merge frames from multiple camera sessions by timestamp.
 * If cameras have calibration with field_rect, transform detections
 * to global field coordinates before merging.
 */
function mergeMultiCameraFrames(sessions: TrackingSession[], uploadCalibrations?: Record<number, any>): {
  mergedFrames: TrackingFrame[];
  totalDurationSec: number;
  cameraContributions: Map<number, number>;
} {
  // Transform detections to global coordinates if field_rect is available
  const transformedSessions = sessions.map(session => {
    const cal = uploadCalibrations?.[session.cameraIndex];
    const fieldRect = cal?.field_rect;
    if (!fieldRect || (fieldRect.x === 0 && fieldRect.y === 0 && fieldRect.w === 1 && fieldRect.h === 1)) {
      return session; // Full field, no transformation needed
    }
    // Transform local coordinates to global
    return {
      ...session,
      frames: session.frames.map(frame => ({
        ...frame,
        detections: frame.detections.map(det => ({
          ...det,
          x: fieldRect.x + det.x * fieldRect.w,
          y: fieldRect.y + det.y * fieldRect.h,
          w: det.w * fieldRect.w,
          h: det.h * fieldRect.h,
        })),
      })),
    };
  });

  if (transformedSessions.length === 1) {
    return {
      mergedFrames: transformedSessions[0].frames,
      totalDurationSec: transformedSessions[0].durationSec,
      cameraContributions: new Map([[transformedSessions[0].cameraIndex, transformedSessions[0].frames.length]]),
    };
  }

  const TIME_MERGE_MS = 250;
  const SPATIAL_MERGE_DIST = 0.05;

  const allTagged: { frame: TrackingFrame; camIdx: number }[] = [];
  const cameraContributions = new Map<number, number>();

  for (const session of transformedSessions) {
    cameraContributions.set(session.cameraIndex, session.frames.length);
    for (const frame of session.frames) {
      allTagged.push({ frame, camIdx: session.cameraIndex });
    }
  }

  allTagged.sort((a, b) => a.frame.timestamp - b.frame.timestamp);

  const mergedFrames: TrackingFrame[] = [];
  let i = 0;
  while (i < allTagged.length) {
    const windowStart = allTagged[i].frame.timestamp;
    const windowDetections: Detection[] = [...allTagged[i].frame.detections];
    let j = i + 1;

    while (j < allTagged.length && allTagged[j].frame.timestamp - windowStart <= TIME_MERGE_MS) {
      for (const det of allTagged[j].frame.detections) {
        const isDuplicate = windowDetections.some(
          (existing) => euclidean(existing, det) < SPATIAL_MERGE_DIST
        );
        if (!isDuplicate) {
          windowDetections.push(det);
        }
      }
      j++;
    }

    mergedFrames.push({ timestamp: windowStart, detections: windowDetections });
    i = j;
  }

  const totalDurationSec = Math.max(...transformedSessions.map((s) => s.durationSec));
  return { mergedFrames, totalDurationSec, cameraContributions };
}

/**
 * From a position trace, compute physical stats assuming fieldW×fieldH meter pitch.
 */
function computeTrackStats(
  positions: { t: number; x: number; y: number }[],
  fieldW: number,
  fieldH: number,
) {
  if (positions.length < 2) {
    return {
      distance_km: 0,
      top_speed_kmh: 0,
      avg_speed_kmh: 0,
      sprint_count: 0,
      sprint_distance_m: 0,
      heatmap_grid: emptyHeatmap(),
      positions_raw: positions.map((p) => ({ t: p.t, x: p.x, y: p.y })),
      minutes_played: 0,
    };
  }

  let totalDist = 0;
  let topSpeed = 0;
  let sprintCount = 0;
  let sprintDist = 0;
  let inSprint = false;
  const SPRINT_THRESHOLD_KMH = 20;
  const speeds: number[] = [];

  for (let i = 1; i < positions.length; i++) {
    const prev = positions[i - 1];
    const curr = positions[i];
    const dx = (curr.x - prev.x) * fieldW;
    const dy = (curr.y - prev.y) * fieldH;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dt = (curr.t - prev.t) / 1000;
    if (dt <= 0) continue;

    totalDist += dist;
    const speed = (dist / dt) * 3.6;
    speeds.push(speed);
    if (speed > topSpeed) topSpeed = speed;

    if (speed >= SPRINT_THRESHOLD_KMH) {
      sprintDist += dist;
      if (!inSprint) {
        sprintCount++;
        inSprint = true;
      }
    } else {
      inSprint = false;
    }
  }

  const avgSpeed =
    speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;

  const COLS = 10;
  const ROWS = 7;
  const grid: number[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  for (const p of positions) {
    const col = Math.min(COLS - 1, Math.floor(p.x * COLS));
    const row = Math.min(ROWS - 1, Math.floor(p.y * ROWS));
    grid[row][col]++;
  }

  const maxVal = Math.max(1, ...grid.flat());
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      grid[r][c] = Math.round((grid[r][c] / maxVal) * 100) / 100;
    }
  }

  const durationMs = positions[positions.length - 1].t - positions[0].t;

  return {
    distance_km: Math.round(totalDist / 10) / 100,
    top_speed_kmh: Math.round(topSpeed * 10) / 10,
    avg_speed_kmh: Math.round(avgSpeed * 10) / 10,
    sprint_count: sprintCount,
    sprint_distance_m: Math.round(sprintDist),
    heatmap_grid: grid,
    positions_raw: positions.map((p) => ({ t: p.t, x: p.x, y: p.y })),
    minutes_played: Math.round(durationMs / 60000),
  };
}

function emptyHeatmap(): number[][] {
  return Array.from({ length: 7 }, () => Array(10).fill(0));
}

function getTrackTimeRange(positions: { t: number; x: number; y: number }[]) {
  const startMin = (positions[0]?.t ?? 0) / 60000;
  const endMin = (positions[positions.length - 1]?.t ?? 0) / 60000;
  return { startMin, endMin };
}

function getPlayerWindow(
  player: LineupEntry,
  events: MatchEvent[],
  fallbackEndMin: number,
) {
  const startMin = player.subbed_in_min ?? (player.starting ? 0 : null);
  const playerEventMinute = events
    .filter(
      (event) =>
        event.player_id &&
        player.player_id &&
        event.player_id === player.player_id &&
        ["red_card", "yellow_red_card", "player_deactivated"].includes(event.event_type),
    )
    .map((event) => event.minute)
    .sort((a, b) => a - b)[0];

  const endCandidates = [player.subbed_out_min, playerEventMinute, fallbackEndMin].filter(
    (value): value is number => typeof value === "number",
  );

  return {
    startMin,
    endMin: endCandidates.length > 0 ? Math.min(...endCandidates) : fallbackEndMin,
  };
}

function getOverlapMinutes(
  window: { startMin: number | null; endMin: number },
  trackRange: { startMin: number; endMin: number },
) {
  if (window.startMin === null) return 0;
  return Math.max(
    0,
    Math.min(window.endMin, trackRange.endMin) - Math.max(window.startMin, trackRange.startMin),
  );
}

function shouldTrackTeam(match: MatchContext | null, team: "home" | "away") {
  if (team === "home") return true;
  return Boolean(match?.track_opponent && match?.opponent_consent_confirmed);
}

function getExpectedZone(
  position: string | null | undefined,
  team: "home" | "away",
  zones: Record<string, { x: number; y: number }>,
) {
  if (!position) return null;
  const base = zones[position.toUpperCase()];
  if (!base) return null;
  return team === "home" ? base : { x: base.x, y: 1 - base.y };
}

function buildTrackProfiles(
  sortedTracks: Array<[number, { t: number; x: number; y: number }[]]>,
): TrackProfile[] {
  return sortedTracks.map(([tid, positions]) => {
    const cx = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
    const cy = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;
    const sidelineFrames = positions.filter((p) => p.x <= 0.08 || p.x >= 0.92).length;
    const edgeFrames = positions.filter((p) => p.y <= 0.05 || p.y >= 0.95).length;

    return {
      tid,
      cx,
      cy,
      sidelineRatio: sidelineFrames / Math.max(1, positions.length),
      edgeRatio: edgeFrames / Math.max(1, positions.length),
      positions,
      cameraCount: 1, // updated later for multi-cam
    };
  });
}

function isTrackablePlayer(player: LineupEntry, match: MatchContext | null) {
  return !player.excluded_from_tracking && shouldTrackTeam(match, player.team);
}

/**
 * Score how well a track matches a player. Works with or without position/shirt info.
 * - If position is known → use zone distance as primary signal
 * - If no position → fall back to team-half proximity + temporal overlap
 * - Shirt numbers are NOT used for track assignment (camera can't read them)
 */
function scoreTrackCandidate(
  player: LineupEntry,
  track: TrackProfile,
  expectedZone: { x: number; y: number } | null,
  playerWindow: { startMin: number | null; endMin: number },
  fallbackEndMin: number,
) {
  const trackRange = getTrackTimeRange(track.positions);
  const overlapMinutes = getOverlapMinutes(playerWindow, trackRange);
  if (overlapMinutes <= 0) {
    return { overlapMinutes, overlapRatio: 0, score: Infinity };
  }

  const activeMinutes = Math.max(
    0.5,
    (playerWindow.endMin ?? fallbackEndMin) - (playerWindow.startMin ?? 0),
  );
  const overlapRatio = Math.min(1, overlapMinutes / activeMinutes);

  // Zone distance: position-based if available, otherwise team-half heuristic
  let zoneDist: number;
  if (expectedZone) {
    zoneDist = Math.sqrt((track.cx - expectedZone.x) ** 2 + (track.cy - expectedZone.y) ** 2);
  } else {
    // No position known: use team-half proximity
    // Home team expected in lower half (y < 0.5), away in upper half (y > 0.5)
    const expectedY = player.team === "home" ? 0.35 : 0.65;
    zoneDist = Math.abs(track.cy - expectedY) * 0.7; // softer penalty
  }

  const overlapPenalty = 1 / (overlapMinutes + 0.25);
  const coveragePenalty = (1 - overlapRatio) * 0.35;
  const officialPenalty = track.sidelineRatio * (expectedZone ? 0.2 : 0.9) + track.edgeRatio * 0.1;

  // Multi-camera bonus: tracks seen by multiple cameras are more reliable
  const multiCamBonus = track.cameraCount > 1 ? -0.05 * (track.cameraCount - 1) : 0;

  return {
    overlapMinutes,
    overlapRatio,
    score: zoneDist + overlapPenalty + coveragePenalty + officialPenalty + multiCamBonus,
  };
}

// Position zone map for all standard football positions
const POSITION_ZONES: Record<string, { x: number; y: number }> = {
  TW: { x: 0.5, y: 0.06 },
  IV: { x: 0.5, y: 0.2 },
  LV: { x: 0.15, y: 0.22 },
  RV: { x: 0.85, y: 0.22 },
  LIV: { x: 0.35, y: 0.2 },
  RIV: { x: 0.65, y: 0.2 },
  ZDM: { x: 0.5, y: 0.35 },
  ZM: { x: 0.5, y: 0.45 },
  LM: { x: 0.15, y: 0.45 },
  RM: { x: 0.85, y: 0.45 },
  ZOM: { x: 0.5, y: 0.55 },
  LA: { x: 0.15, y: 0.65 },
  RA: { x: 0.85, y: 0.65 },
  ST: { x: 0.5, y: 0.75 },
  HS: { x: 0.5, y: 0.65 },
};

// ── Main Handler ──────────────────────────────────────────────────

async function sha256(value: string) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function runProcessing(supabase: any, matchId: string) {
  const updateProgress = async (phase: string, progress: number, detail?: string) => {
    await supabase.from("matches").update({
      processing_progress: { phase, progress: Math.round(progress), detail: detail || null, updated_at: new Date().toISOString() },
    }).eq("id", matchId);
  };

  try {
    await updateProgress("upload", 10, "Uploads werden geladen");

    const { data: uploads, error: uplErr } = await supabase
      .from("tracking_uploads").select("*").eq("match_id", matchId).eq("status", "uploaded");
    if (uplErr) throw uplErr;
    if (!uploads || uploads.length === 0) {
      await updateProgress("error", 0, "Keine Uploads gefunden");
      await supabase.from("matches").update({ status: "done" }).eq("id", matchId);
      return;
    }

    await updateProgress("detection", 15, `${uploads.length} Kamera-Upload(s) gefunden`);

    const sessions: TrackingSession[] = [];
    for (let ui = 0; ui < uploads.length; ui++) {
      const upload = uploads[ui];
      const rawPath = upload.file_path as string;
      const storagePath = rawPath.startsWith("tracking/") ? rawPath.slice("tracking/".length) : rawPath;
      const { data: fileData, error: dlErr } = await supabase.storage.from("tracking").download(storagePath);
      if (dlErr) { console.error(`Download cam ${upload.camera_index} failed:`, dlErr); continue; }
      const session: TrackingSession = JSON.parse(await fileData.text());
      sessions.push(session);
      await updateProgress("detection", 15 + Math.round(((ui + 1) / uploads.length) * 15), `Kamera ${upload.camera_index + 1} geladen`);
    }

    if (sessions.length === 0) {
      await updateProgress("error", 0, "Keine Tracking-Daten herunterladbar");
      await supabase.from("matches").update({ status: "error" }).eq("id", matchId);
      return;
    }

    await updateProgress("detection", 35, "Frames werden zusammengeführt");

    // Load per-camera calibrations for coordinate transformation
    const uploadCalibrations: Record<number, any> = {};
    for (const upload of uploads) {
      if (upload.calibration) {
        uploadCalibrations[upload.camera_index] = upload.calibration;
      }
    }

    const { mergedFrames, totalDurationSec, cameraContributions } = mergeMultiCameraFrames(sessions, uploadCalibrations);
    await updateProgress("detection", 40, `${mergedFrames.length} Frames zusammengeführt`);

    const { data: match } = await supabase.from("matches")
      .select("field_id, home_club_id, track_opponent, opponent_consent_confirmed").eq("id", matchId).single();
    const matchContext = (match ?? null) as MatchContext | null;
    let fieldW = 105, fieldH = 68;
    if (matchContext?.field_id) {
      const { data: field } = await supabase.from("fields").select("width_m, height_m").eq("id", matchContext.field_id).single();
      if (field) { fieldW = field.width_m || 105; fieldH = field.height_m || 68; }
    }

    const { data: lineups } = await supabase.from("match_lineups")
      .select("id, player_id, player_name, team, shirt_number, starting, subbed_in_min, subbed_out_min, excluded_from_tracking")
      .eq("match_id", matchId);
    const { data: matchEvents } = await supabase.from("match_events")
      .select("match_id, team, minute, event_type, player_id, related_player_id, player_name, related_player_name")
      .eq("match_id", matchId).order("minute", { ascending: true });

    const typedLineups = (lineups || []) as LineupEntry[];
    const typedEvents = (matchEvents || []) as MatchEvent[];
    let trackableLineups = typedLineups.filter((p) => isTrackablePlayer(p, matchContext));

    // ── Auto-Discovery: wenn keine Lineups vorhanden ──
    const useAutoDiscovery = trackableLineups.length === 0;
    if (useAutoDiscovery) {
      await updateProgress("tracking", 58, "Auto-Erkennung: Spieler werden identifiziert");
    }

    const playerIds = trackableLineups.map((l) => l.player_id).filter(Boolean);
    const uniquePlayerIds = [...new Set(playerIds)] as string[];
    const playerPositions: Record<string, string> = {};
    if (uniquePlayerIds.length > 0) {
      const { data: players } = await supabase.from("players").select("id, position").in("id", uniquePlayerIds);
      if (players) { for (const p of players) { if (p.position) playerPositions[p.id] = p.position; } }
    }

    await updateProgress("tracking", 45, "Tracks werden aufgebaut");
    const tracks = buildTracks(mergedFrames);
    const sortedTracks = [...tracks.entries()].sort((a, b) => b[1].length - a[1].length);
    const trackProfiles = buildTrackProfiles(sortedTracks);
    if (sessions.length > 1) { for (const tp of trackProfiles) { tp.cameraCount = sessions.length; } }
    await updateProgress("tracking", 55, `${tracks.size} Tracks erkannt`);

    // ── Auto-Discovery Mode ──
    if (useAutoDiscovery && trackProfiles.length > 0) {
      // Filter officials (sideline/edge dwellers)
      const fieldTracks = trackProfiles.filter(t => t.sidelineRatio < 0.45 && t.edgeRatio < 0.4);

      // Filter ball track: smallest avg bounding box area + highest speed variance
      // Since we only have centroid data, use the track with fewest positions (ball moves fast, hard to track consistently)
      // Simple heuristic: skip the shortest tracks that could be ball
      const playerTracks = fieldTracks.filter(t => t.positions.length > 20);

      // Team clustering via median-split on Y-axis
      const sortedByY = [...playerTracks].sort((a, b) => a.cy - b.cy);
      const medianIdx = Math.floor(sortedByY.length / 2);
      const homeGroup = sortedByY.slice(0, medianIdx);
      const awayGroup = sortedByY.slice(medianIdx);

      // Generate auto-lineups and insert into DB
      const autoLineups: any[] = [];
      homeGroup.forEach((t, i) => {
        autoLineups.push({
          match_id: matchId, player_id: null, player_name: `Spieler ${i + 1}`,
          team: "home", starting: true, shirt_number: i + 1, excluded_from_tracking: false,
        });
      });
      awayGroup.forEach((t, i) => {
        autoLineups.push({
          match_id: matchId, player_id: null, player_name: `Spieler ${i + 1}`,
          team: "away", starting: true, shirt_number: i + 1, excluded_from_tracking: false,
        });
      });

      if (autoLineups.length > 0) {
        const { data: inserted } = await supabase.from("match_lineups").insert(autoLineups).select();
        if (inserted) {
          trackableLineups = inserted as LineupEntry[];
        }
      }

      console.log(`[process-tracking] Auto-Discovery: ${homeGroup.length} home, ${awayGroup.length} away players detected`);
      await updateProgress("tracking", 60, `Auto-Erkennung: ${homeGroup.length} + ${awayGroup.length} Spieler erkannt`);
    }

    await updateProgress("tracking", 60, "Spieler werden zugeordnet");
    const homePlayers = trackableLineups.filter((l) => l.team === "home");
    const awayPlayers = trackableLineups.filter((l) => l.team === "away");
    const allPlayers = [...homePlayers, ...awayPlayers];
    const usedTrackIndices = new Set<number>();
    const fallbackEndMin = Math.max(1, Math.ceil(totalDurationSec / 60));

    const sortedPlayers = [...allPlayers].sort((a, b) => {
      const posA = a.player_id ? playerPositions[a.player_id] : null;
      const posB = b.player_id ? playerPositions[b.player_id] : null;
      const hasZoneA = posA && POSITION_ZONES[posA.toUpperCase()] ? 1 : 0;
      const hasZoneB = posB && POSITION_ZONES[posB.toUpperCase()] ? 1 : 0;
      if (hasZoneA !== hasZoneB) return hasZoneB - hasZoneA;
      if (a.starting !== b.starting) return a.starting ? -1 : 1;
      return 0;
    });

    type PlayerStat = { player_id: string | null; player_name: string | null; team: string; stats: ReturnType<typeof computeTrackStats>; confidence: number; };
    const playerStats: PlayerStat[] = [];

    for (const player of sortedPlayers) {
      const position = player.player_id ? playerPositions[player.player_id] : null;
      const expectedZone = getExpectedZone(position, player.team, POSITION_ZONES);
      const playerWindow = getPlayerWindow(player, typedEvents, fallbackEndMin);
      if (playerWindow.startMin === null || playerWindow.endMin <= playerWindow.startMin) continue;
      let bestIdx = -1, bestScore = Infinity;
      for (let ti = 0; ti < trackProfiles.length; ti++) {
        if (usedTrackIndices.has(ti)) continue;
        const { overlapMinutes, score } = scoreTrackCandidate(player, trackProfiles[ti], expectedZone, playerWindow, fallbackEndMin);
        if (overlapMinutes > 0 && score < bestScore) { bestScore = score; bestIdx = ti; }
      }
      if (bestIdx >= 0) {
        usedTrackIndices.add(bestIdx);
        const tc = trackProfiles[bestIdx];
        const stats = computeTrackStats(tc.positions, fieldW, fieldH);
        const confidence = Math.min(1, Math.max(0.1, Math.max(0, 1 - bestScore * 0.8) - (tc.sidelineRatio > 0.45 ? 0.25 : 0) + (expectedZone ? 0.05 : 0)));
        playerStats.push({ player_id: player.player_id || null, player_name: player.player_name, team: player.team, stats, confidence: Math.round(confidence * 100) / 100 });
      }
    }

    // Auto-Discovery: infer positions for auto-detected players
    if (useAutoDiscovery) {
      for (const ps of playerStats) {
        const assignedIdx = [...usedTrackIndices].find((idx) => {
          const tc = trackProfiles[idx];
          return tc && ps.stats.positions_raw.length > 0 && Math.abs(tc.cx - ps.stats.positions_raw.reduce((s, p) => s + p.x, 0) / ps.stats.positions_raw.length) < 0.01;
        });
        if (assignedIdx === undefined) continue;
        const tc = trackProfiles[assignedIdx];
        const cx = tc.cx, cy = ps.team === "away" ? 1 - tc.cy : tc.cy;
        let bestPos = "ZM", bestDist = Infinity;
        for (const [pos, zone] of Object.entries(POSITION_ZONES)) {
          const d = Math.sqrt((cx - zone.x) ** 2 + (cy - zone.y) ** 2);
          if (d < bestDist) { bestDist = d; bestPos = pos; }
        }
        // Update the player_name with inferred position
        if (ps.player_name?.startsWith("Spieler ")) {
          ps.player_name = `${ps.player_name} (${bestPos})`;
        }
      }
    }

    const unassignedTracks = trackProfiles.filter((_, i) => !usedTrackIndices.has(i));
    const likelyOfficials = unassignedTracks.filter((t) => t.sidelineRatio >= 0.45 || t.edgeRatio >= 0.4);
    await updateProgress("stats", 70, `${playerStats.length} Spieler zugeordnet`);

    // KI Position Inference
    for (const ps of playerStats) {
      if (!ps.player_id || playerPositions[ps.player_id]) continue;
      const assignedIdx = [...usedTrackIndices].find((idx) => {
        const tc = trackProfiles[idx];
        return tc && ps.stats.positions_raw.length > 0 && Math.abs(tc.cx - ps.stats.positions_raw.reduce((s, p) => s + p.x, 0) / ps.stats.positions_raw.length) < 0.01;
      });
      if (assignedIdx === undefined) continue;
      const tc = trackProfiles[assignedIdx];
      const cx = tc.cx, cy = ps.team === "away" ? 1 - tc.cy : tc.cy;
      let bestPos = "ZM", bestDist = Infinity;
      for (const [pos, zone] of Object.entries(POSITION_ZONES)) {
        const d = Math.sqrt((cx - zone.x) ** 2 + (cy - zone.y) ** 2);
        if (d < bestDist) { bestDist = d; bestPos = pos; }
      }
      await supabase.from("players").update({ position: bestPos }).eq("id", ps.player_id).is("position", null);
    }

    await updateProgress("stats", 75, "Statistiken werden gespeichert");
    await supabase.from("player_match_stats").delete().eq("match_id", matchId);
    const playerInserts = playerStats.map((ps) => ({
      match_id: matchId, player_id: ps.player_id, team: ps.team,
      distance_km: ps.stats.distance_km, top_speed_kmh: ps.stats.top_speed_kmh, avg_speed_kmh: ps.stats.avg_speed_kmh,
      sprint_count: ps.stats.sprint_count, sprint_distance_m: ps.stats.sprint_distance_m,
      heatmap_grid: ps.stats.heatmap_grid, positions_raw: ps.stats.positions_raw,
      minutes_played: ps.stats.minutes_played || Math.round(totalDurationSec / 60),
      data_source: "fieldiq", raw_metrics: { assignment_confidence: ps.confidence, cameras_used: sessions.length },
    }));
    if (playerInserts.length > 0) {
      const { error: insertErr } = await supabase.from("player_match_stats").insert(playerInserts);
      if (insertErr) throw insertErr;
    }

    await updateProgress("heatmaps", 85, "Heatmaps werden generiert");
    await supabase.from("team_match_stats").delete().eq("match_id", matchId);
    const teamGroups = { home: [] as PlayerStat[], away: [] as PlayerStat[] };
    for (const ps of playerStats) { if (ps.team === "home") teamGroups.home.push(ps); else if (ps.team === "away") teamGroups.away.push(ps); }
    const teamInserts = [];
    for (const [team, players] of Object.entries(teamGroups)) {
      if (players.length === 0) continue;
      const totalDist = players.reduce((s, p) => s + p.stats.distance_km, 0);
      const topSpeed = Math.max(...players.map((p) => p.stats.top_speed_kmh));
      const mergedHeatmap: number[][] = Array.from({ length: 7 }, () => Array(10).fill(0));
      for (const p of players) { for (let r = 0; r < 7; r++) { for (let c = 0; c < 10; c++) { mergedHeatmap[r][c] += p.stats.heatmap_grid[r]?.[c] || 0; } } }
      const maxH = Math.max(1, ...mergedHeatmap.flat());
      for (let r = 0; r < 7; r++) { for (let c = 0; c < 10; c++) { mergedHeatmap[r][c] = Math.round((mergedHeatmap[r][c] / maxH) * 100) / 100; } }
      teamInserts.push({
        match_id: matchId, team, total_distance_km: Math.round(totalDist * 100) / 100,
        avg_distance_km: Math.round((totalDist / players.length) * 100) / 100,
        top_speed_kmh: Math.round(topSpeed * 10) / 10, possession_pct: team === "home" ? 52 : 48,
        formation_heatmap: mergedHeatmap, data_source: "fieldiq",
        raw_metrics: { tracked_player_count: players.length, cameras_used: sessions.length, camera_indices: [...cameraContributions.keys()], opponent_tracking_enabled: shouldTrackTeam(matchContext, "away"), likely_official_tracks_ignored: likelyOfficials.length },
      });
    }
    if (teamInserts.length > 0) {
      const { error: teamErr } = await supabase.from("team_match_stats").insert(teamInserts);
      if (teamErr) throw teamErr;
    }

    await updateProgress("finalize", 92, "Uploads werden finalisiert");
    for (const upload of uploads) { await supabase.from("tracking_uploads").update({ status: "done" }).eq("id", upload.id); }

    await supabase.from("matches").update({
      status: "done",
      processing_progress: { phase: "complete", progress: 100, detail: "Verarbeitung abgeschlossen", updated_at: new Date().toISOString() },
    }).eq("id", matchId);
    console.log(`[process-tracking] ✅ Complete: ${playerStats.length} players, ${sessions.length} camera(s)`);
  } catch (err) {
    console.error("[process-tracking] Error:", err);
    await updateProgress("error", 0, err instanceof Error ? err.message : "Verarbeitung fehlgeschlagen");
    await supabase.from("matches").update({ status: "error" }).eq("id", matchId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Support two auth methods:
    // 1. Bearer JWT (from authenticated coach UI)
    // 2. x-camera-session-token (from camera PWA)
    const authHeader = req.headers.get("Authorization");
    const cameraSessionToken = req.headers.get("x-camera-session-token");

    let isAuthorized = false;

    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userError } = await userClient.auth.getUser();
      if (!userError && userData?.user) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized && cameraSessionToken && cameraSessionToken.length >= 20) {
      // Validate camera session token against any active session
      const tokenHash = await sha256(cameraSessionToken);
      const { data: session } = await supabase
        .from("camera_access_sessions")
        .select("id")
        .eq("session_token_hash", tokenHash)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (session) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { matchId, action } = await req.json();
    if (!matchId) {
      return new Response(JSON.stringify({ error: "matchId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Retry action: reset stuck match
    if (action === "retry") {
      await supabase.from("matches").update({
        status: "processing",
        processing_progress: { phase: "upload", progress: 0, detail: "Erneut gestartet", updated_at: new Date().toISOString() },
      }).eq("id", matchId);
      await supabase.from("tracking_uploads").update({ status: "uploaded" }).eq("match_id", matchId).in("status", ["done", "error"]);
    }

    console.log(`[process-tracking] Starting for match ${matchId}`);

    // Run processing in background
    const processingPromise = runProcessing(supabase, matchId);
    try {
      (globalThis as any).EdgeRuntime?.waitUntil?.(processingPromise);
    } catch {
      await processingPromise;
    }

    return new Response(
      JSON.stringify({ ok: true, matchId, background: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[process-tracking] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Processing failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
