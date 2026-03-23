import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, RotateCcw, AlertTriangle, TrendingUp, Zap, Route, Users, Activity, Timer,
  Bell, ChevronRight, ArrowUpRight, ArrowDownRight, Minus, Target, Shield, Footprints,
  BarChart3, Eye, Gauge, X, ChevronLeft, Crosshair, Award, Goal, Siren,
  PersonStanding, CircleDot, Radar, TriangleAlert, TrendingDown, FileText, Sparkles,
  Share2, Mail, Download, Clipboard, Dumbbell, Newspaper, MessageCircle, Hash,
  Lightbulb, ArrowRight, CheckCircle2, Images
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HEATMAP_COLS, HEATMAP_ROWS } from "@/lib/constants";
import { MiniHeatmap } from "@/components/HeatmapField";
import useEmblaCarousel from "embla-carousel-react";
import { getRandomDemoData, type DemoData, type DemoPlayer } from "@/lib/demo-data";

type DemoState = "notification" | "loading" | "analyzing" | "dashboard";

// Removed external image reference - using programmatic mockup instead

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
            setData(getRandomDemoData());
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
          <h2 className="text-3xl md:text-4xl font-bold font-display mb-3">Erlebe das neue Coaching-Cockpit — ohne Anmeldung</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm leading-relaxed">
            Coach Summary, KI-Analyse-Bilder, neue Charts, Datenwarnungen, Report-Workflows und Was-wäre-wenn-Analyse erscheinen in einem klaren Flow direkt nach dem Spiel.
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

function NotificationState({ onLoad }: { onLoad: () => void }) {
  const staleStats = [
    { label: "Ø Distanz", value: "9.8 km", trend: "stable" as const },
    { label: "Topspeed", value: "28.4 km/h", trend: "down" as const },
    { label: "Sprints", value: "142", trend: "up" as const },
    { label: "Ballbesitz", value: "48%", trend: "down" as const },
    { label: "Passquote", value: "84%", trend: "up" as const },
    { label: "Zweikampfquote", value: "58%", trend: "stable" as const },
    { label: "Tore / Assists", value: "2 / 1", trend: "up" as const },
    { label: "xG", value: "1.82", trend: "up" as const },
  ];

  const staleTopRunners = [
    { name: "L. Schmidt", km: 11.2 },
    { name: "T. Wagner", km: 10.8 },
    { name: "M. Fischer", km: 10.3 },
  ];

  const analysisCategories = [
    { icon: Clipboard, label: "Coach Summary", items: ["Spielkontrolle", "Fokusspieler", "Warnsignal", "Nächste Aktion"] },
    { icon: BarChart3, label: "Leaderboards", items: ["Top-Speed", "Passquote", "Sprints", "Zweikämpfe"] },
    { icon: TriangleAlert, label: "Datenqualität", items: ["Ausreißer", "Plausibilität", "Warnstatus", "Kalibrier-Hinweise"] },
    { icon: Sparkles, label: "Taktik-Tools", items: ["Heatmaps", "KI-Erkenntnisse", "Formationen", "Was-wäre-wenn"] },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-3xl mx-auto space-y-6"
    >
      <div className="rounded-2xl border border-border bg-card shadow-lg p-6 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-sm font-semibold font-display text-foreground">Mein Dashboard</div>
              <div className="text-[10px] text-muted-foreground">FC Musterstadt · Saison 2025/26</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground/70">Letztes Spiel</div>
            <div className="text-xs font-medium text-muted-foreground">vor 7 Tagen</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {staleStats.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border bg-muted/30 p-3 text-center">
              <div className="flex items-center justify-center gap-1">
                <span className="text-lg font-bold font-display text-foreground">{stat.value}</span>
                {stat.trend === "up" && <ArrowUpRight className="w-3 h-3 text-primary" />}
                {stat.trend === "down" && <ArrowDownRight className="w-3 h-3 text-warning" />}
                {stat.trend === "stable" && <Minus className="w-3 h-3 text-muted-foreground" />}
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="text-[10px] font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Top-Läufer (letztes Spiel)</div>
            <div className="space-y-2">
              {staleTopRunners.map((p) => (
                <div key={p.name} className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-foreground/80 w-16 truncate">{p.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
                    <div className="h-full rounded-full bg-primary/50" style={{ width: `${(p.km / 12) * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-10 text-right">{p.km} km</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="text-[10px] font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Team-Heatmap</div>
            <MiniHeatmap />
            <div className="flex items-center justify-between mt-2 text-[8px] text-muted-foreground">
              <span>Wenig Aktivität</span>
              <div className="flex gap-0.5">
                <div className="w-4 h-2 rounded-sm bg-primary/30" />
                <div className="w-4 h-2 rounded-sm bg-accent/40" />
                <div className="w-4 h-2 rounded-sm bg-warning/60" />
              </div>
              <span>Viel Aktivität</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="text-[10px] font-semibold text-primary mb-3 uppercase tracking-wide flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Was FieldIQ alles auswertet
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {analysisCategories.map((cat) => (
              <div key={cat.label} className="rounded-lg bg-card/80 border border-border/30 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <cat.icon className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-semibold text-foreground">{cat.label}</span>
                </div>
                <div className="space-y-0.5">
                  {cat.items.map((item) => (
                    <div key={item} className="text-[9px] text-muted-foreground flex items-center gap-1">
                      <div className="w-1 h-1 rounded-full bg-primary/50" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <motion.div
        className="rounded-2xl border-2 border-primary bg-primary/10 backdrop-blur-sm p-6 cursor-pointer hover:bg-primary/15 hover:border-primary transition-all shadow-lg shadow-primary/20"
        onClick={onLoad}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Bell className="w-6 h-6 text-primary" />
            </div>
            <motion.div
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive flex items-center justify-center"
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <span className="text-[9px] font-bold text-destructive-foreground">1</span>
            </motion.div>
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold font-display text-foreground mb-1">🎉 Neues Coaching-Cockpit verfügbar!</div>
            <div className="text-xs text-foreground/80 mb-2">FC Musterstadt vs. SV Beispielburg · Sonntag, 2. März 2026 · 15:30 Uhr</div>
            <div className="text-xs text-muted-foreground mb-4">3 Kameras haben 90 Minuten Tracking-Daten aufgezeichnet. Coach Summary, Alerts, Charts, Analysebilder und Vor-/Halbzeit-/Nachberichte sind bereit.</div>
            <Button variant="hero" size="sm" className="gap-2" onClick={onLoad}>
              <Play className="w-4 h-4" />
              Cockpit laden & analysieren
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function LoadingState({ progress, phase }: { progress: number; phase: "load" | "analyze" }) {
  const loadLabels = ["Kameradaten synchronisieren...", "Tracking-Punkte zusammenführen...", "Spielerpositionen extrahieren...", "Daten validieren..."];
  const analyzeLabels = ["Coach Summary erstellen...", "Leaderboards berechnen...", "Charts aufbauen...", "Analysebilder zuordnen...", "Datenwarnungen prüfen...", "Vor-/Halbzeit-/Nachberichte vorbereiten...", "Cockpit aufbauen..."];
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
        <h3 className="text-base font-bold font-display mb-1">{phase === "load" ? "Spieldaten werden geladen" : "Coaching-Cockpit wird aufgebaut"}</h3>
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

function DashboardState({ data, onReload }: { data: DemoData; onReset: () => void; onReload: () => void }) {
  const [selectedPlayer, setSelectedPlayer] = useState<DemoPlayer | null>(null);
  const topPlayers = data.players.slice(0, 4);
  const maxHeatVal = Math.max(...data.heatmapGrid.flat(), 0.01);
  const focusPlayer = data.players.reduce((best, player) => (player.rating > best.rating ? player : best), data.players[0]);
  const hasDataWarning = data.teamStats.topSpeed > 40;
  const speedLeaders = [...data.players].sort((a, b) => b.topSpeed - a.topSpeed).slice(0, 5);
  const passLeaders = [...data.players].sort((a, b) => b.passAccuracy - a.passAccuracy).slice(0, 5);
  const reportFlow = [
    { label: "Vorbericht", desc: "Matchplan, Formkurve, Gegnerbild", icon: FileText },
    { label: "Halbzeit", desc: "Sofortige Anpassungen & To-dos", icon: Timer },
    { label: "Nachbericht", desc: "KI-Fazit, Export & Teilen", icon: Newspaper },
  ];
  const coachSummary = [
    {
      icon: Clipboard,
      label: "Spielkontrolle",
      title: data.teamStats.possession >= 52 ? "Du kontrollierst das Spiel" : "Mehr Kontrolle im Zentrum nötig",
      detail: `${data.teamStats.possession.toFixed(0)}% Ballbesitz · ${data.teamStats.passes} Pässe`,
    },
    {
      icon: hasDataWarning ? TriangleAlert : Shield,
      label: "Datenqualität",
      title: hasDataWarning ? "Auffälliger Topspeed erkannt" : "Datenlage wirkt plausibel",
      detail: hasDataWarning ? `${data.teamStats.topSpeed.toFixed(1)} km/h prüfen · mögliche Fehlkalibrierung` : "Keine kritischen Ausreißer im Kernset",
    },
    {
      icon: Sparkles,
      label: "Coach-Fokus",
      title: `${focusPlayer.name} priorisieren`,
      detail: `${focusPlayer.rating.toFixed(1)} Rating · ${focusPlayer.passAccuracy}% Passquote · ${focusPlayer.sprints} Sprints`,
    },
  ];
  const coachActions = [
    data.teamStats.passAccuracy < 80 ? "Einen passsicheren Spieler tiefer positionieren, um den Aufbau unter Druck zu stabilisieren." : "Höhere Staffelung zwischen den Linien testen, weil die Passqualität stabil bleibt.",
    data.teamStats.possession < 50 ? "Im Zentrum Überzahl schaffen, damit zweite Bälle schneller gesichert werden." : "Ballbesitzphasen gezielt in rechte Überladungen ummünzen.",
    hasDataWarning ? "Vor der nächsten Analyse Kalibrierung und Spitzenwerte prüfen, damit Trainerentscheidungen belastbar bleiben." : "Die aktuelle Datenqualität reicht für individuelle Trainingsableitungen und Wechselentscheidungen aus.",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-4"
    >
      <AnimatePresence>
        {selectedPlayer && <PlayerDetailModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
      </AnimatePresence>

      <div className="rounded-lg bg-warning/10 border border-warning/30 px-4 py-2 flex items-center gap-3 text-xs">
        <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
        <span className="text-warning font-medium">Dies sind zufällig generierte Testdaten — keine echten Spielergebnisse.</span>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={onReload} className="text-xs h-7 gap-1">
            <RotateCcw className="w-3 h-3" /> Neu generieren
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-lg font-bold font-display">{data.matchInfo.homeTeam} {data.matchInfo.homeScore} : {data.matchInfo.awayScore} {data.matchInfo.awayTeam}</div>
            <div className="text-xs text-muted-foreground">{data.matchInfo.date} · {data.matchInfo.venue} · 90 Min.</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Ballbesitz</div>
            <div className="text-lg font-bold font-display text-primary">{data.teamStats.possession.toFixed(0)}%</div>
          </div>
        </div>

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

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-card/80 border-2 border-primary/30 shadow-lg shadow-primary/10 p-1.5 rounded-xl backdrop-blur-sm flex h-auto flex-wrap justify-start">
          <TabsTrigger value="overview" className="text-sm gap-2 px-4 py-2.5 font-semibold rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
            <BarChart3 className="w-4 h-4" /> Übersicht
          </TabsTrigger>
          <TabsTrigger value="players" className="text-sm gap-2 px-4 py-2.5 font-semibold rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
            <Users className="w-4 h-4" /> Spieler
          </TabsTrigger>
          <TabsTrigger value="advanced" className="text-sm gap-2 px-4 py-2.5 font-semibold rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
            <Gauge className="w-4 h-4" /> Advanced
          </TabsTrigger>
          <TabsTrigger value="report" className="text-sm gap-2 px-4 py-2.5 font-semibold rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
            <FileText className="w-4 h-4" /> KI-Berichte
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 to-transparent p-4 sm:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-primary font-semibold">Coach Summary</div>
                <h3 className="text-xl font-bold font-display mt-1">Schneller Überblick für Trainer</h3>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[10px] md:min-w-[260px]">
                <div className="rounded-xl border border-border/40 bg-card/70 px-3 py-2">
                  <div className="text-muted-foreground">Ballbesitz</div>
                  <div className="mt-1 font-bold font-display text-foreground">{data.teamStats.possession.toFixed(0)}%</div>
                </div>
                <div className="rounded-xl border border-border/40 bg-card/70 px-3 py-2">
                  <div className="text-muted-foreground">Passquote</div>
                  <div className="mt-1 font-bold font-display text-foreground">{data.teamStats.passAccuracy.toFixed(0)}%</div>
                </div>
                <div className="rounded-xl border border-border/40 bg-card/70 px-3 py-2">
                  <div className="text-muted-foreground">Zielspieler</div>
                  <div className="mt-1 font-bold font-display text-foreground truncate">{focusPlayer.name}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {coachSummary.map((item, index) => (
                <motion.div
                  key={item.label}
                  className="rounded-2xl border border-border/40 bg-card/80 p-4"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 * index }}
                >
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    <item.icon className="h-4 w-4 text-primary" />
                    {item.label}
                  </div>
                  <div className="mt-3 text-base font-semibold font-display text-foreground">{item.title}</div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <div className={`rounded-2xl border p-4 ${hasDataWarning ? "border-warning/40 bg-warning/10" : "border-border/50 bg-card/50"}`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-3">
                {hasDataWarning ? <TriangleAlert className="mt-0.5 h-5 w-5 text-warning shrink-0" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary shrink-0" />}
                <div>
                  <div className="text-sm font-semibold font-display">{hasDataWarning ? "Coach Alert: Plausibilität prüfen" : "Coach Alert: Datenlage stabil"}</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {hasDataWarning
                      ? `Der gemessene Team-Topspeed von ${data.teamStats.topSpeed.toFixed(1)} km/h wirkt auffällig. Vor Detailentscheidungen Kamera-Setup und Kalibrierung prüfen.`
                      : "Die Hauptmetriken wirken plausibel und können direkt für Trainingsplanung und Spielerfeedback genutzt werden."}
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-border/40 bg-card/70 px-3 py-2 text-xs text-muted-foreground">
                {hasDataWarning ? "Warnstatus: auffällig" : "Warnstatus: unkritisch"}
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="rounded-2xl border border-border/50 bg-card/50 p-4">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <div className="text-xs font-semibold text-foreground/80 font-display flex items-center gap-2">
                    <Images className="h-4 w-4 text-primary" />
                    Neueste KI-Analyse-Bilder & Charts
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">Aktuelle Analyse-Screens aus dem Coaching-Cockpit mit Visuals, Leaderboards und Report-Flow.</p>
                </div>
                <span className="text-[9px] bg-primary/10 text-primary px-2 py-1 rounded-full border border-primary/20">Neu</span>
              </div>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <div className="overflow-hidden rounded-2xl border border-border/40 bg-background/70">
                  <img src={latestAnalysisImage} alt="Aktueller Coaching-Cockpit Analyse-Screen mit KI-Auswertung" className="h-full w-full object-cover" loading="lazy" />
                </div>
                <div className="space-y-3">
                  <div className="rounded-2xl border border-border/40 bg-background/60 p-3">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-2">
                      <span>Top-Speed Leaderboard</span>
                      <span>{speedLeaders[0]?.topSpeed.toFixed(1)} km/h max</span>
                    </div>
                    <div className="space-y-2">
                      {speedLeaders.map((player) => (
                        <div key={player.name} className="flex items-center gap-2">
                          <span className="w-20 truncate text-[10px] text-foreground">{player.name}</span>
                          <div className="h-2 flex-1 rounded-full bg-muted/30 overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${(player.topSpeed / Math.max(speedLeaders[0]?.topSpeed || 1, 1)) * 100}%` }} />
                          </div>
                          <span className="w-10 text-right text-[10px] font-medium text-foreground">{player.topSpeed.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border/40 bg-background/60 p-3">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-2">
                      <span>Passquote Leaderboard</span>
                      <span>{passLeaders[0]?.passAccuracy}% Spitze</span>
                    </div>
                    <div className="space-y-2">
                      {passLeaders.map((player) => (
                        <div key={player.name} className="flex items-center gap-2">
                          <span className="w-20 truncate text-[10px] text-foreground">{player.name}</span>
                          <div className="h-2 flex-1 rounded-full bg-muted/30 overflow-hidden">
                            <div className="h-full rounded-full bg-accent" style={{ width: `${player.passAccuracy}%` }} />
                          </div>
                          <span className="w-10 text-right text-[10px] font-medium text-foreground">{player.passAccuracy}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/50 p-4">
              <div className="text-xs font-semibold text-foreground/80 mb-3 font-display">Report-Workflow sichtbar im Cockpit</div>
              <div className="space-y-3">
                {reportFlow.map((step, index) => (
                  <div key={step.label} className="rounded-2xl border border-border/40 bg-background/60 p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                        <step.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold font-display text-foreground">{step.label}</div>
                        <div className="text-[10px] text-muted-foreground">{step.desc}</div>
                      </div>
                    </div>
                    {index < reportFlow.length - 1 ? <div className="mt-3 h-px bg-gradient-to-r from-primary/30 to-transparent" /> : null}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border/50 bg-card/50 p-4">
              <div className="text-xs font-semibold text-foreground/80 mb-3 font-display flex items-center justify-between">
                <span>Spieler-Distanzen (km)</span>
                <span className="text-[9px] text-muted-foreground font-normal">Klick für Details</span>
              </div>
              <div className="space-y-2">
                {data.players.slice(0, 11).map((p, i) => (
                  <motion.div
                    key={p.name}
                    className="flex items-center gap-2 cursor-pointer hover:bg-primary/10 rounded px-1 -mx-1 transition-colors"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.04 }}
                    onClick={() => setSelectedPlayer(p)}
                  >
                    <span className="text-[10px] text-muted-foreground w-24 truncate">#{p.num} {p.name}</span>
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

            <div className="rounded-xl border border-border/50 bg-card/50 p-4">
              <div className="text-xs font-semibold text-foreground/80 mb-3 font-display">Team-Heatmap</div>
              <HeatmapField grid={data.heatmapGrid} maxVal={maxHeatVal} />
              <div className="flex items-center justify-between mt-2 text-[9px] text-muted-foreground">
                <span>Wenig Aktivität</span>
                <div className="flex gap-0.5">
                  <div className="w-3 h-1.5 rounded-sm bg-primary/30" />
                  <div className="w-3 h-1.5 rounded-sm bg-accent/40" />
                  <div className="w-3 h-1.5 rounded-sm bg-warning/60" />
                  <div className="w-3 h-1.5 rounded-sm bg-destructive/60" />
                  <div className="w-3 h-1.5 rounded-sm bg-primary" />
                </div>
                <span>Viel Aktivität</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 to-transparent p-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-warning" />
              <span className="text-xs font-semibold font-display text-foreground/80">KI-Erkenntnisse aus diesem Spiel</span>
              <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">Auto-generiert</span>
            </div>
            <div className="grid md:grid-cols-2 gap-2">
              {coachActions.map((insight) => (
                <motion.div key={insight} className="flex items-start gap-2 text-[10px] text-muted-foreground rounded-lg bg-card/50 p-2.5 border border-border/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>{insight}</span>
                </motion.div>
              ))}
              {[
                "Rechte Überladung bleibt das gefährlichste Angriffsmuster im letzten Drittel.",
                "Mittelfeld-Zweikämpfe sichern aktuell die Spielkontrolle und sollten personell stabil gehalten werden.",
              ].map((insight) => (
                <motion.div key={insight} className="flex items-start gap-2 text-[10px] text-muted-foreground rounded-lg bg-card/50 p-2.5 border border-border/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Lightbulb className="h-3.5 w-3.5 shrink-0 text-warning" />
                  <span>{insight}</span>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border/50 bg-card/50 p-4">
              <div className="text-xs font-semibold text-foreground/80 mb-3 font-display">Speed-Ranking</div>
              <div className="space-y-2">
                {speedLeaders.map((p, i) => (
                  <motion.div key={p.name} className="flex items-center gap-2 cursor-pointer hover:bg-primary/10 rounded px-1 -mx-1 transition-colors" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.05 }} onClick={() => setSelectedPlayer(p)}>
                    <span className="text-[10px] font-bold text-primary w-4">{i + 1}.</span>
                    <span className="text-[10px] text-foreground flex-1 truncate">{p.name}</span>
                    <span className="text-[10px] font-bold text-foreground">{p.topSpeed.toFixed(1)}</span>
                    <span className="text-[8px] text-muted-foreground">km/h</span>
                  </motion.div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-border/50 bg-card/50 p-4">
              <div className="text-xs font-semibold text-foreground/80 mb-3 font-display">Passgenauigkeit</div>
              <div className="space-y-2">
                {passLeaders.map((p, i) => (
                  <motion.div key={p.name} className="flex items-center gap-2 cursor-pointer hover:bg-primary/10 rounded px-1 -mx-1 transition-colors" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.05 }} onClick={() => setSelectedPlayer(p)}>
                    <span className="text-[10px] font-bold text-primary w-4">{i + 1}.</span>
                    <span className="text-[10px] text-foreground flex-1 truncate">{p.name}</span>
                    <span className="text-[10px] font-bold text-foreground">{p.passAccuracy}%</span>
                  </motion.div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-border/50 bg-card/50 p-4">
              <div className="text-xs font-semibold text-foreground/80 mb-3 font-display">Tore + Assists</div>
              <div className="space-y-2">
                {[...data.players].sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists)).slice(0, 5).map((p, i) => (
                  <motion.div key={p.name} className="flex items-center gap-2 cursor-pointer hover:bg-primary/10 rounded px-1 -mx-1 transition-colors" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.05 }} onClick={() => setSelectedPlayer(p)}>
                    <span className="text-[10px] font-bold text-primary w-4">{i + 1}.</span>
                    <span className="text-[10px] text-foreground flex-1 truncate">{p.name}</span>
                    <span className="text-[10px] font-bold text-foreground">{p.goals}T / {p.assists}A</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="rounded-xl border border-border/50 bg-card/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-primary" />
                <div className="text-xs font-semibold text-foreground/80 font-display">Was-wäre-wenn-Analyse</div>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { title: "4-2-3-1 testen", desc: "Mehr Kontrolle im Zentrum und kürzere Abstände hinter dem Ball." },
                  { title: `${focusPlayer.name} höher schieben`, desc: "Stärksten Spieler näher an Abschlusszonen und zweite Bälle bringen." },
                  { title: "Rechte Seite überladen", desc: "Beste Angriffsseite aus den aktuellen Mustern noch konsequenter nutzen." },
                ].map((scenario) => (
                  <div key={scenario.title} className="rounded-2xl border border-border/40 bg-background/60 p-3">
                    <div className="text-sm font-semibold font-display text-foreground">{scenario.title}</div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{scenario.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border/50 bg-card/50 p-4">
              <div className="text-xs font-semibold text-foreground/80 mb-3 font-display">Spielübersicht</div>
              <div className="space-y-2 text-[10px]">
                {[
                  { label: "Schüsse / aufs Tor", value: `${data.teamStats.shotsTotal} / ${data.teamStats.shotsOnTarget}` },
                  { label: "Ecken", value: data.teamStats.corners },
                  { label: "Fouls", value: data.teamStats.fouls },
                  { label: "Abseits", value: data.teamStats.offsides },
                  { label: "Gelbe / Rote", value: `${data.teamStats.yellowCards} / ${data.teamStats.redCards}` },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between rounded-lg border border-border/20 bg-background/50 px-3 py-2">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="font-bold text-foreground">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="players" className="space-y-4">
          <PlayerHeatmapCarousel players={data.players} onSelectPlayer={setSelectedPlayer} />

          <div className="rounded-xl border border-border/50 bg-card/50 p-4 overflow-x-auto">
            <div className="text-xs font-semibold text-foreground/80 mb-3 font-display flex items-center justify-between">
              <span>Kompletter Kader</span>
              <span className="text-[9px] text-muted-foreground font-normal">Klicke auf einen Spieler für Details</span>
            </div>
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
                  <th className="text-center py-1.5 font-medium">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {data.players.map((p, i) => (
                  <motion.tr key={p.name} className="border-b border-border/10 hover:bg-primary/10 transition-colors cursor-pointer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 + i * 0.03 }} onClick={() => setSelectedPlayer(p)}>
                    <td className="py-1.5 font-bold text-primary">{p.num}</td>
                    <td className="py-1.5 font-medium text-foreground">{p.name}</td>
                    <td className="py-1.5 text-muted-foreground">{p.pos}</td>
                    <td className="py-1.5 text-right font-medium">{p.km.toFixed(1)}</td>
                    <td className="py-1.5 text-right">{p.topSpeed.toFixed(1)}</td>
                    <td className="py-1.5 text-right">{p.sprints}</td>
                    <td className="py-1.5 text-right">{p.avgSpeed.toFixed(1)}</td>
                    <td className="py-1.5 text-right">{p.passAccuracy}%</td>
                    <td className="py-1.5 text-right">{p.duelsWon}%</td>
                    <td className={`py-1.5 text-right font-bold ${p.rating >= 7.5 ? "text-primary" : p.rating >= 6.5 ? "" : "text-warning"}`}>{p.rating.toFixed(1)}</td>
                    <td className="py-1.5 text-center">
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                        <Eye className="w-3 h-3 text-primary" />
                      </Button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <div className="rounded-xl border border-border/50 bg-card/50 p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="text-xs font-semibold text-foreground/80 font-display">Advanced Analytics</div>
              <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20 font-display">API-Football + FieldIQ</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: "xG (Expected Goals)", value: data.apiStats.xG.toFixed(2), desc: "Erwartete Tore", icon: Target },
                { label: "xGA (Expected Against)", value: data.apiStats.xGA.toFixed(2), desc: "Erwartete Gegentore", icon: Shield },
                { label: "PPDA", value: data.apiStats.ppda.toFixed(1), desc: "Pressing-Intensität", icon: Zap },
                { label: "Field Tilt", value: `${data.apiStats.fieldTilt.toFixed(0)}%`, desc: "Gegnerische Hälfte", icon: BarChart3 },
                { label: "Schuss-Conv.", value: `${data.apiStats.shotConversion.toFixed(0)}%`, desc: "Torquote", icon: Goal },
                { label: "Zweikampfquote", value: `${data.apiStats.duelWinRate.toFixed(0)}%`, desc: "Gewonnen", icon: PersonStanding },
                { label: "Luftkämpfe", value: `${data.apiStats.aerialWinRate.toFixed(0)}%`, desc: "Gewonnen", icon: TrendingUp },
                { label: "Flankengenau.", value: `${data.apiStats.crossAccuracy.toFixed(0)}%`, desc: "Angekommen", icon: Crosshair },
                { label: "Konter", value: `${data.apiStats.counterAttacks}`, desc: "Schnelle Angriffe", icon: Zap },
                { label: "Standardtore", value: `${data.apiStats.setPlayGoals}`, desc: "Tore aus Standards", icon: CircleDot },
              ].map((stat, i) => (
                <motion.div key={stat.label} className="rounded-lg bg-muted/20 p-3 border border-border/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 + i * 0.05 }}>
                  <stat.icon className="w-3.5 h-3.5 text-primary mb-1" />
                  <div className="text-lg font-bold font-display text-primary mb-0.5">{stat.value}</div>
                  <div className="text-[9px] font-medium text-foreground">{stat.label}</div>
                  <div className="text-[8px] text-muted-foreground">{stat.desc}</div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border/50 bg-card/50 p-4">
              <div className="text-xs font-semibold text-foreground/80 mb-3 font-display">Heim vs. Gast — Vergleich</div>
              {[
                { label: "Ballbesitz", home: data.teamStats.possession, away: 100 - data.teamStats.possession, unit: "%" },
                { label: "Pässe", home: data.teamStats.passes, away: Math.floor(data.teamStats.passes * 0.75), unit: "" },
                { label: "Schüsse", home: data.teamStats.shotsTotal, away: data.teamStats.shotsOnTarget + 2, unit: "" },
                { label: "Ecken", home: data.teamStats.corners, away: Math.floor(data.teamStats.corners * 0.6), unit: "" },
                { label: "Fouls", home: data.teamStats.fouls, away: Math.floor(data.teamStats.fouls * 1.2), unit: "" },
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
              <div className="text-xs font-semibold text-foreground/80 mb-3 font-display">Intensitätszonen (Team)</div>
              {[
                { label: "Gehen (0–6 km/h)", pct: 42, className: "bg-primary/35" },
                { label: "Joggen (6–12 km/h)", pct: 28, className: "bg-accent/45" },
                { label: "Laufen (12–20 km/h)", pct: 18, className: "bg-warning/60" },
                { label: "Sprint (20+ km/h)", pct: 12, className: "bg-destructive/60" },
              ].map((zone, i) => (
                <motion.div key={zone.label} className="mb-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.08 }}>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-muted-foreground">{zone.label}</span>
                    <span className="font-medium text-foreground">{zone.pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                    <motion.div className={`h-full rounded-full ${zone.className}`} initial={{ width: 0 }} animate={{ width: `${zone.pct}%` }} transition={{ delay: 0.5 + i * 0.1, duration: 0.8 }} />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="report" className="space-y-4">
          <ReportTabContent />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

function PlayerDetailModal({ player, onClose }: { player: DemoPlayer; onClose: () => void }) {
  const playerMaxHeat = Math.max(...(player.heatmap?.flat() || [0]), 0.01);
  const safeNum = (val: number | undefined | null, fallback = 0) => val ?? fallback;

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="bg-card border border-border rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onClose} className="gap-1">
              <ChevronLeft className="w-4 h-4" />
              Zurück
            </Button>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-bold font-display text-primary">{player.num}</span>
            </div>
            <div>
              <div className="text-base font-bold font-display text-foreground">{player.name}</div>
              <div className="text-xs text-muted-foreground">{player.pos} · {player.minutesPlayed} Min. gespielt</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Gesamtbewertung</div>
              <div className={`text-xl font-bold font-display ${safeNum(player.rating) >= 7.5 ? "text-primary" : safeNum(player.rating) >= 6.5 ? "text-foreground" : "text-warning"}`}>{safeNum(player.rating).toFixed(1)}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Radar className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold font-display text-primary">FieldIQ Tracking-Daten</span>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { label: "Distanz", value: `${safeNum(player.km).toFixed(2)} km`, icon: Route },
                { label: "Topspeed", value: `${safeNum(player.topSpeed).toFixed(1)} km/h`, icon: Zap },
                { label: "Ø Tempo", value: `${safeNum(player.avgSpeed).toFixed(1)} km/h`, icon: Gauge },
                { label: "Sprints", value: `${safeNum(player.sprints)}`, icon: Footprints },
                { label: "Sprint-Distanz", value: `${safeNum(player.sprintDistanceM)} m`, icon: TrendingUp },
                { label: "Spielzeit", value: `${safeNum(player.minutesPlayed)}'`, icon: Timer },
              ].map((stat) => (
                <div key={stat.label} className="text-center p-2 rounded-lg bg-card/50 border border-border/30">
                  <stat.icon className="w-3.5 h-3.5 text-primary mx-auto mb-1" />
                  <div className="text-sm font-bold font-display text-foreground">{stat.value}</div>
                  <div className="text-[9px] text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border/50 bg-card/50 p-4">
              <div className="text-xs font-semibold text-foreground/80 mb-3 font-display">Positionsheatmap</div>
              <HeatmapField grid={player.heatmap} maxVal={playerMaxHeat} />
            </div>

            <div className="rounded-xl border border-border/50 bg-card/50 p-4">
              <div className="text-xs font-semibold text-foreground/80 mb-3 font-display">Leistungsprofil</div>
              <div className="aspect-square max-w-[200px] mx-auto relative">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  {[0.2, 0.4, 0.6, 0.8, 1].map((scale, i) => (
                    <polygon key={i} points={getRadarPoints(50, 50, 40 * scale, 6)} fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity={0.3} />
                  ))}
                  <motion.polygon
                    points={getRadarPoints(50, 50, 40, 6, [player.km / 13, player.topSpeed / 35, player.sprints / 60, player.passAccuracy / 100, player.duelsWon / 100, player.rating / 10])}
                    fill="hsl(var(--primary) / 0.2)"
                    stroke="hsl(var(--primary))"
                    strokeWidth="1.5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-xl font-bold font-display text-primary">{safeNum(player.rating).toFixed(1)}</div>
                    <div className="text-[8px] text-muted-foreground">Rating</div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1 mt-2 text-[8px] text-muted-foreground text-center">
                <span>Distanz</span>
                <span>Speed</span>
                <span>Sprints</span>
                <span>Pässe</span>
                <span>Zweikämpfe</span>
                <span>Rating</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-card/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold font-display text-foreground/80">API-Football Spielstatistiken</span>
              <span className="text-[9px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Extern</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Passspiel</div>
                <div className="space-y-1.5">
                  <StatRow label="Pässe gesamt" value={player.passesTotal} />
                  <StatRow label="Passquote" value={`${player.passAccuracy}%`} highlight={player.passAccuracy >= 85} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Zweikämpfe</div>
                <div className="space-y-1.5">
                  <StatRow label="Gesamt" value={player.duelsTotal} />
                  <StatRow label="Gewonnen" value={`${player.duelsWon}%`} highlight={player.duelsWon >= 55} />
                  <StatRow label="Tackles" value={player.tackles} />
                  <StatRow label="Dribblings" value={player.dribblesSuccess} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Offensive</div>
                <div className="space-y-1.5">
                  <StatRow label="Tore" value={player.goals} highlight={player.goals > 0} />
                  <StatRow label="Assists" value={player.assists} highlight={player.assists > 0} />
                  <StatRow label="Schüsse gesamt" value={player.shotsTotal} />
                  <StatRow label="Schüsse aufs Tor" value={player.shotsOnGoal} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Disziplin</div>
                <div className="space-y-1.5">
                  <StatRow label="Fouls begangen" value={player.foulsCommitted} warning={player.foulsCommitted >= 3} />
                  <StatRow label="Fouls erlitten" value={player.foulsDrawn} />
                  <StatRow label="Gelbe Karten" value={player.yellowCards} warning={player.yellowCards > 0} />
                  <StatRow label="Rote Karten" value={player.redCards} warning={player.redCards > 0} />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-card/50 p-4">
            <div className="text-xs font-semibold text-foreground/80 mb-3 font-display">Leistungsindikatoren</div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <PerformanceBar label="Laufleistung" value={safeNum(player.km)} max={13} unit="km" />
                <PerformanceBar label="Topspeed" value={safeNum(player.topSpeed)} max={35} unit="km/h" />
                <PerformanceBar label="Sprint-Anteil" value={(safeNum(player.sprintDistanceM) / (safeNum(player.km, 1) * 1000)) * 100} max={20} unit="%" />
              </div>
              <div className="space-y-3">
                <PerformanceBar label="Passgenauigkeit" value={safeNum(player.passAccuracy)} max={100} unit="%" />
                <PerformanceBar label="Zweikampfquote" value={safeNum(player.duelsWon)} max={100} unit="%" />
                <PerformanceBar label="Bewertung" value={safeNum(player.rating)} max={10} unit="/10" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold font-display text-primary">KI-Analyse</span>
              <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">Demo</span>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="rounded-lg bg-card/50 p-3 border border-border/30">
                <div className="flex items-center gap-1.5 mb-1.5"><ArrowUpRight className="w-3 h-3 text-primary" /><span className="text-[10px] font-semibold text-foreground">Stärken</span></div>
                <ul className="text-[9px] text-muted-foreground space-y-0.5">
                  {player.topSpeed > 31 && <li>• Überdurchschnittliche Sprintgeschwindigkeit</li>}
                  {player.passAccuracy > 85 && <li>• Hohe Passgenauigkeit</li>}
                  {player.km > 11 && <li>• Sehr gute Laufleistung</li>}
                  {player.duelsWon > 55 && <li>• Stark im Zweikampf</li>}
                </ul>
              </div>
              <div className="rounded-lg bg-card/50 p-3 border border-border/30">
                <div className="flex items-center gap-1.5 mb-1.5"><TrendingDown className="w-3 h-3 text-warning" /><span className="text-[10px] font-semibold text-foreground">Entwicklungsfelder</span></div>
                <ul className="text-[9px] text-muted-foreground space-y-0.5">
                  {player.passAccuracy < 75 && <li>• Passgenauigkeit verbessern</li>}
                  {player.duelsWon < 45 && <li>• Zweikampfführung trainieren</li>}
                  {player.sprints < 30 && <li>• Mehr Tiefenläufe einfordern</li>}
                </ul>
              </div>
              <div className="rounded-lg bg-card/50 p-3 border border-border/30">
                <div className="flex items-center gap-1.5 mb-1.5"><TriangleAlert className="w-3 h-3 text-destructive" /><span className="text-[10px] font-semibold text-foreground">Hinweise</span></div>
                <ul className="text-[9px] text-muted-foreground space-y-0.5">
                  {player.foulsCommitted >= 3 && <li>• Hohe Foulquote — Gelbgefahr</li>}
                  {player.yellowCards > 0 && <li>• Verwarnung erhalten</li>}
                  <li>• Belastungssteuerung beachten</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ReportTabContent() {
  const [reportType, setReportType] = useState<"pre" | "halftime" | "post">("post");
  const [reportStyle, setReportStyle] = useState<"analytic" | "social" | "newspaper">("analytic");

  const reportTypes = [
    { key: "pre" as const, label: "Vorbericht", icon: FileText },
    { key: "halftime" as const, label: "Halbzeitanalyse", icon: Timer },
    { key: "post" as const, label: "Nachbericht", icon: Award },
  ];

  const reportStyles = [
    { key: "analytic" as const, label: "Analytisch", icon: BarChart3 },
    { key: "social" as const, label: "Social Media", icon: Hash },
    { key: "newspaper" as const, label: "Zeitung", icon: Newspaper },
  ];

  const reportContent: Record<string, Record<string, React.ReactNode>> = {
    post: {
      analytic: (
        <>
          <h2 className="text-lg font-bold font-display text-foreground mt-0 mb-4">FC Musterstadt – SV Beispielburg 2:1 (1:0)</h2>
          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">Spielverlauf</h3>
          <p className="text-muted-foreground mb-3">
            Der FC Musterstadt erwischte einen konzentrierten Start und übernahm früh die Spielkontrolle.
            Bereits in der 23. Minute belohnte sich das Heimteam: Nach einer schnellen Ballstafette über die
            rechte Seite kam <span className="text-foreground font-medium">A. Vogt (#10)</span> im Strafraum zum Abschluss — 1:0.
            Nach der Pause erhöhte der Gegner den Druck, doch <span className="text-foreground font-medium">F. König (#7)</span> bediente
            <span className="text-foreground font-medium"> T. Hartmann (#9)</span> in der 67. Minute zum 2:0.
          </p>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">Taktische Analyse</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-2.5">
              <div className="text-[10px] font-semibold text-primary mb-1">Offensiv-Kennzahlen</div>
              <div className="space-y-1 text-[10px] text-muted-foreground">
                <div className="flex justify-between"><span>xG</span><span className="text-foreground font-medium">1.82</span></div>
                <div className="flex justify-between"><span>Schusseffizienz</span><span className="text-foreground font-medium">29% (2/7)</span></div>
                <div className="flex justify-between"><span>Passquote</span><span className="text-foreground font-medium">84%</span></div>
                <div className="flex justify-between"><span>Angriffe rechts</span><span className="text-foreground font-medium">62%</span></div>
              </div>
            </div>
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-2.5">
              <div className="text-[10px] font-semibold text-primary mb-1">Defensiv-Kennzahlen</div>
              <div className="space-y-1 text-[10px] text-muted-foreground">
                <div className="flex justify-between"><span>xGA</span><span className="text-foreground font-medium">0.94</span></div>
                <div className="flex justify-between"><span>PPDA</span><span className="text-foreground font-medium">8.2</span></div>
                <div className="flex justify-between"><span>Zweikampfquote</span><span className="text-foreground font-medium">58%</span></div>
                <div className="flex justify-between"><span>Ballverluste eig. Hälfte</span><span className="text-foreground font-medium">12</span></div>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0"><Award className="w-5 h-5 text-primary" /></div>
            <div>
              <div className="font-semibold text-foreground">Spieler des Spiels: A. Vogt (#10) — 8.2</div>
              <p className="text-xs text-muted-foreground mt-1">1 Tor, 1 Assist, 89% Passquote, 7/9 Zweikämpfe, 11.4 km, 18 Sprints, 32 Ballkontakte im letzten Drittel.</p>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">🔍 KI-Erkenntnisse</h3>
          <div className="space-y-2 mb-3">
            {[
              { insight: "Überladung rechts: 62% der Angriffe über die rechte Seite — Gegner konnte links nicht absichern.", icon: "💡" },
              { insight: "Pressing-Effizienz: PPDA von 8.2 erzwang 14 Ballverluste im Mittelfeld — deutlich über Liga-Schnitt (11.4).", icon: "📊" },
              { insight: "Konter-Anfälligkeit: 3 der 4 gegnerischen Chancen entstanden nach Ballverlusten im Spielaufbau.", icon: "⚠️" },
              { insight: "Laufleistung 2. Hälfte: 12% Rückgang ab der 65. Minute — Belastungssteuerung überprüfen.", icon: "🏃" },
            ].map((item) => (
              <div key={item.insight} className="flex items-start gap-2 text-xs text-muted-foreground rounded-lg bg-muted/20 p-2 border border-border/30">
                <span className="text-sm shrink-0">{item.icon}</span>
                <span>{item.insight}</span>
              </div>
            ))}
          </div>
        </>
      ),
      social: (
        <div className="bg-muted/30 rounded-xl p-5 border border-border/50 font-mono text-sm leading-relaxed text-foreground">
          <p className="mb-3">⚽ <strong>SIEG!</strong> 🎉</p>
          <p className="mb-3">FC Musterstadt 🟢 2:1 🔴 SV Beispielburg</p>
          <p className="mb-3">⚡ A. Vogt mit Tor + Assist — MoTM! 🏆<br/>🏃 117 km Gesamtlaufleistung<br/>🎯 84% Passquote | 58% Zweikampfquote<br/>📊 xG 1.82 vs 0.94 xGA</p>
          <p className="mb-3">💪 Top-Sprinter: N. Roth (22 Sprints, 32.8 km/h)<br/>🧤 Defensive steht — nur 4 Schüsse aufs Tor zugelassen!</p>
          <p className="text-primary">#FCMusterstadt #Sieg #FieldIQ #Tracking #Fußball</p>
        </div>
      ),
      newspaper: (
        <>
          <h2 className="text-lg font-bold font-display text-foreground mt-0 mb-1 italic">Musterstadt siegt dank starkem Vogt</h2>
          <p className="text-[10px] text-muted-foreground mb-4 italic">Kreisliga A · Spieltag 18 · Von der Sportredaktion</p>
          <p className="text-muted-foreground mb-3"><strong className="text-foreground">Musterstadt.</strong> Der FC Musterstadt hat sein Heimspiel gegen den SV Beispielburg mit 2:1 (1:0) gewonnen und sich damit auf den dritten Tabellenplatz vorgeschoben. Vor 280 Zuschauern im Vereinsstadion zeigte das Team von Trainer Mustermann eine reife Leistung.</p>
          <p className="text-muted-foreground mb-3">Alexander Vogt, der überragende Akteur auf dem Platz, erzielte in der 23. Minute die Führung und bereitete in der 67. Minute das 2:0 durch Tim Hartmann vor. Der Anschlusstreffer der Gäste in der Schlussphase (82.) kam zu spät. „Wir haben heute sehr diszipliniert gespielt", lobte Mustermann nach dem Abpfiff.</p>
        </>
      ),
    },
    halftime: {
      analytic: (
        <>
          <h2 className="text-lg font-bold font-display text-foreground mt-0 mb-4">⏱️ Halbzeitanalyse — 1:0 (23' Vogt)</h2>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: "Ballbesitz", value: "57%", good: true },
              { label: "Passquote", value: "84%", good: true },
              { label: "xG", value: "0.92", good: true },
              { label: "PPDA", value: "8.2", good: true },
            ].map((s) => (
              <div key={s.label} className="rounded-lg bg-muted/20 border border-border/30 p-2 text-center">
                <div className={`text-sm font-bold font-display ${s.good ? "text-primary" : "text-warning"}`}>{s.value}</div>
                <div className="text-[8px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">Erste Hälfte — Überblick</h3>
          <p className="text-muted-foreground mb-3">Klare Dominanz des Heimteams. 4 Torschüsse (2 aufs Tor), Pressing-Intensität hoch. Gegner kam nur zu <span className="text-foreground font-medium">2 Abschlüssen</span> (0 aufs Tor).</p>
          <h3 className="text-sm font-semibold text-foreground mt-4 mb-3 flex items-center gap-2"><Lightbulb className="w-4 h-4 text-warning" />Verbesserungsvorschläge für die 2. Hälfte</h3>
          <div className="space-y-3 mb-4">
            {[
              { priority: "HOCH", priorityColor: "bg-destructive/10 text-destructive border-destructive/30", title: "Linke Seite aktivieren", reason: "Nur 28% der Angriffe über links — Gegner überladen unsere rechte Seite. König (#7) hat erst 14 Ballkontakte.", action: "König (#7) höher schieben, Diagonalbälle von Berger (#4) auf die linke Seite fordern." },
              { priority: "HOCH", priorityColor: "bg-destructive/10 text-destructive border-destructive/30", title: "Konterabsicherung verbessern", reason: "2 Kontersituationen des Gegners entstanden nach Ballverlusten von Roth (#2) im Spielaufbau. Beide Male fehlte die Doppelsicherung.", action: "Müller (#6) soll bei Spielaufbau tiefer stehen. Roth (#2) kürzere Pässe spielen statt lange Diagonalen." },
              { priority: "MITTEL", priorityColor: "bg-warning/10 text-warning border-warning/30", title: "Pressing-Timing anpassen", reason: "Ab der 35. Minute sank die Pressing-Intensität (PPDA stieg von 7.4 auf 11.2). Laufdistanz der Stürmer bereits bei 4.8 km.", action: "Pressing in der 2. Hälfte situativer einsetzen. Vogt (#10) entlasten, Hartmann (#9) soll Pressing auslösen." },
              { priority: "MITTEL", priorityColor: "bg-warning/10 text-warning border-warning/30", title: "Standards besser nutzen", reason: "3 Ecken in der 1. Hälfte — 0 Abschlüsse daraus. Gegnerische Lufthoheit bei 58%.", action: "Flache, kurze Ecken spielen statt hohe Flanken. Fischer (#8) als Abnehmer am kurzen Pfosten." },
              { priority: "TIPP", priorityColor: "bg-primary/10 text-primary border-primary/30", title: "Wechsel-Empfehlung", reason: "Schmidt (#11) hat die niedrigste Passquote (68%) und 0 erfolgreiche Dribblings. Intensität nimmt ab.", action: "Ab 60. Minute durch Weber einwechseln — bringt frische Beine und bessere 1-gegen-1-Qualität über links." },
            ].map((tip) => (
              <div key={tip.title} className="rounded-lg border border-border/40 bg-card/80 p-3">
                <div className="flex items-start gap-2 mb-1.5"><span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${tip.priorityColor}`}>{tip.priority}</span><span className="text-xs font-semibold text-foreground">{tip.title}</span></div>
                <p className="text-[10px] text-muted-foreground mb-1.5"><span className="font-medium text-foreground/80">Warum:</span> {tip.reason}</p>
                <div className="flex items-start gap-1.5 text-[10px] text-primary"><ArrowRight className="w-3 h-3 mt-0.5 shrink-0" /><span className="font-medium">{tip.action}</span></div>
              </div>
            ))}
          </div>
        </>
      ),
      social: (
        <div className="bg-muted/30 rounded-xl p-5 border border-border/50 font-mono text-sm leading-relaxed text-foreground">
          <p className="mb-2">⏱️ <strong>HALBZEIT!</strong></p>
          <p className="mb-2">FC Musterstadt 1:0 SV Beispielburg</p>
          <p className="mb-2">⚽ 23' Vogt | 57% Ballbesitz | 84% Pässe ✅</p>
          <p className="mb-2">📊 xG 0.92 – wir hätten sogar mehr Tore verdient!</p>
          <p className="text-primary mt-2">#HalbzeitUpdate #FCM #Führung</p>
        </div>
      ),
      newspaper: (
        <>
          <h2 className="text-lg font-bold font-display text-foreground mt-0 mb-4 italic">Vogt bringt Musterstadt in Front</h2>
          <p className="text-muted-foreground mb-3"><strong className="text-foreground">Halbzeit.</strong> Nach einer kontrollierten ersten Hälfte führt der FC Musterstadt dank eines Treffers von Alexander Vogt (23.) mit 1:0. Die Gastgeber bestimmten das Spiel bei 57% Ballbesitz und ließen den Gästen kaum Raum für eigene Aktionen.</p>
        </>
      ),
    },
    pre: {
      analytic: (
        <>
          <h2 className="text-lg font-bold font-display text-foreground mt-0 mb-4">📋 Vorbericht: FC Musterstadt vs. SV Beispielburg</h2>
          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">Formkurve</h3>
          <div className="flex gap-4 mb-3">
            <div className="flex-1">
              <div className="text-[10px] font-semibold text-foreground mb-1">FC Musterstadt</div>
              <div className="flex gap-1">{["S", "S", "U", "S", "N"].map((r, i) => <span key={i} className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center ${r === "S" ? "bg-primary/20 text-primary" : r === "N" ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground"}`}>{r}</span>)}</div>
              <div className="text-[9px] text-muted-foreground mt-1">10 Punkte aus 5 Spielen</div>
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-semibold text-foreground mb-1">SV Beispielburg</div>
              <div className="flex gap-1">{["N", "U", "S", "N", "U"].map((r, i) => <span key={i} className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center ${r === "S" ? "bg-primary/20 text-primary" : r === "N" ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground"}`}>{r}</span>)}</div>
              <div className="text-[9px] text-muted-foreground mt-1">5 Punkte aus 5 Spielen</div>
            </div>
          </div>
          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">Schlüsseldaten (letzte 5 Spiele)</h3>
          <div className="grid grid-cols-2 gap-3 text-xs mb-3">
            <div className="rounded-lg bg-primary/5 p-2.5 border border-primary/20">
              <div className="font-semibold text-primary mb-1">FC Musterstadt</div>
              <div className="space-y-0.5 text-[10px] text-muted-foreground">
                <div className="flex justify-between"><span>Ø Distanz</span><span className="text-foreground">10.4 km</span></div>
                <div className="flex justify-between"><span>Ø xG</span><span className="text-foreground">1.6</span></div>
                <div className="flex justify-between"><span>Passquote</span><span className="text-foreground">82%</span></div>
                <div className="flex justify-between"><span>Zweikampfquote</span><span className="text-foreground">56%</span></div>
              </div>
            </div>
            <div className="rounded-lg bg-destructive/5 p-2.5 border border-destructive/20">
              <div className="font-semibold text-destructive mb-1">SV Beispielburg</div>
              <div className="space-y-0.5 text-[10px] text-muted-foreground">
                <div className="flex justify-between"><span>Ø Distanz</span><span className="text-foreground">9.8 km</span></div>
                <div className="flex justify-between"><span>Ø xG</span><span className="text-foreground">1.1</span></div>
                <div className="flex justify-between"><span>Passquote</span><span className="text-foreground">76%</span></div>
                <div className="flex justify-between"><span>Zweikampfquote</span><span className="text-foreground">52%</span></div>
              </div>
            </div>
          </div>
          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2 flex items-center gap-2"><Lightbulb className="w-4 h-4 text-warning" />Taktische Empfehlungen</h3>
          <div className="space-y-1.5">
            {[
              "Gegner schwach bei hohem Pressing (PPDA 14.2) — aggressives Anlaufen empfohlen",
              "Beispielburg anfällig über rechte Seite — Roth (#2) und Vogt (#10) als Tandem nutzen",
              "Standards nutzen: Gegner hat 3 Tore aus Standards kassiert in letzten 5 Spielen",
            ].map((rec) => (
              <div key={rec} className="flex items-start gap-2 text-[10px] text-muted-foreground"><CheckCircle2 className="w-3 h-3 text-primary mt-0.5 shrink-0" /><span>{rec}</span></div>
            ))}
          </div>
        </>
      ),
      social: (
        <div className="bg-muted/30 rounded-xl p-5 border border-border/50 font-mono text-sm leading-relaxed text-foreground">
          <p className="mb-2">🔜 <strong>MATCHDAY!</strong> ⚽</p>
          <p className="mb-2">FC Musterstadt 🆚 SV Beispielburg</p>
          <p className="mb-2">📅 Sonntag, 15:30 Uhr | 🏟️ Vereinsstadion</p>
          <p className="mb-2">📊 Formkurve: S-S-U-S-N vs N-U-S-N-U</p>
          <p>🔥 Wir sind bereit! Kommt zahlreich!</p>
          <p className="text-primary mt-2">#Spieltag #FCM #Vorschau #Matchday</p>
        </div>
      ),
      newspaper: (
        <>
          <h2 className="text-lg font-bold font-display text-foreground mt-0 mb-4 italic">Musterstadt empfängt angeschlagene Beispielburger</h2>
          <p className="text-muted-foreground mb-3"><strong className="text-foreground">Vorschau.</strong> Am Sonntagnachmittag empfängt der formstarke FC Musterstadt (3 Siege in Folge) den kriselnden SV Beispielburg. Die Gastgeber gehen als klarer Favorit in die Partie am 18. Spieltag der Kreisliga A. Besonderes Augenmerk liegt auf Alexander Vogt, der in den letzten drei Spielen an 5 Toren direkt beteiligt war.</p>
        </>
      ),
    },
  };

  return (
    <>
      <div className="rounded-xl border border-border/50 bg-card/50 p-4">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex-1">
            <div className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Berichtstyp</div>
            <div className="flex gap-2 flex-wrap">
              {reportTypes.map((rt) => (
                <button key={rt.key} onClick={() => setReportType(rt.key)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${reportType === rt.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}>
                  <rt.icon className="w-3.5 h-3.5" />{rt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Schreibstil</div>
            <div className="flex gap-2 flex-wrap">
              {reportStyles.map((rs) => (
                <button key={rs.key} onClick={() => setReportStyle(rs.key)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${reportStyle === rs.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}>
                  <rs.icon className="w-3.5 h-3.5" />{rs.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-primary/20 bg-card/50 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Sparkles className="w-5 h-5 text-primary" /></div>
          <div>
            <div className="text-sm font-bold font-display">{reportTypes.find((r) => r.key === reportType)?.label}</div>
            <div className="text-[10px] text-muted-foreground">FieldIQ AI · Stil: {reportStyles.find((r) => r.key === reportStyle)?.label} · Länge: Mittel</div>
          </div>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-3">
          {[
            { label: "Vorbericht", active: reportType === "pre" },
            { label: "Halbzeit", active: reportType === "halftime" },
            { label: "Nachbericht", active: reportType === "post" },
          ].map((step) => (
            <div key={step.label} className={`rounded-xl border px-3 py-2 text-xs ${step.active ? "border-primary/40 bg-primary/10 text-foreground" : "border-border/30 bg-background/50 text-muted-foreground"}`}>
              {step.label}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={`${reportType}-${reportStyle}`} className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
            {reportContent[reportType]?.[reportStyle]}
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/50 flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Sparkles className="w-3.5 h-3.5 text-primary" /><span>Generiert in 4.2 Sekunden</span></div>
          <div className="flex gap-1.5 flex-wrap">
            <Button variant="outline" size="sm" className="text-xs h-7 gap-1"><Clipboard className="w-3 h-3" /> Kopieren</Button>
            <Button variant="outline" size="sm" className="text-xs h-7 gap-1"><Download className="w-3 h-3" /> PDF</Button>
            <Button variant="outline" size="sm" className="text-xs h-7 gap-1"><Mail className="w-3 h-3" /> E-Mail</Button>
            <Button variant="outline" size="sm" className="text-xs h-7 gap-1"><MessageCircle className="w-3 h-3" /> WhatsApp</Button>
            <Button variant="outline" size="sm" className="text-xs h-7 gap-1"><Share2 className="w-3 h-3" /> X</Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Dumbbell className="w-5 h-5 text-primary" /></div>
          <div>
            <div className="text-sm font-bold font-display">KI-Trainingsplan — Woche nach dem Spiel</div>
            <div className="text-[10px] text-muted-foreground">Basierend auf Analyse: FC Musterstadt 2:1 SV Beispielburg</div>
          </div>
        </div>

        <div className="rounded-lg bg-warning/5 border border-warning/20 p-3 mb-4">
          <div className="flex items-center gap-1.5 mb-2"><Lightbulb className="w-3.5 h-3.5 text-warning" /><span className="text-[10px] font-semibold text-warning">Erkannte Trainingsbedarfe aus dem Spiel</span></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { area: "Linke Seite", issue: "Nur 28% Angriffe", severity: "hoch" },
              { area: "Luftkämpfe", issue: "42% Kopfballquote", severity: "mittel" },
              { area: "Standards", issue: "0 Chancen aus 3 Ecken", severity: "mittel" },
              { area: "Ausdauer 2. HZ", issue: "12% Leistungsabfall", severity: "hoch" },
            ].map((need) => (
              <div key={need.area} className="rounded bg-card/80 border border-border/30 p-2">
                <div className="text-[10px] font-semibold text-foreground">{need.area}</div>
                <div className="text-[9px] text-muted-foreground">{need.issue}</div>
                <span className={`text-[8px] font-bold ${need.severity === "hoch" ? "text-destructive" : "text-warning"}`}>Priorität: {need.severity}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-3">
          {[
            { day: "Montag", focus: "Regeneration & Analyse", color: "text-primary", items: ["Lockeres Auslaufen 20'", "Mobilität & Stretching", "Video-Analyse: Spielaufbau über links, Konterabsicherung"] },
            { day: "Mittwoch", focus: "Taktik & Passspiel", color: "text-primary", items: ["Rondo 4v2 — Passquote unter Druck steigern", "Spielaufbau über links trainieren (König #7 + LV)", "Pressing-Staffelung 2. Hälfte simulieren", "Standards: Kurze Ecken einstudieren"] },
            { day: "Donnerstag", focus: "Zweikampf & Lufthoheit", color: "text-warning", items: ["Kopfball-Training (Offensiv + Defensiv)", "1-gegen-1-Übungen in Strafraumzonen", "Gegenpressing nach Ballverlust trainieren"] },
            { day: "Freitag", focus: "Intensität & Abschluss", color: "text-destructive", items: ["Sprint-Intervalle (Top-Speed halten bis 80. Min)", "Abschluss im 16er nach Flanken von links", "Kontersituationen 3v2 üben"] },
          ].map((session) => (
            <div key={session.day} className="rounded-lg bg-card/80 border border-border/30 p-3">
              <div className={`text-xs font-semibold ${session.color} mb-0.5`}>{session.day}</div>
              <div className="text-[10px] font-medium text-foreground mb-2">{session.focus}</div>
              <div className="space-y-1">
                {session.items.map((item) => (
                  <div key={item} className="text-[9px] text-muted-foreground flex items-start gap-1"><ChevronRight className="w-2.5 h-2.5 text-primary mt-0.5 shrink-0" /><span>{item}</span></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function StatRow({ label, value, highlight, warning }: { label: string; value: string | number; highlight?: boolean; warning?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={`text-[10px] font-bold ${warning ? "text-destructive" : highlight ? "text-primary" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

function PerformanceBar({ label, value, max, unit }: { label: string; value: number; max: number; unit: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value.toFixed(1)}{unit}</span>
      </div>
      <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.2 }} />
      </div>
    </div>
  );
}

function getRadarPoints(cx: number, cy: number, r: number, sides: number, values?: number[]): string {
  const points: string[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
    const radius = values ? r * Math.min(values[i] || 0, 1) : r;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    points.push(`${x},${y}`);
  }
  return points.join(" ");
}

function HeatmapField({ grid, maxVal }: { grid: number[][]; maxVal: number; small?: boolean }) {
  const cellWidth = 105 / HEATMAP_COLS;
  const cellHeight = 68 / HEATMAP_ROWS;
  const heatSpots: { x: number; y: number; intensity: number }[] = [];
  grid.forEach((row, rowIdx) => {
    row.forEach((val, colIdx) => {
      if (val > maxVal * 0.05) {
        heatSpots.push({ x: colIdx * cellWidth + cellWidth / 2, y: rowIdx * cellHeight + cellHeight / 2, intensity: val / maxVal });
      }
    });
  });

  return (
    <div className="relative rounded-xl overflow-hidden aspect-[105/68]">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 105 68" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="demoGrass" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(160, 45%, 38%)" />
            <stop offset="50%" stopColor="hsl(155, 42%, 35%)" />
            <stop offset="100%" stopColor="hsl(150, 40%, 32%)" />
          </linearGradient>
          <pattern id="demoStripes" patternUnits="userSpaceOnUse" width="10" height="68">
            <rect x="0" y="0" width="5" height="68" fill="hsl(158, 44%, 36%)" />
            <rect x="5" y="0" width="5" height="68" fill="hsl(155, 40%, 34%)" />
          </pattern>
          <radialGradient id="dHeatLow"><stop offset="0%" stopColor="hsl(160,60%,48%)" stopOpacity="0.5" /><stop offset="60%" stopColor="hsl(160,50%,42%)" stopOpacity="0.2" /><stop offset="100%" stopColor="transparent" /></radialGradient>
          <radialGradient id="dHeatMedLow"><stop offset="0%" stopColor="hsl(120,55%,48%)" stopOpacity="0.65" /><stop offset="50%" stopColor="hsl(140,50%,42%)" stopOpacity="0.3" /><stop offset="100%" stopColor="transparent" /></radialGradient>
          <radialGradient id="dHeatMed"><stop offset="0%" stopColor="hsl(55,85%,52%)" stopOpacity="0.8" /><stop offset="40%" stopColor="hsl(70,70%,48%)" stopOpacity="0.4" /><stop offset="100%" stopColor="transparent" /></radialGradient>
          <radialGradient id="dHeatHigh"><stop offset="0%" stopColor="hsl(25,90%,52%)" stopOpacity="0.85" /><stop offset="35%" stopColor="hsl(40,80%,48%)" stopOpacity="0.45" /><stop offset="100%" stopColor="transparent" /></radialGradient>
          <radialGradient id="dHeatMax"><stop offset="0%" stopColor="hsl(0,85%,50%)" stopOpacity="0.95" /><stop offset="25%" stopColor="hsl(10,90%,48%)" stopOpacity="0.7" /><stop offset="55%" stopColor="hsl(25,80%,45%)" stopOpacity="0.3" /><stop offset="100%" stopColor="transparent" /></radialGradient>
          <filter id="dHeatBlur1" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur in="SourceGraphic" stdDeviation="5" /></filter>
          <filter id="dHeatBlur2" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur in="SourceGraphic" stdDeviation="2.5" /></filter>
        </defs>
        <rect x="0" y="0" width="105" height="68" fill="url(#demoGrass)" />
        <rect x="0" y="0" width="105" height="68" fill="url(#demoStripes)" opacity="0.25" />
        <g filter="url(#dHeatBlur1)" opacity="0.55">
          {heatSpots.filter((s) => s.intensity > 0.15).map((spot, i) => {
            const gid = spot.intensity > 0.8 ? "dHeatMax" : spot.intensity > 0.6 ? "dHeatHigh" : spot.intensity > 0.4 ? "dHeatMed" : spot.intensity > 0.2 ? "dHeatMedLow" : "dHeatLow";
            const r = 6 + spot.intensity * 12;
            return <ellipse key={`b${i}`} cx={spot.x} cy={spot.y} rx={r * 1.3} ry={r} fill={`url(#${gid})`} />;
          })}
        </g>
        <g filter="url(#dHeatBlur2)" opacity="0.8">
          {heatSpots.map((spot, i) => {
            const gid = spot.intensity > 0.8 ? "dHeatMax" : spot.intensity > 0.6 ? "dHeatHigh" : spot.intensity > 0.4 ? "dHeatMed" : spot.intensity > 0.2 ? "dHeatMedLow" : "dHeatLow";
            const r = 4 + spot.intensity * 8;
            return <ellipse key={`d${i}`} cx={spot.x} cy={spot.y} rx={r} ry={r * 0.85} fill={`url(#${gid})`} opacity={0.6 + spot.intensity * 0.4} />;
          })}
        </g>
        <g stroke="white" strokeOpacity="0.4" fill="none">
          <rect x="0.5" y="0.5" width="104" height="67" strokeWidth="0.4" />
          <line x1="52.5" y1="0" x2="52.5" y2="68" strokeWidth="0.3" />
          <circle cx="52.5" cy="34" r="9.15" strokeWidth="0.3" />
          <circle cx="52.5" cy="34" r="0.6" fill="white" fillOpacity="0.35" stroke="none" />
          <rect x="0" y="13.84" width="16.5" height="40.32" strokeWidth="0.25" strokeOpacity="0.3" />
          <rect x="88.5" y="13.84" width="16.5" height="40.32" strokeWidth="0.25" strokeOpacity="0.3" />
          <rect x="0" y="24.84" width="5.5" height="18.32" strokeWidth="0.2" strokeOpacity="0.25" />
          <rect x="99.5" y="24.84" width="5.5" height="18.32" strokeWidth="0.2" strokeOpacity="0.25" />
          <circle cx="11" cy="34" r="0.45" fill="white" fillOpacity="0.3" stroke="none" />
          <circle cx="94" cy="34" r="0.45" fill="white" fillOpacity="0.3" stroke="none" />
          <path d="M 16.5 27.5 A 9.15 9.15 0 0 1 16.5 40.5" strokeWidth="0.2" strokeOpacity="0.25" />
          <path d="M 88.5 27.5 A 9.15 9.15 0 0 0 88.5 40.5" strokeWidth="0.2" strokeOpacity="0.25" />
          <path d="M 0 1 A 1 1 0 0 0 1 0" strokeWidth="0.15" strokeOpacity="0.2" />
          <path d="M 104 0 A 1 1 0 0 0 105 1" strokeWidth="0.15" strokeOpacity="0.2" />
          <path d="M 0 67 A 1 1 0 0 1 1 68" strokeWidth="0.15" strokeOpacity="0.2" />
          <path d="M 105 67 A 1 1 0 0 0 104 68" strokeWidth="0.15" strokeOpacity="0.2" />
        </g>
      </svg>
    </div>
  );
}

function PlayerHeatmapCarousel({ players, onSelectPlayer }: { players: DemoPlayer[]; onSelectPlayer: (p: DemoPlayer) => void; }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start", dragFree: true });
  const autoplayRef = useRef<NodeJS.Timeout | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!emblaApi || isPaused) return;
    const startAutoplay = () => {
      autoplayRef.current = setInterval(() => {
        if (emblaApi.canScrollNext()) emblaApi.scrollNext();
        else emblaApi.scrollTo(0);
      }, 3000);
    };
    startAutoplay();
    return () => {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
    };
  }, [emblaApi, isPaused]);

  const handleMouseEnter = () => {
    setIsPaused(true);
    if (autoplayRef.current) clearInterval(autoplayRef.current);
  };
  const handleMouseLeave = () => setIsPaused(false);
  const scrollPrev = () => emblaApi?.scrollPrev();
  const scrollNext = () => emblaApi?.scrollNext();

  return (
    <div className="relative">
      <Button variant="outline" size="icon" className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background/90 backdrop-blur-sm shadow-lg border-border/50 hover:bg-primary/10" onClick={scrollPrev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background/90 backdrop-blur-sm shadow-lg border-border/50 hover:bg-primary/10" onClick={scrollNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>

      <div ref={emblaRef} className="overflow-hidden mx-4" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        <div className="flex gap-4">
          {players.map((p, i) => {
            const playerMaxHeat = Math.max(...p.heatmap.flat(), 0.01);
            return (
              <motion.div key={p.name} className="flex-shrink-0 w-[280px] md:w-[320px] rounded-xl border border-border/50 bg-card/50 p-4 hover:border-primary/50 transition-all cursor-pointer" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} onClick={() => onSelectPlayer(p)}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><span className="text-sm font-bold font-display text-primary">{p.num}</span></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><span className="text-sm font-bold font-display text-foreground truncate">{p.name}</span><span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{p.pos}</span></div>
                    <div className="flex items-center gap-1 mt-0.5"><span className="text-[10px] text-muted-foreground">Bewertung:</span><span className={`text-xs font-bold ${p.rating >= 7.5 ? "text-primary" : p.rating >= 6.5 ? "text-foreground" : "text-warning"}`}>{p.rating.toFixed(1)}</span>{p.trend === "up" && <ArrowUpRight className="w-3 h-3 text-primary" />}{p.trend === "down" && <ArrowDownRight className="w-3 h-3 text-destructive" />}{p.trend === "stable" && <Minus className="w-3 h-3 text-muted-foreground" />}</div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[{ label: "km", value: p.km.toFixed(1) }, { label: "Top km/h", value: p.topSpeed.toFixed(1) }, { label: "Sprints", value: p.sprints.toString() }, { label: "Passquote", value: `${p.passAccuracy}%` }].map((s) => (
                    <div key={s.label} className="text-center"><div className="text-xs font-bold font-display text-foreground">{s.value}</div><div className="text-[8px] text-muted-foreground">{s.label}</div></div>
                  ))}
                </div>
                <div className="text-[9px] text-muted-foreground mb-1 font-display">Individuelle Heatmap</div>
                <HeatmapField grid={p.heatmap} maxVal={playerMaxHeat} small />
                <Button variant="outline" size="sm" className="w-full mt-3 text-[10px] h-7 gap-1" onClick={(e) => { e.stopPropagation(); onSelectPlayer(p); }}><Eye className="w-3 h-3" />Analysieren</Button>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 mt-3 text-[10px] text-muted-foreground">
        <motion.div className={`w-1.5 h-1.5 rounded-full ${isPaused ? "bg-warning" : "bg-primary"}`} animate={{ opacity: isPaused ? 1 : [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: isPaused ? 0 : Infinity }} />
        <span>{isPaused ? "Pausiert — hover verlassen zum Fortsetzen" : "Auto-Scroll aktiv"}</span>
      </div>
    </div>
  );
}
