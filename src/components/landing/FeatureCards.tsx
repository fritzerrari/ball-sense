import { motion } from "framer-motion";
import {
  Smartphone,
  Brain,
  Shield,
  Users,
  Zap,
  FileText,
  Dumbbell,
  Share2,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  MessageSquare,
  ArrowUp,
  ArrowRightLeft,
  Eye,
  Layers,
  Battery,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useIsMobile } from "@/hooks/use-mobile";

export function FeatureCards() {
  const { t, language } = useTranslation();
  const isMobile = useIsMobile();

  const features = [
    {
      icon: Smartphone,
      title: language === "de" ? "1 Smartphone genügt" : "1 smartphone is enough",
      desc: language === "de"
        ? "Handy aufstellen, Spiel filmen — die KI übernimmt die Analyse. Kein Stativ, keine Sensoren, kein Extra-Equipment."
        : "Set up your phone, film the match — AI handles the analysis. No tripod, no sensors, no extra equipment.",
      span: "sm:col-span-2",
      accent: "from-primary/20 to-primary/5",
    },
    {
      icon: Brain,
      title: language === "de" ? "KI-Spielanalyse" : "AI match analysis",
      desc: language === "de"
        ? "Gemini Vision erkennt Formationen, Spielphasen, Gefahrenzonen und taktische Muster direkt aus dem Video."
        : "Gemini Vision detects formations, match phases, danger zones and tactical patterns directly from the video.",
      span: "",
      accent: "from-primary/15 to-transparent",
    },
    {
      icon: Sparkles,
      title: language === "de" ? "Spielzug-Replay" : "Tactical replay",
      desc: language === "de"
        ? "Animierte Taktik-Grafik mit geschätzten Spielerpositionen — Schlüsselszenen als bewegte Spielfeld-Darstellung."
        : "Animated tactical graphic with estimated player positions — key scenes as moving pitch visualization.",
      span: "",
      accent: "from-accent/20 to-accent/5",
    },
    {
      icon: AlertTriangle,
      title: language === "de" ? "Coaching-Insights & Alerts" : "Coaching insights & alerts",
      desc: language === "de"
        ? "Coach Summary mit Spielkontrolle, Fokusspieler und Datenwarnung. Sofort-Überblick statt langer Tabellen."
        : "Coach summary with match control, focus player and data warnings. Instant overview instead of long tables.",
      span: "",
      accent: "from-primary/15 to-transparent",
    },
    {
      icon: TrendingUp,
      title: language === "de" ? "Match-Trend-Dashboard" : "Match trend dashboard",
      desc: language === "de"
        ? "Formkurve über mehrere Spiele: Wie entwickelt sich dein Team? Wiederkehrende Muster und Schwachstellen auf einen Blick."
        : "Form curve across matches: How is your team developing? Recurring patterns and weaknesses at a glance.",
      span: "sm:col-span-2",
      accent: "from-primary/20 to-primary/5",
    },
    {
      icon: FileText,
      title: language === "de" ? "KI-Berichte in 3 Stilen" : "AI reports in 3 styles",
      desc: language === "de"
        ? "Vorbericht, Halbzeitanalyse und Nachbericht — als analytischer Report, Social-Media-Post oder Zeitungsartikel. Content-Generierung für Vereinswebsite und Presse — exportierbar als PDF, teilbar per WhatsApp, E-Mail und X."
        : "Pre-match, halftime and post-match — as analytical report, social media post or newspaper article. Content generation for club website and press — exportable as PDF, shareable via WhatsApp, email and X.",
      span: "sm:col-span-2",
      accent: "from-accent/15 to-transparent",
    },
    {
      icon: Dumbbell,
      title: t("landing.feat8Title"),
      desc: t("landing.feat8Desc"),
      span: "",
      accent: "from-primary/20 to-primary/5",
    },
    {
      icon: MessageSquare,
      title: language === "de" ? "KI-Assistent" : "AI assistant",
      desc: language === "de"
        ? "Chat-basierter Co-Trainer: Frage nach Taktik, Aufstellung oder Trainingsempfehlungen — die KI antwortet mit Kontext."
        : "Chat-based co-coach: Ask about tactics, lineup or training — the AI answers with context.",
      span: "",
      accent: "from-accent/20 to-accent/5",
    },
    {
      icon: Share2,
      title: t("landing.feat9Title"),
      desc: t("landing.feat9Desc"),
      span: "",
      accent: "from-primary/15 to-transparent",
    },
    {
      icon: Shield,
      title: t("landing.feat4Title"),
      desc: language === "de"
        ? "Einwilligung pro Spieler, DSGVO-konform. Minderjährige brauchen Eltern-Zustimmung."
        : "Consent per player, GDPR-compliant. Minors require parental consent.",
      span: "",
      accent: "from-accent/15 to-transparent",
    },
    {
      icon: Users,
      title: t("landing.feat5Title"),
      desc: t("landing.feat5Desc"),
      span: "",
      accent: "from-primary/15 to-transparent",
    },
    {
      icon: ArrowUp,
      title: language === "de" ? "Pressing-Analyse" : "Pressing analysis",
      desc: language === "de"
        ? "Wie hoch verteidigt dein Team? Pressing-Höhe und Kompaktheit im Zeitverlauf — Korrelation mit Ballgewinnen."
        : "How high does your team defend? Pressing height and compactness over time — correlation with ball recoveries.",
      span: "",
      accent: "from-primary/20 to-primary/5",
    },
    {
      icon: ArrowRightLeft,
      title: language === "de" ? "Umschaltmomente" : "Transition analysis",
      desc: language === "de"
        ? "Konter vs. Gegenpressing: Wie schnell schaltet dein Team um? Umschaltgeschwindigkeit und beteiligte Spieler."
        : "Counters vs. gegenpressing: How fast does your team transition? Speed and involved players.",
      span: "",
      accent: "from-accent/20 to-accent/5",
    },
    {
      icon: Eye,
      title: language === "de" ? "Gegner-Scouting" : "Opponent scouting",
      desc: language === "de"
        ? "Automatisches Gegner-Profil aus deinen eigenen Spielen: Bilanz, Siegquote, bevorzugte Angriffsseite, Schwachstellen und taktische Empfehlungen — ohne fremde Daten. Je mehr Spiele, desto präziser."
        : "Automatic opponent profile from your own matches: record, win rate, preferred attack side, weaknesses and tactical recommendations — no external data. More matches = more precision.",
      span: "sm:col-span-2",
      accent: "from-primary/20 to-primary/5",
    },
    {
      icon: Layers,
      title: language === "de" ? "Formations-Timeline" : "Formation timeline",
      desc: language === "de"
        ? "Wann hat dein Team die Formation gewechselt? Timeline mit Auslöser und Formationswechseln im Spielverlauf."
        : "When did your team change formation? Timeline with triggers and formation changes during the match.",
      span: "",
      accent: "from-accent/15 to-transparent",
    },
    {
      icon: Battery,
      title: language === "de" ? "Ermüdungs-Indikator" : "Fatigue indicator",
      desc: language === "de"
        ? "Sprint-Intensität pro 15-Min-Intervall und Positionsdrift — erkennt, wann dein Team müde wird."
        : "Sprint intensity per 15-min interval and positional drift — detects when your team gets tired.",
      span: "",
      accent: "from-primary/15 to-transparent",
    },
    {
      icon: Zap,
      title: t("landing.feat6Title"),
      desc: t("landing.feat6Desc"),
      span: "sm:col-span-2 lg:col-span-1",
      accent: "from-primary/20 to-primary/5",
    },
  ];

  return (
    <section id="features" className="py-24 md:py-36">
      <div className="container mx-auto px-4">
        <motion.div
          className="max-w-5xl mx-auto mb-16 flex flex-col md:flex-row md:items-end md:justify-between gap-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div>
            <span className="text-xs font-semibold text-primary font-display tracking-wider uppercase mb-3 block">{t("landing.features")}</span>
            <h2 className="text-3xl md:text-4xl font-bold font-display leading-tight">
              {t("landing.featuresTitle")}
            </h2>
          </div>
          <p className="text-muted-foreground max-w-sm text-sm leading-relaxed md:text-right">
            {language === "de"
              ? "Vom Smartphone-Video zur fertigen Taktik-Analyse: KI-Insights, Spielzug-Replay und Trainingsplan in einem klaren Flow."
              : "From smartphone video to complete tactical analysis: AI insights, tactical replay and training plan in one clear flow."}
          </p>
        </motion.div>

        <motion.div
          className="max-w-5xl mx-auto mb-10 h-px overflow-hidden"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <motion.div
            className="h-full bg-gradient-to-r from-transparent via-primary/40 to-transparent"
            initial={{ x: "-100%" }}
            whileInView={{ x: "0%" }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              className={`group relative rounded-2xl border border-border/50 bg-card/50 p-7 transition-all duration-500 overflow-hidden ${feature.span}`}
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              whileHover={isMobile ? undefined : { y: -6, borderColor: "hsl(var(--primary) / 0.3)" }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl`} />

              <motion.div
                className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ boxShadow: "var(--shadow-glow)" }}
              />

              <div className="relative">
                <motion.div
                  className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-all duration-300"
                  whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                >
                  <feature.icon className="h-5 w-5 text-primary" />
                </motion.div>
                <h3 className="text-base font-semibold font-display mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
