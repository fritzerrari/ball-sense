import { HEATMAP_COLS, HEATMAP_ROWS } from "@/lib/constants";

interface HeatmapFieldProps {
  label?: string;
  grid?: number[][] | null;
  className?: string;
  compact?: boolean;
}

export function HeatmapField({ label, grid, className = "", compact = false }: HeatmapFieldProps) {
  const displayGrid = grid || generateEmptyGrid();
  const maxVal = Math.max(...displayGrid.flat(), 0.01);

  return (
    <div className={`space-y-2 ${className}`}>
      {label && <div className="text-sm font-medium text-muted-foreground">{label}</div>}
      <div className={`${compact ? "aspect-[105/68]" : "aspect-[105/68]"} bg-muted/20 rounded-lg border border-border relative overflow-hidden`}>
        {/* Field lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 105 68" preserveAspectRatio="none">
          {/* Outline */}
          <rect x="0" y="0" width="105" height="68" fill="none" stroke="hsl(190 100% 50% / 0.1)" strokeWidth="0.5" />
          {/* Center line */}
          <line x1="52.5" y1="0" x2="52.5" y2="68" stroke="hsl(190 100% 50% / 0.1)" strokeWidth="0.3" />
          {/* Center circle */}
          <circle cx="52.5" cy="34" r="9.15" fill="none" stroke="hsl(190 100% 50% / 0.1)" strokeWidth="0.3" />
          {/* Penalty areas */}
          <rect x="0" y="13.84" width="16.5" height="40.32" fill="none" stroke="hsl(190 100% 50% / 0.08)" strokeWidth="0.3" />
          <rect x="88.5" y="13.84" width="16.5" height="40.32" fill="none" stroke="hsl(190 100% 50% / 0.08)" strokeWidth="0.3" />
          {/* Goal areas */}
          <rect x="0" y="24.84" width="5.5" height="18.32" fill="none" stroke="hsl(190 100% 50% / 0.06)" strokeWidth="0.3" />
          <rect x="99.5" y="24.84" width="5.5" height="18.32" fill="none" stroke="hsl(190 100% 50% / 0.06)" strokeWidth="0.3" />
        </svg>
        {/* Heatmap cells */}
        <div className="absolute inset-1 grid gap-px" style={{ gridTemplateColumns: `repeat(${HEATMAP_COLS}, 1fr)`, gridTemplateRows: `repeat(${HEATMAP_ROWS}, 1fr)` }}>
          {displayGrid.flat().map((val, i) => {
            const norm = val / maxVal;
            const hue = norm > 0.7 ? 0 : norm > 0.4 ? 40 : norm > 0.2 ? 120 : 200;
            const alpha = Math.max(norm * 0.7, 0.02);
            return (
              <div
                key={i}
                className="rounded-[1px]"
                style={{ backgroundColor: `hsla(${hue}, 80%, 50%, ${alpha})` }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function generateEmptyGrid(): number[][] {
  return Array.from({ length: HEATMAP_ROWS }, () => Array(HEATMAP_COLS).fill(0));
}
