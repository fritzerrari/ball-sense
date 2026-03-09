import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "@/lib/i18n";
import { useTheme } from "@/components/ThemeProvider";
import { HEATMAP_COLS, HEATMAP_ROWS } from "@/lib/constants";

/** Realistic heatmap grid matching the real HeatmapField component */
function HeatmapPreview() {
  const grid = generateMockHeatmap();
  const maxVal = Math.max(...grid.flat(), 0.01);

  const cellWidth = 105 / HEATMAP_COLS;
  const cellHeight = 68 / HEATMAP_ROWS;

  const cells = grid.flatMap((row, rowIdx) =>
    row.map((val, colIdx) => {
      const intensity = val / maxVal;
      if (intensity < 0.08) return null;
      return { x: colIdx * cellWidth, y: rowIdx * cellHeight, intensity };
    }).filter(Boolean)
  ) as { x: number; y: number; intensity: number }[];

  function getColor(intensity: number): string {
    if (intensity < 0.15) return "hsla(142, 70%, 35%, 0.3)";
    if (intensity < 0.3) return "hsla(142, 65%, 40%, 0.55)";
    if (intensity < 0.45) return "hsla(85, 60%, 45%, 0.65)";
    if (intensity < 0.55) return "hsla(55, 75%, 50%, 0.75)";
    if (intensity < 0.65) return "hsla(45, 85%, 50%, 0.8)";
    if (intensity < 0.75) return "hsla(30, 90%, 50%, 0.85)";
    if (intensity < 0.85) return "hsla(15, 95%, 50%, 0.9)";
    return "hsla(0, 90%, 50%, 0.95)";
  }

  return (
    <div className="aspect-[105/68] rounded-lg border border-border/50 relative overflow-hidden">
      <svg className="w-full h-full" viewBox="0 0 105 68" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="analyticGrass" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(145, 55%, 28%)" />
            <stop offset="100%" stopColor="hsl(145, 45%, 22%)" />
          </linearGradient>
          <pattern id="analyticStripes" patternUnits="userSpaceOnUse" width="8" height="68">
            <rect x="0" y="0" width="4" height="68" fill="hsl(145, 50%, 26%)" />
            <rect x="4" y="0" width="4" height="68" fill="hsl(145, 46%, 24%)" />
          </pattern>
          <filter id="analyticBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.25" />
          </filter>
        </defs>
        <rect x="0" y="0" width="105" height="68" fill="url(#analyticGrass)" />
        <rect x="0" y="0" width="105" height="68" fill="url(#analyticStripes)" opacity="0.35" />
        <g filter="url(#analyticBlur)">
          {cells.map((cell, i) => (
            <rect key={i} x={cell.x + 0.1} y={cell.y + 0.1} width={cellWidth - 0.2} height={cellHeight - 0.2} fill={getColor(cell.intensity)} rx="0.2" ry="0.2" />
          ))}
        </g>
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

function StatsBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          whileInView={{ width: `${(value / max) * 100}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export function AnalyticsShowcase() {
  const { t } = useTranslation();

  return (
    <section className="py-24 md:py-40 relative overflow-hidden bg-secondary/50">
      <div className="absolute inset-0 field-grid opacity-[0.04]" />
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Left-aligned header */}
        <div className="max-w-5xl mx-auto mb-16 grid lg:grid-cols-3 gap-6">
          <motion.div
            className="lg:col-span-1"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-xs font-semibold text-primary font-display tracking-wider uppercase mb-3 block">Analytics</span>
            <h2 className="text-3xl md:text-4xl font-bold font-display leading-tight">
              {t("landing.analyticsTitle")}
            </h2>
          </motion.div>
          <motion.div
            className="lg:col-span-2 flex items-end"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <p className="text-muted-foreground max-w-lg text-base leading-relaxed">
              {t("landing.analyticsDesc")}
            </p>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto items-center">
          {/* Heatmap — now uses the REAL grid-based rendering */}
          <motion.div
            className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6"
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground/80 font-display">{t("landing.playerHeatmap")}</h3>
              <span className="text-xs text-primary px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10">#10 — A. Vogt</span>
            </div>
            <HeatmapPreview />
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <span>{t("landing.lowActivity")}</span>
              <div className="flex gap-1">
                <div className="w-4 h-2 rounded-sm" style={{ backgroundColor: "hsla(200, 80%, 50%, 0.5)" }} />
                <div className="w-4 h-2 rounded-sm" style={{ backgroundColor: "hsla(120, 80%, 50%, 0.5)" }} />
                <div className="w-4 h-2 rounded-sm" style={{ backgroundColor: "hsla(40, 80%, 50%, 0.5)" }} />
                <div className="w-4 h-2 rounded-sm" style={{ backgroundColor: "hsla(0, 80%, 50%, 0.5)" }} />
              </div>
              <span>{t("landing.highActivity")}</span>
            </div>
          </motion.div>

          {/* Stats dashboard */}
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
              <h3 className="text-sm font-semibold text-foreground/80 font-display mb-4">{t("landing.movementData")}</h3>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold font-display text-primary">11.2</div>
                  <div className="text-xs text-muted-foreground">km</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold font-display text-primary">32.1</div>
                  <div className="text-xs text-muted-foreground">km/h top</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold font-display text-primary">47</div>
                  <div className="text-xs text-muted-foreground">{t("landing.sprints")}</div>
                </div>
              </div>
              <div className="space-y-3">
                <StatsBar label={t("landing.distance")} value={11.2} max={14} color="hsl(152, 65%, 45%)" />
                <StatsBar label={t("landing.sprintDistance")} value={1.8} max={3} color="hsl(38, 92%, 50%)" />
                <StatsBar label={t("landing.avgSpeed")} value={7.4} max={10} color="hsl(200, 70%, 50%)" />
              </div>
            </div>

            <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
              <h3 className="text-sm font-semibold text-foreground/80 font-display mb-3">{t("landing.positionTracking")}</h3>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span>{t("landing.firstHalf")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-warning" />
                  <span>{t("landing.secondHalf")}</span>
                </div>
                <div className="ml-auto text-primary font-medium">95.2% {t("landing.accuracy")}</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/** Generate a realistic-looking heatmap for a midfielder */
function generateMockHeatmap(): number[][] {
  const rows = HEATMAP_ROWS;
  const cols = HEATMAP_COLS;
  const grid: number[][] = [];

  const hotspots = [
    { cx: 8, cy: 6, strength: 1.0, radius: 4 },
    { cx: 10, cy: 7, strength: 0.9, radius: 3.5 },
    { cx: 12, cy: 5, strength: 0.7, radius: 3 },
    { cx: 7, cy: 9, strength: 0.6, radius: 3 },
    { cx: 14, cy: 7, strength: 0.5, radius: 2.5 },
    { cx: 5, cy: 7, strength: 0.4, radius: 3 },
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
      val += Math.random() * 0.05;
      row.push(Math.min(val, 1));
    }
    grid.push(row);
  }
  return grid;
}
