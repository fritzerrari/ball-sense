import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smartphone, Wifi, BarChart3, ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { HEATMAP_COLS, HEATMAP_ROWS } from "@/lib/constants";

const slides = [
  { id: "tracking", label: "Live Tracking" },
  { id: "calibration", label: "Kalibrierung" },
  { id: "analysis", label: "Coach Report" },
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

        <div className="relative aspect-[4/3] md:aspect-[4/3] overflow-hidden">
          <AnimatePresence mode="wait">
            {active === 0 && <TrackingSlide key="tracking" />}
            {active === 1 && <CalibrationSlide key="calibration" />}
            {active === 2 && <DataTransferSlide key="analysis" />}
          </AnimatePresence>
        </div>
      </div>

      {/* Floating badge */}
      <motion.div
        className="absolute -bottom-4 -left-4 rounded-xl border border-border bg-card shadow-lg px-3 py-2 md:px-4 md:py-2.5 flex items-center gap-2 hidden sm:flex"
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 1.8, duration: 0.5, ease: "backOut" }}
      >
        <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-primary/15 flex items-center justify-center">
          <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-primary animate-pulse" />
        </div>
        <div>
          <div className="text-[10px] md:text-xs font-bold font-display text-foreground">3 Kameras</div>
          <div className="text-[9px] md:text-[10px] text-muted-foreground">Synchronisiert</div>
        </div>
      </motion.div>

      <motion.div
        className="absolute -top-3 -right-3 rounded-lg border border-primary/30 bg-card shadow-lg px-2.5 py-1 md:px-3 md:py-1.5 hidden sm:block"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 2, duration: 0.4, ease: "backOut" }}
      >
        <div className="text-xs md:text-sm font-bold font-display text-primary">95.2%</div>
        <div className="text-[8px] md:text-[9px] text-muted-foreground">Accuracy</div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Slide 1: Live Tracking — Enhanced visuals ─── */
function TrackingSlide() {
  const grid = generateMockHeatmap();
  const maxVal = Math.max(...grid.flat(), 0.01);
  const cw = 105 / HEATMAP_COLS;
  const ch = 68 / HEATMAP_ROWS;

  const heatSpots: { x: number; y: number; intensity: number }[] = [];
  grid.forEach((row, rowIdx) => {
    row.forEach((val, colIdx) => {
      if (val > maxVal * 0.05) {
        heatSpots.push({ x: colIdx * cw + cw / 2, y: rowIdx * ch + ch / 2, intensity: val / maxVal });
      }
    });
  });

  return (
    <motion.div
      className="absolute inset-0 p-4 flex flex-col"
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -60 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex-1 relative rounded-xl overflow-hidden border border-border/30">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 105 68" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="sliderGrassBase" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(160, 45%, 38%)" />
              <stop offset="50%" stopColor="hsl(155, 42%, 35%)" />
              <stop offset="100%" stopColor="hsl(150, 40%, 32%)" />
            </linearGradient>
            <pattern id="sliderGrassStripes" patternUnits="userSpaceOnUse" width="10" height="68">
              <rect x="0" y="0" width="5" height="68" fill="hsl(158, 44%, 36%)" />
              <rect x="5" y="0" width="5" height="68" fill="hsl(155, 40%, 34%)" />
            </pattern>
            <radialGradient id="sHeatLow"><stop offset="0%" stopColor="hsl(160,60%,48%)" stopOpacity="0.5" /><stop offset="60%" stopColor="hsl(160,50%,42%)" stopOpacity="0.2" /><stop offset="100%" stopColor="transparent" /></radialGradient>
            <radialGradient id="sHeatMedLow"><stop offset="0%" stopColor="hsl(120,55%,48%)" stopOpacity="0.65" /><stop offset="50%" stopColor="hsl(140,50%,42%)" stopOpacity="0.3" /><stop offset="100%" stopColor="transparent" /></radialGradient>
            <radialGradient id="sHeatMed"><stop offset="0%" stopColor="hsl(55,85%,52%)" stopOpacity="0.8" /><stop offset="40%" stopColor="hsl(70,70%,48%)" stopOpacity="0.4" /><stop offset="100%" stopColor="transparent" /></radialGradient>
            <radialGradient id="sHeatHigh"><stop offset="0%" stopColor="hsl(25,90%,52%)" stopOpacity="0.85" /><stop offset="35%" stopColor="hsl(40,80%,48%)" stopOpacity="0.45" /><stop offset="100%" stopColor="transparent" /></radialGradient>
            <radialGradient id="sHeatMax"><stop offset="0%" stopColor="hsl(0,85%,50%)" stopOpacity="0.95" /><stop offset="25%" stopColor="hsl(10,90%,48%)" stopOpacity="0.7" /><stop offset="55%" stopColor="hsl(25,80%,45%)" stopOpacity="0.3" /><stop offset="100%" stopColor="transparent" /></radialGradient>
            <filter id="sHeatBlur1" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur in="SourceGraphic" stdDeviation="4" /></filter>
            <filter id="sHeatBlur2" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur in="SourceGraphic" stdDeviation="2" /></filter>
          </defs>

          <rect x="0" y="0" width="105" height="68" fill="url(#sliderGrassBase)" />
          <rect x="0" y="0" width="105" height="68" fill="url(#sliderGrassStripes)" opacity="0.25" />

          <g filter="url(#sHeatBlur1)" opacity="0.5">
            {heatSpots.filter(s => s.intensity > 0.15).map((spot, i) => {
              const gid = spot.intensity > 0.8 ? "sHeatMax" : spot.intensity > 0.6 ? "sHeatHigh" : spot.intensity > 0.4 ? "sHeatMed" : spot.intensity > 0.2 ? "sHeatMedLow" : "sHeatLow";
              const r = 5 + spot.intensity * 10;
              return <ellipse key={`b${i}`} cx={spot.x} cy={spot.y} rx={r * 1.3} ry={r} fill={`url(#${gid})`} />;
            })}
          </g>
          <g filter="url(#sHeatBlur2)" opacity="0.75">
            {heatSpots.map((spot, i) => {
              const gid = spot.intensity > 0.8 ? "sHeatMax" : spot.intensity > 0.6 ? "sHeatHigh" : spot.intensity > 0.4 ? "sHeatMed" : spot.intensity > 0.2 ? "sHeatMedLow" : "sHeatLow";
              const r = 3 + spot.intensity * 7;
              return <ellipse key={`d${i}`} cx={spot.x} cy={spot.y} rx={r} ry={r * 0.85} fill={`url(#${gid})`} opacity={0.5 + spot.intensity * 0.5} />;
            })}
          </g>

          {/* Field lines */}
          <g stroke="white" strokeOpacity="0.4" fill="none">
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
          </g>
        </svg>

        {/* Enhanced player dots — larger with team colors */}
        {mockPlayers.map((p, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border-2 border-white/80 flex items-center justify-center shadow-lg"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.team === "home" ? "20px" : "18px",
              height: p.team === "home" ? "20px" : "18px",
              backgroundColor: p.team === "home" ? "hsl(185, 80%, 45%)" : "hsl(0, 75%, 55%)",
              transform: "translate(-50%, -50%)",
            }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3 + i * 0.03, type: "spring" }}
          >
            <span className="text-[7px] font-bold text-white drop-shadow-sm">{p.num}</span>
          </motion.div>
        ))}

        {/* Camera positions with labels */}
        {[
          { pos: 15, label: "Cam 1" },
          { pos: 50, label: "Cam 2" },
          { pos: 85, label: "Cam 3" },
        ].map((cam, i) => (
          <motion.div
            key={i}
            className="absolute -bottom-0 flex flex-col items-center gap-0.5"
            style={{ left: `${cam.pos}%`, transform: "translateX(-50%)" }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 + i * 0.15 }}
          >
            <motion.div
              className="w-0 h-0 opacity-30"
              style={{
                borderLeft: "14px solid transparent",
                borderRight: "14px solid transparent",
                borderBottom: "24px solid hsl(185, 80%, 45%)",
              }}
              animate={{ opacity: [0.15, 0.35, 0.15] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
            />
            <div className="flex flex-col items-center">
              <Smartphone className="w-4 h-4 text-white/90" />
              <span className="text-[7px] text-white/60 font-medium">{cam.label}</span>
            </div>
          </motion.div>
        ))}

        {/* Prominent LIVE badge */}
        <motion.div
          className="absolute top-2 right-2 flex items-center gap-1.5 bg-primary rounded-full px-3 py-1 shadow-lg"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.2, type: "spring" }}
        >
          <div className="relative">
            <div className="w-2.5 h-2.5 rounded-full bg-white" />
            <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-white animate-ping opacity-50" />
          </div>
          <span className="text-[10px] font-bold text-primary-foreground tracking-wider">LIVE</span>
        </motion.div>
      </div>

      {/* Legend bar */}
      <div className="flex items-center justify-between mt-2 px-1">
        <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "hsl(185, 80%, 45%)" }} />
            <span>Heim</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "hsl(0, 75%, 55%)" }} />
            <span>Gast</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
          <span className="font-mono">67:32</span>
          <span>· 22 Spieler</span>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Slide 2: Calibration — Enhanced phone mockup ─── */
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

      <div className="flex-1 flex items-center justify-center gap-4">
        {/* Modern phone mockup with Dynamic Island */}
        <div className="relative w-36 h-52 rounded-[20px] border-2 border-foreground/20 bg-foreground/5 overflow-hidden flex flex-col shadow-xl">
          {/* Dynamic Island */}
          <div className="flex justify-center pt-1.5">
            <div className="w-14 h-3 rounded-full bg-foreground/80" />
          </div>

          {/* Phone screen */}
          <div className="flex-1 relative bg-gradient-to-b from-[hsl(140,30%,30%)] to-[hsl(140,25%,22%)] mx-1.5 mb-1.5 mt-1 rounded-lg overflow-hidden">
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid meet">
              <rect x="10" y="15" width="80" height="110" fill="none" stroke="white" strokeWidth="0.8" opacity="0.4" />

              {/* Corner dots with enhanced pulse */}
              {[[10, 15], [90, 15], [90, 125], [10, 125]].map(([cx, cy], i) => {
                const done = i < 2;
                return (
                  <g key={i}>
                    {done ? (
                      <>
                        <circle cx={cx} cy={cy} r="5" fill="hsl(160, 84%, 39%)" opacity="0.25" />
                        <circle cx={cx} cy={cy} r="3" fill="hsl(160, 84%, 39%)" />
                        <text x={cx} y={(cy as number) + 1.5} textAnchor="middle" fill="white" fontSize="3.5" fontWeight="bold">✓</text>
                      </>
                    ) : (
                      <>
                        <circle cx={cx} cy={cy} r="4" fill="none" stroke="hsl(40, 90%, 60%)" strokeWidth="0.8" opacity="0.8">
                          <animate attributeName="r" values="3;7;3" dur="1.5s" repeatCount="indefinite" begin={`${i * 0.3}s`} />
                          <animate attributeName="opacity" values="0.8;0.15;0.8" dur="1.5s" repeatCount="indefinite" begin={`${i * 0.3}s`} />
                        </circle>
                        <circle cx={cx} cy={cy} r="2" fill="hsl(40, 90%, 60%)" />
                      </>
                    )}
                  </g>
                );
              })}

              {/* Animated connection line between completed points */}
              <line x1="10" y1="15" x2="90" y2="15" stroke="hsl(160, 84%, 39%)" strokeWidth="0.6" opacity="0.5" strokeDasharray="2,2">
                <animate attributeName="stroke-dashoffset" values="0;4" dur="1s" repeatCount="indefinite" />
              </line>

              {/* Animated guide line to next point */}
              <line x1="90" y1="15" x2="90" y2="125" stroke="hsl(40, 90%, 60%)" strokeWidth="0.4" strokeDasharray="3,3" opacity="0.4">
                <animate attributeName="stroke-dashoffset" values="6;0" dur="1.5s" repeatCount="indefinite" />
              </line>
            </svg>
          </div>

          {/* Home bar */}
          <div className="h-3 flex justify-center items-center">
            <div className="w-10 h-1 rounded-full bg-foreground/15" />
          </div>
        </div>

        {/* Instructions with progress bar */}
        <div className="space-y-2 max-w-[140px]">
          {/* Progress indicator */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: "0%" }}
                animate={{ width: "50%" }}
                transition={{ delay: 0.5, duration: 0.8 }}
              />
            </div>
            <span className="text-[10px] text-primary font-semibold">2/4</span>
          </div>

          {[
            { step: "1", text: "Eckpunkt oben-links antippen", done: true },
            { step: "2", text: "Eckpunkt oben-rechts antippen", done: true },
            { step: "3", text: "Eckpunkt unten-rechts antippen", done: false, active: true },
            { step: "4", text: "Eckpunkt unten-links antippen", done: false },
          ].map((item, i) => (
            <motion.div
              key={i}
              className={`flex items-start gap-2 ${item.active ? "bg-primary/5 rounded-md px-1 py-0.5 -mx-1" : ""}`}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.15 }}
            >
              <div className={`w-4.5 h-4.5 rounded-full text-[8px] font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                item.done ? "bg-primary text-primary-foreground" : item.active ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"
              }`}>
                {item.done ? "✓" : item.step}
              </div>
              <span className={`text-[10px] leading-tight ${item.done ? "text-foreground" : item.active ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {item.text}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="text-[9px] text-muted-foreground text-center">4-Punkt-Homographie · Automatische Perspektivkorrektur</div>
    </motion.div>
  );
}

/* ─── Slide 3: Coach Report Preview — Enhanced ─── */
function DataTransferSlide() {
  const grades = [
    { label: "Spielkontrolle", grade: "B+", color: "text-primary" },
    { label: "Pressing", grade: "A-", color: "text-primary" },
    { label: "Defensive", grade: "B", color: "text-primary" },
    { label: "Chancenverwertung", grade: "C+", color: "text-amber-500" },
  ];

  return (
    <motion.div
      className="absolute inset-0 p-4 flex flex-col gap-2"
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -60 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold font-display text-foreground/80">Coach Report</div>
        <div className="flex items-center gap-1 text-[9px] text-primary font-medium">
          <BarChart3 className="w-3 h-3" />
          <span>KI-Analyse</span>
        </div>
      </div>

      {/* Match score header */}
      <motion.div
        className="flex items-center justify-center gap-4 py-2 rounded-lg bg-muted/30 border border-border/30"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="text-center">
          <div className="text-[9px] text-muted-foreground">Heim</div>
          <div className="text-lg font-bold font-display text-foreground">2</div>
        </div>
        <div className="text-xs text-muted-foreground">:</div>
        <div className="text-center">
          <div className="text-[9px] text-muted-foreground">Gast</div>
          <div className="text-lg font-bold font-display text-foreground">1</div>
        </div>
      </motion.div>

      {/* Tactical grades */}
      <div className="grid grid-cols-2 gap-1.5 flex-1">
        {grades.map((g, i) => (
          <motion.div
            key={g.label}
            className="rounded-lg border border-border/30 bg-card/60 p-2 flex flex-col items-center justify-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 + i * 0.1 }}
          >
            <div className={`text-lg font-bold font-display ${g.color}`}>{g.grade}</div>
            <div className="text-[8px] text-muted-foreground text-center leading-tight">{g.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Momentum mini chart */}
      <motion.div
        className="rounded-lg border border-border/30 bg-card/60 p-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        <div className="text-[8px] text-muted-foreground mb-1">Momentum</div>
        <div className="flex items-end gap-[2px] h-6">
          {[40, 55, 70, 60, 80, 65, 50, 75, 85, 60, 45, 70].map((h, i) => (
            <motion.div
              key={i}
              className="flex-1 rounded-sm bg-primary/50"
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{ delay: 1 + i * 0.05, duration: 0.3 }}
            />
          ))}
        </div>
      </motion.div>

      {/* Training recommendation teaser */}
      <motion.div
        className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/15 px-2 py-1.5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        <Zap className="h-3 w-3 text-primary shrink-0" />
        <span className="text-[9px] text-foreground leading-tight">
          <strong>Training:</strong> Linke Seite unter Druck stabilisieren
        </span>
      </motion.div>

      <div className="flex items-center justify-center gap-4 text-[9px] text-muted-foreground">
        <span>📊 4 Kategorien bewertet</span>
        <span>⚡ in 2 Min erstellt</span>
      </div>
    </motion.div>
  );
}

/* ─── Mock Data ─── */
const mockPlayers = [
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
  { x: 92, y: 48, num: 1, team: "away" },
  { x: 78, y: 20, num: 2, team: "away" },
  { x: 80, y: 38, num: 4, team: "away" },
  { x: 80, y: 58, num: 5, team: "away" },
  { x: 78, y: 76, num: 3, team: "away" },
  { x: 68, y: 30, num: 6, team: "away" },
  { x: 66, y: 48, num: 8, team: "away" },
  { x: 68, y: 66, num: 14, team: "away" },
  { x: 56, y: 22, num: 7, team: "away" },
  { x: 58, y: 48, num: 9, team: "away" },
  { x: 56, y: 74, num: 11, team: "away" },
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
