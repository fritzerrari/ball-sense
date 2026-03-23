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
function mergeMultiCameraFrames(sessions: TrackingSession[]): {
  mergedFrames: TrackingFrame[];
  totalDurationSec: number;
  cameraContributions: Map<number, number>; // cameraIndex → frame count
} {
  if (sessions.length === 1) {
    return {
      mergedFrames: sessions[0].frames,
      totalDurationSec: sessions[0].durationSec,
      cameraContributions: new Map([[sessions[0].cameraIndex, sessions[0].frames.length]]),
    };
  }

  const TIME_MERGE_MS = 250;
  const SPATIAL_MERGE_DIST = 0.05;

  // Collect all frames tagged with camera index
  const allTagged: { frame: TrackingFrame; camIdx: number }[] = [];
  const cameraContributions = new Map<number, number>();

  for (const session of sessions) {
    cameraContributions.set(session.cameraIndex, session.frames.length);
    for (const frame of session.frames) {
      allTagged.push({ frame, camIdx: session.cameraIndex });
    }
  }

  // Sort all frames by timestamp
  allTagged.sort((a, b) => a.frame.timestamp - b.frame.timestamp);

  // Group frames within TIME_MERGE_MS windows
  const mergedFrames: TrackingFrame[] = [];
  let i = 0;
  while (i < allTagged.length) {
    const windowStart = allTagged[i].frame.timestamp;
    const windowDetections: Detection[] = [...allTagged[i].frame.detections];
    let j = i + 1;

    while (j < allTagged.length && allTagged[j].frame.timestamp - windowStart <= TIME_MERGE_MS) {
      // Merge detections: only add if not spatially close to existing
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

    mergedFrames.push({
      timestamp: windowStart,
      detections: windowDetections,
    });
    i = j;
  }

  const totalDurationSec = Math.max(...sessions.map((s) => s.durationSec));

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { matchId } = await req.json();
    if (!matchId) {
      return new Response(JSON.stringify({ error: "matchId required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    console.log(`[process-tracking] Starting for match ${matchId}`);

    // 1) Get ALL tracking uploads for this match
    const { data: uploads, error: uplErr } = await supabase
      .from("tracking_uploads")
      .select("*")
      .eq("match_id", matchId)
      .eq("status", "uploaded");

    if (uplErr) throw uplErr;
    if (!uploads || uploads.length === 0) {
      return new Response(
        JSON.stringify({ error: "No uploads found", matchId }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[process-tracking] Found ${uploads.length} camera upload(s)`);

    // 2) Download ALL tracking JSONs and merge
    const sessions: TrackingSession[] = [];
    for (const upload of uploads) {
      const rawPath = upload.file_path as string;
      const storagePath = rawPath.startsWith("tracking/") ? rawPath.slice("tracking/".length) : rawPath;
      console.log(`[process-tracking] Downloading camera ${upload.camera_index} from: ${storagePath}`);

      const { data: fileData, error: dlErr } = await supabase.storage
        .from("tracking")
        .download(storagePath);

      if (dlErr) {
        console.error(`[process-tracking] Failed to download camera ${upload.camera_index}:`, dlErr);
        continue; // skip failed downloads, process what we have
      }

      const sessionJson = await fileData.text();
      const session: TrackingSession = JSON.parse(sessionJson);
      sessions.push(session);
      console.log(`[process-tracking] Camera ${upload.camera_index}: ${session.frames.length} frames, ${session.durationSec}s`);
    }

    if (sessions.length === 0) {
      return new Response(
        JSON.stringify({ error: "Could not download any tracking data", matchId }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3) Merge multi-camera frames
    const { mergedFrames, totalDurationSec, cameraContributions } = mergeMultiCameraFrames(sessions);
    console.log(
      `[process-tracking] Merged ${sessions.length} camera(s) → ${mergedFrames.length} frames, ${totalDurationSec}s`
    );

    // 4) Get match and field dimensions
    const { data: match } = await supabase
      .from("matches")
      .select("field_id, home_club_id, track_opponent, opponent_consent_confirmed")
      .eq("id", matchId)
      .single();

    const matchContext = (match ?? null) as MatchContext | null;

    let fieldW = 105;
    let fieldH = 68;
    if (matchContext?.field_id) {
      const { data: field } = await supabase
        .from("fields")
        .select("width_m, height_m")
        .eq("id", matchContext.field_id)
        .single();
      if (field) {
        fieldW = field.width_m || 105;
        fieldH = field.height_m || 68;
      }
    }

    // 5) Get lineups, events and player positions
    const { data: lineups } = await supabase
      .from("match_lineups")
      .select("id, player_id, player_name, team, shirt_number, starting, subbed_in_min, subbed_out_min, excluded_from_tracking")
      .eq("match_id", matchId);

    const { data: matchEvents } = await supabase
      .from("match_events")
      .select("match_id, team, minute, event_type, player_id, related_player_id, player_name, related_player_name")
      .eq("match_id", matchId)
      .order("minute", { ascending: true });

    const typedLineups = (lineups || []) as LineupEntry[];
    const typedEvents = (matchEvents || []) as MatchEvent[];

    const trackableLineups = typedLineups.filter((player) => isTrackablePlayer(player, matchContext));
    const skippedHomePlayers = typedLineups.filter((p) => p.team === "home" && p.excluded_from_tracking);
    const skippedAwayPlayers = typedLineups.filter((p) => p.team === "away" && !shouldTrackTeam(matchContext, "away"));

    // Categorize players by shirt number availability for logging
    const playersWithNumber = trackableLineups.filter((p) => p.shirt_number != null);
    const playersWithoutNumber = trackableLineups.filter((p) => p.shirt_number == null);
    console.log(
      `[process-tracking] Players: ${playersWithNumber.length} with shirt#, ${playersWithoutNumber.length} without shirt#`
    );

    const playerIds = trackableLineups.map((l) => l.player_id).filter(Boolean);
    const uniquePlayerIds = [...new Set(playerIds)] as string[];
    const playerPositions: Record<string, string> = {};
    if (uniquePlayerIds.length > 0) {
      const { data: players } = await supabase
        .from("players")
        .select("id, position")
        .in("id", uniquePlayerIds);
      if (players) {
        for (const p of players) {
          if (p.position) playerPositions[p.id] = p.position;
        }
      }
    }

    const homePlayers = trackableLineups.filter((l) => l.team === "home");
    const awayPlayers = trackableLineups.filter((l) => l.team === "away");
    console.log(
      `[process-tracking] Lineups: ${homePlayers.length} home, ${awayPlayers.length} away, ${typedEvents.length} events`
    );
    if (skippedHomePlayers.length > 0) {
      console.log(`[process-tracking] Skipped ${skippedHomePlayers.length} home excluded`);
    }
    if (skippedAwayPlayers.length > 0) {
      console.log(`[process-tracking] Skipped ${skippedAwayPlayers.length} away (no consent)`);
    }

    // 6) Build tracks from merged detections
    const tracks = buildTracks(mergedFrames);
    console.log(`[process-tracking] Built ${tracks.size} tracks from merged frames`);

    const sortedTracks = [...tracks.entries()].sort((a, b) => b[1].length - a[1].length);
    const trackProfiles = buildTrackProfiles(sortedTracks);

    // 7) Position-based player-to-track assignment
    // Works regardless of shirt numbers: uses position zones, temporal overlap,
    // and team-half heuristics as fallback
    const allPlayers = [...homePlayers, ...awayPlayers];
    const usedTrackIndices = new Set<number>();
    const fallbackEndMin = Math.max(1, Math.ceil(totalDurationSec / 60));

    // Sort players by assignment priority:
    // 1. Players with known positions get assigned first (more constraints = better match)
    // 2. Players without positions get remaining tracks
    const sortedPlayers = [...allPlayers].sort((a, b) => {
      const posA = a.player_id ? playerPositions[a.player_id] : null;
      const posB = b.player_id ? playerPositions[b.player_id] : null;
      const hasZoneA = posA && POSITION_ZONES[posA.toUpperCase()] ? 1 : 0;
      const hasZoneB = posB && POSITION_ZONES[posB.toUpperCase()] ? 1 : 0;
      // Players with known zones first
      if (hasZoneA !== hasZoneB) return hasZoneB - hasZoneA;
      // Starting players before subs
      if (a.starting !== b.starting) return a.starting ? -1 : 1;
      return 0;
    });

    const playerStats: Array<{
      player_id: string | null;
      player_name: string | null;
      team: string;
      stats: ReturnType<typeof computeTrackStats>;
      confidence: number;
    }> = [];

    for (const player of sortedPlayers) {
      const position = player.player_id ? playerPositions[player.player_id] : null;
      const expectedZone = getExpectedZone(position, player.team, POSITION_ZONES);
      const playerWindow = getPlayerWindow(player, typedEvents, fallbackEndMin);

      if (playerWindow.startMin === null || playerWindow.endMin <= playerWindow.startMin) {
        console.log(`[process-tracking] Skipping inactive: ${player.player_name}`);
        continue;
      }

      let bestIdx = -1;
      let bestScore = Infinity;
      let bestOverlapMinutes = 0;

      for (let ti = 0; ti < trackProfiles.length; ti++) {
        if (usedTrackIndices.has(ti)) continue;
        const candidate = trackProfiles[ti];
        const { overlapMinutes, score } = scoreTrackCandidate(
          player,
          candidate,
          expectedZone,
          playerWindow,
          fallbackEndMin,
        );
        if (overlapMinutes <= 0) continue;

        if (score < bestScore) {
          bestScore = score;
          bestIdx = ti;
          bestOverlapMinutes = overlapMinutes;
        }
      }

      if (bestIdx >= 0) {
        usedTrackIndices.add(bestIdx);
        const tc = trackProfiles[bestIdx];
        const stats = computeTrackStats(tc.positions, fieldW, fieldH);
        const confidenceBase = Math.max(0, 1 - bestScore * 0.8);
        const officialPenalty = tc.sidelineRatio > 0.45 ? 0.25 : 0;
        // Boost confidence if position was known (better constraint)
        const positionBonus = expectedZone ? 0.05 : 0;
        const confidence = Math.min(1, Math.max(0.1, confidenceBase - officialPenalty + positionBonus));

        playerStats.push({
          player_id: player.player_id || null,
          player_name: player.player_name,
          team: player.team,
          stats,
          confidence: Math.round(confidence * 100) / 100,
        });

        const shirtInfo = player.shirt_number != null ? `#${player.shirt_number}` : "no#";
        console.log(
          `[process-tracking] ${player.player_name} (${player.team}/${position || "?"}/${shirtInfo}) → track ${tc.tid} overlap=${bestOverlapMinutes.toFixed(1)}m conf=${confidence.toFixed(2)}`
        );
      } else {
        console.log(
          `[process-tracking] No track found for ${player.player_name} (${player.team}/${position || "?"})`
        );
      }
    }

    const unassignedTracks = trackProfiles.filter((_, i) => !usedTrackIndices.has(i));
    const likelyOfficials = unassignedTracks.filter((t) => t.sidelineRatio >= 0.45 || t.edgeRatio >= 0.4);
    console.log(
      `[process-tracking] Assigned ${playerStats.length} players, ${unassignedTracks.length} unassigned (${likelyOfficials.length} likely officials)`
    );

    // 8) Replace player_match_stats
    await supabase.from("player_match_stats").delete().eq("match_id", matchId);

    const playerInserts = playerStats.map((ps) => ({
      match_id: matchId,
      player_id: ps.player_id,
      team: ps.team,
      distance_km: ps.stats.distance_km,
      top_speed_kmh: ps.stats.top_speed_kmh,
      avg_speed_kmh: ps.stats.avg_speed_kmh,
      sprint_count: ps.stats.sprint_count,
      sprint_distance_m: ps.stats.sprint_distance_m,
      heatmap_grid: ps.stats.heatmap_grid,
      positions_raw: ps.stats.positions_raw,
      minutes_played: ps.stats.minutes_played || Math.round(totalDurationSec / 60),
      data_source: "fieldiq",
      raw_metrics: {
        assignment_confidence: ps.confidence,
        cameras_used: sessions.length,
      },
    }));

    if (playerInserts.length > 0) {
      const { error: insertErr } = await supabase
        .from("player_match_stats")
        .insert(playerInserts);
      if (insertErr) {
        console.error("[process-tracking] player_match_stats insert error:", insertErr);
        throw insertErr;
      }
    }

    // 9) Replace and compute team_match_stats
    await supabase.from("team_match_stats").delete().eq("match_id", matchId);

    const teamGroups = { home: [] as typeof playerStats, away: [] as typeof playerStats };
    for (const ps of playerStats) {
      if (ps.team === "home") teamGroups.home.push(ps);
      else if (ps.team === "away") teamGroups.away.push(ps);
    }

    const teamInserts = [];
    for (const [team, players] of Object.entries(teamGroups)) {
      if (players.length === 0) continue;
      const totalDist = players.reduce((s, p) => s + p.stats.distance_km, 0);
      const topSpeed = Math.max(...players.map((p) => p.stats.top_speed_kmh));

      const mergedHeatmap: number[][] = Array.from({ length: 7 }, () => Array(10).fill(0));
      for (const p of players) {
        for (let r = 0; r < 7; r++) {
          for (let c = 0; c < 10; c++) {
            mergedHeatmap[r][c] += p.stats.heatmap_grid[r]?.[c] || 0;
          }
        }
      }
      const maxH = Math.max(1, ...mergedHeatmap.flat());
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 10; c++) {
          mergedHeatmap[r][c] = Math.round((mergedHeatmap[r][c] / maxH) * 100) / 100;
        }
      }

      teamInserts.push({
        match_id: matchId,
        team,
        total_distance_km: Math.round(totalDist * 100) / 100,
        avg_distance_km: Math.round((totalDist / players.length) * 100) / 100,
        top_speed_kmh: Math.round(topSpeed * 10) / 10,
        possession_pct: team === "home" ? 52 : 48,
        formation_heatmap: mergedHeatmap,
        data_source: "fieldiq",
        raw_metrics: {
          tracked_player_count: players.length,
          cameras_used: sessions.length,
          camera_indices: [...cameraContributions.keys()],
          opponent_tracking_enabled: shouldTrackTeam(matchContext, "away"),
          likely_official_tracks_ignored: likelyOfficials.length,
        },
      });
    }

    if (teamInserts.length > 0) {
      const { error: teamErr } = await supabase
        .from("team_match_stats")
        .insert(teamInserts);
      if (teamErr) {
        console.error("[process-tracking] team_match_stats insert error:", teamErr);
        throw teamErr;
      }
    }

    // 10) Update all upload statuses to done
    for (const upload of uploads) {
      await supabase
        .from("tracking_uploads")
        .update({ status: "done" })
        .eq("id", upload.id);
    }

    // 11) Update match status
    await supabase
      .from("matches")
      .update({ status: "done" })
      .eq("id", matchId);

    console.log(`[process-tracking] ✅ Complete: ${playerStats.length} players, ${sessions.length} camera(s)`);

    return new Response(
      JSON.stringify({
        success: true,
        matchId,
        camerasProcessed: sessions.length,
        cameraIndices: [...cameraContributions.keys()],
        playersProcessed: playerStats.length,
        teamsProcessed: teamInserts.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[process-tracking] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Processing failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
