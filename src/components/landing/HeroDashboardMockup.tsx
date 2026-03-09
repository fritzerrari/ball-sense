import { motion } from "framer-motion";
import { useTranslation } from "@/lib/i18n";
import { HEATMAP_COLS, HEATMAP_ROWS } from "@/lib/constants";

/**
 * A mini "app window" showing a fake dashboard — proves
 * the product is real and immediately communicates value.
 */
export function HeroDashboardMockup() {
  const { t } = useTranslation();

  // Generate realistic-looking heatmap grid data
  const heatmapGrid = generateMockHeatmap();
  const maxVal = Math.max(...heatmapGrid.flat(), 0.01);

  return (
    <motion.div
      className="relative w-full max-w-lg mx-auto"
      initial={{ opacity: 0, y: 40, rotateY: -8 }}
      animate={{ opacity: 1, y: 0, rotateY: 0 }}
      transition={{ duration: 1, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Glow behind */}
      <div className="absolute -inset-8 bg-primary/8 rounded-3xl blur-3xl" />
      
      {/* Main window */}
      <div className="relative rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/50">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-warning/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-success/60" />
          </div>
          <div className="flex-1 text-center">
            <span className="text-[10px] text-muted-foreground font-medium">FieldIQ — Dashboard</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Ø Distance", value: "11.2 km" },
              { label: "Top Speed", value: "32.1 km/h" },
              { label: "Sprints", value: "47" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                className="rounded-lg bg-muted/50 border border-border/50 p-3 text-center"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8 + i * 0.1, duration: 0.5 }}
              >
                <div className="text-lg font-bold font-display text-primary">{stat.value}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Mini heatmap (real grid-based!) + player list */}
          <div className="grid grid-cols-5 gap-3">
            {/* Heatmap — matches real HeatmapField component */}
            <motion.div
              className="col-span-3 rounded-lg bg-muted/20 border border-border/30 relative overflow-hidden aspect-[105/68]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 0.6 }}
            >
              <svg className="w-full h-full" viewBox="0 0 105 68" preserveAspectRatio="xMidYMid slice">
                <defs>
                  <linearGradient id="mockupGrass" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="hsl(145, 55%, 28%)" />
                    <stop offset="100%" stopColor="hsl(145, 45%, 22%)" />
                  </linearGradient>
                  <pattern id="mockupStripes" patternUnits="userSpaceOnUse" width="8" height="68">
                    <rect x="0" y="0" width="4" height="68" fill="hsl(145, 50%, 26%)" />
                    <rect x="4" y="0" width="4" height="68" fill="hsl(145, 46%, 24%)" />
                  </pattern>
                  <filter id="mockupBlur" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="0.25" />
                  </filter>
                </defs>
                <rect x="0" y="0" width="105" height="68" fill="url(#mockupGrass)" />
                <rect x="0" y="0" width="105" height="68" fill="url(#mockupStripes)" opacity="0.35" />
                <g filter="url(#mockupBlur)">
                  {heatmapGrid.flat().map((val, i) => {
                    const colIdx = i % HEATMAP_COLS;
                    const rowIdx = Math.floor(i / HEATMAP_COLS);
                    const intensity = val / maxVal;
                    if (intensity < 0.08) return null;
                    const cw = 105 / HEATMAP_COLS;
                    const ch = 68 / HEATMAP_ROWS;
                    const color = intensity < 0.15 ? "hsla(142,70%,35%,0.3)" : intensity < 0.3 ? "hsla(142,65%,40%,0.55)" : intensity < 0.45 ? "hsla(85,60%,45%,0.65)" : intensity < 0.55 ? "hsla(55,75%,50%,0.75)" : intensity < 0.65 ? "hsla(45,85%,50%,0.8)" : intensity < 0.75 ? "hsla(30,90%,50%,0.85)" : intensity < 0.85 ? "hsla(15,95%,50%,0.9)" : "hsla(0,90%,50%,0.95)";
                    return <rect key={i} x={colIdx * cw + 0.1} y={rowIdx * ch + 0.1} width={cw - 0.2} height={ch - 0.2} fill={color} rx="0.2" ry="0.2" />;
                  })}
                </g>
                <g stroke="white" strokeOpacity="0.45" fill="none" strokeWidth="0.3">
                  <rect x="1" y="1" width="103" height="66" rx="0.5" />
                  <line x1="52.5" y1="1" x2="52.5" y2="67" />
                  <circle cx="52.5" cy="34" r="9.15" />
                  <rect x="1" y="13.84" width="16.5" height="40.32" strokeOpacity="0.3" />
                  <rect x="87.5" y="13.84" width="16.5" height="40.32" strokeOpacity="0.3" />
                </g>
                <text x="3" y="65" fill="white" fillOpacity="0.3" fontSize="3" fontFamily="sans-serif">HEATMAP</text>
              </svg>
            </motion.div>

            {/* Player list — fictional names */}
            <div className="col-span-2 space-y-1.5">
              {[
                { name: "A. Vogt", km: "11.2", num: "10" },
                { name: "M. Berger", km: "10.8", num: "8" },
                { name: "F. Hauser", km: "10.5", num: "6" },
                { name: "N. Roth", km: "9.7", num: "7" },
              ].map((player, i) => (
                <motion.div
                  key={player.name}
                  className="flex items-center gap-2 rounded-md bg-muted/30 border border-border/30 px-2 py-1.5"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1 + i * 0.12, duration: 0.4 }}
                >
                  <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[9px] font-bold flex items-center justify-center font-display">{player.num}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-medium text-foreground truncate">{player.name}</div>
                    <div className="text-[8px] text-muted-foreground">{player.km} km</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Bar chart mockup */}
          <div className="rounded-lg bg-muted/30 border border-border/30 p-3">
            <div className="text-[10px] text-muted-foreground mb-2 font-display font-medium">Saisonverlauf — Laufdistanz</div>
            <div className="flex items-end gap-1 h-10">
              {[65, 78, 55, 82, 90, 72, 88, 95, 70, 85, 92, 80].map((h, i) => (
                <motion.div
                  key={i}
                  className="flex-1 rounded-t-sm bg-primary/40"
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: 1.3 + i * 0.05, duration: 0.5, ease: "easeOut" }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating badge — Live Tracking */}
      <motion.div
        className="absolute -bottom-4 -left-4 rounded-xl border border-border bg-card shadow-lg px-4 py-2.5 flex items-center gap-2.5"
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 1.8, duration: 0.5, ease: "backOut" }}
      >
        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
        </div>
        <div>
          <div className="text-xs font-bold font-display text-foreground">Live Tracking</div>
          <div className="text-[10px] text-muted-foreground">3 Kameras aktiv</div>
        </div>
      </motion.div>

      {/* Floating accuracy badge */}
      <motion.div
        className="absolute -top-3 -right-3 rounded-lg border border-primary/30 bg-card shadow-lg px-3 py-1.5"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 2, duration: 0.4, ease: "backOut" }}
      >
        <div className="text-sm font-bold font-display text-primary">95.2%</div>
        <div className="text-[9px] text-muted-foreground">Accuracy</div>
      </motion.div>
    </motion.div>
  );
}

/** Generate a realistic-looking heatmap for a midfielder */
function generateMockHeatmap(): number[][] {
  const rows = HEATMAP_ROWS; // 14
  const cols = HEATMAP_COLS; // 21
  const grid: number[][] = [];

  // Hotspots for a central midfielder (#10)
  const hotspots = [
    { cx: 8, cy: 6, strength: 1.0, radius: 4 },   // Left-center
    { cx: 10, cy: 7, strength: 0.9, radius: 3.5 },  // Center
    { cx: 12, cy: 5, strength: 0.7, radius: 3 },    // Right-center forward
    { cx: 7, cy: 9, strength: 0.6, radius: 3 },     // Left back
    { cx: 14, cy: 7, strength: 0.5, radius: 2.5 },  // Attacking zone
    { cx: 5, cy: 7, strength: 0.4, radius: 3 },     // Deep midfielder
  ];

  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < cols; c++) {
      let val = 0;
      for (const hs of hotspots) {
        const dist = Math.sqrt((c - hs.cx) ** 2 + (r - hs.cy) ** 2);
        if (dist < hs.radius * 2) {
          val += hs.strength * Math.exp(-(dist * dist) / (2 * (hs.radius * 0.8) ** 2));
        }
      }
      // Add slight noise
      val += Math.random() * 0.05;
      row.push(Math.min(val, 1));
    }
    grid.push(row);
  }
  return grid;
}
