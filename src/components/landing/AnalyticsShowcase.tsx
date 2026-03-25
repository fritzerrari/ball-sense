import { motion } from "framer-motion";
import { useTranslation } from "@/lib/i18n";
import { Brain, Shield, TrendingUp, Target, Sparkles, AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function DangerZoneViz() {
  return (
    <div className="aspect-[105/68] rounded-lg border border-border/50 relative overflow-hidden">
      <svg className="w-full h-full" viewBox="0 0 105 68" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="azGrass" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(160, 45%, 38%)" />
            <stop offset="100%" stopColor="hsl(150, 40%, 32%)" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="105" height="68" fill="url(#azGrass)" />
        <g stroke="white" strokeOpacity="0.4" fill="none" strokeWidth="0.3">
          <rect x="1" y="1" width="103" height="66" rx="0.5" />
          <line x1="52.5" y1="1" x2="52.5" y2="67" />
          <circle cx="52.5" cy="34" r="9.15" />
          <rect x="1" y="13.84" width="16.5" height="40.32" strokeOpacity="0.3" />
          <rect x="87.5" y="13.84" width="16.5" height="40.32" strokeOpacity="0.3" />
        </g>
        <rect x="75" y="10" width="28" height="48" rx="3" fill="hsl(0, 80%, 50%)" fillOpacity="0.25" stroke="hsl(0, 80%, 50%)" strokeOpacity="0.4" strokeWidth="0.5">
          <animate attributeName="fill-opacity" values="0.15;0.3;0.15" dur="3s" repeatCount="indefinite" />
        </rect>
        <rect x="40" y="20" width="25" height="28" rx="3" fill="hsl(40, 90%, 50%)" fillOpacity="0.15" stroke="hsl(40, 90%, 50%)" strokeOpacity="0.3" strokeWidth="0.5" />
        <rect x="2" y="10" width="28" height="48" rx="3" fill="hsl(120, 50%, 45%)" fillOpacity="0.15" stroke="hsl(120, 50%, 45%)" strokeOpacity="0.3" strokeWidth="0.5" />
        <text x="89" y="36" fill="white" fillOpacity="0.7" fontSize="3.5" textAnchor="middle" fontWeight="600">Angriff</text>
        <text x="52.5" y="36" fill="white" fillOpacity="0.5" fontSize="3" textAnchor="middle">Kontrolle</text>
        <text x="16" y="36" fill="white" fillOpacity="0.5" fontSize="3" textAnchor="middle">Stabil</text>
      </svg>
    </div>
  );
}

export function AnalyticsShowcase() {
  const { language } = useTranslation();
  const de = language === "de";

  const insights = [
    {
      icon: Target,
      label: de ? "Spielkontrolle" : "Match control",
      value: de ? "Dominant in HZ 1, Verlust ab Min. 40" : "Dominant in 1st half, loss from min. 40",
      color: "text-primary",
    },
    {
      icon: AlertTriangle,
      label: de ? "Schwachstelle erkannt" : "Weakness detected",
      value: de ? "Links anfällig — 3 Chancen über diese Seite" : "Left side vulnerable — 3 chances via this side",
      color: "text-warning",
    },
    {
      icon: TrendingUp,
      label: de ? "Angriffsmuster" : "Attack pattern",
      value: de ? "62% Angriffe über rechts — Gegner liest euch" : "62% attacks via right — opponent reads you",
      color: "text-primary",
    },
  ];

  return (
    <section className="py-24 md:py-40 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-secondary/40 via-secondary/20 to-transparent" />
      <div className="absolute inset-0 field-grid opacity-[0.04]" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-xs font-semibold text-primary font-display tracking-wider uppercase mb-3 block">
            {de ? "KI-Analyse" : "AI Analysis"}
          </span>
          <h2 className="text-3xl md:text-5xl font-bold font-display mb-4">
            {de ? (
              <>Dein Spiel.<br /><span className="gradient-text">Durchleuchtet.</span></>
            ) : (
              <>Your match.<br /><span className="gradient-text">X-rayed.</span></>
            )}
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            {de
              ? "Gefahrenzonen, Spielkontrolle und taktische Muster — die KI findet, was dir während des Spiels entgangen ist."
              : "Danger zones, match control and tactical patterns — AI finds what you missed during the match."}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto items-start">
          {/* Danger zones visualization */}
          <motion.div
            className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6"
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground/80 font-display">
                {de ? "Gefahrenzonen-Analyse" : "Danger zone analysis"}
              </h3>
              <span className="text-xs text-primary px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10">
                {de ? "KI-geschätzt" : "AI-estimated"}
              </span>
            </div>
            <DangerZoneViz />
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <span>{de ? "Defensiv stabil" : "Defensively stable"}</span>
              <div className="flex gap-1">
                <div className="w-4 h-2 rounded-sm bg-primary/40" />
                <div className="w-4 h-2 rounded-sm bg-warning/50" />
                <div className="w-4 h-2 rounded-sm bg-destructive/50" />
              </div>
              <span>{de ? "Hohes Risiko" : "High risk"}</span>
            </div>
          </motion.div>

          {/* KI-Insights */}
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
              <h3 className="text-sm font-semibold text-foreground/80 font-display mb-4 flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                {de ? "KI-Erkenntnisse" : "AI insights"}
              </h3>
              <div className="space-y-3">
                {insights.map((insight, i) => (
                  <motion.div
                    key={insight.label}
                    className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border/30 hover:border-primary/20 transition-colors"
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                  >
                    <insight.icon className={`h-4 w-4 mt-0.5 ${insight.color}`} />
                    <div>
                      <div className="text-xs font-semibold text-foreground">{insight.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{insight.value}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-6">
              <h3 className="text-sm font-semibold text-foreground/80 font-display mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {de ? "Sofort-Empfehlung" : "Instant recommendation"}
              </h3>
              <p className="text-sm text-foreground leading-relaxed mb-3">
                {de
                  ? "Rechte Überladung bleibt euer stärkstes Muster. Linke Seite gezielt stärken — Gegner lesen eure Angriffe."
                  : "Right overload remains your strongest pattern. Strengthen the left side — opponents read your attacks."}
              </p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-primary">
                  <Shield className="h-3 w-3" />
                  <span>Confidence: ~75%</span>
                </div>
              </div>
            </div>

            <Button variant="heroOutline" size="sm" className="w-full gap-2" asChild>
              <a href="#demo">
                {de ? "Live-Demo ansehen" : "See live demo"}
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
