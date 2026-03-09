import { useMemo } from "react";
import { HEATMAP_COLS, HEATMAP_ROWS } from "@/lib/constants";

interface PlayerTrail {
  id: string;
  name: string;
  number: number | null;
  color: string;
  positions: { x: number; y: number }[]; // normalized 0-1
  currentPos?: { x: number; y: number };
}

interface PitchVisualizationProps {
  players?: PlayerTrail[];
  className?: string;
  mode?: "trails" | "heatmap";
  /** Normalized time range [0-1, 0-1] to filter positions */
  timeRange?: [number, number];
}

const PLAYER_COLORS = [
  "hsl(152, 60%, 46%)",
  "hsl(200, 80%, 55%)",
  "hsl(38, 92%, 55%)",
  "hsl(280, 60%, 55%)",
  "hsl(0, 72%, 55%)",
  "hsl(170, 60%, 45%)",
  "hsl(330, 60%, 55%)",
  "hsl(60, 70%, 50%)",
  "hsl(210, 70%, 45%)",
  "hsl(15, 80%, 55%)",
  "hsl(120, 40%, 50%)",
];

export function getPlayerColor(index: number) {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

// Heatmap color stops: transparent → blue → cyan → green → yellow → red
function heatmapColor(intensity: number): string {
  if (intensity <= 0) return "transparent";
  const clamped = Math.min(1, intensity);
  // 5-stop gradient
  const stops: [number, number, number, number][] = [
    [0, 60, 180, 255],     // blue
    [0.25, 0, 200, 220],   // cyan
    [0.5, 40, 200, 80],    // green
    [0.75, 240, 200, 0],   // yellow
    [1, 240, 50, 30],      // red
  ];

  let lower = stops[0];
  let upper = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped >= stops[i][0] && clamped <= stops[i + 1][0]) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }

  const range = upper[0] - lower[0] || 1;
  const t = (clamped - lower[0]) / range;
  const r = Math.round(lower[1] + (upper[1] - lower[1]) * t);
  const g = Math.round(lower[2] + (upper[2] - lower[2]) * t);
  const b = Math.round(lower[3] + (upper[3] - lower[3]) * t);
  const alpha = 0.15 + clamped * 0.55;

  return `rgba(${r},${g},${b},${alpha})`;
}

export default function PitchVisualization({ players = [], className = "", mode = "trails", timeRange }: PitchVisualizationProps) {
  const W = 680;
  const H = 440;
  const PAD = 20;
  const PW = W - PAD * 2;
  const PH = H - PAD * 2;

  const toSvg = (x: number, y: number) => ({
    sx: PAD + x * PW,
    sy: PAD + y * PH,
  });

  // Filter players' positions by timeRange
  const filteredPlayers = useMemo(() => {
    if (!timeRange) return players;
    return players.map(p => {
      const len = p.positions.length;
      const start = Math.floor(timeRange[0] * len);
      const end = Math.ceil(timeRange[1] * len);
      return { ...p, positions: p.positions.slice(start, end) };
    });
  }, [players, timeRange]);

  // Trail paths (used in trails mode)
  const trails = useMemo(() => {
    if (mode !== "trails") return [];
    return filteredPlayers.map(player => {
      if (player.positions.length < 2) return null;
      const points = player.positions.map(p => toSvg(p.x, p.y));
      const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.sx} ${p.sy}`).join(" ");
      return { ...player, pathD: d, svgPoints: points };
    }).filter(Boolean);
  }, [filteredPlayers, mode]);

  // Heatmap grid (used in heatmap mode)
  const heatmapGrid = useMemo(() => {
    if (mode !== "heatmap" || filteredPlayers.length === 0) return null;

    const cols = HEATMAP_COLS;
    const rows = HEATMAP_ROWS;
    const grid: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

    filteredPlayers.forEach(player => {
      player.positions.forEach(pos => {
        const col = Math.min(cols - 1, Math.max(0, Math.floor(pos.x * cols)));
        const row = Math.min(rows - 1, Math.max(0, Math.floor(pos.y * rows)));
        grid[row][col] += 1;
      });
    });

    let max = 0;
    grid.forEach(r => r.forEach(v => { if (v > max) max = v; }));

    const cellW = PW / cols;
    const cellH = PH / rows;

    return { grid, max, cols, rows, cellW, cellH };
  }, [filteredPlayers, mode]);

  return (
    <div className={`relative ${className}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" style={{ filter: "drop-shadow(0 4px 20px hsl(142 55% 30% / 0.15))" }}>
        <defs>
          <linearGradient id="pitchGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(145, 55%, 28%)" />
            <stop offset="50%" stopColor="hsl(145, 50%, 25%)" />
            <stop offset="100%" stopColor="hsl(145, 45%, 22%)" />
          </linearGradient>
          <pattern id="pitchStripes" width={PW / 10} height={PH} patternUnits="userSpaceOnUse" x={PAD} y={PAD}>
            <rect width={PW / 20} height={PH} fill="hsl(145, 52%, 26%)" />
            <rect x={PW / 20} width={PW / 20} height={PH} fill="hsl(145, 48%, 24%)" />
          </pattern>
          <filter id="trailGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="dotGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="heatBlur">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* Pitch background with grass stripes */}
        <rect x={PAD} y={PAD} width={PW} height={PH} rx="4" fill="url(#pitchGrad)" />
        <rect x={PAD} y={PAD} width={PW} height={PH} rx="4" fill="url(#pitchStripes)" opacity="0.4" />

        {/* Heatmap layer (behind markings for a blended look) */}
        {mode === "heatmap" && heatmapGrid && (
          <g opacity="0.85">
            {heatmapGrid.grid.map((row, ri) =>
              row.map((val, ci) => {
                if (val === 0) return null;
                const intensity = heatmapGrid.max > 0 ? val / heatmapGrid.max : 0;
                return (
                  <rect
                    key={`h-${ri}-${ci}`}
                    x={PAD + ci * heatmapGrid.cellW}
                    y={PAD + ri * heatmapGrid.cellH}
                    width={heatmapGrid.cellW + 0.5}
                    height={heatmapGrid.cellH + 0.5}
                    fill={heatmapColor(intensity)}
                    rx="2"
                  />
                );
              })
            )}
            {/* Blurred overlay for smooth heatmap look */}
            <g filter="url(#heatBlur)" opacity="0.5">
              {heatmapGrid.grid.map((row, ri) =>
                row.map((val, ci) => {
                  if (val === 0) return null;
                  const intensity = heatmapGrid.max > 0 ? val / heatmapGrid.max : 0;
                  return (
                    <rect
                      key={`hb-${ri}-${ci}`}
                      x={PAD + ci * heatmapGrid.cellW}
                      y={PAD + ri * heatmapGrid.cellH}
                      width={heatmapGrid.cellW + 0.5}
                      height={heatmapGrid.cellH + 0.5}
                      fill={heatmapColor(intensity)}
                    />
                  );
                })
              )}
            </g>
          </g>
        )}

        {/* Pitch markings */}
        <g stroke="hsl(0, 0%, 100%)" strokeWidth="1.5" fill="none" opacity={mode === "heatmap" ? "0.35" : "0.6"}>
          <rect x={PAD} y={PAD} width={PW} height={PH} rx="2" />
          <line x1={W / 2} y1={PAD} x2={W / 2} y2={H - PAD} />
          <circle cx={W / 2} cy={H / 2} r={PH * 0.16} />
          <circle cx={W / 2} cy={H / 2} r="3" fill="hsl(0, 0%, 100%)" opacity="0.6" />
          <rect x={PAD} y={H / 2 - PH * 0.3} width={PW * 0.14} height={PH * 0.6} />
          <rect x={PAD} y={H / 2 - PH * 0.15} width={PW * 0.05} height={PH * 0.3} />
          <path d={`M ${PAD + PW * 0.14} ${H / 2 - PH * 0.12} A ${PH * 0.14} ${PH * 0.14} 0 0 1 ${PAD + PW * 0.14} ${H / 2 + PH * 0.12}`} />
          <circle cx={PAD + PW * 0.1} cy={H / 2} r="2" fill="hsl(0, 0%, 100%)" opacity="0.6" />
          <rect x={W - PAD - PW * 0.14} y={H / 2 - PH * 0.3} width={PW * 0.14} height={PH * 0.6} />
          <rect x={W - PAD - PW * 0.05} y={H / 2 - PH * 0.15} width={PW * 0.05} height={PH * 0.3} />
          <path d={`M ${W - PAD - PW * 0.14} ${H / 2 - PH * 0.12} A ${PH * 0.14} ${PH * 0.14} 0 0 0 ${W - PAD - PW * 0.14} ${H / 2 + PH * 0.12}`} />
          <circle cx={W - PAD - PW * 0.1} cy={H / 2} r="2" fill="hsl(0, 0%, 100%)" opacity="0.6" />
          <path d={`M ${PAD} ${PAD + 12} A 12 12 0 0 1 ${PAD + 12} ${PAD}`} />
          <path d={`M ${W - PAD - 12} ${PAD} A 12 12 0 0 1 ${W - PAD} ${PAD + 12}`} />
          <path d={`M ${PAD + 12} ${H - PAD} A 12 12 0 0 1 ${PAD} ${H - PAD - 12}`} />
          <path d={`M ${W - PAD} ${H - PAD - 12} A 12 12 0 0 1 ${W - PAD - 12} ${H - PAD}`} />
        </g>

        {/* Goals */}
        <g stroke="hsl(0, 0%, 100%)" strokeWidth="2" fill="none" opacity="0.4">
          <rect x={PAD - 8} y={H / 2 - PH * 0.08} width={8} height={PH * 0.16} rx="1" />
          <rect x={W - PAD} y={H / 2 - PH * 0.08} width={8} height={PH * 0.16} rx="1" />
        </g>

        {/* Player trails (trails mode only) */}
        {mode === "trails" && trails.map((trail: any) => (
          <g key={trail.id}>
            <path d={trail.pathD} fill="none" stroke={trail.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.15" filter="url(#trailGlow)" />
            <path d={trail.pathD} fill="none" stroke={trail.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" strokeDasharray="6 3" />
          </g>
        ))}

        {/* Player current positions (trails mode only) */}
        {mode === "trails" && players.map(player => {
          const pos = player.currentPos || (player.positions.length > 0 ? player.positions[player.positions.length - 1] : null);
          if (!pos) return null;
          const { sx, sy } = toSvg(pos.x, pos.y);
          return (
            <g key={`dot-${player.id}`} filter="url(#dotGlow)">
              <circle cx={sx} cy={sy} r="10" fill={player.color} opacity="0.15">
                <animate attributeName="r" values="10;14;10" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.15;0.05;0.15" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx={sx} cy={sy} r="7" fill={player.color} stroke="white" strokeWidth="1.5" opacity="0.95" />
              <text x={sx} y={sy + 1} textAnchor="middle" dominantBaseline="central" fontSize="8" fontWeight="700" fill="white" fontFamily="Space Grotesk, sans-serif">
                {player.number ?? "?"}
              </text>
            </g>
          );
        })}

        {/* Heatmap legend */}
        {mode === "heatmap" && players.length > 0 && (
          <g>
            <defs>
              <linearGradient id="heatLegendGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(60,180,255,0.7)" />
                <stop offset="25%" stopColor="rgba(0,200,220,0.7)" />
                <stop offset="50%" stopColor="rgba(40,200,80,0.7)" />
                <stop offset="75%" stopColor="rgba(240,200,0,0.7)" />
                <stop offset="100%" stopColor="rgba(240,50,30,0.7)" />
              </linearGradient>
            </defs>
            <rect x={W - 140} y={H - 30} width={110} height={10} rx="3" fill="url(#heatLegendGrad)" />
            <text x={W - 143} y={H - 21} fontSize="7" fill="white" opacity="0.6" textAnchor="end" fontFamily="Inter, sans-serif">wenig</text>
            <text x={W - 27} y={H - 21} fontSize="7" fill="white" opacity="0.6" textAnchor="start" fontFamily="Inter, sans-serif">viel</text>
          </g>
        )}

        {/* "No data" overlay */}
        {players.length === 0 && (
          <g>
            <text x={W / 2} y={H / 2 - 8} textAnchor="middle" fontSize="13" fill="white" opacity="0.5" fontFamily="Space Grotesk, sans-serif" fontWeight="500">
              Spieler auswählen
            </text>
            <text x={W / 2} y={H / 2 + 10} textAnchor="middle" fontSize="11" fill="white" opacity="0.35" fontFamily="Inter, sans-serif">
              {mode === "heatmap" ? "um Heatmap anzuzeigen" : "um Laufwege anzuzeigen"}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
