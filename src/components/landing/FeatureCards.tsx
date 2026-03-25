import { motion } from "framer-motion";
import {
  Smartphone, Brain, Shield, Users, Zap, FileText, Dumbbell, Share2,
  Sparkles, TrendingUp, AlertTriangle, MessageSquare, ArrowUp,
  ArrowRightLeft, Eye, Layers, Battery, Target, Camera,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useIsMobile } from "@/hooks/use-mobile";

type FeatureGroup = {
  title: string;
  subtitle: string;
  accent: string;
  features: { icon: typeof Brain; title: string; desc: string }[];
};

export function FeatureCards() {
  const { language } = useTranslation();
  const isMobile = useIsMobile();
  const de = language === "de";

  const groups: FeatureGroup[] = [
    {
      title: de ? "🎥 Aufnahme & Setup" : "🎥 Recording & Setup",
      subtitle: de ? "So einfach wie ein Video drehen" : "As easy as shooting a video",
      accent: "from-primary/20 to-primary/5",
      features: [
        {
          icon: Smartphone,
          title: de ? "1 Smartphone genügt" : "1 smartphone is enough",
          desc: de ? "Handy aufstellen, Spiel filmen — kein Stativ, keine Sensoren." : "Set up your phone, film the match — no tripod, no sensors.",
        },
        {
          icon: Camera,
          title: de ? "4-Punkt-Kalibrierung" : "4-point calibration",
          desc: de ? "Eckpunkte antippen, KI verifiziert das Spielfeld. Automatische Perspektivkorrektur." : "Tap corner points, AI verifies the pitch. Automatic perspective correction.",
        },
        {
          icon: Zap,
          title: de ? "Sofort einsatzbereit" : "Instant setup",
          desc: de ? "Kein Setup, keine Schulung. In 2 Minuten startklar." : "No setup, no training. Ready in 2 minutes.",
        },
      ],
    },
    {
      title: de ? "🧠 KI-Analyse" : "🧠 AI Analysis",
      subtitle: de ? "Was kein Trainer-Auge sieht" : "What no coach's eye can see",
      accent: "from-accent/20 to-accent/5",
      features: [
        {
          icon: Brain,
          title: de ? "KI-Spielanalyse" : "AI match analysis",
          desc: de ? "Formationen, Spielphasen, Gefahrenzonen und taktische Muster — direkt aus dem Video." : "Formations, match phases, danger zones and tactical patterns — directly from the video.",
        },
        {
          icon: Sparkles,
          title: de ? "Spielzug-Replay" : "Tactical replay",
          desc: de ? "Animierte Positionen, Schlüsselszenen als bewegte Spielfeld-Grafik." : "Animated positions, key scenes as moving pitch visualization.",
        },
        {
          icon: ArrowUp,
          title: de ? "Pressing-Analyse" : "Pressing analysis",
          desc: de ? "Pressing-Höhe und Kompaktheit im Zeitverlauf — Korrelation mit Ballgewinnen." : "Pressing height and compactness over time — correlation with ball recoveries.",
        },
        {
          icon: ArrowRightLeft,
          title: de ? "Umschaltmomente" : "Transition analysis",
          desc: de ? "Konter vs. Gegenpressing: Umschaltgeschwindigkeit und beteiligte Spieler." : "Counters vs. gegenpressing: transition speed and involved players.",
        },
        {
          icon: Battery,
          title: de ? "Ermüdungs-Indikator" : "Fatigue indicator",
          desc: de ? "Sprint-Intensität pro 15-Min-Intervall — erkennt, wann dein Team müde wird." : "Sprint intensity per 15-min interval — detects when your team gets tired.",
        },
        {
          icon: Layers,
          title: de ? "Formations-Timeline" : "Formation timeline",
          desc: de ? "Wann hat dein Team die Formation gewechselt? Timeline mit Auslösern." : "When did your team change formation? Timeline with triggers.",
        },
      ],
    },
    {
      title: de ? "📊 Reports & Coaching" : "📊 Reports & Coaching",
      subtitle: de ? "Vom Spieltag direkt in die Trainingsplanung" : "From matchday straight into training planning",
      accent: "from-primary/15 to-primary/5",
      features: [
        {
          icon: AlertTriangle,
          title: de ? "Coaching-Insights & Alerts" : "Coaching insights & alerts",
          desc: de ? "Coach Summary mit Spielkontrolle, Fokusspieler und Warnsignalen." : "Coach summary with match control, focus player and warnings.",
        },
        {
          icon: FileText,
          title: de ? "KI-Berichte in 3 Stilen" : "AI reports in 3 styles",
          desc: de ? "Vor-, Halbzeit- und Nachbericht — als analytischer Report, Social-Post oder Zeitungsartikel." : "Pre-match, halftime and post-match — as analytical report, social post or newspaper article.",
        },
        {
          icon: Dumbbell,
          title: de ? "KI-Trainingsplan" : "AI training plan",
          desc: de ? "Automatische Trainingsempfehlungen basierend auf Analyse und Schwächen." : "Automatic training recommendations based on analysis and weaknesses.",
        },
        {
          icon: TrendingUp,
          title: de ? "Match-Trend-Dashboard" : "Match trend dashboard",
          desc: de ? "Formkurve über mehrere Spiele — wiederkehrende Muster auf einen Blick." : "Form curve across matches — recurring patterns at a glance.",
        },
        {
          icon: Share2,
          title: de ? "Export & Teilen" : "Export & share",
          desc: de ? "PDF, WhatsApp, E-Mail, X — Berichte sofort exportieren und teilen." : "PDF, WhatsApp, email, X — export and share reports instantly.",
        },
      ],
    },
    {
      title: de ? "🔒 Scouting & Sicherheit" : "🔒 Scouting & Security",
      subtitle: de ? "Datenschutz und Gegneranalyse" : "Privacy and opponent analysis",
      accent: "from-accent/15 to-accent/5",
      features: [
        {
          icon: Eye,
          title: de ? "Gegner-Scouting" : "Opponent scouting",
          desc: de ? "Automatisches Gegner-Profil aus eigenen Spielen: Bilanz, Schwachstellen, taktische Empfehlungen." : "Automatic opponent profile from your own matches: record, weaknesses, tactical recommendations.",
        },
        {
          icon: MessageSquare,
          title: de ? "KI-Assistent" : "AI assistant",
          desc: de ? "Chat-basierter Co-Trainer: Frage nach Taktik, Aufstellung oder Trainingsempfehlungen." : "Chat-based co-coach: Ask about tactics, lineup or training.",
        },
        {
          icon: Shield,
          title: de ? "DSGVO-konform" : "GDPR compliant",
          desc: de ? "Einwilligung pro Spieler, keine Gesichtserkennung. Minderjährige brauchen Eltern-Zustimmung." : "Consent per player, no face recognition. Minors need parental consent.",
        },
        {
          icon: Users,
          title: de ? "Für jedes Team" : "For every team",
          desc: de ? "Von der Kreisliga bis zur Regionalliga — für alle Altersklassen." : "From local leagues to regional divisions — for all age groups.",
        },
      ],
    },
  ];

  return (
    <section id="features" className="py-24 md:py-36">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-xs font-semibold text-primary font-display tracking-wider uppercase mb-3 block">
            {de ? "Alle Features" : "All features"}
          </span>
          <h2 className="text-3xl md:text-5xl font-bold font-display mb-4">
            {de ? (
              <>Alles, was dein Team<br /><span className="gradient-text">besser macht</span></>
            ) : (
              <>Everything that makes<br /><span className="gradient-text">your team better</span></>
            )}
          </h2>
        </motion.div>

        <div className="max-w-6xl mx-auto space-y-16">
          {groups.map((group, gi) => (
            <motion.div
              key={group.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6 }}
            >
              {/* Group header */}
              <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-2">
                <div>
                  <h3 className="text-xl md:text-2xl font-bold font-display">{group.title}</h3>
                  <p className="text-sm text-muted-foreground">{group.subtitle}</p>
                </div>
              </div>

              {/* Feature grid */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.features.map((feature, fi) => (
                  <motion.div
                    key={feature.title}
                    className="group relative rounded-2xl border border-border/50 bg-card/50 p-6 transition-all duration-500 overflow-hidden hover:border-primary/30"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-30px" }}
                    transition={{ duration: 0.4, delay: fi * 0.06 }}
                    whileHover={isMobile ? undefined : { y: -4 }}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${group.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl`} />
                    <div className="relative">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                        <feature.icon className="h-5 w-5 text-primary" />
                      </div>
                      <h4 className="text-sm font-semibold font-display mb-1.5">{feature.title}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
