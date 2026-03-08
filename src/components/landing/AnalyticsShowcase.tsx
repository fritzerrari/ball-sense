import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "@/lib/i18n";
import { useTheme } from "@/components/ThemeProvider";

function HeatmapCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 400 * dpr;
    canvas.height = 260 * dpr;
    ctx.scale(dpr, dpr);

    const isDark = theme === "dark";

    // Draw pitch
    ctx.fillStyle = isDark ? "rgba(16, 30, 22, 1)" : "rgba(34, 120, 70, 0.9)";
    ctx.fillRect(0, 0, 400, 260);

    // Pitch lines
    ctx.strokeStyle = isDark ? "rgba(74, 222, 128, 0.15)" : "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, 380, 240);
    ctx.beginPath();
    ctx.moveTo(200, 10);
    ctx.lineTo(200, 250);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(200, 130, 40, 0, Math.PI * 2);
    ctx.stroke();

    // Heat zones
    const zones = [
      { x: 120, y: 100, r: 60, intensity: 0.7 },
      { x: 180, y: 140, r: 45, intensity: 0.5 },
      { x: 100, y: 180, r: 50, intensity: 0.6 },
      { x: 250, y: 120, r: 35, intensity: 0.4 },
      { x: 80, y: 130, r: 55, intensity: 0.65 },
      { x: 160, y: 80, r: 30, intensity: 0.35 },
    ];

    for (const zone of zones) {
      const grad = ctx.createRadialGradient(zone.x, zone.y, 0, zone.x, zone.y, zone.r);
      grad.addColorStop(0, `rgba(74, 222, 128, ${zone.intensity * 0.6})`);
      grad.addColorStop(0.4, `rgba(234, 179, 8, ${zone.intensity * 0.3})`);
      grad.addColorStop(0.7, `rgba(239, 68, 68, ${zone.intensity * 0.15})`);
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, zone.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [theme]);

  return <canvas ref={canvasRef} className="w-full h-auto rounded-lg" style={{ maxWidth: 400 }} />;
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
      <div className="absolute inset-0 field-grid opacity-20" />
      
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-5xl font-bold font-display mb-4 text-foreground">
            {t("landing.analyticsTitle")}
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            {t("landing.analyticsDesc")}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto items-center">
          {/* Heatmap */}
          <motion.div
            className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6"
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground/80 font-display">{t("landing.playerHeatmap")}</h3>
              <span className="text-xs text-primary px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10">#10 — L. Müller</span>
            </div>
            <HeatmapCanvas />
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <span>{t("landing.lowActivity")}</span>
              <div className="flex gap-1">
                <div className="w-4 h-2 rounded-sm bg-red-500/50" />
                <div className="w-4 h-2 rounded-sm bg-yellow-500/50" />
                <div className="w-4 h-2 rounded-sm bg-green-500/50" />
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
            {/* Player stats card */}
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

            {/* Tracking lines mockup */}
            <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
              <h3 className="text-sm font-semibold text-foreground/80 font-display mb-3">{t("landing.positionTracking")}</h3>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span>{t("landing.firstHalf")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-yellow-500" />
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
