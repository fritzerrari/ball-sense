import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smartphone, Wifi, BarChart3, ChevronLeft, ChevronRight } from "lucide-react";
import { HEATMAP_COLS, HEATMAP_ROWS } from "@/lib/constants";

const slides = [
  { id: "tracking", label: "Live Tracking" },
  { id: "calibration", label: "Kalibrierung" },
  { id: "analysis", label: "Datenübertragung" },
];

export function HeroSlider() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setActive((p) => (p + 1) % slides.length), 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      className="relative w-full max-w-lg mx-auto"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="absolute -inset-8 bg-primary/8 rounded-3xl blur-3xl" />

      <div className="relative rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Slide dots */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
          <div className="flex gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setActive(i)}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  i === active ? "w-6 bg-primary" : "w-2.5 bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground font-medium font-display">
            {slides[active].label}
          </span>
          <div className="flex gap-1">
            <button onClick={() => setActive((p) => (p - 1 + slides.length) % slides.length)} className="p-0.5 rounded hover:bg-muted/50">
              <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button onClick={() => setActive((p) => (p + 1) % slides.length)} className="p-0.5 rounded hover:bg-muted/50">
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="relative aspect-[4/3] overflow-hidden">
          <AnimatePresence mode="wait">
            {active === 0 && <TrackingSlide key="tracking" />}
            {active === 1 && <CalibrationSlide key="calibration" />}
            {active === 2 && <DataTransferSlide key="analysis" />}
          </AnimatePresence>
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
          <div className="text-xs font-bold font-display text-foreground">3 Kameras</div>
          <div className="text-[10px] text-muted-foreground">Synchronisiert</div>
        </div>
      </motion.div>

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

/* ─── Slide 1: Live Tracking — Football field with cameras ─── */
function TrackingSlide() {
  const grid = generateMockHeatmap();
  const maxVal = Math.max(...grid.flat(), 0.01);

  return (
    <motion.div
      className="absolute inset-0 p-4 flex flex-col"
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -60 }}
      transition={{ duration: 0.4 }}
    >
      {/* Football field with heatmap */}
      <div className="flex-1 relative rounded-xl overflow-hidden bg-[hsl(var(--primary)/0.05)] border border-border/30">
        {/* Green pitch background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(140,40%,28%)] to-[hsl(140,35%,22%)]" />

        {/* Field lines */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 105 68" preserveAspectRatio="xMidYMid meet">
          <rect x="2" y="2" width="101" height="64" fill="none" stroke="white" strokeWidth="0.4" opacity="0.5" />
          <line x1="52.5" y1="2" x2="52.5" y2="66" stroke="white" strokeWidth="0.3" opacity="0.4" />
          <circle cx="52.5" cy="34" r="9.15" fill="none" stroke="white" strokeWidth="0.3" opacity="0.4" />
          <circle cx="52.5" cy="34" r="0.5" fill="white" opacity="0.5" />
          <rect x="2" y="13.84" width="16.5" height="40.32" fill="none" stroke="white" strokeWidth="0.3" opacity="0.35" />
          <rect x="86.5" y="13.84" width="16.5" height="40.32" fill="none" stroke="white" strokeWidth="0.3" opacity="0.35" />
          <rect x="2" y="24.84" width="5.5" height="18.32" fill="none" stroke="white" strokeWidth="0.25" opacity="0.3" />
          <rect x="97" y="24.84" width="5.5" height="18.32" fill="none" stroke="white" strokeWidth="0.25" opacity="0.3" />
          {/* Corner arcs */}
          <path d="M2,5 A3,3 0 0,1 5,2" fill="none" stroke="white" strokeWidth="0.25" opacity="0.3" />
          <path d="M100,2 A3,3 0 0,1 103,5" fill="none" stroke="white" strokeWidth="0.25" opacity="0.3" />
          <path d="M103,63 A3,3 0 0,1 100,66" fill="none" stroke="white" strokeWidth="0.25" opacity="0.3" />
          <path d="M5,66 A3,3 0 0,1 2,63" fill="none" stroke="white" strokeWidth="0.25" opacity="0.3" />
        </svg>

        {/* Heatmap overlay */}
        <div className="absolute inset-2 grid gap-px" style={{ gridTemplateColumns: `repeat(${HEATMAP_COLS}, 1fr)`, gridTemplateRows: `repeat(${HEATMAP_ROWS}, 1fr)` }}>
          {grid.flat().map((val, i) => {
            const norm = val / maxVal;
            const hue = norm > 0.7 ? 0 : norm > 0.4 ? 40 : norm > 0.2 ? 120 : 200;
            const alpha = Math.max(norm * 0.55, 0.01);
            return (
              <motion.div
                key={i}
                className="rounded-[2px]"
                style={{ backgroundColor: `hsla(${hue}, 85%, 50%, ${alpha})` }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + i * 0.002, duration: 0.3 }}
              />
            );
          })}
        </div>

        {/* Player dots */}
        {mockPlayers.map((p, i) => (
          <motion.div
            key={i}
            className="absolute w-3 h-3 rounded-full border border-white/60 flex items-center justify-center"
            style={{ left: `${p.x}%`, top: `${p.y}%`, backgroundColor: p.team === "home" ? "hsl(var(--primary))" : "hsl(var(--destructive))" }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5 + i * 0.05, type: "spring" }}
          >
            <span className="text-[5px] font-bold text-white">{p.num}</span>
          </motion.div>
        ))}

        {/* Camera icons on sideline */}
        {[15, 50, 85].map((pos, i) => (
          <motion.div
            key={i}
            className="absolute -bottom-0 flex flex-col items-center"
            style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 + i * 0.2 }}
          >
            <div className="relative">
              <Smartphone className="w-4 h-4 text-white/80" />
              {/* Tracking cone */}
              <motion.div
                className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0"
                style={{
                  borderLeft: "12px solid transparent",
                  borderRight: "12px solid transparent",
                  borderBottom: "20px solid hsla(var(--primary), 0.15)",
                }}
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Legend bar */}
      <div className="flex items-center justify-between mt-2 px-1">
        <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span>Heim</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-destructive" />
            <span>Gast</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[9px] text-primary font-medium">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          LIVE · 67:32
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Slide 2: Calibration ─── */
function CalibrationSlide() {
  return (
    <motion.div
      className="absolute inset-0 p-4 flex flex-col gap-3"
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -60 }}
      transition={{ duration: 0.4 }}
    >
      <div className="text-[11px] font-semibold font-display text-foreground/80">Spielfeld kalibrieren</div>

      {/* Phone mockup with field overlay */}
      <div className="flex-1 flex items-center justify-center gap-4">
        <div className="relative w-36 h-52 rounded-2xl border-2 border-border bg-muted/30 overflow-hidden flex flex-col">
          {/* Phone screen */}
          <div className="flex-1 relative bg-gradient-to-b from-[hsl(140,30%,30%)] to-[hsl(140,25%,22%)] m-1.5 rounded-lg overflow-hidden">
            {/* Field with corner markers */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid meet">
              <rect x="10" y="15" width="80" height="110" fill="none" stroke="white" strokeWidth="0.8" opacity="0.4" />
              {/* Corner dots with pulse */}
              {[[10, 15], [90, 15], [90, 125], [10, 125]].map(([cx, cy], i) => (
                <g key={i}>
                  <circle cx={cx} cy={cy} r="4" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.8">
                    <animate attributeName="r" values="3;6;3" dur="2s" repeatCount="indefinite" begin={`${i * 0.3}s`} />
                    <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite" begin={`${i * 0.3}s`} />
                  </circle>
                  <circle cx={cx} cy={cy} r="2" fill="hsl(var(--primary))" />
                </g>
              ))}
              {/* Dashed guides */}
              <line x1="10" y1="15" x2="90" y2="125" stroke="hsl(var(--primary))" strokeWidth="0.3" strokeDasharray="3,3" opacity="0.4" />
              <line x1="90" y1="15" x2="10" y2="125" stroke="hsl(var(--primary))" strokeWidth="0.3" strokeDasharray="3,3" opacity="0.4" />
            </svg>
          </div>
          {/* Home bar */}
          <div className="h-3 flex justify-center items-center">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-3 max-w-[140px]">
          {[
            { step: "1", text: "Eckpunkt oben-links antippen", done: true },
            { step: "2", text: "Eckpunkt oben-rechts antippen", done: true },
            { step: "3", text: "Eckpunkt unten-rechts antippen", done: false },
            { step: "4", text: "Eckpunkt unten-links antippen", done: false },
          ].map((item, i) => (
            <motion.div
              key={i}
              className="flex items-start gap-2"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.15 }}
            >
              <div className={`w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                item.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {item.done ? "✓" : item.step}
              </div>
              <span className={`text-[10px] leading-tight ${item.done ? "text-foreground" : "text-muted-foreground"}`}>{item.text}</span>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="text-[9px] text-muted-foreground text-center">4-Punkt-Homographie · Automatische Perspektivkorrektur</div>
    </motion.div>
  );
}

/* ─── Slide 3: Data Transfer ─── */
function DataTransferSlide() {
  return (
    <motion.div
      className="absolute inset-0 p-4 flex flex-col gap-3"
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -60 }}
      transition={{ duration: 0.4 }}
    >
      <div className="text-[11px] font-semibold font-display text-foreground/80">Daten synchronisieren</div>

      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-3">
          {/* 3 Phones sending data */}
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((cam) => (
              <motion.div
                key={cam}
                className="flex items-center gap-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + cam * 0.15 }}
              >
                <div className="w-10 h-16 rounded-lg border border-border bg-muted/30 flex flex-col items-center justify-center gap-1">
                  <Smartphone className="w-4 h-4 text-primary" />
                  <span className="text-[7px] text-muted-foreground">Cam {cam}</span>
                </div>
                {/* Data stream */}
                <div className="flex items-center gap-0.5">
                  {[0, 1, 2].map((dot) => (
                    <motion.div
                      key={dot}
                      className="w-1 h-1 rounded-full bg-primary"
                      animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: dot * 0.2 + cam * 0.1 }}
                    />
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Central cloud/server */}
          <motion.div
            className="w-24 h-24 rounded-xl border-2 border-primary/30 bg-primary/5 flex flex-col items-center justify-center gap-2"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.8, type: "spring" }}
          >
            <Wifi className="w-6 h-6 text-primary" />
            <span className="text-[9px] font-semibold text-primary font-display">FieldIQ Cloud</span>
            <motion.div
              className="text-[8px] text-muted-foreground"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Verarbeitung...
            </motion.div>
          </motion.div>

          {/* Output arrow */}
          <div className="flex items-center gap-0.5">
            {[0, 1, 2].map((dot) => (
              <motion.div
                key={dot}
                className="w-1 h-1 rounded-full bg-primary"
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1, repeat: Infinity, delay: dot * 0.2 }}
              />
            ))}
          </div>

          {/* Dashboard result */}
          <motion.div
            className="w-20 h-24 rounded-lg border border-border bg-card/80 p-2 flex flex-col gap-1.5"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.2 }}
          >
            <BarChart3 className="w-4 h-4 text-primary" />
            <div className="space-y-1">
              {[70, 50, 85, 40].map((w, i) => (
                <motion.div
                  key={i}
                  className="h-1 rounded-full bg-primary/40"
                  initial={{ width: 0 }}
                  animate={{ width: `${w}%` }}
                  transition={{ delay: 1.5 + i * 0.1, duration: 0.5 }}
                />
              ))}
            </div>
            <span className="text-[7px] text-muted-foreground mt-auto">Report</span>
          </motion.div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 text-[9px] text-muted-foreground">
        <span>🔒 Ende-zu-Ende verschlüsselt</span>
        <span>⚡ ~30 Sek. Verarbeitungszeit</span>
      </div>
    </motion.div>
  );
}

/* ─── Mock Data ─── */
const mockPlayers = [
  // Home team (positions as % of field)
  { x: 8, y: 48, num: 1, team: "home" },
  { x: 22, y: 25, num: 2, team: "home" },
  { x: 20, y: 42, num: 4, team: "home" },
  { x: 20, y: 58, num: 5, team: "home" },
  { x: 22, y: 75, num: 3, team: "home" },
  { x: 38, y: 35, num: 6, team: "home" },
  { x: 36, y: 62, num: 8, team: "home" },
  { x: 48, y: 20, num: 7, team: "home" },
  { x: 48, y: 48, num: 10, team: "home" },
  { x: 48, y: 78, num: 11, team: "home" },
  { x: 55, y: 48, num: 9, team: "home" },
  // Away team
  { x: 92, y: 48, num: 1, team: "away" },
  { x: 78, y: 28, num: 2, team: "away" },
  { x: 80, y: 48, num: 4, team: "away" },
  { x: 78, y: 68, num: 3, team: "away" },
  { x: 68, y: 38, num: 6, team: "away" },
  { x: 68, y: 58, num: 8, team: "away" },
  { x: 60, y: 48, num: 9, team: "away" },
];

function generateMockHeatmap(): number[][] {
  const grid: number[][] = [];
  const hotspots = [
    { cx: 8, cy: 6, strength: 1.0, radius: 4 },
    { cx: 10, cy: 7, strength: 0.9, radius: 3.5 },
    { cx: 12, cy: 5, strength: 0.7, radius: 3 },
    { cx: 7, cy: 9, strength: 0.6, radius: 3 },
    { cx: 14, cy: 7, strength: 0.5, radius: 2.5 },
  ];
  for (let r = 0; r < HEATMAP_ROWS; r++) {
    const row: number[] = [];
    for (let c = 0; c < HEATMAP_COLS; c++) {
      let val = 0;
      for (const hs of hotspots) {
        const dist = Math.sqrt((c - hs.cx) ** 2 + (r - hs.cy) ** 2);
        if (dist < hs.radius * 2) {
          val += hs.strength * Math.exp(-(dist * dist) / (2 * (hs.radius * 0.8) ** 2));
        }
      }
      val += Math.random() * 0.03;
      row.push(Math.min(val, 1));
    }
    grid.push(row);
  }
  return grid;
}
