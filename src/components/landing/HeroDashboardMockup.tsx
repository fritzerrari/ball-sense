import { motion } from "framer-motion";
import { useTranslation } from "@/lib/i18n";

/**
 * A mini "app window" showing a fake dashboard — proves
 * the product is real and immediately communicates value.
 */
export function HeroDashboardMockup() {
  const { t } = useTranslation();

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
              { label: "Ø Distance", value: "11.2 km", color: "text-primary" },
              { label: "Top Speed", value: "32.1 km/h", color: "text-primary" },
              { label: "Sprints", value: "47", color: "text-primary" },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                className="rounded-lg bg-muted/50 border border-border/50 p-3 text-center"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8 + Math.random() * 0.3, duration: 0.5 }}
              >
                <div className={`text-lg font-bold font-display ${stat.color}`}>{stat.value}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Mini heatmap + player list side by side */}
          <div className="grid grid-cols-5 gap-3">
            {/* Heatmap placeholder */}
            <div className="col-span-3 rounded-lg bg-pitch-dark/90 border border-border/30 p-3 relative overflow-hidden aspect-[3/2]">
              {/* Pitch lines */}
              <div className="absolute inset-3 border border-pitch-line/20 rounded-sm" />
              <div className="absolute top-3 bottom-3 left-1/2 w-px bg-pitch-line/20" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full border border-pitch-line/20" />
              
              {/* Heat zones */}
              {[
                { x: "30%", y: "40%", size: 40, opacity: 0.4 },
                { x: "45%", y: "55%", size: 30, opacity: 0.3 },
                { x: "25%", y: "65%", size: 35, opacity: 0.35 },
                { x: "60%", y: "35%", size: 25, opacity: 0.25 },
              ].map((zone, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    left: zone.x,
                    top: zone.y,
                    width: zone.size,
                    height: zone.size,
                    background: `radial-gradient(circle, hsl(152 65% 45% / ${zone.opacity}), transparent)`,
                    transform: "translate(-50%, -50%)",
                  }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 1.2 + i * 0.15, duration: 0.6 }}
                />
              ))}

              {/* Player dots */}
              {[
                { x: "28%", y: "35%" },
                { x: "42%", y: "55%" },
                { x: "65%", y: "40%" },
                { x: "35%", y: "70%" },
                { x: "55%", y: "30%" },
              ].map((dot, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full bg-primary shadow-[0_0_6px_hsl(152_65%_45%/0.6)]"
                  style={{ left: dot.x, top: dot.y, transform: "translate(-50%, -50%)" }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.5 + i * 0.1 }}
                />
              ))}

              <div className="absolute bottom-1.5 left-3 text-[8px] text-pitch-line/50 font-display">HEATMAP</div>
            </div>

            {/* Player list */}
            <div className="col-span-2 space-y-1.5">
              {[
                { name: "L. Müller", km: "11.2", num: "10" },
                { name: "T. Kroos", km: "10.8", num: "8" },
                { name: "J. Kimmich", km: "10.5", num: "6" },
                { name: "S. Gnabry", km: "9.7", num: "7" },
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

      {/* Floating badge */}
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

      {/* Floating accuracy badge top right */}
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
