import { useMemo } from "react";
import { HEATMAP_COLS, HEATMAP_ROWS } from "@/lib/constants";

interface PlayerTrail {
  id: string;
  name: string;
  number: number | null;
  color: string;
  positions: { x: number; y: number }[];
  currentPos?: { x: number; y: number };
}

interface PitchVisualizationProps {
  players?: PlayerTrail[];
  className?: string;
  mode?: "trails" | "heatmap";
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

  const filteredPlayers = useMemo(() => {
    if (!timeRange) return players;
    return players.map(p => {
      const len = p.positions.length;
      const start = Math.floor(timeRange[0] * len);
      const end = Math.ceil(timeRange[1] * len);
      return { ...p, positions: p.positions.slice(start, end) };
    });
  }, [players, timeRange]);

  const trails = useMemo(() => {
    if (mode !== "trails") return [];
    return filteredPlayers.map(player => {
      if (player.positions.length < 2) return null;
      const points = player.positions.map(p => toSvg(p.x, p.y));
      const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.sx} ${p.sy}`).join(" ");
      return { ...player, pathD: d, svgPoints: points };
    }).filter(Boolean);
  }, [filteredPlayers, mode]);

  // Heatmap: convert positions to smooth heat spots
  const heatSpots = useMemo(() => {
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
    if (max === 0) return null;

    const cellW = PW / cols;
    const cellH = PH / rows;

    const spots: { sx: number; sy: number; intensity: number }[] = [];
    grid.forEach((row, ri) => {
      row.forEach((val, ci) => {
        const intensity = val / max;
        if (intensity > 0.05) {
          spots.push({
            sx: PAD + ci * cellW + cellW / 2,
            sy: PAD + ri * cellH + cellH / 2,
            intensity,
          });
        }
      });
    });

    return spots;
  }, [filteredPlayers, mode]);

  return (
    <div className={`relative ${className}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" style={{ filter: "drop-shadow(0 4px 20px hsl(142 55% 30% / 0.15))" }}>
        <defs>
          <linearGradient id="pitchGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(160, 45%, 38%)" />
            <stop offset="50%" stopColor="hsl(155, 42%, 35%)" />
            <stop offset="100%" stopColor="hsl(150, 40%, 32%)" />
          </linearGradient>
          <pattern id="pitchStripes" width={PW / 10} height={PH} patternUnits="userSpaceOnUse" x={PAD} y={PAD}>
            <rect width={PW / 20} height={PH} fill="hsl(158, 44%, 36%)" />
            <rect x={PW / 20} width={PW / 20} height={PH} fill="hsl(155, 40%, 34%)" />
          </pattern>
          <filter id="trailGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="dotGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* Smooth heatmap gradients */}
          <radialGradient id="pvHeatLow"><stop offset="0%" stopColor="hsl(160,60%,48%)" stopOpacity="0.5" /><stop offset="60%" stopColor="hsl(160,50%,42%)" stopOpacity="0.2" /><stop offset="100%" stopColor="transparent" /></radialGradient>
          <radialGradient id="pvHeatMedLow"><stop offset="0%" stopColor="hsl(120,55%,48%)" stopOpacity="0.65" /><stop offset="50%" stopColor="hsl(140,50%,42%)" stopOpacity="0.3" /><stop offset="100%" stopColor="transparent" /></radialGradient>
          <radialGradient id="pvHeatMed"><stop offset="0%" stopColor="hsl(55,85%,52%)" stopOpacity="0.8" /><stop offset="40%" stopColor="hsl(70,70%,48%)" stopOpacity="0.4" /><stop offset="100%" stopColor="transparent" /></radialGradient>
          <radialGradient id="pvHeatHigh"><stop offset="0%" stopColor="hsl(25,90%,52%)" stopOpacity="0.85" /><stop offset="35%" stopColor="hsl(40,80%,48%)" stopOpacity="0.45" /><stop offset="100%" stopColor="transparent" /></radialGradient>
          <radialGradient id="pvHeatMax"><stop offset="0%" stopColor="hsl(0,85%,50%)" stopOpacity="0.95" /><stop offset="25%" stopColor="hsl(10,90%,48%)" stopOpacity="0.7" /><stop offset="55%" stopColor="hsl(25,80%,45%)" stopOpacity="0.3" /><stop offset="100%" stopColor="transparent" /></radialGradient>
          <filter id="pvHeatBlur1" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur in="SourceGraphic" stdDeviation="18" /></filter>
          <filter id="pvHeatBlur2" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur in="SourceGraphic" stdDeviation="10" /></filter>
        </defs>

        {/* Pitch background with grass stripes */}
        <rect x={PAD} y={PAD} width={PW} height={PH} rx="4" fill="url(#pitchGrad)" />
        <rect x={PAD} y={PAD} width={PW} height={PH} rx="4" fill="url(#pitchStripes)" opacity="0.25" />

        {/* Heatmap layer */}
        {mode === "heatmap" && heatSpots && (
          <>
            {/* Ambient base */}
            <g filter="url(#pvHeatBlur1)" opacity="0.55">
              {heatSpots.filter(s => s.intensity > 0.15).map((spot, i) => {
                const gid = spot.intensity > 0.8 ? "pvHeatMax" : spot.intensity > 0.6 ? "pvHeatHigh" : spot.intensity > 0.4 ? "pvHeatMed" : spot.intensity > 0.2 ? "pvHeatMedLow" : "pvHeatLow";
                const r = 30 + spot.intensity * 50;
                return <ellipse key={`b${i}`} cx={spot.sx} cy={spot.sy} rx={r * 1.3} ry={r} fill={`url(#${gid})`} />;
              })}
            </g>
            {/* Detail layer */}
            <g filter="url(#pvHeatBlur2)" opacity="0.8">
              {heatSpots.map((spot, i) => {
                const gid = spot.intensity > 0.8 ? "pvHeatMax" : spot.intensity > 0.6 ? "pvHeatHigh" : spot.intensity > 0.4 ? "pvHeatMed" : spot.intensity > 0.2 ? "pvHeatMedLow" : "pvHeatLow";
                const r = 18 + spot.intensity * 35;
                return <ellipse key={`d${i}`} cx={spot.sx} cy={spot.sy} rx={r} ry={r * 0.85} fill={`url(#${gid})`} opacity={0.6 + spot.intensity * 0.4} />;
              })}
            </g>
          </>
        )}

        {/* Pitch markings */}
        <g stroke="hsl(0, 0%, 100%)" strokeWidth="1.5" fill="none" opacity={mode === "heatmap" ? "0.35" : "0.5"}>
          <rect x={PAD} y={PAD} width={PW} height={PH} rx="2" />
          <line x1={W / 2} y1={PAD} x2={W / 2} y2={H - PAD} />
          <circle cx={W / 2} cy={H / 2} r={PH * 0.16} />
          <circle cx={W / 2} cy={H / 2} r="3" fill="hsl(0, 0%, 100%)" opacity="0.5" />
          <rect x={PAD} y={H / 2 - PH * 0.3} width={PW * 0.14} height={PH * 0.6} />
          <rect x={PAD} y={H / 2 - PH * 0.15} width={PW * 0.05} height={PH * 0.3} />
          <path d={`M ${PAD + PW * 0.14} ${H / 2 - PH * 0.12} A ${PH * 0.14} ${PH * 0.14} 0 0 1 ${PAD + PW * 0.14} ${H / 2 + PH * 0.12}`} />
          <circle cx={PAD + PW * 0.1} cy={H / 2} r="2" fill="hsl(0, 0%, 100%)" opacity="0.5" />
          <rect x={W - PAD - PW * 0.14} y={H / 2 - PH * 0.3} width={PW * 0.14} height={PH * 0.6} />
          <rect x={W - PAD - PW * 0.05} y={H / 2 - PH * 0.15} width={PW * 0.05} height={PH * 0.3} />
          <path d={`M ${W - PAD - PW * 0.14} ${H / 2 - PH * 0.12} A ${PH * 0.14} ${PH * 0.14} 0 0 0 ${W - PAD - PW * 0.14} ${H / 2 + PH * 0.12}`} />
          <circle cx={W - PAD - PW * 0.1} cy={H / 2} r="2" fill="hsl(0, 0%, 100%)" opacity="0.5" />
          <path d={`M ${PAD} ${PAD + 12} A 12 12 0 0 1 ${PAD + 12} ${PAD}`} />
          <path d={`M ${W - PAD - 12} ${PAD} A 12 12 0 0 1 ${W - PAD} ${PAD + 12}`} />
          <path d={`M ${PAD + 12} ${H - PAD} A 12 12 0 0 1 ${PAD} ${H - PAD - 12}`} />
          <path d={`M ${W - PAD} ${H - PAD - 12} A 12 12 0 0 1 ${W - PAD - 12} ${H - PAD}`} />
        </g>

        {/* Goals */}
        <g stroke="hsl(0, 0%, 100%)" strokeWidth="2" fill="none" opacity="0.35">
          <rect x={PAD - 8} y={H / 2 - PH * 0.08} width={8} height={PH * 0.16} rx="1" />
          <rect x={W - PAD} y={H / 2 - PH * 0.08} width={8} height={PH * 0.16} rx="1" />
        </g>

        {/* Player trails */}
        {mode === "trails" && trails.map((trail: any) => (
          <g key={trail.id}>
            <path d={trail.pathD} fill="none" stroke={trail.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.15" filter="url(#trailGlow)" />
            <path d={trail.pathD} fill="none" stroke={trail.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" strokeDasharray="6 3" />
          </g>
        ))}

        {/* Player dots */}
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
                <stop offset="0%" stopColor="hsl(160, 50%, 42%)" />
                <stop offset="25%" stopColor="hsl(120, 55%, 48%)" />
                <stop offset="50%" stopColor="hsl(55, 85%, 52%)" />
                <stop offset="75%" stopColor="hsl(25, 90%, 52%)" />
                <stop offset="100%" stopColor="hsl(0, 85%, 50%)" />
              </linearGradient>
            </defs>
            <rect x={W - 140} y={H - 30} width={110} height={10} rx="3" fill="url(#heatLegendGrad)" />
            <text x={W - 143} y={H - 21} fontSize="7" fill="white" opacity="0.6" textAnchor="end" fontFamily="Inter, sans-serif">wenig</text>
            <text x={W - 27} y={H - 21} fontSize="7" fill="white" opacity="0.6" textAnchor="start" fontFamily="Inter, sans-serif">viel</text>
          </g>
        )}

        {/* No data overlay */}
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
