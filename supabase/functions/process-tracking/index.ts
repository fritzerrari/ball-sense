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
    const used = new Set<number>(); // detection indices already assigned
    const matched = new Set<number>(); // track ids already matched

    // 1) Match existing tracks to closest detection
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

    // 2) Create new tracks for unmatched detections
    for (let i = 0; i < frame.detections.length; i++) {
      if (used.has(i)) continue;
      const det = frame.detections[i];
      const tid = nextTrackId++;
      tracks.set(tid, [{ t: frame.timestamp, x: det.x, y: det.y }]);
      active.set(tid, { x: det.x, y: det.y });
    }

    // 3) Remove tracks not seen for too long (>5 frames equivalent, ~2.5s at 2fps)
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
    const dist = Math.sqrt(dx * dx + dy * dy); // meters
    const dt = (curr.t - prev.t) / 1000; // seconds
    if (dt <= 0) continue;

    totalDist += dist;
    const speed = (dist / dt) * 3.6; // km/h
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

  // Build 10×7 heatmap grid
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
  // Normalise to 0-1
  const maxVal = Math.max(1, ...grid.flat());
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      grid[r][c] = Math.round((grid[r][c] / maxVal) * 100) / 100;
    }
  }

  const durationMs = positions[positions.length - 1].t - positions[0].t;

  return {
    distance_km: Math.round(totalDist / 10) / 100, // round to 2 decimals
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

    // 3) Get field dimensions
    const { data: match } = await supabase
      .from("matches")
      .select("field_id, home_club_id")
      .eq("id", matchId)
      .single();

    let fieldW = 105;
    let fieldH = 68;
    if (match?.field_id) {
      const { data: field } = await supabase
        .from("fields")
        .select("width_m, height_m")
        .eq("id", match.field_id)
        .single();
      if (field) {
        fieldW = field.width_m || 105;
        fieldH = field.height_m || 68;
      }
    }

    // 4) Get lineups, events and player positions
    const { data: lineups } = await supabase
      .from("match_lineups")
      .select("id, player_id, player_name, team, shirt_number, starting, subbed_in_min, subbed_out_min")
      .eq("match_id", matchId);

    const { data: matchEvents } = await supabase
      .from("match_events")
      .select("match_id, team, minute, event_type, player_id, related_player_id, player_name, related_player_name")
      .eq("match_id", matchId)
      .order("minute", { ascending: true });

    const typedLineups = (lineups || []) as LineupEntry[];
    const typedEvents = (matchEvents || []) as MatchEvent[];

    // Fetch player positions for position-based assignment
    const playerIds = typedLineups.map((l) => l.player_id).filter(Boolean);
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

    const homePlayers = typedLineups.filter((l) => l.team === "home");
    const awayPlayers = typedLineups.filter((l) => l.team === "away");
    console.log(
      `[process-tracking] Lineups: ${homePlayers.length} home, ${awayPlayers.length} away, ${typedEvents.length} events`,
    );

    // 5) Build tracks from detections
    const tracks = buildTracks(session.frames);
    console.log(`[process-tracking] Built ${tracks.size} tracks`);

    // Sort tracks by number of positions (longest = most stable)
    const sortedTracks = [...tracks.entries()]
      .sort((a, b) => b[1].length - a[1].length);

    // 6) Position-based player-to-track assignment
    // Map tactical positions to expected field zones (x: 0=left, 1=right; y: 0=top/own goal, 1=bottom/opponent goal)
    const POSITION_ZONES: Record<string, { x: number; y: number }> = {
      TW: { x: 0.5, y: 0.06 },    // Goalkeeper — deep in own half
      IV: { x: 0.5, y: 0.20 },    // Centre-back
      LV: { x: 0.15, y: 0.22 },   // Left-back
      RV: { x: 0.85, y: 0.22 },   // Right-back
      LIV: { x: 0.35, y: 0.20 },  // Left centre-back
      RIV: { x: 0.65, y: 0.20 },  // Right centre-back
      ZDM: { x: 0.5, y: 0.35 },   // Defensive midfielder
      ZM: { x: 0.5, y: 0.45 },    // Central midfielder
      LM: { x: 0.15, y: 0.45 },   // Left midfielder
      RM: { x: 0.85, y: 0.45 },   // Right midfielder
      ZOM: { x: 0.5, y: 0.55 },   // Attacking midfielder
      LA: { x: 0.15, y: 0.65 },   // Left winger
      RA: { x: 0.85, y: 0.65 },   // Right winger
      ST: { x: 0.5, y: 0.75 },    // Striker
      HS: { x: 0.5, y: 0.65 },    // Second striker
    };

    // Compute centroid for each track
    const trackCentroids = sortedTracks.map(([tid, positions]) => {
      const cx = positions.reduce((s, p) => s + p.x, 0) / positions.length;
      const cy = positions.reduce((s, p) => s + p.y, 0) / positions.length;
      return { tid, cx, cy, positions };
    });

    // Use greedy matching: for each player, find the closest unassigned track
    const allPlayers = [...homePlayers, ...awayPlayers];
    const usedTrackIndices = new Set<number>();
    const playerStats: Array<{
      player_id: string | null;
      player_name: string | null;
      team: string;
      stats: ReturnType<typeof computeTrackStats>;
      confidence: number;
    }> = [];

    // Build cost matrix and do greedy assignment
    for (const player of allPlayers) {
      const position = player.player_id ? playerPositions[player.player_id] : null;
      const expectedZone = position ? POSITION_ZONES[position] : null;

      let bestIdx = -1;
      let bestDist = Infinity;

      for (let ti = 0; ti < trackCentroids.length; ti++) {
        if (usedTrackIndices.has(ti)) continue;
        const tc = trackCentroids[ti];

        if (expectedZone) {
          // Distance from track centroid to expected zone
          const dist = Math.sqrt(
            (tc.cx - expectedZone.x) ** 2 + (tc.cy - expectedZone.y) ** 2
          );
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = ti;
          }
        } else {
          // No position info — fall back to longest remaining track
          if (bestIdx === -1) {
            bestIdx = ti;
            bestDist = 0.5; // neutral confidence
          }
        }
      }

      if (bestIdx >= 0) {
        usedTrackIndices.add(bestIdx);
        const tc = trackCentroids[bestIdx];
        const stats = computeTrackStats(tc.positions, fieldW, fieldH);
        // Confidence: 1.0 = perfect match, 0.0 = worst
        const confidence = expectedZone
          ? Math.max(0, 1 - bestDist * 2) // dist of 0.5 = confidence 0
          : 0.3; // no position = low confidence
        playerStats.push({
          player_id: player.player_id || null,
          player_name: player.player_name,
          team: player.team,
          stats,
          confidence: Math.round(confidence * 100) / 100,
        });
        console.log(
          `[process-tracking] Assigned ${player.player_name} (${position || "?"}) → track ${tc.tid} (centroid ${tc.cx.toFixed(2)},${tc.cy.toFixed(2)}) confidence=${confidence.toFixed(2)}`
        );
      }
    }

    console.log(`[process-tracking] Computed stats for ${playerStats.length} players`);

    // 7) Insert player_match_stats
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

    // 8) Compute & insert team_match_stats
    const teamGroups = { home: [] as typeof playerStats, away: [] as typeof playerStats };
    for (const ps of playerStats) {
      if (ps.team === "home") teamGroups.home.push(ps);
      else teamGroups.away.push(ps);
    }

    const teamInserts = [];
    for (const [team, players] of Object.entries(teamGroups)) {
      if (players.length === 0) continue;
      const totalDist = players.reduce((s, p) => s + p.stats.distance_km, 0);
      const topSpeed = Math.max(...players.map((p) => p.stats.top_speed_kmh));

      // Merge heatmaps
      const mergedHeatmap: number[][] = Array.from({ length: 7 }, () =>
        Array(10).fill(0),
      );
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
        avg_distance_km:
          Math.round((totalDist / players.length) * 100) / 100,
        top_speed_kmh: Math.round(topSpeed * 10) / 10,
        possession_pct: team === "home" ? 52 : 48, // placeholder until ball tracking
        formation_heatmap: mergedHeatmap,
        data_source: "fieldiq",
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
