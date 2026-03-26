import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipForward, SkipBack } from "lucide-react";

interface SceneFrame {
  idx: number;
  label?: string;
}

interface TacticalReplayControlsProps {
  currentFrame: number;
  totalFrames: number;
  playing: boolean;
  speed: number;
  speedIdx: number;
  onTogglePlay: () => void;
  onSkipTo: (idx: number) => void;
  onSpeedChange: () => void;
  sceneFrames: SceneFrame[];
  intervalSec: number;
}

export default function TacticalReplayControls({
  currentFrame,
  totalFrames,
  playing,
  speed,
  onTogglePlay,
  onSkipTo,
  onSpeedChange,
  sceneFrames,
  intervalSec,
}: TacticalReplayControlsProps) {
  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onSkipTo(currentFrame - 1)} disabled={currentFrame <= 0}>
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={onTogglePlay}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onSkipTo(currentFrame + 1)} disabled={currentFrame >= totalFrames - 1}>
          <SkipForward className="h-4 w-4" />
        </Button>

        <div className="flex-1 px-2">
          <Slider
            value={[currentFrame]}
            min={0}
            max={Math.max(totalFrames - 1, 1)}
            step={1}
            onValueChange={([v]) => onSkipTo(v)}
          />
        </div>

        <button
          className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors px-1.5"
          onClick={onSpeedChange}
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
              onClick={() => onSkipTo(f.idx)}
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
    </>
  );
}
