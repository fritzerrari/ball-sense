import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, SkipForward, SkipBack, Info, Eye } from "lucide-react";
import TacticalReplayField from "./tactical-replay/TacticalReplayField";
import TacticalReplayControls from "./tactical-replay/TacticalReplayControls";
import { fillGhostPlayers, interpolateFrame, type PlayerPos, type FrameData } from "./tactical-replay/replay-utils";

interface TacticalReplayProps {
  frames: FrameData[];
  intervalSec: number;
  teamSizeDetected?: { home: number; away: number; format_label: string };
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
    // Ball trail
    const bArr = history.get("ball") ?? [];
    bArr.push({ x: displayState.ball.x, y: displayState.ball.y });
    if (bArr.length > 5) bArr.shift();
    history.set("ball", bArr);
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

      {/* SVG Field */}
      <TacticalReplayField
        displayState={displayState}
        posHistoryRef={posHistoryRef}
        currentMinute={currentMinute}
        currentLabel={currentLabel}
        expectedHome={expectedHome}
        expectedAway={expectedAway}
      />

      {/* Controls */}
      <TacticalReplayControls
        currentFrame={currentFrame}
        totalFrames={totalFrames}
        playing={playing}
        speed={speed}
        speedIdx={speedIdx}
        onTogglePlay={togglePlay}
        onSkipTo={skipTo}
        onSpeedChange={() => setSpeedIdx(i => (i + 1) % SPEEDS.length)}
        sceneFrames={sceneFrames}
        intervalSec={intervalSec}
      />
    </div>
  );
}
