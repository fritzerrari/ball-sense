import { HEATMAP_COLS, HEATMAP_ROWS } from "@/lib/constants";
import { useMemo } from "react";

interface HeatmapFieldProps {
  label?: string;
  grid?: number[][] | null;
  className?: string;
  compact?: boolean;
  small?: boolean;
}

export function HeatmapField({ label, grid, className = "", small = false }: HeatmapFieldProps) {
  const displayGrid = grid || generateEmptyGrid();
  const maxVal = Math.max(...displayGrid.flat(), 0.01);

  // Convert grid to heat spots (center-point based for smooth gradients)
  const cellWidth = 105 / HEATMAP_COLS;
  const cellHeight = 68 / HEATMAP_ROWS;

  const heatSpots = useMemo(() => {
    const result: { x: number; y: number; intensity: number }[] = [];
    displayGrid.forEach((row, rowIdx) => {
      row.forEach((val, colIdx) => {
        const intensity = val / maxVal;
        if (intensity > 0.05) {
          result.push({
            x: colIdx * cellWidth + cellWidth / 2,
            y: rowIdx * cellHeight + cellHeight / 2,
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
            {/* Teal-green pitch base matching reference */}
            <linearGradient id="hfGrassBase" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(160, 45%, 38%)" />
              <stop offset="50%" stopColor="hsl(155, 42%, 35%)" />
              <stop offset="100%" stopColor="hsl(150, 40%, 32%)" />
            </linearGradient>
            
            {/* Grass stripe pattern */}
            <pattern id="hfGrassStripes" patternUnits="userSpaceOnUse" width="10" height="68">
              <rect x="0" y="0" width="5" height="68" fill="hsl(158, 44%, 36%)" />
              <rect x="5" y="0" width="5" height="68" fill="hsl(155, 40%, 34%)" />
            </pattern>

            {/* Smooth heat radial gradients - teal → green → yellow → orange → red */}
            <radialGradient id="hfHeatLow">
              <stop offset="0%" stopColor="hsl(160, 60%, 48%)" stopOpacity="0.5" />
              <stop offset="60%" stopColor="hsl(160, 50%, 42%)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
            <radialGradient id="hfHeatMedLow">
              <stop offset="0%" stopColor="hsl(120, 55%, 48%)" stopOpacity="0.65" />
              <stop offset="50%" stopColor="hsl(140, 50%, 42%)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
            <radialGradient id="hfHeatMed">
              <stop offset="0%" stopColor="hsl(55, 85%, 52%)" stopOpacity="0.8" />
              <stop offset="40%" stopColor="hsl(70, 70%, 48%)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
            <radialGradient id="hfHeatHigh">
              <stop offset="0%" stopColor="hsl(25, 90%, 52%)" stopOpacity="0.85" />
              <stop offset="35%" stopColor="hsl(40, 80%, 48%)" stopOpacity="0.45" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
            <radialGradient id="hfHeatMax">
              <stop offset="0%" stopColor="hsl(0, 85%, 50%)" stopOpacity="0.95" />
              <stop offset="25%" stopColor="hsl(10, 90%, 48%)" stopOpacity="0.7" />
              <stop offset="55%" stopColor="hsl(25, 80%, 45%)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
            
            {/* Strong gaussian blur for smooth organic blending */}
            <filter id="hfHeatBlur" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
            </filter>
            <filter id="hfHeatBlur2" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5" />
            </filter>
          </defs>

          {/* Pitch background */}
          <rect x="0" y="0" width="105" height="68" fill="url(#hfGrassBase)" />
          <rect x="0" y="0" width="105" height="68" fill="url(#hfGrassStripes)" opacity="0.25" />

          {/* Base heat layer - very blurred for ambient color */}
          <g filter="url(#hfHeatBlur2)" opacity="0.6">
            {heatSpots.filter(s => s.intensity > 0.15).map((spot, i) => {
              const gradId = spot.intensity > 0.8 ? "hfHeatMax" : spot.intensity > 0.6 ? "hfHeatHigh" : spot.intensity > 0.4 ? "hfHeatMed" : spot.intensity > 0.2 ? "hfHeatMedLow" : "hfHeatLow";
              const r = 6 + spot.intensity * 12;
              return (
                <ellipse key={`b${i}`} cx={spot.x} cy={spot.y} rx={r * 1.3} ry={r} fill={`url(#${gradId})`} />
              );
            })}
          </g>

          {/* Detail heat layer - moderately blurred */}
          <g filter="url(#hfHeatBlur)" opacity="0.8">
            {heatSpots.map((spot, i) => {
              const gradId = spot.intensity > 0.8 ? "hfHeatMax" : spot.intensity > 0.6 ? "hfHeatHigh" : spot.intensity > 0.4 ? "hfHeatMed" : spot.intensity > 0.2 ? "hfHeatMedLow" : "hfHeatLow";
              const r = 4 + spot.intensity * 8;
              return (
                <ellipse key={`d${i}`} cx={spot.x} cy={spot.y} rx={r} ry={r * 0.85} fill={`url(#${gradId})`} opacity={0.6 + spot.intensity * 0.4} />
              );
            })}
          </g>

          {/* Field lines - crisp white on top */}
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
  const grid = useMemo(() => {
    const result: number[][] = [];
    const centerX = HEATMAP_COLS / 2;
    const centerY = HEATMAP_ROWS / 2;
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

  const heatSpots = useMemo(() => {
    const result: { x: number; y: number; intensity: number }[] = [];
    grid.forEach((row, rowIdx) => {
      row.forEach((val, colIdx) => {
        const intensity = val / maxVal;
        if (intensity > 0.05) {
          result.push({
            x: colIdx * cellWidth + cellWidth / 2,
            y: rowIdx * cellHeight + cellHeight / 2,
            intensity,
          });
        }
      });
    });
    return result;
  }, [grid, maxVal, cellWidth, cellHeight]);

  return (
    <div className={`aspect-[105/68] rounded-lg overflow-hidden shadow-inner border border-border/30 ${className}`}>
      <svg className="w-full h-full" viewBox="0 0 105 68" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="miniGrass2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(160, 45%, 38%)" />
            <stop offset="100%" stopColor="hsl(150, 40%, 32%)" />
          </linearGradient>
          <pattern id="miniStripes2" patternUnits="userSpaceOnUse" width="8" height="68">
            <rect x="0" y="0" width="4" height="68" fill="hsl(158, 44%, 36%)" />
            <rect x="4" y="0" width="4" height="68" fill="hsl(155, 40%, 34%)" />
          </pattern>
          <radialGradient id="mhLow"><stop offset="0%" stopColor="hsl(160,60%,48%)" stopOpacity="0.5" /><stop offset="60%" stopColor="hsl(160,50%,42%)" stopOpacity="0.2" /><stop offset="100%" stopColor="transparent" /></radialGradient>
          <radialGradient id="mhMedLow"><stop offset="0%" stopColor="hsl(120,55%,48%)" stopOpacity="0.65" /><stop offset="50%" stopColor="hsl(140,50%,42%)" stopOpacity="0.3" /><stop offset="100%" stopColor="transparent" /></radialGradient>
          <radialGradient id="mhMed"><stop offset="0%" stopColor="hsl(55,85%,52%)" stopOpacity="0.8" /><stop offset="40%" stopColor="hsl(70,70%,48%)" stopOpacity="0.4" /><stop offset="100%" stopColor="transparent" /></radialGradient>
          <radialGradient id="mhHigh"><stop offset="0%" stopColor="hsl(25,90%,52%)" stopOpacity="0.85" /><stop offset="35%" stopColor="hsl(40,80%,48%)" stopOpacity="0.45" /><stop offset="100%" stopColor="transparent" /></radialGradient>
          <radialGradient id="mhMax"><stop offset="0%" stopColor="hsl(0,85%,50%)" stopOpacity="0.95" /><stop offset="25%" stopColor="hsl(10,90%,48%)" stopOpacity="0.7" /><stop offset="55%" stopColor="hsl(25,80%,45%)" stopOpacity="0.3" /><stop offset="100%" stopColor="transparent" /></radialGradient>
          <filter id="mhBlur1" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur in="SourceGraphic" stdDeviation="4" /></filter>
          <filter id="mhBlur2" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur in="SourceGraphic" stdDeviation="2.5" /></filter>
        </defs>

        <rect x="0" y="0" width="105" height="68" fill="url(#miniGrass2)" />
        <rect x="0" y="0" width="105" height="68" fill="url(#miniStripes2)" opacity="0.25" />

        <g filter="url(#mhBlur1)" opacity="0.55">
          {heatSpots.filter(s => s.intensity > 0.15).map((spot, i) => {
            const gid = spot.intensity > 0.8 ? "mhMax" : spot.intensity > 0.6 ? "mhHigh" : spot.intensity > 0.4 ? "mhMed" : spot.intensity > 0.2 ? "mhMedLow" : "mhLow";
            const r = 6 + spot.intensity * 10;
            return <ellipse key={`b${i}`} cx={spot.x} cy={spot.y} rx={r * 1.2} ry={r} fill={`url(#${gid})`} />;
          })}
        </g>
        <g filter="url(#mhBlur2)" opacity="0.75">
          {heatSpots.map((spot, i) => {
            const gid = spot.intensity > 0.8 ? "mhMax" : spot.intensity > 0.6 ? "mhHigh" : spot.intensity > 0.4 ? "mhMed" : spot.intensity > 0.2 ? "mhMedLow" : "mhLow";
            const r = 3.5 + spot.intensity * 7;
            return <ellipse key={`d${i}`} cx={spot.x} cy={spot.y} rx={r} ry={r * 0.85} fill={`url(#${gid})`} opacity={0.5 + spot.intensity * 0.5} />;
          })}
        </g>

        <g stroke="white" strokeOpacity="0.4" fill="none" strokeWidth="0.3">
          <rect x="1" y="1" width="103" height="66" rx="0.5" />
          <line x1="52.5" y1="1" x2="52.5" y2="67" />
          <circle cx="52.5" cy="34" r="9.15" />
          <circle cx="52.5" cy="34" r="0.5" fill="white" fillOpacity="0.35" stroke="none" />
          <rect x="1" y="13.84" width="16.5" height="40.32" strokeOpacity="0.3" />
          <rect x="87.5" y="13.84" width="16.5" height="40.32" strokeOpacity="0.3" />
        </g>
      </svg>
    </div>
  );
}
