// Auto-Clip Detector: Erkennt taktische Muster aus Positionsdaten und Events
// und legt virtuelle Clip-Marker (video_type='auto_pattern') an.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Pattern = {
  pattern_key: string;
  label: string;
  minute: number;
  severity: "info" | "warn" | "danger" | "good";
  description: string;
  duration_sec: number;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { match_id, force_refresh = false } = await req.json();
    if (!match_id) throw new Error("match_id required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // If not forcing, check whether auto-pattern clips already exist
    if (!force_refresh) {
      const { data: existing } = await supabase
        .from("match_videos")
        .select("id, event_type, event_minute, duration_sec")
        .eq("match_id", match_id)
        .eq("video_type", "auto_pattern");
      if (existing && existing.length > 0) {
        return new Response(JSON.stringify({ patterns: existing, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Load match + club id
    const { data: match } = await supabase
      .from("matches")
      .select("id, home_club_id, h2_started_at, h1_started_at")
      .eq("id", match_id)
      .single();
    if (!match) throw new Error("match not found");

    // Load events + team stats (for context) + player positions
    const [{ data: events }, { data: teamStats }, { data: playerStats }] = await Promise.all([
      supabase
        .from("match_events")
        .select("minute, event_type, team, event_zone, event_pattern, event_cause, severity")
        .eq("match_id", match_id)
        .order("minute"),
      supabase.from("team_match_stats").select("*").eq("match_id", match_id),
      supabase
        .from("player_match_stats")
        .select("team, player_id, positions_raw, heatmap_grid, period")
        .eq("match_id", match_id)
        .eq("period", "full"),
    ]);

    const patterns: Pattern[] = detectPatterns(
      events ?? [],
      teamStats ?? [],
      playerStats ?? [],
    );

    // Replace existing auto_pattern clips
    if (force_refresh) {
      await supabase
        .from("match_videos")
        .delete()
        .eq("match_id", match_id)
        .eq("video_type", "auto_pattern");
    }

    if (patterns.length > 0) {
      const rows = patterns.map((p) => ({
        match_id,
        club_id: match.home_club_id,
        file_path: `auto://${match_id}/${p.pattern_key}-${p.minute}`,
        video_type: "auto_pattern",
        event_type: p.pattern_key,
        event_minute: p.minute,
        duration_sec: p.duration_sec,
        status: "pattern",
      }));
      const { error: insertErr } = await supabase.from("match_videos").insert(rows);
      if (insertErr) console.error("insert clips failed", insertErr);
    }

    return new Response(JSON.stringify({ patterns, count: patterns.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("auto-clip-detector error", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

/** Heuristic pattern detection on events + positions. */
function detectPatterns(
  events: any[],
  teamStats: any[],
  playerStats: any[],
): Pattern[] {
  const out: Pattern[] = [];
  const homeStats = teamStats.find((t) => t.team === "home");
  const awayStats = teamStats.find((t) => t.team === "away");

  // 1) Goals against → ball-loss in build-up?
  const goalsAgainst = events.filter(
    (e) => e.event_type === "goal" && e.team === "away",
  );
  for (const g of goalsAgainst) {
    const precedingLoss = events.find(
      (e) =>
        e.team === "home" &&
        ["ball_loss", "turnover"].includes(e.event_type) &&
        g.minute - e.minute >= 0 &&
        g.minute - e.minute <= 2,
    );
    out.push({
      pattern_key: "goal_conceded_buildup",
      label: precedingLoss
        ? `Gegentor nach Ballverlust (Min ${precedingLoss.minute})`
        : `Gegentor – Verteidigungssituation`,
      minute: Math.max(0, g.minute - 1),
      severity: "danger",
      duration_sec: 30,
      description: precedingLoss
        ? `Ballverlust in Min ${precedingLoss.minute} (${precedingLoss.event_zone ?? "Zentrum"}) → Gegentor in Min ${g.minute}.`
        : `Gegentor in Min ${g.minute} – Defensive Lücke prüfen.`,
    });
  }

  // 2) Cluster of own ball losses in own third (3+ within 5 min in def zone)
  const losses = events.filter(
    (e) => e.team === "home" && ["ball_loss", "turnover"].includes(e.event_type),
  );
  for (let i = 0; i < losses.length; i++) {
    const window = losses.filter(
      (l) => l.minute >= losses[i].minute && l.minute <= losses[i].minute + 5,
    );
    const defLosses = window.filter((l) =>
      ["def_third", "own_third", "back"].includes(l.event_zone ?? ""),
    );
    if (defLosses.length >= 3) {
      out.push({
        pattern_key: "loss_cluster_def",
        label: `Ballverlust-Cluster hinten (Min ${losses[i].minute})`,
        minute: losses[i].minute,
        severity: "warn",
        duration_sec: 45,
        description: `${defLosses.length} Ballverluste in der eigenen Hälfte zwischen Min ${losses[i].minute} und ${losses[i].minute + 5}.`,
      });
      i += defLosses.length - 1;
    }
  }

  // 3) Heatmap-based: detect "open center" — gap between MID-line and DEF-line
  const homePlayers = playerStats.filter((p) => p.team === "home" && p.positions_raw);
  if (homePlayers.length >= 6) {
    const samplePositions: { x: number; y: number; t?: number }[] = [];
    for (const p of homePlayers) {
      const positions = Array.isArray(p.positions_raw) ? p.positions_raw : [];
      for (const pos of positions.slice(0, 50)) {
        if (typeof pos?.x === "number" && typeof pos?.y === "number") {
          samplePositions.push({ x: pos.x, y: pos.y, t: pos.t });
        }
      }
    }
    if (samplePositions.length > 30) {
      // Check center coverage at y between 40-60
      const centerCoverage = samplePositions.filter(
        (p) => p.x >= 35 && p.x <= 65 && p.y >= 40 && p.y <= 60,
      ).length / samplePositions.length;
      if (centerCoverage < 0.12) {
        out.push({
          pattern_key: "open_center",
          label: "Zentrum offen",
          minute: 1,
          severity: "warn",
          duration_sec: 60,
          description: `Nur ${(centerCoverage * 100).toFixed(0)}% Anwesenheit im zentralen Mittelfeld – anfällig für Konter durch die Mitte.`,
        });
      }
    }
  }

  // 4) Set-piece clusters (corner / freekick / throw_in)
  const setPieces = events.filter((e) =>
    ["corner", "freekick", "throw_in", "penalty"].includes(e.event_type),
  );
  const setPieceWindows: Record<number, number> = {};
  for (const sp of setPieces) {
    const bucket = Math.floor(sp.minute / 10) * 10;
    setPieceWindows[bucket] = (setPieceWindows[bucket] ?? 0) + 1;
  }
  for (const [bucket, count] of Object.entries(setPieceWindows)) {
    if (count >= 4) {
      out.push({
        pattern_key: "setpiece_cluster",
        label: `Standard-Häufung Min ${bucket}-${Number(bucket) + 10}`,
        minute: Number(bucket),
        severity: "info",
        duration_sec: 90,
        description: `${count} Standardsituationen in 10 Minuten – Standardstrategie überprüfen.`,
      });
    }
  }

  // 5) Possession imbalance per phase (very low possession <35% → press too high?)
  if (homeStats?.possession_pct && homeStats.possession_pct < 35) {
    out.push({
      pattern_key: "low_possession",
      label: `Niedriger Ballbesitz ${Math.round(homeStats.possession_pct)}%`,
      minute: 1,
      severity: "warn",
      duration_sec: 60,
      description: `Eigener Ballbesitz nur ${Math.round(homeStats.possession_pct)}%. Aufbauspiel/Pressing-Resistenz analysieren.`,
    });
  }

  // 6) Goal-scoring runs (≥2 goals within 10 min)
  const goalsFor = events.filter((e) => e.event_type === "goal" && e.team === "home");
  for (let i = 0; i < goalsFor.length; i++) {
    const window = goalsFor.filter(
      (g) => g.minute >= goalsFor[i].minute && g.minute <= goalsFor[i].minute + 10,
    );
    if (window.length >= 2) {
      out.push({
        pattern_key: "scoring_run",
        label: `Torflut Min ${goalsFor[i].minute}-${goalsFor[i].minute + 10}`,
        minute: goalsFor[i].minute,
        severity: "good",
        duration_sec: 60,
        description: `${window.length} eigene Tore in 10 Minuten – Stärken in dieser Phase festhalten.`,
      });
      i += window.length - 1;
    }
  }

  // Dedupe by (pattern_key, minute)
  const seen = new Set<string>();
  return out.filter((p) => {
    const key = `${p.pattern_key}-${p.minute}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
