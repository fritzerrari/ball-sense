import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, RotateCcw, AlertTriangle, TrendingUp, Zap, Route, Users, Activity, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { HEATMAP_COLS, HEATMAP_ROWS } from "@/lib/constants";

type DemoState = "empty" | "loading" | "loaded";

interface DemoData {
  players: DemoPlayer[];
  teamStats: { possession: number; totalKm: number; avgSpeed: number; topSpeed: number; sprints: number; passes: number; passAccuracy: number };
  heatmapGrid: number[][];
  matchEvents: string[];
  apiStats: { xG: number; xGA: number; ppda: number; fieldTilt: number };
}

interface DemoPlayer {
  name: string;
  num: number;
  pos: string;
  km: number;
  topSpeed: number;
  sprints: number;
  avgSpeed: number;
}

export function DemoSection() {
  const [state, setState] = useState<DemoState>("empty");
  const [progress, setProgress] = useState(0);
  const [data, setData] = useState<DemoData | null>(null);

  const loadDemo = useCallback(() => {
    setState("loading");
    setProgress(0);

    const steps = [10, 25, 40, 55, 70, 82, 91, 97, 100];
    let i = 0;
    const interval = setInterval(() => {
      if (i < steps.length) {
        setProgress(steps[i]);
        i++;
      } else {
        clearInterval(interval);
        setData(generateDemoData());
        setState("loaded");
      }
    }, 250);
  }, []);

  const reset = useCallback(() => {
    setState("empty");
    setData(null);
    setProgress(0);
  }, []);

  return (
    <section id="demo" className="py-24 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 field-grid opacity-[0.03]" />
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-xs font-semibold text-primary font-display tracking-wider uppercase mb-3 block">Live Demo</span>
          <h2 className="text-3xl md:text-4xl font-bold font-display mb-3">Teste es selbst — ohne Anmeldung</h2>
          <p className="text-muted-foreground max-w-lg mx-auto text-sm">
            Lade zufällige Testdaten und erlebe, wie FieldIQ ein komplettes Spiel analysiert.
          </p>
        </motion.div>

        <div className="max-w-5xl mx-auto">
          <AnimatePresence mode="wait">
            {state === "empty" && <EmptyState key="empty" onLoad={loadDemo} />}
            {state === "loading" && <LoadingState key="loading" progress={progress} />}
            {state === "loaded" && data && <LoadedState key="loaded" data={data} onReset={reset} onReload={loadDemo} />}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

/* ─── Empty State: Skeleton charts + CTA ─── */
function EmptyState({ onLoad }: { onLoad: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Skeleton dashboard */}
      <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-6 space-y-6">
        {/* Top stat cards - empty */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {["Laufdistanz", "Ø Geschwindigkeit", "Sprints", "Topspeed"].map((label) => (
            <div key={label} className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-4 text-center">
              <div className="text-2xl font-bold font-display text-muted-foreground/30">—</div>
              <div className="text-[10px] text-muted-foreground mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Skeleton charts row */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Empty bar chart */}
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-4">
            <div className="text-xs text-muted-foreground/50 mb-3 font-display">Spieler-Distanzen</div>
            <div className="flex items-end gap-2 h-28">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex-1 rounded-t bg-muted/20 border border-dashed border-border/30" style={{ height: "100%" }} />
              ))}
            </div>
          </div>

          {/* Empty heatmap */}
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-4">
            <div className="text-xs text-muted-foreground/50 mb-3 font-display">Team-Heatmap</div>
            <div className="aspect-[105/68] bg-muted/10 rounded-lg border border-dashed border-border/30 flex items-center justify-center">
              <span className="text-xs text-muted-foreground/30">Keine Daten</span>
            </div>
          </div>
        </div>

        {/* Empty player table */}
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-4">
          <div className="text-xs text-muted-foreground/50 mb-3 font-display">Kader-Übersicht</div>
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 rounded bg-muted/15 border border-dashed border-border/20" />
            ))}
          </div>
        </div>
      </div>

      {/* CTA Button */}
      <div className="flex justify-center">
        <Button variant="hero" size="xl" onClick={onLoad} className="gap-2">
          <Play className="w-5 h-5" />
          Demo-Daten laden
        </Button>
      </div>
    </motion.div>
  );
}

/* ─── Loading State ─── */
function LoadingState({ progress }: { progress: number }) {
  const labels = [
    "Spieler-Positionen laden...",
    "Heatmaps berechnen...",
    "Laufwege analysieren...",
    "Sprint-Daten aggregieren...",
    "Report generieren...",
  ];
  const labelIdx = Math.min(Math.floor(progress / 22), labels.length - 1);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="rounded-2xl border border-primary/30 bg-card/80 backdrop-blur-sm p-8 text-center space-y-6"
    >
      <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Activity className="w-8 h-8 text-primary" />
        </motion.div>
      </div>

      <div>
        <h3 className="text-lg font-bold font-display mb-1">Testdaten werden generiert</h3>
        <p className="text-sm text-muted-foreground">{labels[labelIdx]}</p>
      </div>

      <div className="max-w-sm mx-auto space-y-2">
        <Progress value={progress} className="h-2" />
        <div className="text-xs text-muted-foreground">{progress}%</div>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-warning">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>Dies sind zufällig generierte Testdaten — keine echten Spielergebnisse.</span>
      </div>
    </motion.div>
  );
}

/* ─── Loaded State: Full dashboard ─── */
function LoadedState({ data, onReset, onReload }: { data: DemoData; onReset: () => void; onReload: () => void }) {
  const maxVal = Math.max(...data.heatmapGrid.flat(), 0.01);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-4"
    >
      {/* Test data banner */}
      <div className="rounded-lg bg-warning/10 border border-warning/30 px-4 py-2.5 flex items-center gap-3 text-sm">
        <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
        <span className="text-warning font-medium text-xs">Dies sind zufällig generierte Testdaten. Ergebnisse variieren bei jedem Laden.</span>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={onReload} className="text-xs h-7 gap-1">
            <RotateCcw className="w-3 h-3" />
            Neu laden
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-6 space-y-6">
        {/* Top stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Route, label: "Ø Distanz", value: `${data.teamStats.totalKm.toFixed(1)} km` },
            { icon: Zap, label: "Topspeed", value: `${data.teamStats.topSpeed.toFixed(1)} km/h` },
            { icon: TrendingUp, label: "Sprints", value: `${data.teamStats.sprints}` },
            { icon: Timer, label: "Ø Geschw.", value: `${data.teamStats.avgSpeed.toFixed(1)} km/h` },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              className="rounded-xl border border-border/60 bg-muted/30 p-4 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <stat.icon className="w-4 h-4 text-primary mx-auto mb-2" />
              <div className="text-xl font-bold font-display text-primary">{stat.value}</div>
              <div className="text-[10px] text-muted-foreground mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Player distance bars */}
          <div className="rounded-xl border border-border/50 bg-muted/10 p-4">
            <div className="text-xs font-semibold text-foreground/80 mb-3 font-display">Spieler-Distanzen (km)</div>
            <div className="space-y-2">
              {data.players.slice(0, 8).map((p, i) => (
                <motion.div
                  key={p.name}
                  className="flex items-center gap-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                >
                  <span className="text-[10px] text-muted-foreground w-20 truncate">#{p.num} {p.name}</span>
                  <div className="flex-1 h-3 rounded-full bg-muted/30 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${(p.km / 13) * 100}%` }}
                      transition={{ delay: 0.5 + i * 0.08, duration: 0.8 }}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-foreground w-8 text-right">{p.km.toFixed(1)}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Heatmap */}
          <div className="rounded-xl border border-border/50 bg-muted/10 p-4">
            <div className="text-xs font-semibold text-foreground/80 mb-3 font-display">Team-Heatmap</div>
            <div className="aspect-[105/68] relative rounded-lg overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-[hsl(140,40%,28%)] to-[hsl(140,35%,22%)]" />
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 105 68" preserveAspectRatio="none">
                <rect x="0" y="0" width="105" height="68" fill="none" stroke="white" strokeWidth="0.4" opacity="0.3" />
                <line x1="52.5" y1="0" x2="52.5" y2="68" stroke="white" strokeWidth="0.3" opacity="0.25" />
                <circle cx="52.5" cy="34" r="9.15" fill="none" stroke="white" strokeWidth="0.3" opacity="0.25" />
                <rect x="0" y="13.84" width="16.5" height="40.32" fill="none" stroke="white" strokeWidth="0.3" opacity="0.2" />
                <rect x="88.5" y="13.84" width="16.5" height="40.32" fill="none" stroke="white" strokeWidth="0.3" opacity="0.2" />
              </svg>
              <div className="absolute inset-1 grid gap-px" style={{ gridTemplateColumns: `repeat(${HEATMAP_COLS}, 1fr)`, gridTemplateRows: `repeat(${HEATMAP_ROWS}, 1fr)` }}>
                {data.heatmapGrid.flat().map((val, i) => {
                  const norm = val / maxVal;
                  const hue = norm > 0.7 ? 0 : norm > 0.4 ? 40 : norm > 0.2 ? 120 : 200;
                  const alpha = Math.max(norm * 0.65, 0.02);
                  return (
                    <motion.div
                      key={i}
                      className="rounded-[1px]"
                      style={{ backgroundColor: `hsla(${hue}, 85%, 50%, ${alpha})` }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 + i * 0.001, duration: 0.2 }}
                    />
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between mt-2 text-[9px] text-muted-foreground">
              <span>Wenig</span>
              <div className="flex gap-0.5">
                <div className="w-3 h-1.5 rounded-sm" style={{ backgroundColor: "hsla(200,80%,50%,0.5)" }} />
                <div className="w-3 h-1.5 rounded-sm" style={{ backgroundColor: "hsla(120,80%,50%,0.5)" }} />
                <div className="w-3 h-1.5 rounded-sm" style={{ backgroundColor: "hsla(40,80%,50%,0.5)" }} />
                <div className="w-3 h-1.5 rounded-sm" style={{ backgroundColor: "hsla(0,80%,50%,0.5)" }} />
              </div>
              <span>Viel</span>
            </div>
          </div>
        </div>

        {/* API-Stats (erfunden) */}
        <div className="rounded-xl border border-border/50 bg-muted/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="text-xs font-semibold text-foreground/80 font-display">Advanced Analytics</div>
            <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20 font-display">API</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "xG (Expected Goals)", value: data.apiStats.xG.toFixed(2) },
              { label: "xGA (Expected Goals Against)", value: data.apiStats.xGA.toFixed(2) },
              { label: "PPDA (Pressing)", value: data.apiStats.ppda.toFixed(1) },
              { label: "Field Tilt", value: `${data.apiStats.fieldTilt.toFixed(0)}%` },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                className="text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 + i * 0.1 }}
              >
                <div className="text-lg font-bold font-display text-primary">{stat.value}</div>
                <div className="text-[9px] text-muted-foreground mt-0.5">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Player table */}
        <div className="rounded-xl border border-border/50 bg-muted/10 p-4 overflow-x-auto">
          <div className="text-xs font-semibold text-foreground/80 mb-3 font-display">Kader-Übersicht</div>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-muted-foreground border-b border-border/30">
                <th className="text-left py-1.5 font-medium">#</th>
                <th className="text-left py-1.5 font-medium">Spieler</th>
                <th className="text-left py-1.5 font-medium">Pos</th>
                <th className="text-right py-1.5 font-medium">km</th>
                <th className="text-right py-1.5 font-medium">Top km/h</th>
                <th className="text-right py-1.5 font-medium">Sprints</th>
                <th className="text-right py-1.5 font-medium">Ø km/h</th>
              </tr>
            </thead>
            <tbody>
              {data.players.map((p, i) => (
                <motion.tr
                  key={p.name}
                  className="border-b border-border/10 hover:bg-muted/20 transition-colors"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 + i * 0.03 }}
                >
                  <td className="py-1.5 font-bold text-primary">{p.num}</td>
                  <td className="py-1.5 font-medium text-foreground">{p.name}</td>
                  <td className="py-1.5 text-muted-foreground">{p.pos}</td>
                  <td className="py-1.5 text-right font-medium">{p.km.toFixed(1)}</td>
                  <td className="py-1.5 text-right">{p.topSpeed.toFixed(1)}</td>
                  <td className="py-1.5 text-right">{p.sprints}</td>
                  <td className="py-1.5 text-right">{p.avgSpeed.toFixed(1)}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Random Data Generator ─── */
function generateDemoData(): DemoData {
  const r = (min: number, max: number) => min + Math.random() * (max - min);

  const names = [
    { name: "L. Müller", pos: "ST", num: 9 },
    { name: "T. Kroos", pos: "ZM", num: 8 },
    { name: "J. Kimmich", pos: "ZDM", num: 6 },
    { name: "S. Gnabry", pos: "RA", num: 7 },
    { name: "A. Vogt", pos: "ZOM", num: 10 },
    { name: "M. Berger", pos: "IV", num: 4 },
    { name: "F. Hauser", pos: "LV", num: 3 },
    { name: "N. Roth", pos: "RV", num: 2 },
    { name: "P. Schwarz", pos: "IV", num: 5 },
    { name: "D. Werner", pos: "LA", num: 11 },
    { name: "K. Fischer", pos: "TW", num: 1 },
  ];

  const players: DemoPlayer[] = names.map((n) => {
    const isGK = n.pos === "TW";
    const isST = n.pos === "ST" || n.pos === "RA" || n.pos === "LA";
    return {
      ...n,
      km: isGK ? r(5.5, 6.5) : isST ? r(9.5, 11.5) : r(10.0, 12.5),
      topSpeed: isGK ? r(22, 26) : r(28, 34),
      sprints: isGK ? Math.floor(r(5, 12)) : Math.floor(r(25, 55)),
      avgSpeed: isGK ? r(4, 5.5) : r(6.5, 8.5),
    };
  });

  players.sort((a, b) => b.km - a.km);

  const totalKm = players.reduce((s, p) => s + p.km, 0) / players.length;
  const topSpeed = Math.max(...players.map((p) => p.topSpeed));
  const sprints = players.reduce((s, p) => s + p.sprints, 0);

  // Generate team heatmap
  const hotspots = [
    { cx: r(6, 10), cy: r(5, 9), strength: r(0.7, 1), radius: r(3, 5) },
    { cx: r(10, 15), cy: r(4, 10), strength: r(0.6, 0.9), radius: r(2.5, 4) },
    { cx: r(4, 8), cy: r(3, 7), strength: r(0.4, 0.7), radius: r(2, 3.5) },
    { cx: r(12, 18), cy: r(5, 9), strength: r(0.3, 0.6), radius: r(2, 3) },
    { cx: r(3, 6), cy: r(6, 10), strength: r(0.3, 0.5), radius: r(2, 3) },
  ];

  const heatmapGrid: number[][] = [];
  for (let row = 0; row < HEATMAP_ROWS; row++) {
    const rowData: number[] = [];
    for (let col = 0; col < HEATMAP_COLS; col++) {
      let val = 0;
      for (const hs of hotspots) {
        const dist = Math.sqrt((col - hs.cx) ** 2 + (row - hs.cy) ** 2);
        if (dist < hs.radius * 2) {
          val += hs.strength * Math.exp(-(dist * dist) / (2 * (hs.radius * 0.8) ** 2));
        }
      }
      val += Math.random() * 0.04;
      rowData.push(Math.min(val, 1));
    }
    heatmapGrid.push(rowData);
  }

  return {
    players,
    teamStats: {
      possession: r(45, 62),
      totalKm,
      avgSpeed: r(6.8, 8.2),
      topSpeed,
      sprints,
      passes: Math.floor(r(380, 520)),
      passAccuracy: r(78, 92),
    },
    heatmapGrid,
    matchEvents: [],
    apiStats: {
      xG: r(0.8, 2.5),
      xGA: r(0.5, 2.0),
      ppda: r(7, 14),
      fieldTilt: r(40, 65),
    },
  };
}
