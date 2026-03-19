import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
  // track id → array of { timestamp, x, y }
  const tracks = new Map<number, { t: number; x: number; y: number }[]>();
  let nextTrackId = 0;
  // current active tracks: trackId → last known position
  const active = new Map<number, { x: number; y: number }>();
  const THRESHOLD = 0.12; // max normalised distance to match

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
 * From a position trace, compute physical stats assuming a 105×68m pitch.
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
  const grid: number[][] = Array.from({ length: ROWS }, () =>
    Array(COLS).fill(0),
  );
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
    };
  });
}

function isTrackablePlayer(player: LineupEntry, match: MatchContext | null) {
  return !player.excluded_from_tracking && shouldTrackTeam(match, player.team);
}

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
  const zoneDist = expectedZone
    ? Math.sqrt((track.cx - expectedZone.x) ** 2 + (track.cy - expectedZone.y) ** 2)
    : Math.abs(track.cy - (player.team === "home" ? 0.5 : 0.5));
  const overlapPenalty = 1 / (overlapMinutes + 0.25);
  const coveragePenalty = (1 - overlapRatio) * 0.35;
  const officialPenalty = track.sidelineRatio * (expectedZone ? 0.2 : 0.9) + track.edgeRatio * 0.1;

  return {
    overlapMinutes,
    overlapRatio,
    score: zoneDist + overlapPenalty + coveragePenalty + officialPenalty,
  };
}
// ── Main Handler ──────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
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

    // Verify user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } =
      await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Use service role for data operations
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { matchId } = await req.json();
    if (!matchId) {
      return new Response(JSON.stringify({ error: "matchId required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    console.log(`[process-tracking] Starting for match ${matchId}`);

    // 1) Get tracking uploads for this match
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

    // 2) Download tracking JSON from storage
    const upload = uploads[0];
    // file_path may be stored as "tracking/matchId/cam_0.json" or "matchId/cam_0.json"
    // The storage client already targets bucket "tracking", so strip the prefix if present
    const rawPath = upload.file_path as string;
    const storagePath = rawPath.startsWith("tracking/") ? rawPath.slice("tracking/".length) : rawPath;
    console.log(`[process-tracking] Downloading from bucket 'tracking', path: ${storagePath}`);

    const { data: fileData, error: dlErr } = await supabase.storage
      .from("tracking")
      .download(storagePath);

    if (dlErr) throw dlErr;
    const sessionJson = await fileData.text();
    const session: TrackingSession = JSON.parse(sessionJson);
    console.log(
      `[process-tracking] Loaded ${session.frames.length} frames, ${session.durationSec}s`,
    );

    // 3) Get match and field dimensions
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

    // 4) Get lineups, events and player positions
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
    const skippedHomePlayers = typedLineups.filter((player) => player.team === "home" && player.excluded_from_tracking);
    const skippedAwayPlayers = typedLineups.filter((player) => player.team === "away" && !shouldTrackTeam(matchContext, "away"));

    const playerIds = trackableLineups.map((l) => l.player_id).filter(Boolean);
    const uniquePlayerIds = [...new Set(playerIds)] as string[];
    let playerPositions: Record<string, string> = {};
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
      `[process-tracking] Lineups: ${homePlayers.length} home tracked, ${awayPlayers.length} away tracked, ${typedEvents.length} events`,
    );
    if (skippedHomePlayers.length > 0) {
      console.log(`[process-tracking] Skipped ${skippedHomePlayers.length} home players excluded from tracking`);
    }
    if (skippedAwayPlayers.length > 0) {
      console.log(`[process-tracking] Skipped ${skippedAwayPlayers.length} away players (no opponent approval)`);
    }

    // 5) Build tracks from detections
    const tracks = buildTracks(session.frames);
    console.log(`[process-tracking] Built ${tracks.size} tracks`);

    const sortedTracks = [...tracks.entries()].sort((a, b) => b[1].length - a[1].length);

    // 6) Position-based player-to-track assignment
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

    const trackProfiles = buildTrackProfiles(sortedTracks);

    const allPlayers = [...homePlayers, ...awayPlayers];
    const usedTrackIndices = new Set<number>();
    const fallbackEndMin = Math.max(1, Math.ceil(session.durationSec / 60));
    const playerStats: Array<{
      player_id: string | null;
      player_name: string | null;
      team: string;
      stats: ReturnType<typeof computeTrackStats>;
      confidence: number;
    }> = [];

    for (const player of allPlayers) {
      const position = player.player_id ? playerPositions[player.player_id] : null;
      const expectedZone = getExpectedZone(position, player.team, POSITION_ZONES);
      const playerWindow = getPlayerWindow(player, typedEvents, fallbackEndMin);

      if (playerWindow.startMin === null || playerWindow.endMin <= playerWindow.startMin) {
        console.log(`[process-tracking] Skipping inactive player ${player.player_name}`);
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
        const confidence = Math.max(0.1, confidenceBase - officialPenalty);

        playerStats.push({
          player_id: player.player_id || null,
          player_name: player.player_name,
          team: player.team,
          stats,
          confidence: Math.round(confidence * 100) / 100,
        });
        console.log(
          `[process-tracking] Assigned ${player.player_name} (${player.team}/${position || "?"}) → track ${tc.tid} overlap=${bestOverlapMinutes.toFixed(1)}m confidence=${confidence.toFixed(2)} sideline=${tc.sidelineRatio.toFixed(2)}`,
        );
      }
    }

    const unassignedTracks = trackProfiles.filter((_, index) => !usedTrackIndices.has(index));
    const likelyOfficials = unassignedTracks.filter((track) => track.sidelineRatio >= 0.45 || track.edgeRatio >= 0.4);
    console.log(
      `[process-tracking] Computed stats for ${playerStats.length} players, left ${unassignedTracks.length} unassigned tracks (${likelyOfficials.length} likely officials/non-players)`,
    );

    // 7) Replace player_match_stats for this match
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
      minutes_played: ps.stats.minutes_played || Math.round(session.durationSec / 60),
      data_source: "fieldiq",
      raw_metrics: {
        assignment_confidence: ps.confidence,
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

    // 8) Replace and compute team_match_stats
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

    // 9) Update upload status
    await supabase
      .from("tracking_uploads")
      .update({ status: "done" })
      .eq("id", upload.id);

    // 10) Update match status to done
    await supabase
      .from("matches")
      .update({ status: "done" })
      .eq("id", matchId);

    console.log(`[process-tracking] ✅ Complete for match ${matchId}`);

    return new Response(
      JSON.stringify({
        success: true,
        matchId,
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
