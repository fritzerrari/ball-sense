import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, Loader2, AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";
import { fetchCameraCoverage, cameraLabel, type CameraCoverageResult } from "@/lib/camera-coverage";

interface FramePos {
  frame_index?: number;
  visible_area?: { description?: string; estimated_coverage_pct?: number };
  players?: Array<{ team?: "home" | "away"; x?: number; y?: number; estimated?: boolean }>;
  ball?: { x?: number; y?: number };
}

interface Props {
  matchId: string;
  framePositions?: FramePos[] | null;
}

const GRID_X = 16;
const GRID_Y = 10;

// Camera color tokens (semantic, design-system aligned)
const CAM_COLORS = [
  "hsl(var(--primary))",       // Trainer
  "hsl(var(--accent))",        // Helfer A
  "hsl(45 95% 55%)",           // Helfer B (warm yellow)
  "hsl(280 80% 65%)",          // Helfer C (purple)
];

/**
 * Approximate the rectangular visible area on the pitch for a camera based on
 * the verbal `visible_area.description` Gemini returns. Falls back to coverage_pct
 * centered on the pitch when no spatial keyword is found.
 *
 * Returns normalized coords {x, y, w, h} on a 0–100 system.
 */
function inferRectFromDescription(desc: string | undefined, coveragePct: number): { x: number; y: number; w: number; h: number } {
  const d = (desc ?? "").toLowerCase();
  const cov = Math.max(10, Math.min(100, coveragePct || 60)) / 100;
  // Default = centered, area proportional to coverage
  const side = Math.sqrt(cov);
  let w = 100 * Math.min(1, side * 1.2);
  let h = 100 * Math.min(1, side * 1.2);
  let x = (100 - w) / 2;
  let y = (100 - h) / 2;

  if (/left|links|linke/.test(d)) { x = 0; w = Math.min(60, 100 * cov * 1.3); }
  else if (/right|rechts|rechte/.test(d)) { w = Math.min(60, 100 * cov * 1.3); x = 100 - w; }
  else if (/full|gesamt|komplett/.test(d)) { x = 0; y = 0; w = 100; h = 100; }
  else if (/penalty|strafraum|tor/.test(d)) {
    w = 35; h = 50; x = (100 - w) / 2; y = (100 - h) / 2;
    if (/left|links/.test(d)) x = 0;
    if (/right|rechts/.test(d)) x = 65;
  }
  return { x, y, w, h };
}

export default function CameraCoverageMap({ matchId, framePositions }: Props) {
  const [coverage, setCoverage] = useState<CameraCoverageResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchCameraCoverage(matchId).then((res) => {
      if (cancelled) return;
      setCoverage(res);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [matchId]);

  // Build detection density grid from ALL player positions (real, observed data)
  const grid = useMemo(() => {
    const g: number[][] = Array.from({ length: GRID_Y }, () => Array(GRID_X).fill(0));
    let total = 0;
    if (Array.isArray(framePositions)) {
      for (const fr of framePositions) {
        if (!Array.isArray(fr?.players)) continue;
        for (const p of fr.players) {
          if (p.estimated) continue; // only count truly observed players
          const x = typeof p.x === "number" ? p.x : -1;
          const y = typeof p.y === "number" ? p.y : -1;
          if (x < 0 || x > 100 || y < 0 || y > 100) continue;
          const gx = Math.min(GRID_X - 1, Math.floor((x / 100) * GRID_X));
          const gy = Math.min(GRID_Y - 1, Math.floor((y / 100) * GRID_Y));
          g[gy][gx] += 1;
          total += 1;
        }
      }
    }
    return { g, total };
  }, [framePositions]);

  const maxCell = useMemo(() => {
    let m = 0;
    for (const row of grid.g) for (const c of row) if (c > m) m = c;
    return m;
  }, [grid]);

  // Compute per-camera approx. visible rect from sample frames
  const camRects = useMemo(() => {
    if (!coverage || !Array.isArray(framePositions) || framePositions.length === 0) return [];
    // Distribute frames evenly across cameras (we don't have per-frame cam id post-merge)
    const cams = coverage.cameras.slice().sort((a, b) => a.camera_index - b.camera_index);
    const totalFrames = cams.reduce((s, c) => s + (c.frame_count || 0), 0) || 1;
    const rects: Array<{ cam: number; rect: ReturnType<typeof inferRectFromDescription>; share: number; descSample: string }> = [];
    let cursor = 0;
    for (const cam of cams) {
      const share = (cam.frame_count || 0) / totalFrames;
      const span = Math.max(1, Math.round(framePositions.length * share));
      const slice = framePositions.slice(cursor, cursor + span);
      cursor += span;
      // Aggregate visible-area description (most frequent keyword)
      const descs = slice.map((f) => f.visible_area?.description ?? "").filter(Boolean);
      const descSample = descs[0] ?? "Full pitch";
      const avgCov = slice.reduce((s, f) => s + (f.visible_area?.estimated_coverage_pct ?? 60), 0) / Math.max(1, slice.length);
      rects.push({ cam: cam.camera_index, rect: inferRectFromDescription(descSample, avgCov), share, descSample });
    }
    return rects;
  }, [coverage, framePositions]);

  // Identify blind zones (cells with 0 detections) and total coverage score
  const { blindCells, coverageScore, recommendation } = useMemo(() => {
    if (!grid.total) return { blindCells: 0, coverageScore: 0, recommendation: null as string | null };
    let blind = 0;
    const totalCells = GRID_X * GRID_Y;
    // Quadrant blindness for recommendation
    const quad = { tl: 0, tr: 0, bl: 0, br: 0 };
    const quadTotal = { tl: 0, tr: 0, bl: 0, br: 0 };
    for (let y = 0; y < GRID_Y; y++) {
      for (let x = 0; x < GRID_X; x++) {
        const isBlind = grid.g[y][x] === 0;
        if (isBlind) blind++;
        const k = (y < GRID_Y / 2 ? "t" : "b") + (x < GRID_X / 2 ? "l" : "r") as keyof typeof quad;
        quadTotal[k]++;
        if (isBlind) quad[k]++;
      }
    }
    const score = Math.round(((totalCells - blind) / totalCells) * 100);
    const worstQuad = (Object.keys(quad) as Array<keyof typeof quad>)
      .map((k) => ({ k, ratio: quad[k] / quadTotal[k] }))
      .sort((a, b) => b.ratio - a.ratio)[0];
    let rec: string | null = null;
    if (worstQuad && worstQuad.ratio > 0.4) {
      const map: Record<string, string> = {
        tl: "obere linke Spielfeldhälfte",
        tr: "obere rechte Spielfeldhälfte",
        bl: "untere linke Spielfeldhälfte",
        br: "untere rechte Spielfeldhälfte",
      };
      rec = `Helfer-Kamera Richtung ${map[worstQuad.k]} positionieren — dort ${Math.round(worstQuad.ratio * 100)}% Blindzonen.`;
    }
    return { blindCells: blind, coverageScore: score, recommendation: rec };
  }, [grid]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Kamera-Abdeckungskarte wird geladen…
        </CardContent>
      </Card>
    );
  }

  if (!coverage || coverage.cameras.length === 0 || !grid.total) return null;

  return (
    <Card>
      <CardContent className="py-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Kamera-Abdeckung & Sichtfeld</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={
              coverageScore >= 80 ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
              : coverageScore >= 60 ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
              : "border-destructive/40 bg-destructive/10 text-destructive"
            }>
              {coverageScore >= 80 ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
              {coverageScore}% Felddeckung
            </Badge>
            <Badge variant="outline" className="text-xs">
              {coverage.cameras.length} Kamera{coverage.cameras.length > 1 ? "s" : ""}
            </Badge>
          </div>
        </div>

        {/* SVG soccer field */}
        <div className="relative w-full" style={{ aspectRatio: "105 / 68" }}>
          <svg viewBox="0 0 100 68" className="w-full h-full rounded-md" preserveAspectRatio="none">
            {/* Pitch background */}
            <rect x="0" y="0" width="100" height="68" fill="hsl(142 50% 22%)" />
            {/* Stripes */}
            {Array.from({ length: 10 }).map((_, i) => (
              <rect key={i} x={i * 10} y="0" width="10" height="68" fill={i % 2 === 0 ? "hsl(142 50% 24%)" : "hsl(142 50% 20%)"} />
            ))}

            {/* Heatmap of player detections */}
            {grid.g.map((row, y) =>
              row.map((c, x) => {
                if (c === 0) return null;
                const intensity = maxCell > 0 ? c / maxCell : 0;
                const cellW = 100 / GRID_X;
                const cellH = 68 / GRID_Y;
                return (
                  <rect
                    key={`${x}-${y}`}
                    x={x * cellW}
                    y={y * cellH}
                    width={cellW}
                    height={cellH}
                    fill={`hsl(var(--primary))`}
                    opacity={0.15 + intensity * 0.55}
                  />
                );
              })
            )}

            {/* Blind zones overlay */}
            {grid.g.map((row, y) =>
              row.map((c, x) => {
                if (c !== 0) return null;
                const cellW = 100 / GRID_X;
                const cellH = 68 / GRID_Y;
                return (
                  <rect
                    key={`b-${x}-${y}`}
                    x={x * cellW}
                    y={y * cellH}
                    width={cellW}
                    height={cellH}
                    fill="hsl(0 70% 50%)"
                    opacity={0.18}
                  />
                );
              })
            )}

            {/* Field markings */}
            <g fill="none" stroke="hsl(0 0% 100%)" strokeWidth="0.3" opacity="0.7">
              <rect x="0.5" y="0.5" width="99" height="67" />
              <line x1="50" y1="0.5" x2="50" y2="67.5" />
              <circle cx="50" cy="34" r="9.15" />
              <circle cx="50" cy="34" r="0.5" fill="hsl(0 0% 100%)" />
              {/* Penalty boxes */}
              <rect x="0.5" y="13.85" width="16.5" height="40.3" />
              <rect x="83" y="13.85" width="16.5" height="40.3" />
              <rect x="0.5" y="24.85" width="5.5" height="18.3" />
              <rect x="94" y="24.85" width="5.5" height="18.3" />
            </g>

            {/* Camera view rectangles */}
            {camRects.map(({ cam, rect }, i) => {
              const color = CAM_COLORS[cam] ?? CAM_COLORS[i % CAM_COLORS.length];
              return (
                <g key={cam}>
                  <rect
                    x={rect.x}
                    y={(rect.y / 100) * 68}
                    width={rect.w}
                    height={(rect.h / 100) * 68}
                    fill="none"
                    stroke={color}
                    strokeWidth="0.6"
                    strokeDasharray="1.2 0.8"
                    opacity="0.9"
                  />
                  <text
                    x={rect.x + 1}
                    y={(rect.y / 100) * 68 + 3}
                    fill={color}
                    fontSize="2.4"
                    fontWeight="700"
                  >
                    {cameraLabel(cam)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "hsl(var(--primary))", opacity: 0.6 }} />
            Spieler-Erkennungsdichte
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "hsl(0 70% 50%)", opacity: 0.4 }} />
            Blindzone (0 Detections)
          </div>
          {camRects.map(({ cam }) => (
            <div key={cam} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-1 rounded-sm border" style={{ borderColor: CAM_COLORS[cam] ?? CAM_COLORS[0], borderStyle: "dashed", borderWidth: 1.5 }} />
              {cameraLabel(cam)}
            </div>
          ))}
        </div>

        {/* Stats + recommendation */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="bg-muted/40 rounded-md p-2">
            <div className="text-muted-foreground">Erkannte Positionen</div>
            <div className="font-semibold text-sm">{grid.total}</div>
          </div>
          <div className="bg-muted/40 rounded-md p-2">
            <div className="text-muted-foreground">Blindzonen</div>
            <div className="font-semibold text-sm">{blindCells} / {GRID_X * GRID_Y}</div>
          </div>
          <div className="bg-muted/40 rounded-md p-2">
            <div className="text-muted-foreground">Hotspot-Intensität</div>
            <div className="font-semibold text-sm">{maxCell}</div>
          </div>
          <div className="bg-muted/40 rounded-md p-2">
            <div className="text-muted-foreground">Aktive Kameras</div>
            <div className="font-semibold text-sm">{coverage.cameras.length}</div>
          </div>
        </div>

        {recommendation && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs">
            <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-amber-500 mb-0.5">Setup-Empfehlung fürs nächste Spiel</div>
              <div className="text-muted-foreground">{recommendation}</div>
            </div>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground italic">
          Heatmap basiert auf real beobachteten Spielerpositionen (KI-Schätzungen ausgeschlossen). Kamera-Boxen sind Annäherungen aus der KI-Beschreibung des Sichtfelds.
        </p>
      </CardContent>
    </Card>
  );
}
