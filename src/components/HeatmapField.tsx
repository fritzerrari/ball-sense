import { HEATMAP_COLS, HEATMAP_ROWS } from "@/lib/constants";
import { useMemo } from "react";

interface HeatmapFieldProps {
  label?: string;
  grid?: number[][] | null;
  className?: string;
  compact?: boolean;
  small?: boolean;
}

// Shared function to get heat color based on intensity
function getHeatColor(intensity: number): string {
  if (intensity < 0.15) return "hsla(142, 70%, 35%, 0.3)"; // Dark green - barely visible
  if (intensity < 0.3) return "hsla(142, 65%, 40%, 0.55)"; // Green
  if (intensity < 0.45) return "hsla(85, 60%, 45%, 0.65)"; // Yellow-green
  if (intensity < 0.55) return "hsla(55, 75%, 50%, 0.75)"; // Yellow
  if (intensity < 0.65) return "hsla(45, 85%, 50%, 0.8)"; // Orange-yellow
  if (intensity < 0.75) return "hsla(30, 90%, 50%, 0.85)"; // Orange
  if (intensity < 0.85) return "hsla(15, 95%, 50%, 0.9)"; // Red-orange
  return "hsla(0, 90%, 50%, 0.95)"; // Red - hottest
}

export function HeatmapField({ label, grid, className = "", small = false }: HeatmapFieldProps) {
  const displayGrid = grid || generateEmptyGrid();
  const maxVal = Math.max(...displayGrid.flat(), 0.01);

  // Cell dimensions for SVG viewbox
  const cellWidth = 105 / HEATMAP_COLS;
  const cellHeight = 68 / HEATMAP_ROWS;

  const cells = useMemo(() => {
    const result: { x: number; y: number; color: string; intensity: number }[] = [];
    
    displayGrid.forEach((row, rowIdx) => {
      row.forEach((val, colIdx) => {
        const intensity = val / maxVal;
        if (intensity > 0.08) {
          result.push({
            x: colIdx * cellWidth,
            y: rowIdx * cellHeight,
            color: getHeatColor(intensity),
            intensity,
          });
        }
      });
    });
    return result;
  }, [displayGrid, maxVal, cellWidth, cellHeight]);

  return (
    <div className={`space-y-2 ${className}`}>
      {label && <div className="text-sm font-medium text-muted-foreground">{label}</div>}
      <div className={`aspect-[105/68] rounded-xl border border-border/50 relative overflow-hidden shadow-inner ${small ? 'rounded-lg' : ''}`}>
        <svg 
          className="absolute inset-0 w-full h-full" 
          viewBox="0 0 105 68" 
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            {/* Realistic grass texture gradient */}
            <linearGradient id="grassBase" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(145, 55%, 28%)" />
              <stop offset="50%" stopColor="hsl(145, 50%, 25%)" />
              <stop offset="100%" stopColor="hsl(145, 45%, 22%)" />
            </linearGradient>
            
            {/* Grass stripe pattern */}
            <pattern id="grassStripes" patternUnits="userSpaceOnUse" width="10" height="68">
              <rect x="0" y="0" width="5" height="68" fill="hsl(145, 52%, 26%)" />
              <rect x="5" y="0" width="5" height="68" fill="hsl(145, 48%, 24%)" />
            </pattern>

            {/* Subtle cell blur for smoother transitions */}
            <filter id="cellBlur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="0.3" />
            </filter>

            {/* Glow effect for high intensity cells */}
            <filter id="heatGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Pitch background with grass stripes */}
          <rect x="0" y="0" width="105" height="68" fill="url(#grassBase)" />
          <rect x="0" y="0" width="105" height="68" fill="url(#grassStripes)" opacity="0.4" />

          {/* Heat cells layer */}
          <g filter="url(#cellBlur)">
            {cells.map((cell, i) => (
              <rect
                key={i}
                x={cell.x + 0.1}
                y={cell.y + 0.1}
                width={cellWidth - 0.2}
                height={cellHeight - 0.2}
                fill={cell.color}
                rx="0.3"
                ry="0.3"
              />
            ))}
          </g>

          {/* High intensity glow overlay */}
          <g filter="url(#heatGlow)" opacity="0.4">
            {cells.filter(c => c.intensity > 0.7).map((cell, i) => (
              <rect
                key={i}
                x={cell.x + 0.5}
                y={cell.y + 0.5}
                width={cellWidth - 1}
                height={cellHeight - 1}
                fill={cell.color}
                rx="0.5"
                ry="0.5"
              />
            ))}
          </g>

          {/* Field lines - crisp white */}
          <g stroke="white" strokeOpacity="0.5" fill="none">
            {/* Outline */}
            <rect x="1" y="1" width="103" height="66" strokeWidth="0.35" rx="0.5" />
            {/* Center line */}
            <line x1="52.5" y1="1" x2="52.5" y2="67" strokeWidth="0.3" />
            {/* Center circle */}
            <circle cx="52.5" cy="34" r="9.15" strokeWidth="0.3" />
            {/* Center spot */}
            <circle cx="52.5" cy="34" r="0.6" fill="white" fillOpacity="0.5" stroke="none" />
            {/* Penalty areas */}
            <rect x="1" y="13.84" width="16.5" height="40.32" strokeWidth="0.25" />
            <rect x="87.5" y="13.84" width="16.5" height="40.32" strokeWidth="0.25" />
            {/* Goal areas */}
            <rect x="1" y="24.84" width="5.5" height="18.32" strokeWidth="0.2" />
            <rect x="98.5" y="24.84" width="5.5" height="18.32" strokeWidth="0.2" />
            {/* Penalty spots */}
            <circle cx="12" cy="34" r="0.4" fill="white" fillOpacity="0.4" stroke="none" />
            <circle cx="93" cy="34" r="0.4" fill="white" fillOpacity="0.4" stroke="none" />
            {/* Penalty arcs */}
            <path d="M 17.5 27.5 A 9.15 9.15 0 0 1 17.5 40.5" strokeWidth="0.25" />
            <path d="M 87.5 27.5 A 9.15 9.15 0 0 0 87.5 40.5" strokeWidth="0.25" />
            {/* Corner arcs */}
            <path d="M 1 2 A 1 1 0 0 0 2 1" strokeWidth="0.2" />
            <path d="M 103 1 A 1 1 0 0 0 104 2" strokeWidth="0.2" />
            <path d="M 1 66 A 1 1 0 0 1 2 67" strokeWidth="0.2" />
            <path d="M 104 66 A 1 1 0 0 0 103 67" strokeWidth="0.2" />
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
  // Generate a realistic grid-based heatmap
  const grid = useMemo(() => {
    const result: number[][] = [];
    const centerX = HEATMAP_COLS / 2;
    const centerY = HEATMAP_ROWS / 2;
    
    // Activity hotspots
    const hotspots = [
      { cx: centerX, cy: centerY, strength: 1.0, radius: 5 },
      { cx: centerX - 4, cy: centerY - 2, strength: 0.8, radius: 3.5 },
      { cx: centerX + 3, cy: centerY + 1, strength: 0.75, radius: 3 },
      { cx: centerX - 8, cy: centerY, strength: 0.5, radius: 2.5 },
      { cx: centerX + 7, cy: centerY - 1, strength: 0.45, radius: 2.5 },
    ];

    for (let row = 0; row < HEATMAP_ROWS; row++) {
      const rowData: number[] = [];
      for (let col = 0; col < HEATMAP_COLS; col++) {
        let val = 0;
        for (const hs of hotspots) {
          const dist = Math.sqrt((col - hs.cx) ** 2 + (row - hs.cy) ** 2);
          if (dist < hs.radius * 2) {
            val += hs.strength * Math.exp(-(dist * dist) / (2 * (hs.radius * 0.7) ** 2));
          }
        }
        val += Math.random() * 0.03;
        rowData.push(Math.min(val, 1));
      }
      result.push(rowData);
    }
    return result;
  }, []);

  const maxVal = Math.max(...grid.flat(), 0.01);
  const cellWidth = 105 / HEATMAP_COLS;
  const cellHeight = 68 / HEATMAP_ROWS;

  const cells = useMemo(() => {
    const result: { x: number; y: number; color: string; intensity: number }[] = [];
    
    grid.forEach((row, rowIdx) => {
      row.forEach((val, colIdx) => {
        const intensity = val / maxVal;
        if (intensity > 0.08) {
          result.push({
            x: colIdx * cellWidth,
            y: rowIdx * cellHeight,
            color: getHeatColor(intensity),
            intensity,
          });
        }
      });
    });
    return result;
  }, [grid, maxVal, cellWidth, cellHeight]);

  return (
    <div className={`aspect-[105/68] rounded-lg overflow-hidden shadow-inner border border-border/30 ${className}`}>
      <svg 
        className="w-full h-full" 
        viewBox="0 0 105 68" 
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="miniGrass" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(145, 55%, 28%)" />
            <stop offset="100%" stopColor="hsl(145, 45%, 22%)" />
          </linearGradient>
          
          <pattern id="miniStripes" patternUnits="userSpaceOnUse" width="8" height="68">
            <rect x="0" y="0" width="4" height="68" fill="hsl(145, 50%, 26%)" />
            <rect x="4" y="0" width="4" height="68" fill="hsl(145, 46%, 24%)" />
          </pattern>

          <filter id="miniCellBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.25" />
          </filter>
        </defs>

        {/* Background */}
        <rect x="0" y="0" width="105" height="68" fill="url(#miniGrass)" />
        <rect x="0" y="0" width="105" height="68" fill="url(#miniStripes)" opacity="0.35" />

        {/* Heat cells */}
        <g filter="url(#miniCellBlur)">
          {cells.map((cell, i) => (
            <rect
              key={i}
              x={cell.x + 0.1}
              y={cell.y + 0.1}
              width={cellWidth - 0.2}
              height={cellHeight - 0.2}
              fill={cell.color}
              rx="0.2"
              ry="0.2"
            />
          ))}
        </g>

        {/* Field lines */}
        <g stroke="white" strokeOpacity="0.45" fill="none" strokeWidth="0.3">
          <rect x="1" y="1" width="103" height="66" rx="0.5" />
          <line x1="52.5" y1="1" x2="52.5" y2="67" />
          <circle cx="52.5" cy="34" r="9.15" />
          <circle cx="52.5" cy="34" r="0.5" fill="white" fillOpacity="0.4" stroke="none" />
          <rect x="1" y="13.84" width="16.5" height="40.32" strokeOpacity="0.3" />
          <rect x="87.5" y="13.84" width="16.5" height="40.32" strokeOpacity="0.3" />
        </g>
      </svg>
    </div>
  );
}
