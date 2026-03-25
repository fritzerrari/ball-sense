import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, RotateCcw, AlertTriangle, TrendingUp, Zap, Users, Activity, Timer,
  Bell, ChevronRight, ArrowRight, Target, Shield,
  BarChart3, Sparkles, FileText, Dumbbell, Newspaper, Lightbulb,
  CheckCircle2, Brain, Eye, Award, Hash
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/lib/i18n";

type DemoState = "notification" | "loading" | "analyzing" | "dashboard";

export function DemoSection() {
  const [state, setState] = useState<DemoState>("notification");
  const [progress, setProgress] = useState(0);
  const { language } = useTranslation();

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
            setState("dashboard");
          }
        }, 300);
      }
    }, 250);
  }, []);

  const reset = useCallback(() => {
    setState("notification");
    setProgress(0);
  }, []);

  const de = language === "de";

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
          <span className="text-xs font-semibold text-primary font-display tracking-wider uppercase mb-3 block">
            {de ? "Interaktive Demo" : "Interactive Demo"}
          </span>
          <h2 className="text-3xl md:text-4xl font-bold font-display mb-3">
            {de ? "Erlebe das Coaching-Cockpit — ohne Anmeldung" : "Experience the coaching cockpit — no signup needed"}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm leading-relaxed">
            {de
              ? "Coach Summary, KI-Erkenntnisse, Gefahrenzonen, Spielzug-Replay, Report-Workflows und Trainingsplan — alles in einem klaren Flow."
              : "Coach Summary, AI insights, danger zones, tactical replay, report workflows and training plan — all in one clear flow."}
          </p>
        </motion.div>

        <div className="max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            {state === "notification" && <NotificationState key="notif" onLoad={startLoad} de={de} />}
            {state === "loading" && <LoadingState key="load" progress={progress} phase="load" de={de} />}
            {state === "analyzing" && <LoadingState key="analyze" progress={progress} phase="analyze" de={de} />}
            {state === "dashboard" && <DashboardState key="dash" onReset={reset} onReload={() => { reset(); setTimeout(startLoad, 100); }} de={de} />}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function NotificationState({ onLoad, de }: { onLoad: () => void; de: boolean }) {
  const analysisCategories = [
    { icon: Brain, label: de ? "KI-Spielanalyse" : "AI Analysis", items: de ? ["Formationen", "Spielphasen", "Gefahrenzonen", "Ballverlustmuster"] : ["Formations", "Match phases", "Danger zones", "Ball loss patterns"] },
    { icon: BarChart3, label: "Coach Summary", items: de ? ["Spielkontrolle", "Fokusspieler", "Warnsignal", "Nächste Aktion"] : ["Match control", "Focus player", "Alert", "Next action"] },
    { icon: Eye, label: de ? "Spielzug-Replay" : "Tactical Replay", items: de ? ["Animierte Positionen", "Schlüsselszenen", "Timeline-Scrub", "Geschwindigkeit"] : ["Animated positions", "Key scenes", "Timeline scrub", "Speed control"] },
    { icon: Sparkles, label: de ? "KI-Berichte" : "AI Reports", items: de ? ["Vorbericht", "Halbzeitanalyse", "Nachbericht", "3 Stile"] : ["Pre-match", "Halftime", "Post-match", "3 styles"] },
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
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-sm font-semibold font-display text-foreground">{de ? "KI-Analyse" : "AI Analysis"}</div>
              <div className="text-[10px] text-muted-foreground">FC Musterstadt · {de ? "Saison" : "Season"} 2025/26</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="text-[10px] font-semibold text-primary mb-3 uppercase tracking-wide flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            {de ? "Was FieldIQ alles auswertet" : "What FieldIQ analyzes"}
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
            <div className="text-sm font-bold font-display text-foreground mb-1">
              🎉 {de ? "Neuer Coaching-Report verfügbar!" : "New coaching report available!"}
            </div>
            <div className="text-xs text-foreground/80 mb-2">
              FC Musterstadt vs. SV Beispielburg · {de ? "Sonntag" : "Sunday"}, 2. {de ? "März" : "March"} 2026 · 15:30
            </div>
            <div className="text-xs text-muted-foreground mb-4">
              {de
                ? "KI-Analyse abgeschlossen. Coach Summary, Gefahrenzonen, Spielzug-Replay und taktische Empfehlungen sind bereit."
                : "AI analysis complete. Coach summary, danger zones, tactical replay and tactical recommendations are ready."}
            </div>
            <Button variant="hero" size="sm" className="gap-2" onClick={onLoad}>
              <Play className="w-4 h-4" />
              {de ? "Report laden" : "Load report"}
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function LoadingState({ progress, phase, de }: { progress: number; phase: "load" | "analyze"; de: boolean }) {
  const loadLabels = de
    ? ["Video-Frames extrahieren...", "Bilder an KI senden...", "Formationen erkennen...", "Daten validieren..."]
    : ["Extracting video frames...", "Sending images to AI...", "Detecting formations...", "Validating data..."];
  const analyzeLabels = de
    ? ["Coach Summary erstellen...", "Gefahrenzonen berechnen...", "Spielzug-Positionen schätzen...", "Taktische Muster erkennen...", "Trainingsplan generieren...", "Berichte vorbereiten...", "Cockpit aufbauen..."]
    : ["Creating coach summary...", "Computing danger zones...", "Estimating player positions...", "Detecting tactical patterns...", "Generating training plan...", "Preparing reports...", "Building cockpit..."];
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
          {phase === "load"
            ? (de ? "Video wird analysiert" : "Analyzing video")
            : (de ? "Coaching-Report wird erstellt" : "Creating coaching report")}
        </h3>
        <p className="text-sm text-muted-foreground">{labels[idx]}</p>
      </div>
      <div className="max-w-xs mx-auto space-y-2">
        <Progress value={progress} className="h-2" />
        <div className="text-xs text-muted-foreground">{progress}%</div>
      </div>
      <div className="flex items-center justify-center gap-2 text-xs text-warning">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>{de ? "Demo-Modus: Beispieldaten" : "Demo mode: sample data"}</span>
      </div>
    </motion.div>
  );
}

function DashboardState({ onReload, de }: { onReset: () => void; onReload: () => void; de: boolean }) {
  const coachSummary = [
    {
      icon: Target,
      label: de ? "Spielkontrolle" : "Match control",
      title: de ? "Dominante 1. Halbzeit" : "Dominant 1st half",
      detail: de ? "Klare Feldüberlegenheit bis zur 40. Minute, dann nachlassende Intensität." : "Clear pitch control until minute 40, then declining intensity.",
    },
    {
      icon: AlertTriangle,
      label: de ? "Warnsignal" : "Warning",
      title: de ? "Links anfällig in HZ 2" : "Left side vulnerable in 2nd half",
      detail: de ? "3 von 4 Gegner-Chancen entstanden über die linke Abwehrseite nach der Pause." : "3 of 4 opponent chances came via left defense after halftime.",
    },
    {
      icon: Sparkles,
      label: de ? "Coach-Fokus" : "Coach focus",
      title: de ? "A. Vogt (#10) priorisieren" : "Prioritize A. Vogt (#10)",
      detail: de ? "Stärkster Spieler der Partie. 1 Tor, 1 Assist. Höher positionieren." : "Strongest player of the match. 1 goal, 1 assist. Position higher.",
    },
  ];

  const dangerZones = [
    { zone: de ? "Angriff rechts" : "Attack right", level: "high" as const, pct: 62 },
    { zone: de ? "Angriff Mitte" : "Attack center", level: "medium" as const, pct: 28 },
    { zone: de ? "Angriff links" : "Attack left", level: "low" as const, pct: 10 },
    { zone: de ? "Defensiv links" : "Defensive left", level: "high" as const, pct: 0, risk: true },
    { zone: de ? "Defensiv Mitte" : "Defensive center", level: "low" as const, pct: 0 },
    { zone: de ? "Defensiv rechts" : "Defensive right", level: "low" as const, pct: 0 },
  ];

  const reportFlow = [
    { label: de ? "Vorbericht" : "Pre-match", desc: de ? "Matchplan, Formkurve, Gegnerbild" : "Match plan, form curve, opponent profile", icon: FileText },
    { label: de ? "Halbzeitanalyse" : "Halftime", desc: de ? "Sofortige Anpassungen & To-dos" : "Instant adjustments & to-dos", icon: Timer },
    { label: de ? "Nachbericht" : "Post-match", desc: de ? "KI-Fazit, Export & Teilen" : "AI summary, export & share", icon: Newspaper },
  ];

  const coachActions = [
    de ? "Rechte Überladung bleibt das gefährlichste Angriffsmuster — konsequenter nutzen." : "Right overload remains the most dangerous attack pattern — use more consistently.",
    de ? "Linke Defensivseite gezielt stärken: König (#7) enger an der Abwehrkette halten." : "Strengthen left defensive side: keep König (#7) closer to the back line.",
    de ? "Pressing-Intensität ab Minute 60 situativer einsetzen — Laufleistung nimmt spürbar ab." : "Apply pressing intensity more selectively from minute 60 — running performance drops noticeably.",
    de ? "Standards besser nutzen: Flache Ecken statt hohe Flanken bei gegnerischer Lufthoheit." : "Better use of set pieces: short corners instead of high crosses against aerial dominance.",
  ];

  const trainingWeek = [
    { day: de ? "Montag" : "Monday", focus: de ? "Regeneration + Videoanalyse" : "Recovery + video analysis", detail: de ? "Taktikbesprechung Gefahrenzonen" : "Tactical review of danger zones" },
    { day: de ? "Dienstag" : "Tuesday", focus: de ? "Passspiel unter Druck" : "Passing under pressure", detail: de ? "Rondos, enge Räume, Spielaufbau" : "Rondos, tight spaces, build-up play" },
    { day: de ? "Mittwoch" : "Wednesday", focus: de ? "Defensive Stabilität links" : "Left-side defensive stability", detail: de ? "Verschieben, Doppelsicherung, 1v1" : "Shifting, double coverage, 1v1" },
    { day: de ? "Donnerstag" : "Thursday", focus: de ? "Konterabsicherung" : "Counter-attack protection", detail: de ? "Umschalten nach Ballverlust" : "Transition after ball loss" },
    { day: de ? "Freitag" : "Friday", focus: de ? "Standards + Abschluss" : "Set pieces + finishing", detail: de ? "Eckball-Varianten, Freistoß" : "Corner kick variations, free kicks" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-4"
    >
      <div className="rounded-lg bg-warning/10 border border-warning/30 px-4 py-2 flex items-center gap-3 text-xs">
        <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
        <span className="text-warning font-medium">
          {de ? "Demo-Modus: Dies sind Beispiel-Analysedaten — keine echten Spielergebnisse." : "Demo mode: These are sample analysis data — not real match results."}
        </span>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={onReload} className="text-xs h-7 gap-1">
            <RotateCcw className="w-3 h-3" /> {de ? "Neu laden" : "Reload"}
          </Button>
        </div>
      </div>

      {/* Match header */}
      <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-lg font-bold font-display">FC Musterstadt 2 : 1 SV Beispielburg</div>
            <div className="text-xs text-muted-foreground">02.03.2026 · Vereinsstadion · 90 Min.</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20 font-medium">
              {de ? "KI-Analyse" : "AI Analysis"}
            </span>
            <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20 font-medium">
              ~75% Confidence
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: de ? "Dominanz" : "Dominance", value: de ? "Dominant" : "Dominant", color: "text-primary" },
            { label: "Tempo", value: de ? "Hoch" : "High", color: "text-primary" },
            { label: de ? "Chancen" : "Chances", value: "7 : 4", color: "text-foreground" },
            { label: de ? "Formationsänderung" : "Formation change", value: de ? "Ja (62')" : "Yes (62')", color: "text-warning" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
              <div className={`text-base font-bold font-display ${stat.color}`}>{stat.value}</div>
              <div className="text-[9px] text-muted-foreground mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-card/80 border border-primary/20 shadow-sm p-1 rounded-xl backdrop-blur-sm grid grid-cols-4 w-full h-auto">
          <TabsTrigger value="overview" className="text-xs sm:text-sm gap-1.5 px-2 sm:px-4 py-2 font-semibold rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
            <Brain className="w-3.5 h-3.5 shrink-0" /> <span className="hidden sm:inline">{de ? "Übersicht" : "Overview"}</span><span className="sm:hidden">{de ? "Übersicht" : "Overview"}</span>
          </TabsTrigger>
          <TabsTrigger value="replay" className="text-xs sm:text-sm gap-1.5 px-2 sm:px-4 py-2 font-semibold rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
            <Eye className="w-3.5 h-3.5 shrink-0" /> <span className="hidden sm:inline">{de ? "Replay" : "Replay"}</span><span className="sm:hidden">Replay</span>
          </TabsTrigger>
          <TabsTrigger value="training" className="text-xs sm:text-sm gap-1.5 px-2 sm:px-4 py-2 font-semibold rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
            <Dumbbell className="w-3.5 h-3.5 shrink-0" /> <span className="hidden sm:inline">{de ? "Training" : "Training"}</span><span className="sm:hidden">Training</span>
          </TabsTrigger>
          <TabsTrigger value="report" className="text-xs sm:text-sm gap-1.5 px-2 sm:px-4 py-2 font-semibold rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
            <FileText className="w-3.5 h-3.5 shrink-0" /> <span className="hidden sm:inline">{de ? "Berichte" : "Reports"}</span><span className="sm:hidden">{de ? "Report" : "Report"}</span>
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-4">
          {/* Coach Summary */}
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 to-transparent p-4 sm:p-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-primary font-semibold">Coach Summary</div>
            <h3 className="text-xl font-bold font-display mt-1 mb-4">{de ? "Schneller Überblick für Trainer" : "Quick overview for coaches"}</h3>

            <div className="grid gap-3 lg:grid-cols-3">
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

          {/* Danger Zones */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border/50 bg-card/50 p-4">
              <div className="text-xs font-semibold text-foreground/80 mb-3 font-display flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                {de ? "Gefahrenzonen" : "Danger Zones"}
              </div>
              <div className="space-y-2">
                {dangerZones.map((zone) => (
                  <div key={zone.zone} className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground w-28 truncate">{zone.zone}</span>
                    {zone.pct > 0 ? (
                      <>
                        <div className="flex-1 h-2.5 rounded-full bg-muted/30 overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${zone.level === "high" ? "bg-primary" : zone.level === "medium" ? "bg-primary/50" : "bg-primary/25"}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${zone.pct}%` }}
                            transition={{ delay: 0.3, duration: 0.8 }}
                          />
                        </div>
                        <span className="text-[10px] font-medium text-foreground w-8 text-right">{zone.pct}%</span>
                      </>
                    ) : (
                      <div className="flex-1 flex items-center">
                        <span className={`text-[9px] px-2 py-0.5 rounded-full border ${zone.risk ? "bg-destructive/10 text-destructive border-destructive/30" : "bg-primary/10 text-primary border-primary/30"}`}>
                          {zone.risk ? (de ? "Anfällig" : "Vulnerable") : (de ? "Stabil" : "Stable")}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/50 p-4">
              <div className="text-xs font-semibold text-foreground/80 mb-3 font-display">{de ? "Report-Workflow" : "Report Workflow"}</div>
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

          {/* Opponent History Profile */}
          <div className="rounded-2xl border border-accent/30 bg-card/50 p-4 overflow-hidden">
            <div className="h-1 -mx-4 -mt-4 mb-4 bg-gradient-to-r from-accent to-primary/50" />
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-accent-foreground" />
                <span className="text-sm font-semibold font-display">{de ? "Gegner-Profil: SV Beispielburg" : "Opponent Profile: SV Beispielburg"}</span>
              </div>
              <span className="text-[9px] bg-accent/10 text-accent-foreground px-2 py-0.5 rounded-full border border-accent/30">
                {de ? "3 Spiele analysiert" : "3 matches analyzed"}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {[
                { label: de ? "Bilanz" : "Record", value: "2S / 0U / 1N", sub: de ? "67% Siegquote" : "67% win rate", color: "text-primary" },
                { label: de ? "⌀ Tore" : "⌀ Goals", value: "2.3 : 1.0", sub: de ? "Erzielt : Kassiert" : "Scored : Conceded" },
                { label: de ? "⌀ Ballbesitz" : "⌀ Possession", value: "56%", sub: de ? "Eigener Durchschnitt" : "Own average" },
                { label: de ? "Angriffsseite" : "Attack side", value: de ? "Rechts" : "Right", sub: de ? "Stärkste Seite" : "Strongest side" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-border/50 bg-muted/30 p-2.5">
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{s.label}</p>
                  <p className={`text-sm font-bold font-display mt-0.5 ${s.color ?? ""}`}>{s.value}</p>
                  <p className="text-[9px] text-muted-foreground">{s.sub}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 mb-3">
              <p className="text-[10px] font-semibold text-destructive mb-1">{de ? "Schwachstellen bei Spielen gegen diesen Gegner" : "Weaknesses in matches against this opponent"}</p>
              <div className="space-y-1">
                {[
                  de ? "Linke Defensivseite in der 2. Halbzeit anfällig" : "Left defensive side vulnerable in 2nd half",
                  de ? "Konterabsicherung nach Ballverlusten im Aufbau" : "Counter protection after build-up ball losses",
                ].map((w) => (
                  <p key={w} className="text-[10px] text-foreground/80 flex items-start gap-1.5">
                    <span className="text-destructive/60 mt-0.5">•</span>{w}
                  </p>
                ))}
              </div>
            </div>
            <p className="text-[9px] text-muted-foreground text-center">
              {de ? "Basiert ausschließlich auf eigenen Spieldaten — keine externen Quellen." : "Based exclusively on your own match data — no external sources."}
            </p>
          </div>

          {/* KI Insights */}
          <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 to-transparent p-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-warning" />
              <span className="text-xs font-semibold font-display text-foreground/80">
                {de ? "KI-Erkenntnisse aus diesem Spiel" : "AI insights from this match"}
              </span>
              <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                {de ? "Auto-generiert" : "Auto-generated"}
              </span>
            </div>
            <div className="grid md:grid-cols-2 gap-2">
              {coachActions.map((insight) => (
                <motion.div key={insight} className="flex items-start gap-2 text-[10px] text-muted-foreground rounded-lg bg-card/50 p-2.5 border border-border/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
                  <span>{insight}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* REPLAY TAB */}
        <TabsContent value="replay" className="space-y-4">
          <div className="rounded-2xl border border-border/50 bg-card/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-semibold text-foreground/80 font-display flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                {de ? "Spielzug-Replay (KI-geschätzt)" : "Tactical Replay (AI-estimated)"}
              </div>
              <span className="text-[9px] bg-warning/10 text-warning px-2 py-0.5 rounded-full border border-warning/30">
                ~75% {de ? "Genauigkeit" : "accuracy"}
              </span>
            </div>

            {/* Mini field with animated dots */}
            <div className="aspect-[105/68] rounded-lg border border-border/50 relative overflow-hidden bg-[hsl(160,45%,30%)]">
              <svg className="w-full h-full" viewBox="0 0 105 68" preserveAspectRatio="xMidYMid slice">
                <defs>
                  <linearGradient id="demoGrass" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="hsl(160, 45%, 38%)" />
                    <stop offset="100%" stopColor="hsl(150, 40%, 32%)" />
                  </linearGradient>
                </defs>
                <rect x="0" y="0" width="105" height="68" fill="url(#demoGrass)" />
                <g stroke="white" strokeOpacity="0.35" fill="none" strokeWidth="0.3">
                  <rect x="1" y="1" width="103" height="66" rx="0.5" />
                  <line x1="52.5" y1="1" x2="52.5" y2="67" />
                  <circle cx="52.5" cy="34" r="9.15" />
                  <rect x="1" y="13.84" width="16.5" height="40.32" />
                  <rect x="87.5" y="13.84" width="16.5" height="40.32" />
                </g>
                {/* Home team (blue) */}
                {[
                  [8, 34], [20, 15], [20, 34], [20, 53], [35, 10], [35, 28], [35, 40], [35, 58],
                  [55, 20], [55, 48], [70, 34],
                ].map(([x, y], i) => (
                  <motion.circle
                    key={`h${i}`}
                    r="2.2"
                    fill="hsl(var(--primary))"
                    fillOpacity="0.9"
                    stroke="white"
                    strokeWidth="0.4"
                    initial={{ cx: 52.5, cy: 34 }}
                    animate={{ cx: x, cy: y }}
                    transition={{ delay: 0.3 + i * 0.08, duration: 1.2, ease: "easeOut" }}
                  />
                ))}
                {/* Away team (red) */}
                {[
                  [97, 34], [85, 15], [85, 34], [85, 53], [70, 12], [70, 28], [70, 40], [70, 56],
                  [55, 15], [55, 53], [40, 34],
                ].map(([x, y], i) => (
                  <motion.circle
                    key={`a${i}`}
                    r="2.2"
                    fill="hsl(0, 70%, 55%)"
                    fillOpacity="0.8"
                    stroke="white"
                    strokeWidth="0.4"
                    initial={{ cx: 52.5, cy: 34 }}
                    animate={{ cx: x, cy: y }}
                    transition={{ delay: 0.5 + i * 0.08, duration: 1.2, ease: "easeOut" }}
                  />
                ))}
                {/* Ball */}
                <motion.circle
                  r="1.5"
                  fill="white"
                  initial={{ cx: 52.5, cy: 34 }}
                  animate={{ cx: [52.5, 60, 72, 68], cy: [34, 28, 32, 35] }}
                  transition={{ delay: 1, duration: 3, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
                />
              </svg>
            </div>

            <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-primary" /><span>{de ? "Heim" : "Home"}</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-[hsl(0,70%,55%)]" /><span>{de ? "Gast" : "Away"}</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-white border border-border" /><span>Ball</span></div>
              </div>
              <span>{de ? "Schlüsselszene: Angriff über rechts (23')" : "Key scene: Attack via right (23')"}</span>
            </div>

            <div className="mt-3 rounded-lg bg-muted/20 p-3 border border-border/30">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <AlertTriangle className="h-3 w-3 text-warning" />
                <span>
                  {de
                    ? "Die Positionen sind KI-Schätzungen aus Einzelframes (1 Bild/30s). Für taktische Muster geeignet, nicht für exakte Laufwege."
                    : "Positions are AI estimates from single frames (1 image/30s). Suitable for tactical patterns, not for exact running paths."}
                </span>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TRAINING TAB */}
        <TabsContent value="training" className="space-y-4">
          <div className="rounded-2xl border border-border/50 bg-card/50 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Dumbbell className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-foreground/80 font-display">
                {de ? "KI-Trainingsplan (basierend auf Analyse)" : "AI Training Plan (based on analysis)"}
              </span>
              <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                {de ? "Auto-generiert" : "Auto-generated"}
              </span>
            </div>
            <div className="space-y-2">
              {trainingWeek.map((day, i) => (
                <motion.div
                  key={day.day}
                  className="rounded-xl border border-border/40 bg-background/60 p-3 flex items-start gap-3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                >
                  <div className="w-20 shrink-0">
                    <span className="text-[10px] font-bold text-primary">{day.day}</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{day.focus}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{day.detail}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* REPORT TAB */}
        <TabsContent value="report" className="space-y-4">
          <ReportTabContent de={de} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

function ReportTabContent({ de }: { de: boolean }) {
  const [reportType, setReportType] = useState<"pre" | "halftime" | "post">("post");
  const [reportStyle, setReportStyle] = useState<"analytic" | "social" | "newspaper">("analytic");

  const reportTypes = [
    { key: "pre" as const, label: de ? "Vorbericht" : "Pre-match", icon: FileText },
    { key: "halftime" as const, label: de ? "Halbzeitanalyse" : "Halftime", icon: Timer },
    { key: "post" as const, label: de ? "Nachbericht" : "Post-match", icon: Award },
  ];

  const reportStyles = [
    { key: "analytic" as const, label: de ? "Analytisch" : "Analytical", icon: BarChart3 },
    { key: "social" as const, label: "Social Media", icon: Hash },
    { key: "newspaper" as const, label: de ? "Zeitung" : "Newspaper", icon: Newspaper },
  ];

  const reportContent: Record<string, Record<string, React.ReactNode>> = {
    post: {
      analytic: (
        <>
          <h2 className="text-lg font-bold font-display text-foreground mt-0 mb-4">FC Musterstadt – SV Beispielburg 2:1 (1:0)</h2>
          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">{de ? "Spielverlauf" : "Match progression"}</h3>
          <p className="text-muted-foreground mb-3">
            {de
              ? "Der FC Musterstadt erwischte einen konzentrierten Start und übernahm früh die Spielkontrolle. In der 23. Minute fiel das 1:0 nach einer Ballstafette über rechts. Nach der Pause erhöhte der Gegner den Druck, doch in der 67. Minute fiel das 2:0."
              : "FC Musterstadt had a focused start and took early control. The 1-0 came in the 23rd minute after a passing sequence down the right. After halftime the opponent increased pressure, but the 2-0 came in the 67th minute."}
          </p>
          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">{de ? "🔍 KI-Erkenntnisse" : "🔍 AI Insights"}</h3>
          <div className="space-y-2 mb-3">
            {[
              de ? "Überladung rechts: 62% der Angriffe über die rechte Seite." : "Right overload: 62% of attacks via the right side.",
              de ? "Konter-Anfälligkeit: 3 der 4 gegnerischen Chancen nach Ballverlusten im Aufbau." : "Counter vulnerability: 3 of 4 opponent chances from build-up ball losses.",
              de ? "Formationsänderung in der 62. Minute stabilisierte das Zentrum." : "Formation change in the 62nd minute stabilized the center.",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2 text-xs text-muted-foreground rounded-lg bg-muted/20 p-2 border border-border/30">
                <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </>
      ),
      social: (
        <div className="bg-muted/30 rounded-xl p-5 border border-border/50 font-mono text-sm leading-relaxed text-foreground">
          <p className="mb-3">⚽ <strong>{de ? "SIEG!" : "WIN!"}</strong> 🎉</p>
          <p className="mb-3">FC Musterstadt 🟢 2:1 🔴 SV Beispielburg</p>
          <p className="mb-3">⚡ A. Vogt {de ? "mit Tor + Assist" : "with goal + assist"} — MoTM! 🏆<br/>🧠 {de ? "KI-Analyse: Dominante 1. HZ, rechts stärkste Angriffsseite" : "AI analysis: Dominant 1st half, right side strongest attack channel"}<br/>📊 62% {de ? "Angriffe über rechts" : "attacks via right"}</p>
          <p className="text-primary">#FCMusterstadt #FieldIQ #KIAnalyse</p>
        </div>
      ),
      newspaper: (
        <>
          <h2 className="text-lg font-bold font-display text-foreground mt-0 mb-1 italic">{de ? "Musterstadt siegt dank starkem Vogt" : "Musterstadt wins thanks to strong Vogt"}</h2>
          <p className="text-[10px] text-muted-foreground mb-4 italic">{de ? "Kreisliga A · Spieltag 18 · Von der Sportredaktion" : "District League A · Matchday 18 · Sports desk"}</p>
          <p className="text-muted-foreground mb-3">
            {de
              ? "Der FC Musterstadt hat sein Heimspiel gegen den SV Beispielburg mit 2:1 (1:0) gewonnen. Vor 280 Zuschauern zeigte das Team eine taktisch reife Leistung — die KI-Analyse bestätigt eine dominante erste Hälfte mit klarer Kontrolle."
              : "FC Musterstadt won their home match against SV Beispielburg 2-1 (1-0). In front of 280 spectators the team showed a tactically mature performance — the AI analysis confirms a dominant first half with clear control."}
          </p>
        </>
      ),
    },
    halftime: {
      analytic: (
        <>
          <h2 className="text-lg font-bold font-display text-foreground mt-0 mb-4">⏱️ {de ? "Halbzeitanalyse — 1:0 (23' Vogt)" : "Halftime Analysis — 1:0 (23' Vogt)"}</h2>
          <h3 className="text-sm font-semibold text-foreground mt-4 mb-3 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-warning" />{de ? "Anpassungen für die 2. Hälfte" : "Adjustments for 2nd half"}
          </h3>
          <div className="space-y-3 mb-4">
            {[
              { priority: de ? "HOCH" : "HIGH", color: "bg-destructive/10 text-destructive border-destructive/30", title: de ? "Linke Seite aktivieren" : "Activate left side", action: de ? "König (#7) höher schieben, Diagonalbälle auf links fordern." : "Push König (#7) higher, demand diagonal balls to the left." },
              { priority: de ? "MITTEL" : "MEDIUM", color: "bg-warning/10 text-warning border-warning/30", title: de ? "Konterabsicherung" : "Counter protection", action: de ? "Müller (#6) bei Spielaufbau tiefer stehen lassen." : "Have Müller (#6) drop deeper during build-up." },
              { priority: de ? "TIPP" : "TIP", color: "bg-primary/10 text-primary border-primary/30", title: de ? "Wechsel-Empfehlung ab 60'" : "Substitution rec. from 60'", action: de ? "Schmidt (#11) durch Weber ersetzen — frische Beine links." : "Replace Schmidt (#11) with Weber — fresh legs on the left." },
            ].map((tip) => (
              <div key={tip.title} className="rounded-lg border border-border/40 bg-card/80 p-3">
                <div className="flex items-start gap-2 mb-1.5">
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${tip.color}`}>{tip.priority}</span>
                  <span className="text-xs font-semibold text-foreground">{tip.title}</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px] text-primary">
                  <ArrowRight className="w-3 h-3 mt-0.5 shrink-0" />
                  <span className="font-medium">{tip.action}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      ),
      social: (
        <div className="bg-muted/30 rounded-xl p-5 border border-border/50 font-mono text-sm leading-relaxed text-foreground">
          <p className="mb-2">⏱️ <strong>{de ? "HALBZEIT!" : "HALFTIME!"}</strong></p>
          <p className="mb-2">FC Musterstadt 1:0 SV Beispielburg</p>
          <p className="mb-2">⚽ 23' Vogt | {de ? "Dominante 1. HZ" : "Dominant 1st half"} ✅</p>
          <p className="text-primary mt-2">#HalbzeitUpdate #FCM</p>
        </div>
      ),
      newspaper: (
        <>
          <h2 className="text-lg font-bold font-display text-foreground mt-0 mb-4 italic">{de ? "Vogt bringt Musterstadt in Front" : "Vogt puts Musterstadt ahead"}</h2>
          <p className="text-muted-foreground mb-3">
            {de
              ? "Nach einer kontrollierten ersten Hälfte führt der FC Musterstadt dank eines Treffers von Alexander Vogt (23.) mit 1:0."
              : "After a controlled first half, FC Musterstadt leads 1-0 thanks to Alexander Vogt's strike (23')."}
          </p>
        </>
      ),
    },
    pre: {
      analytic: (
        <>
          <h2 className="text-lg font-bold font-display text-foreground mt-0 mb-4">📋 {de ? "Vorbericht" : "Pre-match"}: FC Musterstadt vs. SV Beispielburg</h2>
          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">{de ? "Formkurve" : "Form curve"}</h3>
          <div className="flex gap-4 mb-3">
            <div className="flex-1">
              <div className="text-[10px] font-semibold text-foreground mb-1">FC Musterstadt</div>
              <div className="flex gap-1">{["S", "S", "U", "S", "N"].map((r, i) => <span key={i} className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center ${r === "S" ? "bg-primary/20 text-primary" : r === "N" ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground"}`}>{r}</span>)}</div>
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-semibold text-foreground mb-1">SV Beispielburg</div>
              <div className="flex gap-1">{["N", "U", "S", "N", "U"].map((r, i) => <span key={i} className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center ${r === "S" ? "bg-primary/20 text-primary" : r === "N" ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground"}`}>{r}</span>)}</div>
            </div>
          </div>
          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-warning" />{de ? "Taktische Empfehlungen" : "Tactical recommendations"}
          </h3>
          <div className="space-y-1.5">
            {[
              de ? "Gegner schwach bei hohem Pressing — aggressives Anlaufen empfohlen" : "Opponent weak under high pressing — aggressive closing recommended",
              de ? "Beispielburg anfällig über rechte Seite — als Angriffskanal nutzen" : "Beispielburg vulnerable on the right — use as attack channel",
              de ? "Standardsituationen vorbereiten: Gegner schwach bei zweiten Bällen" : "Prepare set pieces: opponent weak on second balls",
            ].map((tip) => (
              <div key={tip} className="flex items-start gap-2 text-[10px] text-muted-foreground">
                <ArrowRight className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </>
      ),
      social: (
        <div className="bg-muted/30 rounded-xl p-5 border border-border/50 font-mono text-sm leading-relaxed text-foreground">
          <p className="mb-2">📋 <strong>{de ? "MATCHDAY!" : "MATCHDAY!"}</strong></p>
          <p className="mb-2">🆚 FC Musterstadt vs. SV Beispielburg</p>
          <p className="mb-2">⏰ 15:30 | 📍 Vereinsstadion</p>
          <p className="text-primary">#Vorbericht #FCM #Matchday</p>
        </div>
      ),
      newspaper: (
        <>
          <h2 className="text-lg font-bold font-display text-foreground mt-0 mb-4 italic">{de ? "Musterstadt empfängt Beispielburg" : "Musterstadt hosts Beispielburg"}</h2>
          <p className="text-muted-foreground mb-3">
            {de
              ? "Am Sonntag empfängt der FC Musterstadt den SV Beispielburg zum Kreisliga-Duell. Die Gastgeber gehen als Favorit ins Spiel."
              : "On Sunday, FC Musterstadt hosts SV Beispielburg for a district league clash. The hosts go in as favorites."}
          </p>
        </>
      ),
    },
  };

  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 p-4">
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {reportTypes.map((rt) => (
            <button
              key={rt.key}
              onClick={() => setReportType(rt.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${reportType === rt.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}
            >
              <rt.icon className="w-3 h-3" />
              {rt.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {reportStyles.map((rs) => (
            <button
              key={rs.key}
              onClick={() => setReportStyle(rs.key)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all whitespace-nowrap ${reportStyle === rs.key ? "bg-primary/10 text-primary border border-primary/30" : "bg-muted/20 text-muted-foreground hover:bg-muted/40 border border-transparent"}`}
            >
              <rs.icon className="w-3 h-3" />
              {rs.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/30 bg-background/60 p-5 prose-sm prose-neutral dark:prose-invert max-w-none text-sm leading-relaxed">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${reportType}-${reportStyle}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {reportContent[reportType]?.[reportStyle] ?? (
              <p className="text-muted-foreground italic">{de ? "Dieser Berichtstyp ist in Kürze verfügbar." : "This report type is coming soon."}</p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
