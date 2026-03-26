import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, SkipForward, SkipBack, Info, Eye } from "lucide-react";

interface PlayerPos {
  team: "home" | "away";
  x: number;
  y: number;
  role?: string;
  number?: number;
  estimated?: boolean;
}

interface FrameData {
  frame_index: number;
  label?: string;
  ball: { x: number; y: number };
  players: PlayerPos[];
}

interface TacticalReplayProps {
  frames: FrameData[];
  intervalSec: number;
  teamSizeDetected?: { home: number; away: number; format_label: string };
}

/** Lerp helper */
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Default formation positions for ghost player fill */
const FORMATION_POSITIONS: Record<number, { x: number; y: number; role: string }[]> = {
  11: [
    { x: 5, y: 50, role: "GK" },
    { x: 20, y: 15, role: "DEF" }, { x: 20, y: 38, role: "DEF" }, { x: 20, y: 62, role: "DEF" }, { x: 20, y: 85, role: "DEF" },
    { x: 45, y: 25, role: "MID" }, { x: 45, y: 50, role: "MID" }, { x: 45, y: 75, role: "MID" },
    { x: 70, y: 20, role: "FWD" }, { x: 70, y: 50, role: "FWD" }, { x: 70, y: 80, role: "FWD" },
  ],
  7: [
    { x: 5, y: 50, role: "GK" },
    { x: 25, y: 25, role: "DEF" }, { x: 25, y: 75, role: "DEF" },
    { x: 50, y: 25, role: "MID" }, { x: 50, y: 75, role: "MID" },
    { x: 75, y: 35, role: "FWD" }, { x: 75, y: 65, role: "FWD" },
  ],
};

/** Fill missing players with ghost positions */
function fillGhostPlayers(players: PlayerPos[], team: "home" | "away", expectedSize: number, isAway: boolean): PlayerPos[] {
  const teamPlayers = players.filter(p => p.team === team);
  if (teamPlayers.length >= expectedSize) return teamPlayers;

  const template = FORMATION_POSITIONS[expectedSize] ?? FORMATION_POSITIONS[11] ?? [];
  const missing = expectedSize - teamPlayers.length;
  const ghosts: PlayerPos[] = [];

  for (let i = 0; i < missing && i < template.length; i++) {
    const pos = template[template.length - 1 - i]; // fill from least important
    const exists = teamPlayers.some(p => Math.abs(p.x - (isAway ? 100 - pos.x : pos.x)) < 10 && Math.abs(p.y - pos.y) < 10);
    if (!exists) {
      ghosts.push({
        team,
        x: isAway ? 100 - pos.x : pos.x,
        y: pos.y,
        role: pos.role,
        estimated: true,
      });
    }
  }

  return [...teamPlayers, ...ghosts].slice(0, expectedSize);
}

/** Interpolate between two frames */
function interpolateFrame(a: FrameData, b: FrameData, t: number, expectedHome: number, expectedAway: number): { ball: { x: number; y: number }; players: PlayerPos[] } {
  const ball = { x: lerp(a.ball.x, b.ball.x, t), y: lerp(a.ball.y, b.ball.y, t) };

  const homeA = fillGhostPlayers(a.players, "home", expectedHome, false);
  const homeB = fillGhostPlayers(b.players, "home", expectedHome, false);
  const awayA = fillGhostPlayers(a.players, "away", expectedAway, true);
  const awayB = fillGhostPlayers(b.players, "away", expectedAway, true);

  const interpolatePlayers = (listA: PlayerPos[], listB: PlayerPos[]): PlayerPos[] => {
    const maxLen = Math.max(listA.length, listB.length);
    return Array.from({ length: maxLen }, (_, i) => {
      const pa = listA[i] ?? listA[listA.length - 1] ?? { team: "home" as const, x: 50, y: 50 };
      const pb = listB[i] ?? listB[listB.length - 1] ?? pa;
      return {
        team: pa.team,
        x: lerp(pa.x, pb.x, t),
        y: lerp(pa.y, pb.y, t),
        role: pa.role,
        number: pa.number,
        estimated: pa.estimated || pb.estimated,
      };
    });
  };

  return {
    ball,
    players: [...interpolatePlayers(homeA, homeB), ...interpolatePlayers(awayA, awayB)],
  };
}

const SPEEDS = [0.5, 1, 2, 4];

export default function TacticalReplay({ frames, intervalSec, teamSizeDetected }: TacticalReplayProps) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [interpolationT, setInterpolationT] = useState(0);
  const [showGhosts, setShowGhosts] = useState(true);
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const speed = SPEEDS[speedIdx];
  const totalFrames = frames.length;
  const expectedHome = teamSizeDetected?.home ?? 11;
  const expectedAway = teamSizeDetected?.away ?? 11;

  // Store previous positions for trails
  const posHistoryRef = useRef<Map<string, { x: number; y: number }[]>>(new Map());

  // Animation loop
  useEffect(() => {
    if (!playing) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    const frameDuration = (intervalSec * 1000) / speed;

    const tick = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;

      const newT = interpolationT + delta / frameDuration;
      if (newT >= 1) {
        const nextFrame = currentFrame + 1;
        if (nextFrame >= totalFrames - 1) {
          setCurrentFrame(totalFrames - 1);
          setInterpolationT(0);
          setPlaying(false);
          lastTimeRef.current = 0;
          return;
        }
        setCurrentFrame(nextFrame);
        setInterpolationT(newT - 1);
      } else {
        setInterpolationT(newT);
      }

      lastTimeRef.current = timestamp;
      animRef.current = requestAnimationFrame(tick);
    };

    lastTimeRef.current = 0;
    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [playing, currentFrame, interpolationT, speed, intervalSec, totalFrames]);

  const togglePlay = useCallback(() => {
    if (currentFrame >= totalFrames - 1 && !playing) {
      setCurrentFrame(0);
      setInterpolationT(0);
      posHistoryRef.current.clear();
    }
    setPlaying(p => !p);
  }, [currentFrame, totalFrames, playing]);

  const skipTo = useCallback((idx: number) => {
    setCurrentFrame(Math.max(0, Math.min(idx, totalFrames - 1)));
    setInterpolationT(0);
    posHistoryRef.current.clear();
  }, [totalFrames]);

  // Current visual state
  const displayState = useMemo(() => {
    const a = frames[currentFrame];
    const b = frames[Math.min(currentFrame + 1, totalFrames - 1)];
    if (!a) return null;
    if (currentFrame >= totalFrames - 1 || a === b) {
      const homeFilled = showGhosts ? fillGhostPlayers(a.players, "home", expectedHome, false) : a.players.filter(p => p.team === "home");
      const awayFilled = showGhosts ? fillGhostPlayers(a.players, "away", expectedAway, true) : a.players.filter(p => p.team === "away");
      return { ball: a.ball, players: [...homeFilled, ...awayFilled] };
    }
    return interpolateFrame(a, b, interpolationT, showGhosts ? expectedHome : 0, showGhosts ? expectedAway : 0);
  }, [frames, currentFrame, interpolationT, totalFrames, showGhosts, expectedHome, expectedAway]);

  // Update position history for trails
  useEffect(() => {
    if (!displayState) return;
    const history = posHistoryRef.current;
    displayState.players.forEach((p, i) => {
      const key = `${p.team}-${i}`;
      const arr = history.get(key) ?? [];
      arr.push({ x: p.x, y: p.y });
      if (arr.length > 4) arr.shift();
      history.set(key, arr);
    });
  }, [displayState, currentFrame]);

  const currentLabel = frames[currentFrame]?.label;
  const currentMinute = Math.round((currentFrame * intervalSec) / 60);
  const sceneFrames = frames.map((f, i) => ({ ...f, idx: i })).filter(f => f.label);

  if (!displayState) return null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Play className="h-5 w-5 text-primary" />
          <h2 className="font-semibold font-display">Spielzug-Replay</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGhosts(g => !g)}
            className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border transition-colors ${
              showGhosts ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground"
            }`}
          >
            <Eye className="h-3 w-3" />
            Ghost-Spieler
          </button>
          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-500 border-0 gap-1">
            <Info className="h-3 w-3" /> KI-Schätzung
          </Badge>
        </div>
      </div>

      {/* SVG Field - Full Width */}
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
          </defs>

          {/* Pitch */}
          <rect x="0" y="0" width="105" height="68" fill="url(#trGrass)" />
          <rect x="0" y="0" width="105" height="68" fill="url(#trStripes)" />

          {/* Field lines */}
          <g stroke="hsl(var(--pitch-line))" strokeOpacity="0.4" fill="none">
            <rect x="1" y="1" width="103" height="66" strokeWidth="0.35" rx="0.5" />
            <line x1="52.5" y1="1" x2="52.5" y2="67" strokeWidth="0.3" />
            <circle cx="52.5" cy="34" r="9.15" strokeWidth="0.3" />
            <circle cx="52.5" cy="34" r="0.6" fill="hsl(var(--pitch-line))" fillOpacity="0.4" stroke="none" />
            <rect x="1" y="13.84" width="16.5" height="40.32" strokeWidth="0.25" />
            <rect x="87.5" y="13.84" width="16.5" height="40.32" strokeWidth="0.25" />
            <rect x="1" y="24.84" width="5.5" height="18.32" strokeWidth="0.2" />
            <rect x="98.5" y="24.84" width="5.5" height="18.32" strokeWidth="0.2" />
            <circle cx="12" cy="34" r="0.4" fill="hsl(var(--pitch-line))" fillOpacity="0.35" stroke="none" />
            <circle cx="93" cy="34" r="0.4" fill="hsl(var(--pitch-line))" fillOpacity="0.35" stroke="none" />
            <path d="M 17.5 27.5 A 9.15 9.15 0 0 1 17.5 40.5" strokeWidth="0.25" />
            <path d="M 87.5 27.5 A 9.15 9.15 0 0 0 87.5 40.5" strokeWidth="0.25" />
          </g>

          {/* Player trails */}
          {displayState.players.map((p, i) => {
            const key = `${p.team}-${i}`;
            const trail = posHistoryRef.current.get(key);
            if (!trail || trail.length < 2 || p.estimated) return null;
            return (
              <polyline
                key={`trail-${key}`}
                points={trail.map(pt => `${(pt.x / 100) * 105},${(pt.y / 100) * 68}`).join(" ")}
                fill="none"
                stroke={p.team === "home" ? "hsl(210, 90%, 55%)" : "hsl(0, 80%, 55%)"}
                strokeWidth="0.5"
                strokeOpacity="0.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}

          {/* Ball trail */}
          {(() => {
            const ballTrail = posHistoryRef.current.get("ball");
            if (ballTrail && ballTrail.length >= 2) {
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
            }
            // Update ball trail
            const bArr = posHistoryRef.current.get("ball") ?? [];
            bArr.push({ x: displayState.ball.x, y: displayState.ball.y });
            if (bArr.length > 5) bArr.shift();
            posHistoryRef.current.set("ball", bArr);
            return null;
          })()}

          {/* Players */}
          {displayState.players.map((p, i) => {
            const cx = (p.x / 100) * 105;
            const cy = (p.y / 100) * 68;
            const isHome = p.team === "home";
            const isGhost = p.estimated;
            return (
              <g key={i}>
                {/* Player circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r="2.2"
                  fill={isHome ? "hsl(210, 90%, 55%)" : "hsl(0, 80%, 55%)"}
                  stroke="white"
                  strokeWidth={isGhost ? "0.3" : "0.5"}
                  opacity={isGhost ? 0.35 : 0.95}
                  strokeDasharray={isGhost ? "0.8,0.4" : "none"}
                  filter={isGhost ? undefined : "url(#glow)"}
                />
                {/* Jersey number or role */}
                <text
                  x={cx}
                  y={cy + 0.7}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fillOpacity={isGhost ? 0.4 : 0.95}
                  fontSize="1.8"
                  fontWeight="bold"
                  fontFamily="var(--font-display)"
                >
                  {p.number ?? (p.role ? p.role.charAt(0) : "")}
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

        {/* Team size indicator */}
        <div className="absolute bottom-2 left-2 pointer-events-none">
          <span className="text-[9px] text-white/60 bg-black/30 backdrop-blur-sm rounded px-1.5 py-0.5">
            {expectedHome}v{expectedAway}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => skipTo(currentFrame - 1)} disabled={currentFrame <= 0}>
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={togglePlay}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => skipTo(currentFrame + 1)} disabled={currentFrame >= totalFrames - 1}>
          <SkipForward className="h-4 w-4" />
        </Button>

        <div className="flex-1 px-2">
          <Slider
            value={[currentFrame]}
            min={0}
            max={Math.max(totalFrames - 1, 1)}
            step={1}
            onValueChange={([v]) => skipTo(v)}
          />
        </div>

        <button
          className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors px-1.5"
          onClick={() => setSpeedIdx(i => (i + 1) % SPEEDS.length)}
        >
          {speed}×
        </button>

        <span className="text-xs text-muted-foreground tabular-nums min-w-[4ch] text-right">
          {currentFrame + 1}/{totalFrames}
        </span>
      </div>

      {/* Scene bar */}
      {sceneFrames.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {sceneFrames.map(f => (
            <button
              key={f.idx}
              onClick={() => skipTo(f.idx)}
              className={`shrink-0 flex items-center gap-1.5 rounded-xl border px-3 py-2 text-left transition-all ${
                f.idx === currentFrame
                  ? "bg-primary/10 border-primary/30 shadow-sm"
                  : "border-border/50 hover:border-border hover:bg-muted/30"
              }`}
            >
              <span className={`text-xs font-bold font-display tabular-nums ${f.idx === currentFrame ? "text-primary" : "text-muted-foreground"}`}>
                ~{Math.round((f.idx * intervalSec) / 60)}′
              </span>
              <span className={`text-[11px] max-w-[120px] truncate ${f.idx === currentFrame ? "text-foreground" : "text-muted-foreground"}`}>
                {f.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
