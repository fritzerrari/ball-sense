import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause, SkipForward, SkipBack, Info } from "lucide-react";

interface PlayerPos {
  team: "home" | "away";
  x: number;
  y: number;
  role?: string;
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
}

/** Lerp helper */
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Interpolate between two frames */
function interpolateFrame(a: FrameData, b: FrameData, t: number): { ball: { x: number; y: number }; players: PlayerPos[] } {
  const ball = { x: lerp(a.ball.x, b.ball.x, t), y: lerp(a.ball.y, b.ball.y, t) };

  // Match players by team + index
  const homePlayers_a = a.players.filter((p) => p.team === "home");
  const homePlayers_b = b.players.filter((p) => p.team === "home");
  const awayPlayers_a = a.players.filter((p) => p.team === "away");
  const awayPlayers_b = b.players.filter((p) => p.team === "away");

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
      };
    });
  };

  return {
    ball,
    players: [...interpolatePlayers(homePlayers_a, homePlayers_b), ...interpolatePlayers(awayPlayers_a, awayPlayers_b)],
  };
}

const SPEEDS = [0.5, 1, 2, 4];

export default function TacticalReplay({ frames, intervalSec }: TacticalReplayProps) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [interpolationT, setInterpolationT] = useState(0);
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const speed = SPEEDS[speedIdx];
  const totalFrames = frames.length;

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
    }
    setPlaying((p) => !p);
  }, [currentFrame, totalFrames, playing]);

  const skipTo = useCallback((idx: number) => {
    setCurrentFrame(Math.max(0, Math.min(idx, totalFrames - 1)));
    setInterpolationT(0);
  }, [totalFrames]);

  // Current visual state
  const displayState = useMemo(() => {
    const a = frames[currentFrame];
    const b = frames[Math.min(currentFrame + 1, totalFrames - 1)];
    if (!a) return null;
    if (currentFrame >= totalFrames - 1 || a === b) return { ball: a.ball, players: a.players };
    return interpolateFrame(a, b, interpolationT);
  }, [frames, currentFrame, interpolationT, totalFrames]);

  const currentLabel = frames[currentFrame]?.label;
  const currentMinute = Math.round((currentFrame * intervalSec) / 60);

  if (!displayState) return null;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Play className="h-5 w-5 text-primary" />
            <h2 className="font-semibold font-display">Spielzug-Replay</h2>
          </div>
          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-500 border-0 gap-1">
            <Info className="h-3 w-3" /> KI-Schätzung
          </Badge>
        </div>

        {/* SVG Field */}
        <div className="aspect-[105/68] rounded-xl border border-border/50 relative overflow-hidden shadow-inner">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 105 68" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="trGrass" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(160, 45%, 38%)" />
                <stop offset="50%" stopColor="hsl(155, 42%, 35%)" />
                <stop offset="100%" stopColor="hsl(150, 40%, 32%)" />
              </linearGradient>
              <pattern id="trStripes" patternUnits="userSpaceOnUse" width="10" height="68">
                <rect x="0" y="0" width="5" height="68" fill="hsl(158, 44%, 36%)" />
                <rect x="5" y="0" width="5" height="68" fill="hsl(155, 40%, 34%)" />
              </pattern>
            </defs>

            {/* Pitch */}
            <rect x="0" y="0" width="105" height="68" fill="url(#trGrass)" />
            <rect x="0" y="0" width="105" height="68" fill="url(#trStripes)" opacity="0.25" />

            {/* Field lines */}
            <g stroke="white" strokeOpacity="0.45" fill="none">
              <rect x="1" y="1" width="103" height="66" strokeWidth="0.35" rx="0.5" />
              <line x1="52.5" y1="1" x2="52.5" y2="67" strokeWidth="0.3" />
              <circle cx="52.5" cy="34" r="9.15" strokeWidth="0.3" />
              <circle cx="52.5" cy="34" r="0.6" fill="white" fillOpacity="0.4" stroke="none" />
              <rect x="1" y="13.84" width="16.5" height="40.32" strokeWidth="0.25" />
              <rect x="87.5" y="13.84" width="16.5" height="40.32" strokeWidth="0.25" />
              <rect x="1" y="24.84" width="5.5" height="18.32" strokeWidth="0.2" />
              <rect x="98.5" y="24.84" width="5.5" height="18.32" strokeWidth="0.2" />
              <circle cx="12" cy="34" r="0.4" fill="white" fillOpacity="0.35" stroke="none" />
              <circle cx="93" cy="34" r="0.4" fill="white" fillOpacity="0.35" stroke="none" />
              <path d="M 17.5 27.5 A 9.15 9.15 0 0 1 17.5 40.5" strokeWidth="0.25" />
              <path d="M 87.5 27.5 A 9.15 9.15 0 0 0 87.5 40.5" strokeWidth="0.25" />
            </g>

            {/* Players */}
            {displayState.players.map((p, i) => {
              const cx = (p.x / 100) * 105;
              const cy = (p.y / 100) * 68;
              const isHome = p.team === "home";
              return (
                <g key={i}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r="2"
                    fill={isHome ? "hsl(210, 90%, 55%)" : "hsl(0, 80%, 55%)"}
                    stroke="white"
                    strokeWidth="0.4"
                    opacity="0.9"
                  />
                  {p.role && (
                    <text
                      x={cx}
                      y={cy - 2.8}
                      textAnchor="middle"
                      fill="white"
                      fillOpacity="0.7"
                      fontSize="2"
                      fontWeight="bold"
                    >
                      {p.role}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Ball */}
            <circle
              cx={(displayState.ball.x / 100) * 105}
              cy={(displayState.ball.y / 100) * 68}
              r="1.3"
              fill="white"
              stroke="hsl(0,0%,30%)"
              strokeWidth="0.3"
            />
          </svg>

          {/* Frame label overlay */}
          {currentLabel && (
            <div className="absolute top-2 left-2 right-2 flex justify-between items-start pointer-events-none">
              <Badge className="bg-background/80 text-foreground text-[10px] backdrop-blur-sm border-border/50">
                ~{currentMinute}′
              </Badge>
              <Badge variant="outline" className="bg-background/80 text-[10px] backdrop-blur-sm max-w-[60%] truncate">
                {currentLabel}
              </Badge>
            </div>
          )}
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
            onClick={() => setSpeedIdx((i) => (i + 1) % SPEEDS.length)}
          >
            {speed}×
          </button>

          <span className="text-xs text-muted-foreground tabular-nums min-w-[4ch] text-right">
            {currentFrame + 1}/{totalFrames}
          </span>
        </div>

        {/* Scene markers */}
        {frames.some((f) => f.label) && (
          <div className="flex flex-wrap gap-1.5">
            {frames.map((f, i) =>
              f.label ? (
                <button
                  key={i}
                  onClick={() => skipTo(i)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                    i === currentFrame
                      ? "bg-primary/15 border-primary/30 text-primary"
                      : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  ~{Math.round((i * intervalSec) / 60)}′ {f.label}
                </button>
              ) : null,
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
