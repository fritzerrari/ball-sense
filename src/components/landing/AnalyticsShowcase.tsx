import { motion } from "framer-motion";
import { useTranslation } from "@/lib/i18n";
import { Brain, Shield, TrendingUp, Target, Sparkles, AlertTriangle } from "lucide-react";

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
        {/* Field lines */}
        <g stroke="white" strokeOpacity="0.4" fill="none" strokeWidth="0.3">
          <rect x="1" y="1" width="103" height="66" rx="0.5" />
          <line x1="52.5" y1="1" x2="52.5" y2="67" />
          <circle cx="52.5" cy="34" r="9.15" />
          <rect x="1" y="13.84" width="16.5" height="40.32" strokeOpacity="0.3" />
          <rect x="87.5" y="13.84" width="16.5" height="40.32" strokeOpacity="0.3" />
        </g>
        {/* Danger zones */}
        <rect x="75" y="10" width="28" height="48" rx="3" fill="hsl(0, 80%, 50%)" fillOpacity="0.25" stroke="hsl(0, 80%, 50%)" strokeOpacity="0.4" strokeWidth="0.5" />
        <rect x="40" y="20" width="25" height="28" rx="3" fill="hsl(40, 90%, 50%)" fillOpacity="0.15" stroke="hsl(40, 90%, 50%)" strokeOpacity="0.3" strokeWidth="0.5" />
        <rect x="2" y="10" width="28" height="48" rx="3" fill="hsl(120, 50%, 45%)" fillOpacity="0.15" stroke="hsl(120, 50%, 45%)" strokeOpacity="0.3" strokeWidth="0.5" />
        {/* Labels */}
        <text x="89" y="36" fill="white" fillOpacity="0.7" fontSize="3.5" textAnchor="middle" fontWeight="600">Angriff</text>
        <text x="52.5" y="36" fill="white" fillOpacity="0.5" fontSize="3" textAnchor="middle">Kontrolle</text>
        <text x="16" y="36" fill="white" fillOpacity="0.5" fontSize="3" textAnchor="middle">Stabil</text>
      </svg>
    </div>
  );
}

export function AnalyticsShowcase() {
  const { t, language } = useTranslation();

  const insights = [
    {
      icon: Target,
      label: language === "de" ? "Spielkontrolle" : "Match control",
      value: language === "de" ? "Dominant in HZ 1" : "Dominant in 1st half",
      color: "text-primary",
    },
    {
      icon: AlertTriangle,
      label: language === "de" ? "Schwachstelle" : "Weakness",
      value: language === "de" ? "Links anfällig" : "Left side vulnerable",
      color: "text-warning",
    },
    {
      icon: TrendingUp,
      label: language === "de" ? "Angriffsmuster" : "Attack pattern",
      value: language === "de" ? "62% über rechts" : "62% via right side",
      color: "text-primary",
    },
  ];

  return (
    <section className="py-24 md:py-40 relative overflow-hidden bg-secondary/50">
      <div className="absolute inset-0 field-grid opacity-[0.04]" />

      <div className="container mx-auto px-4 relative z-10">
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
          {/* Danger zones visualization */}
          <motion.div
            className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6"
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground/80 font-display">
                {language === "de" ? "Gefahrenzonen-Analyse" : "Danger zone analysis"}
              </h3>
              <span className="text-xs text-primary px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10">
                {language === "de" ? "KI-geschätzt" : "AI-estimated"}
              </span>
            </div>
            <DangerZoneViz />
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <span>{language === "de" ? "Defensiv stabil" : "Defensively stable"}</span>
              <div className="flex gap-1">
                <div className="w-4 h-2 rounded-sm bg-primary/40" />
                <div className="w-4 h-2 rounded-sm bg-warning/50" />
                <div className="w-4 h-2 rounded-sm bg-destructive/50" />
              </div>
              <span>{language === "de" ? "Hohes Risiko" : "High risk"}</span>
            </div>
          </motion.div>

          {/* KI-Insights */}
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
              <h3 className="text-sm font-semibold text-foreground/80 font-display mb-4 flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                {language === "de" ? "KI-Erkenntnisse" : "AI insights"}
              </h3>
              <div className="space-y-4">
                {insights.map((insight, i) => (
                  <motion.div
                    key={insight.label}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border/30"
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                  >
                    <insight.icon className={`h-4 w-4 mt-0.5 ${insight.color}`} />
                    <div>
                      <div className="text-xs font-medium text-foreground">{insight.label}</div>
                      <div className="text-xs text-muted-foreground">{insight.value}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
              <h3 className="text-sm font-semibold text-foreground/80 font-display mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {language === "de" ? "Coaching-Empfehlung" : "Coaching recommendation"}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {language === "de"
                  ? "Die rechte Seite ist aktuell euer stärkster Angriffskanal. Linke Seite gezielt stärken, um weniger berechenbar zu werden."
                  : "The right side is currently your strongest attack channel. Strengthen the left side to become less predictable."}
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs text-primary">
                <Shield className="h-3 w-3" />
                <span>{language === "de" ? "Confidence: hoch" : "Confidence: high"}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
