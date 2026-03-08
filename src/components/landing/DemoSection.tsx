import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, RotateCcw, AlertTriangle, TrendingUp, Zap, Route, Users, Activity, Timer,
  Bell, ChevronRight, ArrowUpRight, ArrowDownRight, Minus, Target, Shield, Footprints,
  BarChart3, Eye, Gauge
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HEATMAP_COLS, HEATMAP_ROWS } from "@/lib/constants";

type DemoState = "notification" | "loading" | "analyzing" | "dashboard";

interface DemoPlayer {
  name: string;
  num: number;
  pos: string;
  km: number;
  topSpeed: number;
  sprints: number;
  avgSpeed: number;
  passAccuracy: number;
  duelsWon: number;
  rating: number;
  heatmap: number[][];
  trend: "up" | "down" | "stable";
}

interface DemoData {
  players: DemoPlayer[];
  teamStats: {
    possession: number; totalKm: number; avgSpeed: number; topSpeed: number;
    sprints: number; passes: number; passAccuracy: number; shotsOnTarget: number;
    corners: number; fouls: number;
  };
  heatmapGrid: number[][];
  apiStats: { xG: number; xGA: number; ppda: number; fieldTilt: number; shotConversion: number; duelWinRate: number };
}

export function DemoSection() {
  const [state, setState] = useState<DemoState>("notification");
  const [progress, setProgress] = useState(0);
  const [data, setData] = useState<DemoData | null>(null);

  const startLoad = useCallback(() => {
    setState("loading");
    setProgress(0);
    const steps = [15, 30, 50, 70, 85, 100];
    let i = 0;
    const interval = setInterval(() => {
      if (i < steps.length) {
        setProgress(steps[i]);
        i++;
      } else {
        clearInterval(interval);
        setState("analyzing");
        setProgress(0);
        let j = 0;
        const analyzeSteps = [10, 25, 45, 60, 78, 90, 100];
        const analyzeInterval = setInterval(() => {
          if (j < analyzeSteps.length) {
            setProgress(analyzeSteps[j]);
            j++;
          } else {
            clearInterval(analyzeInterval);
            setData(generateDemoData());
            setState("dashboard");
          }
        }, 300);
      }
    }, 250);
  }, []);

  const reset = useCallback(() => {
    setState("notification");
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
          <span className="text-xs font-semibold text-primary font-display tracking-wider uppercase mb-3 block">Interaktive Demo</span>
          <h2 className="text-3xl md:text-4xl font-bold font-display mb-3">Erlebe FieldIQ — ohne Anmeldung</h2>
          <p className="text-muted-foreground max-w-lg mx-auto text-sm">
            So sieht es aus, wenn nach einem Spiel neue Tracking-Daten für dein Team bereitstehen.
          </p>
        </motion.div>

        <div className="max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            {state === "notification" && <NotificationState key="notif" onLoad={startLoad} />}
            {state === "loading" && <LoadingState key="load" progress={progress} phase="load" />}
            {state === "analyzing" && <LoadingState key="analyze" progress={progress} phase="analyze" />}
            {state === "dashboard" && data && <DashboardState key="dash" data={data} onReset={reset} onReload={() => { reset(); setTimeout(startLoad, 100); }} />}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

/* ─── Notification State ─── */
function NotificationState({ onLoad }: { onLoad: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-2xl mx-auto space-y-6"
    >
      {/* Empty dashboard skeleton */}
      <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-6 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-primary/40" />
          </div>
          <div>
            <div className="text-sm font-semibold font-display text-foreground/60">Mein Dashboard</div>
            <div className="text-[10px] text-muted-foreground">FC Musterstadt · Saison 2025/26</div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {["Distanz", "Topspeed", "Sprints", "Ballbesitz"].map((l) => (
            <div key={l} className="rounded-xl border border-dashed border-border/50 bg-muted/10 p-4 text-center">
              <div className="text-2xl font-bold font-display text-muted-foreground/20">—</div>
              <div className="text-[10px] text-muted-foreground/50 mt-1">{l}</div>
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-dashed border-border/50 bg-muted/10 p-4 h-32 flex items-center justify-center">
            <span className="text-xs text-muted-foreground/30">Keine Spieldaten vorhanden</span>
          </div>
          <div className="rounded-xl border border-dashed border-border/50 bg-muted/10 p-4 h-32 flex items-center justify-center">
            <span className="text-xs text-muted-foreground/30">Keine Heatmap verfügbar</span>
          </div>
        </div>
      </div>

      {/* Notification card */}
      <motion.div
        className="rounded-2xl border-2 border-primary/40 bg-primary/5 backdrop-blur-sm p-6 cursor-pointer hover:border-primary/60 transition-colors"
        onClick={onLoad}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
              <Bell className="w-6 h-6 text-primary" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive flex items-center justify-center">
              <span className="text-[8px] font-bold text-destructive-foreground">1</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold font-display text-foreground mb-1">
              🎉 Neue Spieldaten verfügbar!
            </div>
            <div className="text-xs text-muted-foreground mb-3">
              FC Musterstadt vs. SV Beispielburg · Sonntag, 2. März 2026 · 15:30 Uhr
            </div>
            <div className="text-xs text-muted-foreground/70 mb-4">
              3 Kameras haben 90 Minuten Tracking-Daten aufgezeichnet. Die Daten sind bereit zur Analyse.
            </div>
            <Button variant="hero" size="sm" className="gap-2" onClick={onLoad}>
              <Play className="w-4 h-4" />
              Daten laden & analysieren
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Loading / Analyzing State ─── */
function LoadingState({ progress, phase }: { progress: number; phase: "load" | "analyze" }) {
  const loadLabels = ["Kameradaten synchronisieren...", "Tracking-Punkte zusammenführen...", "Spielerpositionen extrahieren...", "Daten validieren..."];
  const analyzeLabels = ["Laufwege berechnen...", "Sprint-Analyse...", "Heatmaps generieren...", "Advanced Analytics...", "Dashboard aufbauen..."];
  const labels = phase === "load" ? loadLabels : analyzeLabels;
  const idx = Math.min(Math.floor(progress / (100 / labels.length)), labels.length - 1);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="max-w-lg mx-auto rounded-2xl border border-primary/30 bg-card/80 backdrop-blur-sm p-8 text-center space-y-5"
    >
      <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
          <Activity className="w-7 h-7 text-primary" />
        </motion.div>
      </div>
      <div>
        <h3 className="text-base font-bold font-display mb-1">
          {phase === "load" ? "Spieldaten werden geladen" : "Analyse läuft"}
        </h3>
        <p className="text-sm text-muted-foreground">{labels[idx]}</p>
      </div>
      <div className="max-w-xs mx-auto space-y-2">
        <Progress value={progress} className="h-2" />
        <div className="text-xs text-muted-foreground">{progress}%</div>
      </div>
      <div className="flex items-center justify-center gap-2 text-xs text-warning">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>Demo-Modus: Zufällig generierte Testdaten</span>
      </div>
    </motion.div>
  );
}

/* ─── Dashboard State ─── */
function DashboardState({ data, onReset, onReload }: { data: DemoData; onReset: () => void; onReload: () => void }) {
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const topPlayers = data.players.slice(0, 4);
  const maxHeatVal = Math.max(...data.heatmapGrid.flat(), 0.01);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-4"
    >
      {/* Banner */}
      <div className="rounded-lg bg-warning/10 border border-warning/30 px-4 py-2 flex items-center gap-3 text-xs">
        <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
        <span className="text-warning font-medium">Dies sind zufällig generierte Testdaten — keine echten Spielergebnisse.</span>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={onReload} className="text-xs h-7 gap-1">
            <RotateCcw className="w-3 h-3" /> Neu generieren
          </Button>
        </div>
      </div>

      {/* Match header */}
      <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-lg font-bold font-display">FC Musterstadt 2 : 1 SV Beispielburg</div>
            <div className="text-xs text-muted-foreground">Sonntag, 2. März 2026 · Sportplatz Am Wald · 90 Min.</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Ballbesitz</div>
            <div className="text-lg font-bold font-display text-primary">{data.teamStats.possession.toFixed(0)}%</div>
          </div>
        </div>

        {/* Top stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { icon: Route, label: "Ø Distanz", value: `${data.teamStats.totalKm.toFixed(1)} km`, sub: `${(data.teamStats.totalKm * 11).toFixed(0)} km gesamt` },
            { icon: Zap, label: "Topspeed", value: `${data.teamStats.topSpeed.toFixed(1)} km/h`, sub: topPlayers[0]?.name },
            { icon: Footprints, label: "Sprints", value: `${data.teamStats.sprints}`, sub: `Ø ${(data.teamStats.sprints / 11).toFixed(0)} pro Spieler` },
            { icon: Timer, label: "Ø Geschw.", value: `${data.teamStats.avgSpeed.toFixed(1)} km/h`, sub: "Team-Durchschnitt" },
            { icon: Target, label: "Passquote", value: `${data.teamStats.passAccuracy.toFixed(0)}%`, sub: `${data.teamStats.passes} Pässe` },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <stat.icon className="w-3.5 h-3.5 text-primary mx-auto mb-1.5" />
              <div className="text-base font-bold font-display text-primary">{stat.value}</div>
              <div className="text-[9px] text-muted-foreground mt-0.5">{stat.label}</div>
              <div className="text-[8px] text-muted-foreground/60 mt-0.5">{stat.sub}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Main content with tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted/30 border border-border/50">
          <TabsTrigger value="overview" className="text-xs gap-1"><BarChart3 className="w-3 h-3" /> Übersicht</TabsTrigger>
          <TabsTrigger value="players" className="text-xs gap-1"><Users className="w-3 h-3" /> Spieler</TabsTrigger>
          <TabsTrigger value="advanced" className="text-xs gap-1"><Gauge className="w-3 h-3" /> Advanced</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Distance chart */}
            <div className="rounded-xl border border-border/50 bg-card/50 p-4">
              <div className="text-xs font-semibold text-foreground/80 mb-3 font-display flex items-center justify-between">
                <span>Spieler-Distanzen (km)</span>
                <span className="text-[9px] text-muted-foreground font-normal">Top 11</span>
              </div>
              <div className="space-y-2">
                {data.players.slice(0, 11).map((p, i) => (
                  <motion.div
                    key={p.name}
                    className="flex items-center gap-2 cursor-pointer hover:bg-muted/20 rounded px-1 -mx-1 transition-colors"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.04 }}
                    onClick={() => setSelectedPlayer(i < 4 ? i : null)}
                  >
                    <span className="text-[10px] text-muted-foreground w-20 truncate">#{p.num} {p.name}</span>
                    <div className="flex-1 h-3 rounded-full bg-muted/30 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${(p.km / 13) * 100}%` }}
                        transition={{ delay: 0.4 + i * 0.06, duration: 0.8 }}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-foreground w-8 text-right">{p.km.toFixed(1)}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Team Heatmap */}
            <div className="rounded-xl border border-border/50 bg-card/50 p-4">
              <div className="text-xs font-semibold text-foreground/80 mb-3 font-display">Team-Heatmap</div>
              <HeatmapField grid={data.heatmapGrid} maxVal={maxHeatVal} />
              <div className="flex items-center justify-between mt-2 text-[9px] text-muted-foreground">
                <span>Wenig Aktivität</span>
                <div className="flex gap-0.5">
                  {["hsla(200,80%,50%,0.5)", "hsla(120,80%,50%,0.5)", "hsla(40,80%,50%,0.5)", "hsla(0,80%,50%,0.5)"].map((c, i) => (
                    <div key={i} className="w-4 h-1.5 rounded-sm" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <span>Viel Aktivität</span>
              </div>
            </div>
          </div>

          {/* Sprint & Speed comparison */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border/50 bg-card/50 p-4">
              <div className="text-xs font-semibold text-foreground/80 mb-3 font-display">Speed-Ranking</div>
              <div className="space-y-2">
                {[...data.players].sort((a, b) => b.topSpeed - a.topSpeed).slice(0, 5).map((p, i) => (
                  <motion.div key={p.name} className="flex items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.05 }}>
                    <span className="text-[10px] font-bold text-primary w-4">{i + 1}.</span>
                    <span className="text-[10px] text-foreground flex-1 truncate">{p.name}</span>
                    <span className="text-[10px] font-bold text-foreground">{p.topSpeed.toFixed(1)}</span>
                    <span className="text-[8px] text-muted-foreground">km/h</span>
                  </motion.div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-border/50 bg-card/50 p-4">
              <div className="text-xs font-semibold text-foreground/80 mb-3 font-display">Sprint-Ranking</div>
              <div className="space-y-2">
                {[...data.players].sort((a, b) => b.sprints - a.sprints).slice(0, 5).map((p, i) => (
                  <motion.div key={p.name} className="flex items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.05 }}>
                    <span className="text-[10px] font-bold text-primary w-4">{i + 1}.</span>
                    <span className="text-[10px] text-foreground flex-1 truncate">{p.name}</span>
                    <span className="text-[10px] font-bold text-foreground">{p.sprints}</span>
                    <span className="text-[8px] text-muted-foreground">Sprints</span>
                  </motion.div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-border/50 bg-card/50 p-4">
              <div className="text-xs font-semibold text-foreground/80 mb-3 font-display">Spielübersicht</div>
              <div className="space-y-2 text-[10px]">
                {[
                  { label: "Schüsse aufs Tor", value: data.teamStats.shotsOnTarget },
                  { label: "Ecken", value: data.teamStats.corners },
                  { label: "Fouls", value: data.teamStats.fouls },
                  { label: "Pässe gesamt", value: data.teamStats.passes },
                  { label: "Passquote", value: `${data.teamStats.passAccuracy.toFixed(0)}%` },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="font-bold text-foreground">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Players Tab */}
        <TabsContent value="players" className="space-y-4">
          {/* Player spotlight cards */}
          <div className="grid md:grid-cols-2 gap-4">
            {topPlayers.map((p, i) => {
              const playerMaxHeat = Math.max(...p.heatmap.flat(), 0.01);
              return (
                <motion.div
                  key={p.name}
                  className={`rounded-xl border bg-card/50 p-4 transition-all ${
                    selectedPlayer === i ? "border-primary shadow-lg shadow-primary/10" : "border-border/50"
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => setSelectedPlayer(selectedPlayer === i ? null : i)}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold font-display text-primary">{p.num}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold font-display text-foreground truncate">{p.name}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{p.pos}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">Bewertung:</span>
                        <span className={`text-xs font-bold ${p.rating >= 7.5 ? "text-primary" : p.rating >= 6.5 ? "text-foreground" : "text-warning"}`}>
                          {p.rating.toFixed(1)}
                        </span>
                        {p.trend === "up" && <ArrowUpRight className="w-3 h-3 text-primary" />}
                        {p.trend === "down" && <ArrowDownRight className="w-3 h-3 text-destructive" />}
                        {p.trend === "stable" && <Minus className="w-3 h-3 text-muted-foreground" />}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[
                      { label: "km", value: p.km.toFixed(1) },
                      { label: "Top km/h", value: p.topSpeed.toFixed(1) },
                      { label: "Sprints", value: p.sprints.toString() },
                      { label: "Passquote", value: `${p.passAccuracy}%` },
                    ].map((s) => (
                      <div key={s.label} className="text-center">
                        <div className="text-xs font-bold font-display text-foreground">{s.value}</div>
                        <div className="text-[8px] text-muted-foreground">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Individual heatmap */}
                  <div className="text-[9px] text-muted-foreground mb-1 font-display">Individuelle Heatmap</div>
                  <HeatmapField grid={p.heatmap} maxVal={playerMaxHeat} small />
                </motion.div>
              );
            })}
          </div>

          {/* Full roster table */}
          <div className="rounded-xl border border-border/50 bg-card/50 p-4 overflow-x-auto">
            <div className="text-xs font-semibold text-foreground/80 mb-3 font-display">Kompletter Kader</div>
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
                  <th className="text-right py-1.5 font-medium">Passquote</th>
                  <th className="text-right py-1.5 font-medium">Zweikämpfe</th>
                  <th className="text-right py-1.5 font-medium">Rating</th>
                </tr>
              </thead>
              <tbody>
                {data.players.map((p, i) => (
                  <motion.tr
                    key={p.name}
                    className="border-b border-border/10 hover:bg-muted/20 transition-colors"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 + i * 0.03 }}
                  >
                    <td className="py-1.5 font-bold text-primary">{p.num}</td>
                    <td className="py-1.5 font-medium text-foreground">{p.name}</td>
                    <td className="py-1.5 text-muted-foreground">{p.pos}</td>
                    <td className="py-1.5 text-right font-medium">{p.km.toFixed(1)}</td>
                    <td className="py-1.5 text-right">{p.topSpeed.toFixed(1)}</td>
                    <td className="py-1.5 text-right">{p.sprints}</td>
                    <td className="py-1.5 text-right">{p.avgSpeed.toFixed(1)}</td>
                    <td className="py-1.5 text-right">{p.passAccuracy}%</td>
                    <td className="py-1.5 text-right">{p.duelsWon}%</td>
                    <td className={`py-1.5 text-right font-bold ${p.rating >= 7.5 ? "text-primary" : p.rating >= 6.5 ? "" : "text-warning"}`}>
                      {p.rating.toFixed(1)}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Advanced Tab */}
        <TabsContent value="advanced" className="space-y-4">
          <div className="rounded-xl border border-border/50 bg-card/50 p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="text-xs font-semibold text-foreground/80 font-display">Advanced Analytics</div>
              <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20 font-display">API-Football</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: "xG (Expected Goals)", value: data.apiStats.xG.toFixed(2), desc: "Erwartete Tore basierend auf Schussqualität" },
                { label: "xGA (Expected Against)", value: data.apiStats.xGA.toFixed(2), desc: "Erwartete Gegentore" },
                { label: "PPDA (Pressing-Intensität)", value: data.apiStats.ppda.toFixed(1), desc: "Pässe pro Defensivaktion — niedriger = intensiver" },
                { label: "Field Tilt", value: `${data.apiStats.fieldTilt.toFixed(0)}%`, desc: "Anteil der Aktionen in der gegnerischen Hälfte" },
                { label: "Schuss-Conversion", value: `${data.apiStats.shotConversion.toFixed(0)}%`, desc: "Anteil der Schüsse die zu Toren führen" },
                { label: "Zweikampfquote", value: `${data.apiStats.duelWinRate.toFixed(0)}%`, desc: "Gewonnene Zweikämpfe" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  className="rounded-lg bg-muted/20 p-3 border border-border/30"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 + i * 0.08 }}
                >
                  <div className="text-lg font-bold font-display text-primary mb-1">{stat.value}</div>
                  <div className="text-[10px] font-medium text-foreground mb-0.5">{stat.label}</div>
                  <div className="text-[8px] text-muted-foreground">{stat.desc}</div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Comparison bars */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border/50 bg-card/50 p-4">
              <div className="text-xs font-semibold text-foreground/80 mb-3 font-display">Heim vs. Gast — Vergleich</div>
              {[
                { label: "Ballbesitz", home: data.teamStats.possession, away: 100 - data.teamStats.possession, unit: "%" },
                { label: "Pässe", home: data.teamStats.passes, away: Math.floor(data.teamStats.passes * 0.75), unit: "" },
                { label: "Schüsse", home: data.teamStats.shotsOnTarget + 4, away: data.teamStats.shotsOnTarget, unit: "" },
                { label: "Ecken", home: data.teamStats.corners, away: Math.floor(data.teamStats.corners * 0.6), unit: "" },
              ].map((c, i) => {
                const total = c.home + c.away;
                const homePct = (c.home / total) * 100;
                return (
                  <motion.div key={c.label} className="mb-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.1 }}>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="font-medium text-primary">{c.home}{c.unit}</span>
                      <span className="text-muted-foreground">{c.label}</span>
                      <span className="font-medium text-destructive">{c.away}{c.unit}</span>
                    </div>
                    <div className="flex h-2 rounded-full overflow-hidden bg-muted/30">
                      <motion.div className="bg-primary/70 rounded-l-full" initial={{ width: 0 }} animate={{ width: `${homePct}%` }} transition={{ delay: 0.5 + i * 0.1, duration: 0.8 }} />
                      <motion.div className="bg-destructive/50 rounded-r-full" initial={{ width: 0 }} animate={{ width: `${100 - homePct}%` }} transition={{ delay: 0.5 + i * 0.1, duration: 0.8 }} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
            <div className="rounded-xl border border-border/50 bg-card/50 p-4">
              <div className="text-xs font-semibold text-foreground/80 mb-3 font-display">Intensitätszonen</div>
              {[
                { label: "Gehen (0–6 km/h)", pct: 42, color: "bg-blue-500/60" },
                { label: "Joggen (6–12 km/h)", pct: 28, color: "bg-green-500/60" },
                { label: "Laufen (12–20 km/h)", pct: 18, color: "bg-yellow-500/60" },
                { label: "Sprint (20+ km/h)", pct: 12, color: "bg-red-500/60" },
              ].map((zone, i) => (
                <motion.div key={zone.label} className="mb-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.08 }}>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-muted-foreground">{zone.label}</span>
                    <span className="font-medium text-foreground">{zone.pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                    <motion.div className={`h-full rounded-full ${zone.color}`} initial={{ width: 0 }} animate={{ width: `${zone.pct}%` }} transition={{ delay: 0.5 + i * 0.1, duration: 0.8 }} />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

/* ─── Reusable Heatmap on Football Field ─── */
function HeatmapField({ grid, maxVal, small }: { grid: number[][]; maxVal: number; small?: boolean }) {
  return (
    <div className={`relative rounded-lg overflow-hidden ${small ? "aspect-[105/68]" : "aspect-[105/68]"}`}>
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(140,40%,28%)] to-[hsl(140,35%,22%)]" />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 105 68" preserveAspectRatio="none">
        <rect x="0" y="0" width="105" height="68" fill="none" stroke="white" strokeWidth="0.4" opacity="0.3" />
        <line x1="52.5" y1="0" x2="52.5" y2="68" stroke="white" strokeWidth="0.3" opacity="0.25" />
        <circle cx="52.5" cy="34" r="9.15" fill="none" stroke="white" strokeWidth="0.3" opacity="0.25" />
        <rect x="0" y="13.84" width="16.5" height="40.32" fill="none" stroke="white" strokeWidth="0.3" opacity="0.2" />
        <rect x="88.5" y="13.84" width="16.5" height="40.32" fill="none" stroke="white" strokeWidth="0.3" opacity="0.2" />
        <rect x="0" y="24.84" width="5.5" height="18.32" fill="none" stroke="white" strokeWidth="0.25" opacity="0.15" />
        <rect x="99.5" y="24.84" width="5.5" height="18.32" fill="none" stroke="white" strokeWidth="0.25" opacity="0.15" />
      </svg>
      <div
        className="absolute inset-1 grid gap-px"
        style={{ gridTemplateColumns: `repeat(${HEATMAP_COLS}, 1fr)`, gridTemplateRows: `repeat(${HEATMAP_ROWS}, 1fr)` }}
      >
        {grid.flat().map((val, i) => {
          const norm = val / maxVal;
          const hue = norm > 0.7 ? 0 : norm > 0.4 ? 40 : norm > 0.2 ? 120 : 200;
          const alpha = Math.max(norm * 0.6, 0.02);
          return (
            <div key={i} className="rounded-[1px]" style={{ backgroundColor: `hsla(${hue}, 85%, 50%, ${alpha})` }} />
          );
        })}
      </div>
    </div>
  );
}

/* ─── Random Data Generator ─── */
function generateDemoData(): DemoData {
  const r = (min: number, max: number) => min + Math.random() * (max - min);
  const ri = (min: number, max: number) => Math.floor(r(min, max));

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

  const positionHotspots: Record<string, { cx: number; cy: number }[]> = {
    TW: [{ cx: 2, cy: 7 }],
    IV: [{ cx: 5, cy: 5 }, { cx: 5, cy: 9 }],
    LV: [{ cx: 6, cy: 1 }, { cx: 8, cy: 2 }],
    RV: [{ cx: 6, cy: 12 }, { cx: 8, cy: 11 }],
    ZDM: [{ cx: 8, cy: 7 }, { cx: 10, cy: 6 }],
    ZM: [{ cx: 10, cy: 7 }, { cx: 12, cy: 5 }],
    ZOM: [{ cx: 13, cy: 7 }, { cx: 14, cy: 6 }],
    RA: [{ cx: 15, cy: 11 }, { cx: 17, cy: 12 }],
    LA: [{ cx: 15, cy: 2 }, { cx: 17, cy: 1 }],
    ST: [{ cx: 17, cy: 7 }, { cx: 18, cy: 6 }],
  };

  const players: DemoPlayer[] = names.map((n) => {
    const isGK = n.pos === "TW";
    const isAttacker = ["ST", "RA", "LA"].includes(n.pos);

    // Generate individual heatmap
    const spots = positionHotspots[n.pos] || [{ cx: 10, cy: 7 }];
    const heatmap: number[][] = [];
    for (let row = 0; row < HEATMAP_ROWS; row++) {
      const rowData: number[] = [];
      for (let col = 0; col < HEATMAP_COLS; col++) {
        let val = 0;
        for (const hs of spots) {
          const dist = Math.sqrt((col - hs.cx) ** 2 + (row - hs.cy) ** 2);
          val += Math.exp(-(dist * dist) / (2 * (2.5) ** 2));
        }
        val += Math.random() * 0.05;
        rowData.push(Math.min(val, 1));
      }
      heatmap.push(rowData);
    }

    return {
      ...n,
      km: isGK ? r(5.5, 6.5) : isAttacker ? r(9.5, 11.5) : r(10, 12.5),
      topSpeed: isGK ? r(22, 26) : r(28, 34),
      sprints: isGK ? ri(5, 12) : ri(25, 55),
      avgSpeed: isGK ? r(4, 5.5) : r(6.5, 8.5),
      passAccuracy: isGK ? ri(65, 80) : ri(72, 95),
      duelsWon: ri(40, 75),
      rating: isGK ? r(6.0, 8.0) : r(5.8, 8.5),
      heatmap,
      trend: (["up", "down", "stable"] as const)[ri(0, 3)],
    };
  });

  players.sort((a, b) => b.km - a.km);

  // Team heatmap
  const hotspots = [
    { cx: r(6, 10), cy: r(4, 10), strength: r(0.7, 1), radius: r(3, 5) },
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
        if (dist < hs.radius * 2) val += hs.strength * Math.exp(-(dist * dist) / (2 * (hs.radius * 0.8) ** 2));
      }
      val += Math.random() * 0.04;
      rowData.push(Math.min(val, 1));
    }
    heatmapGrid.push(rowData);
  }

  const totalKm = players.reduce((s, p) => s + p.km, 0) / players.length;

  return {
    players,
    teamStats: {
      possession: r(48, 62),
      totalKm,
      avgSpeed: r(6.8, 8.2),
      topSpeed: Math.max(...players.map((p) => p.topSpeed)),
      sprints: players.reduce((s, p) => s + p.sprints, 0),
      passes: ri(380, 520),
      passAccuracy: r(78, 92),
      shotsOnTarget: ri(4, 9),
      corners: ri(3, 8),
      fouls: ri(8, 18),
    },
    heatmapGrid,
    apiStats: {
      xG: r(0.8, 2.5),
      xGA: r(0.5, 2.0),
      ppda: r(7, 14),
      fieldTilt: r(45, 65),
      shotConversion: r(10, 30),
      duelWinRate: r(45, 65),
    },
  };
}
