import { useMemo } from "react";

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
}

const PLAYER_COLORS = [
  "hsl(152, 60%, 46%)",  // primary green
  "hsl(200, 80%, 55%)",  // blue
  "hsl(38, 92%, 55%)",   // amber
  "hsl(280, 60%, 55%)",  // purple
  "hsl(0, 72%, 55%)",    // red
  "hsl(170, 60%, 45%)",  // teal
  "hsl(330, 60%, 55%)",  // pink
  "hsl(60, 70%, 50%)",   // yellow
  "hsl(210, 70%, 45%)",  // navy
  "hsl(15, 80%, 55%)",   // orange
  "hsl(120, 40%, 50%)",  // lime
];

export function getPlayerColor(index: number) {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

export default function PitchVisualization({ players = [], className = "" }: PitchVisualizationProps) {
  // Pitch dimensions in SVG coords
  const W = 680;
  const H = 440;
  const PAD = 20;
  const PW = W - PAD * 2;  // pitch width
  const PH = H - PAD * 2;  // pitch height

  // Helper to convert normalized coords to SVG
  const toSvg = (x: number, y: number) => ({
    sx: PAD + x * PW,
    sy: PAD + y * PH,
  });

  // Generate trail paths
  const trails = useMemo(() => {
    return players.map(player => {
      if (player.positions.length < 2) return null;
      const points = player.positions.map(p => toSvg(p.x, p.y));
      const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.sx} ${p.sy}`).join(" ");
      return { ...player, pathD: d, svgPoints: points };
    }).filter(Boolean);
  }, [players]);

  return (
    <div className={`relative ${className}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" style={{ filter: "drop-shadow(0 4px 20px hsl(142 55% 30% / 0.15))" }}>
        <defs>
          {/* Pitch gradient */}
          <linearGradient id="pitchGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(142, 55%, 38%)" />
            <stop offset="50%" stopColor="hsl(142, 55%, 42%)" />
            <stop offset="100%" stopColor="hsl(142, 55%, 36%)" />
          </linearGradient>
          {/* Stripe pattern */}
          <pattern id="pitchStripes" width={PW / 10} height={PH} patternUnits="userSpaceOnUse" x={PAD} y={PAD}>
            <rect width={PW / 20} height={PH} fill="hsl(142, 55%, 42%)" opacity="0.15" />
          </pattern>
          {/* Trail glow filter */}
          <filter id="trailGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Player dot glow */}
          <filter id="dotGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Pitch background */}
        <rect x={PAD} y={PAD} width={PW} height={PH} rx="4" fill="url(#pitchGrad)" />
        <rect x={PAD} y={PAD} width={PW} height={PH} rx="4" fill="url(#pitchStripes)" />

        {/* Pitch markings */}
        <g stroke="hsl(0, 0%, 100%)" strokeWidth="1.5" fill="none" opacity="0.6">
          {/* Outline */}
          <rect x={PAD} y={PAD} width={PW} height={PH} rx="2" />
          {/* Center line */}
          <line x1={W / 2} y1={PAD} x2={W / 2} y2={H - PAD} />
          {/* Center circle */}
          <circle cx={W / 2} cy={H / 2} r={PH * 0.16} />
          {/* Center spot */}
          <circle cx={W / 2} cy={H / 2} r="3" fill="hsl(0, 0%, 100%)" opacity="0.6" />

          {/* Left penalty area */}
          <rect x={PAD} y={H / 2 - PH * 0.3} width={PW * 0.14} height={PH * 0.6} />
          {/* Left goal area */}
          <rect x={PAD} y={H / 2 - PH * 0.15} width={PW * 0.05} height={PH * 0.3} />
          {/* Left penalty arc */}
          <path d={`M ${PAD + PW * 0.14} ${H / 2 - PH * 0.12} A ${PH * 0.14} ${PH * 0.14} 0 0 1 ${PAD + PW * 0.14} ${H / 2 + PH * 0.12}`} />
          {/* Left penalty spot */}
          <circle cx={PAD + PW * 0.1} cy={H / 2} r="2" fill="hsl(0, 0%, 100%)" opacity="0.6" />

          {/* Right penalty area */}
          <rect x={W - PAD - PW * 0.14} y={H / 2 - PH * 0.3} width={PW * 0.14} height={PH * 0.6} />
          {/* Right goal area */}
          <rect x={W - PAD - PW * 0.05} y={H / 2 - PH * 0.15} width={PW * 0.05} height={PH * 0.3} />
          {/* Right penalty arc */}
          <path d={`M ${W - PAD - PW * 0.14} ${H / 2 - PH * 0.12} A ${PH * 0.14} ${PH * 0.14} 0 0 0 ${W - PAD - PW * 0.14} ${H / 2 + PH * 0.12}`} />
          {/* Right penalty spot */}
          <circle cx={W - PAD - PW * 0.1} cy={H / 2} r="2" fill="hsl(0, 0%, 100%)" opacity="0.6" />

          {/* Corner arcs */}
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

        {/* Player trails */}
        {trails.map((trail: any) => (
          <g key={trail.id}>
            {/* Trail shadow */}
            <path
              d={trail.pathD}
              fill="none"
              stroke={trail.color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.15"
              filter="url(#trailGlow)"
            />
            {/* Trail line */}
            <path
              d={trail.pathD}
              fill="none"
              stroke={trail.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.7"
              strokeDasharray="6 3"
            />
          </g>
        ))}

        {/* Player current positions */}
        {players.map(player => {
          const pos = player.currentPos || (player.positions.length > 0 ? player.positions[player.positions.length - 1] : null);
          if (!pos) return null;
          const { sx, sy } = toSvg(pos.x, pos.y);
          return (
            <g key={`dot-${player.id}`} filter="url(#dotGlow)">
              {/* Pulse ring */}
              <circle cx={sx} cy={sy} r="10" fill={player.color} opacity="0.15">
                <animate attributeName="r" values="10;14;10" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.15;0.05;0.15" dur="2s" repeatCount="indefinite" />
              </circle>
              {/* Main dot */}
              <circle cx={sx} cy={sy} r="7" fill={player.color} stroke="white" strokeWidth="1.5" opacity="0.95" />
              {/* Number label */}
              <text
                x={sx}
                y={sy + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="8"
                fontWeight="700"
                fill="white"
                fontFamily="Space Grotesk, sans-serif"
              >
                {player.number ?? "?"}
              </text>
            </g>
          );
        })}

        {/* "No data" overlay */}
        {players.length === 0 && (
          <g>
            <text
              x={W / 2}
              y={H / 2 - 8}
              textAnchor="middle"
              fontSize="13"
              fill="white"
              opacity="0.5"
              fontFamily="Space Grotesk, sans-serif"
              fontWeight="500"
            >
              Spieler auswählen
            </text>
            <text
              x={W / 2}
              y={H / 2 + 10}
              textAnchor="middle"
              fontSize="11"
              fill="white"
              opacity="0.35"
              fontFamily="Inter, sans-serif"
            >
              um Laufwege anzuzeigen
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
