import { HEATMAP_COLS, HEATMAP_ROWS } from "@/lib/constants";
import { useMemo } from "react";

interface HeatmapFieldProps {
  label?: string;
  grid?: number[][] | null;
  className?: string;
  compact?: boolean;
}

interface HeatSpot {
  x: number;
  y: number;
  intensity: number;
}

export function HeatmapField({ label, grid, className = "", compact = false }: HeatmapFieldProps) {
  const displayGrid = grid || generateEmptyGrid();
  const maxVal = Math.max(...displayGrid.flat(), 0.01);

  // Convert grid to heat spots for SVG rendering
  const heatSpots = useMemo(() => {
    const spots: HeatSpot[] = [];
    const cellWidth = 105 / HEATMAP_COLS;
    const cellHeight = 68 / HEATMAP_ROWS;

    displayGrid.forEach((row, rowIdx) => {
      row.forEach((val, colIdx) => {
        if (val > maxVal * 0.05) {
          spots.push({
            x: colIdx * cellWidth + cellWidth / 2,
            y: rowIdx * cellHeight + cellHeight / 2,
            intensity: val / maxVal,
          });
        }
      });
    });
    return spots;
  }, [displayGrid, maxVal]);

  return (
    <div className={`space-y-2 ${className}`}>
      {label && <div className="text-sm font-medium text-muted-foreground">{label}</div>}
      <div className={`aspect-[105/68] rounded-xl border border-border relative overflow-hidden`}>
        <svg 
          className="absolute inset-0 w-full h-full" 
          viewBox="0 0 105 68" 
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            {/* Pitch grass gradient */}
            <linearGradient id="pitchGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--pitch))" stopOpacity="0.9" />
              <stop offset="100%" stopColor="hsl(var(--pitch-dark))" stopOpacity="0.95" />
            </linearGradient>
            
            {/* Heat gradients */}
            <radialGradient id="heatLow">
              <stop offset="0%" stopColor="hsl(200, 80%, 55%)" stopOpacity="0.6" />
              <stop offset="50%" stopColor="hsl(200, 70%, 50%)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="hsl(200, 60%, 45%)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="heatMedLow">
              <stop offset="0%" stopColor="hsl(160, 75%, 50%)" stopOpacity="0.7" />
              <stop offset="40%" stopColor="hsl(140, 70%, 45%)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="hsl(120, 60%, 40%)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="heatMed">
              <stop offset="0%" stopColor="hsl(60, 90%, 55%)" stopOpacity="0.8" />
              <stop offset="35%" stopColor="hsl(45, 85%, 50%)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="hsl(30, 80%, 45%)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="heatHigh">
              <stop offset="0%" stopColor="hsl(15, 95%, 55%)" stopOpacity="0.9" />
              <stop offset="30%" stopColor="hsl(5, 90%, 50%)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="hsl(0, 85%, 45%)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="heatMax">
              <stop offset="0%" stopColor="hsl(0, 100%, 60%)" stopOpacity="1" />
              <stop offset="25%" stopColor="hsl(0, 95%, 55%)" stopOpacity="0.75" />
              <stop offset="60%" stopColor="hsl(15, 90%, 50%)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="hsl(30, 80%, 45%)" stopOpacity="0" />
            </radialGradient>

            {/* Blur filter for smooth blending */}
            <filter id="heatBlur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" />
            </filter>
          </defs>

          {/* Pitch background */}
          <rect x="0" y="0" width="105" height="68" fill="url(#pitchGradient)" />

          {/* Heat spots layer */}
          <g filter="url(#heatBlur)">
            {heatSpots.map((spot, i) => {
              const gradientId = 
                spot.intensity > 0.85 ? "heatMax" :
                spot.intensity > 0.65 ? "heatHigh" :
                spot.intensity > 0.45 ? "heatMed" :
                spot.intensity > 0.25 ? "heatMedLow" : "heatLow";
              
              const radius = 4 + spot.intensity * 8;
              
              return (
                <ellipse
                  key={i}
                  cx={spot.x}
                  cy={spot.y}
                  rx={radius}
                  ry={radius * 0.85}
                  fill={`url(#${gradientId})`}
                  opacity={0.7 + spot.intensity * 0.3}
                />
              );
            })}
          </g>

          {/* Field lines - on top of heat */}
          <g stroke="hsl(var(--pitch-line))" strokeOpacity="0.35" fill="none">
            {/* Outline */}
            <rect x="0.5" y="0.5" width="104" height="67" strokeWidth="0.4" />
            {/* Center line */}
            <line x1="52.5" y1="0" x2="52.5" y2="68" strokeWidth="0.3" />
            {/* Center circle */}
            <circle cx="52.5" cy="34" r="9.15" strokeWidth="0.3" />
            {/* Center spot */}
            <circle cx="52.5" cy="34" r="0.5" fill="hsl(var(--pitch-line))" fillOpacity="0.4" />
            {/* Penalty areas */}
            <rect x="0" y="13.84" width="16.5" height="40.32" strokeWidth="0.25" strokeOpacity="0.3" />
            <rect x="88.5" y="13.84" width="16.5" height="40.32" strokeWidth="0.25" strokeOpacity="0.3" />
            {/* Goal areas */}
            <rect x="0" y="24.84" width="5.5" height="18.32" strokeWidth="0.2" strokeOpacity="0.25" />
            <rect x="99.5" y="24.84" width="5.5" height="18.32" strokeWidth="0.2" strokeOpacity="0.25" />
            {/* Penalty spots */}
            <circle cx="11" cy="34" r="0.4" fill="hsl(var(--pitch-line))" fillOpacity="0.3" />
            <circle cx="94" cy="34" r="0.4" fill="hsl(var(--pitch-line))" fillOpacity="0.3" />
            {/* Penalty arcs */}
            <path d="M 16.5 27.5 A 9.15 9.15 0 0 1 16.5 40.5" strokeWidth="0.2" strokeOpacity="0.2" />
            <path d="M 88.5 27.5 A 9.15 9.15 0 0 0 88.5 40.5" strokeWidth="0.2" strokeOpacity="0.2" />
            {/* Corner arcs */}
            <path d="M 0 1 A 1 1 0 0 0 1 0" strokeWidth="0.15" strokeOpacity="0.2" />
            <path d="M 104 0 A 1 1 0 0 0 105 1" strokeWidth="0.15" strokeOpacity="0.2" />
            <path d="M 0 67 A 1 1 0 0 1 1 68" strokeWidth="0.15" strokeOpacity="0.2" />
            <path d="M 105 67 A 1 1 0 0 0 104 68" strokeWidth="0.15" strokeOpacity="0.2" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function generateEmptyGrid(): number[][] {
  return Array.from({ length: HEATMAP_ROWS }, () => Array(HEATMAP_COLS).fill(0));
}

// Compact inline heatmap for demo/preview purposes
export function MiniHeatmap({ className = "" }: { className?: string }) {
  // Predefined realistic activity pattern
  const heatData: HeatSpot[] = [
    // High activity in central midfield
    { x: 52, y: 34, intensity: 1.0 },
    { x: 45, y: 30, intensity: 0.9 },
    { x: 58, y: 38, intensity: 0.85 },
    // Left side activity
    { x: 35, y: 25, intensity: 0.75 },
    { x: 30, y: 42, intensity: 0.7 },
    { x: 25, y: 34, intensity: 0.65 },
    // Right side
    { x: 70, y: 28, intensity: 0.6 },
    { x: 75, y: 40, intensity: 0.55 },
    // Defensive third
    { x: 18, y: 34, intensity: 0.5 },
    { x: 15, y: 22, intensity: 0.35 },
    { x: 15, y: 46, intensity: 0.35 },
    // Attacking third
    { x: 85, y: 34, intensity: 0.45 },
    { x: 90, y: 28, intensity: 0.3 },
    { x: 90, y: 40, intensity: 0.3 },
  ];

  return (
    <div className={`aspect-[105/68] rounded-lg overflow-hidden ${className}`}>
      <svg 
        className="w-full h-full" 
        viewBox="0 0 105 68" 
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="miniPitchGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--pitch))" />
            <stop offset="100%" stopColor="hsl(var(--pitch-dark))" />
          </linearGradient>
          
          <radialGradient id="miniHeatCool">
            <stop offset="0%" stopColor="hsl(180, 70%, 50%)" stopOpacity="0.65" />
            <stop offset="60%" stopColor="hsl(160, 60%, 45%)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <radialGradient id="miniHeatWarm">
            <stop offset="0%" stopColor="hsl(50, 90%, 55%)" stopOpacity="0.8" />
            <stop offset="50%" stopColor="hsl(35, 80%, 50%)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <radialGradient id="miniHeatHot">
            <stop offset="0%" stopColor="hsl(10, 95%, 55%)" stopOpacity="0.9" />
            <stop offset="40%" stopColor="hsl(25, 85%, 50%)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>

          <filter id="miniBlur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
          </filter>
        </defs>

        {/* Background */}
        <rect x="0" y="0" width="105" height="68" fill="url(#miniPitchGrad)" />

        {/* Heat spots */}
        <g filter="url(#miniBlur)">
          {heatData.map((spot, i) => {
            const gradientId = 
              spot.intensity > 0.7 ? "miniHeatHot" :
              spot.intensity > 0.45 ? "miniHeatWarm" : "miniHeatCool";
            const r = 6 + spot.intensity * 10;
            
            return (
              <ellipse
                key={i}
                cx={spot.x}
                cy={spot.y}
                rx={r}
                ry={r * 0.8}
                fill={`url(#${gradientId})`}
              />
            );
          })}
        </g>

        {/* Field lines */}
        <g stroke="white" strokeOpacity="0.3" fill="none" strokeWidth="0.3">
          <rect x="0.5" y="0.5" width="104" height="67" />
          <line x1="52.5" y1="0" x2="52.5" y2="68" />
          <circle cx="52.5" cy="34" r="9.15" />
          <rect x="0" y="13.84" width="16.5" height="40.32" strokeOpacity="0.2" />
          <rect x="88.5" y="13.84" width="16.5" height="40.32" strokeOpacity="0.2" />
        </g>
      </svg>
    </div>
  );
}
