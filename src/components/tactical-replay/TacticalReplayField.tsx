import { Badge } from "@/components/ui/badge";
import type { PlayerPos } from "./replay-utils";

interface DisplayState {
  ball: { x: number; y: number };
  players: PlayerPos[];
}

interface TacticalReplayFieldProps {
  displayState: DisplayState;
  posHistoryRef: React.RefObject<Map<string, { x: number; y: number }[]>>;
  currentMinute: number;
  currentLabel?: string;
  expectedHome: number;
  expectedAway: number;
}

const HOME_COLOR = "hsl(160, 84%, 39%)";
const AWAY_COLOR = "hsl(15, 85%, 55%)";

export default function TacticalReplayField({
  displayState,
  posHistoryRef,
  currentMinute,
  currentLabel,
  expectedHome,
  expectedAway,
}: TacticalReplayFieldProps) {
  const history = posHistoryRef.current;
  const isSmallFormat = expectedHome <= 7 || expectedAway <= 7;

  return (
    <div className="rounded-2xl border border-border/50 relative overflow-hidden shadow-inner" style={{ aspectRatio: "105/68" }}>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 105 68" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="trGrass" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--pitch))" />
            <stop offset="100%" stopColor="hsl(var(--pitch-dark))" />
          </linearGradient>
          <pattern id="trStripes" patternUnits="userSpaceOnUse" width="10" height="68">
            <rect x="0" y="0" width="5" height="68" fill="hsl(var(--pitch))" opacity="0.15" />
          </pattern>
          <filter id="glow">
            <feGaussianBlur stdDeviation="0.8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="playerShadow">
            <feDropShadow dx="0" dy="0.5" stdDeviation="0.6" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* Pitch */}
        <rect x="0" y="0" width="105" height="68" fill="url(#trGrass)" />
        <rect x="0" y="0" width="105" height="68" fill="url(#trStripes)" />

        {/* Field lines */}
        <g stroke="hsl(var(--pitch-line))" strokeOpacity="0.4" fill="none">
          <rect x="1" y="1" width="103" height="66" strokeWidth="0.35" rx="0.5" />
          <line x1="52.5" y1="1" x2="52.5" y2="67" strokeWidth="0.3" />
          <circle cx="52.5" cy="34" r={isSmallFormat ? 6 : 9.15} strokeWidth="0.3" />
          <circle cx="52.5" cy="34" r="0.6" fill="hsl(var(--pitch-line))" fillOpacity="0.4" stroke="none" />
          {!isSmallFormat && (
            <>
              <rect x="1" y="13.84" width="16.5" height="40.32" strokeWidth="0.25" />
              <rect x="87.5" y="13.84" width="16.5" height="40.32" strokeWidth="0.25" />
              <rect x="1" y="24.84" width="5.5" height="18.32" strokeWidth="0.2" />
              <rect x="98.5" y="24.84" width="5.5" height="18.32" strokeWidth="0.2" />
              <circle cx="12" cy="34" r="0.4" fill="hsl(var(--pitch-line))" fillOpacity="0.35" stroke="none" />
              <circle cx="93" cy="34" r="0.4" fill="hsl(var(--pitch-line))" fillOpacity="0.35" stroke="none" />
              <path d="M 17.5 27.5 A 9.15 9.15 0 0 1 17.5 40.5" strokeWidth="0.25" />
              <path d="M 87.5 27.5 A 9.15 9.15 0 0 0 87.5 40.5" strokeWidth="0.25" />
            </>
          )}
          {isSmallFormat && (
            <>
              <rect x="1" y="20" width="8" height="28" strokeWidth="0.25" />
              <rect x="96" y="20" width="8" height="28" strokeWidth="0.25" />
            </>
          )}
        </g>

        {/* Player trails */}
        {displayState.players.map((p, i) => {
          const key = `${p.team}-${i}`;
          const trail = history?.get(key);
          if (!trail || trail.length < 2 || p.estimated) return null;
          return (
            <polyline
              key={`trail-${key}`}
              points={trail.map(pt => `${(pt.x / 100) * 105},${(pt.y / 100) * 68}`).join(" ")}
              fill="none"
              stroke={p.team === "home" ? HOME_COLOR : AWAY_COLOR}
              strokeWidth="0.5"
              strokeOpacity="0.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}

        {/* Ball trail */}
        {(() => {
          const ballTrail = history?.get("ball");
          if (!ballTrail || ballTrail.length < 2) return null;
          return (
            <polyline
              points={ballTrail.map(pt => `${(pt.x / 100) * 105},${(pt.y / 100) * 68}`).join(" ")}
              fill="none"
              stroke="white"
              strokeWidth="0.4"
              strokeOpacity="0.4"
              strokeDasharray="1,0.5"
              strokeLinecap="round"
            />
          );
        })()}

        {/* Players */}
        {displayState.players.map((p, i) => {
          const cx = (p.x / 100) * 105;
          const cy = (p.y / 100) * 68;
          const isHome = p.team === "home";
          const isGhost = p.estimated;
          const fillColor = isHome ? HOME_COLOR : AWAY_COLOR;
          return (
            <g key={i} filter={isGhost ? undefined : "url(#playerShadow)"}>
              <circle
                cx={cx}
                cy={cy}
                r="2.4"
                fill={fillColor}
                stroke="white"
                strokeWidth={isGhost ? "0.3" : "0.55"}
                opacity={isGhost ? 0.35 : 0.95}
                strokeDasharray={isGhost ? "0.8,0.4" : "none"}
                filter={isGhost ? undefined : "url(#glow)"}
              />
              <text
                x={cx}
                y={cy + 0.7}
                textAnchor="middle"
                dominantBaseline="central"
                fill="white"
                fillOpacity={isGhost ? 0.5 : 0.95}
                fontSize="1.9"
                fontWeight="bold"
                fontFamily="var(--font-display)"
              >
                {p.number != null ? p.number : (p.role ? p.role.charAt(0) : "")}
              </text>
            </g>
          );
        })}

        {/* Ball */}
        <circle
          cx={(displayState.ball.x / 100) * 105}
          cy={(displayState.ball.y / 100) * 68}
          r="1.4"
          fill="white"
          stroke="hsl(0,0%,25%)"
          strokeWidth="0.35"
          filter="url(#glow)"
        />
      </svg>

      {/* Frame label overlay */}
      <div className="absolute top-2 left-2 right-2 flex justify-between items-start pointer-events-none">
        <Badge className="bg-background/80 text-foreground text-[10px] backdrop-blur-sm border-border/50">
          ~{currentMinute}′
        </Badge>
        {currentLabel && (
          <Badge variant="outline" className="bg-background/80 text-[10px] backdrop-blur-sm max-w-[60%] truncate">
            {currentLabel}
          </Badge>
        )}
      </div>

      {/* Legend + team size */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
        <span className="text-[9px] text-white/60 bg-black/30 backdrop-blur-sm rounded px-1.5 py-0.5">
          {expectedHome}v{expectedAway}
        </span>
        <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded px-2 py-0.5">
          <span className="flex items-center gap-1 text-[9px] text-white/80">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: HOME_COLOR }} />
            Heim
          </span>
          <span className="flex items-center gap-1 text-[9px] text-white/80">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: AWAY_COLOR }} />
            Gegner
          </span>
        </div>
      </div>
    </div>
  );
}
