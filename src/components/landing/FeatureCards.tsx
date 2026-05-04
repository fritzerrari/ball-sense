import { useState } from "react";
import { motion } from "framer-motion";
import {
  Smartphone, Brain, Shield, Users, Zap, FileText, Dumbbell, Share2,
  Sparkles, TrendingUp, AlertTriangle, MessageSquare, ArrowUp,
  ArrowRightLeft, Eye, Layers, Battery, Target, Camera, ChevronDown,
  Radio, ScanLine, ClipboardEdit, Inbox, Bell, Trophy, Activity,
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
  const [openGroup, setOpenGroup] = useState<number | null>(0);

  const groups: FeatureGroup[] = [
    {
      title: de ? "🆕 Neu im System" : "🆕 What's new",
      subtitle: de ? "Frisch ausgerollt — automatisiert & vernetzt" : "Just rolled out — automated & connected",
      accent: "from-primary/25 to-accent/10",
      features: [
        { icon: Inbox, title: de ? "Coach-Inbox" : "Coach Inbox", desc: de ? "KI-Empfehlungen aus deinen letzten 5 Spielen — Lob, Warnungen, Taktik & Fitness." : "AI insights from your last 5 matches — praise, warnings, tactics & fitness." },
        { icon: Bell, title: de ? "Eltern-Push" : "Parent Push", desc: de ? "Eltern abonnieren ihr Kind und bekommen automatisch Push-Nachrichten nach dem Spiel." : "Parents subscribe to their child and receive automatic push notifications after the match." },
        { icon: Trophy, title: de ? "Saison-Wrapped" : "Season Wrapped", desc: de ? "Animierte Saison-Highlights mit Top-Scorern, Best-of-Klips & Teilen-Button." : "Animated season highlights with top scorers, best-of clips & share button." },
        { icon: Activity, title: de ? "Health & Watchdog" : "Health & Watchdog", desc: de ? "Selbstheilende Pipeline: stuck Jobs werden automatisch erkannt und neu gestartet." : "Self-healing pipeline: stuck jobs are automatically detected and restarted." },
      ],
    },
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
          title: de ? "Auto-Kalibrierung" : "Auto calibration",
          desc: de ? "Die KI erkennt das Spielfeld automatisch im ersten Frame — kein manuelles Setup nötig." : "AI detects the pitch automatically in the first frame — no manual setup needed.",
        },
        {
          icon: Zap,
          title: de ? "Sofort einsatzbereit" : "Instant setup",
          desc: de ? "Kein Setup, keine Schulung. In 2 Minuten startklar." : "No setup, no training. Ready in 2 minutes.",
        },
        {
          icon: Radio,
          title: de ? "Walkie-Talkie" : "Walkie-Talkie",
          desc: de ? "Push-to-Talk Kommunikation zwischen Trainer und Kameramann — direkt in der App." : "Push-to-talk communication between coach and camera operator — directly in the app.",
        },
      ],
    },
    {
      title: de ? "🧠 KI-Analyse" : "🧠 AI Analysis",
      subtitle: de ? "Was kein Trainer-Auge sieht" : "What no coach's eye can see",
      accent: "from-accent/20 to-accent/5",
      features: [
        { icon: Brain, title: de ? "KI-Spielanalyse" : "AI match analysis", desc: de ? "Formationen, Spielphasen, Gefahrenzonen und taktische Muster — direkt aus dem Video." : "Formations, match phases, danger zones and tactical patterns — directly from the video." },
        { icon: Sparkles, title: de ? "Spielzug-Replay" : "Tactical replay", desc: de ? "Animierte Positionen, Schlüsselszenen als bewegte Spielfeld-Grafik." : "Animated positions, key scenes as moving pitch visualization." },
        { icon: ArrowUp, title: de ? "Pressing-Analyse" : "Pressing analysis", desc: de ? "Pressing-Höhe und Kompaktheit im Zeitverlauf — Korrelation mit Ballgewinnen." : "Pressing height and compactness over time — correlation with ball recoveries." },
        { icon: ArrowRightLeft, title: de ? "Umschaltmomente" : "Transition analysis", desc: de ? "Konter vs. Gegenpressing: Umschaltgeschwindigkeit und beteiligte Spieler." : "Counters vs. gegenpressing: transition speed and involved players." },
        { icon: Battery, title: de ? "Ermüdungs-Indikator" : "Fatigue indicator", desc: de ? "Sprint-Intensität pro 15-Min-Intervall — erkennt, wann dein Team müde wird." : "Sprint intensity per 15-min interval — detects when your team gets tired." },
        { icon: Layers, title: de ? "Formations-Timeline" : "Formation timeline", desc: de ? "Wann hat dein Team die Formation gewechselt? Timeline mit Auslösern." : "When did your team change formation? Timeline with triggers." },
      ],
    },
    {
      title: de ? "📊 Reports & Coaching" : "📊 Reports & Coaching",
      subtitle: de ? "Vom Spieltag direkt in die Trainingsplanung" : "From matchday straight into training planning",
      accent: "from-primary/15 to-primary/5",
      features: [
        { icon: AlertTriangle, title: de ? "Coaching-Insights & Alerts" : "Coaching insights & alerts", desc: de ? "Coach Summary mit Spielkontrolle, Fokusspieler und Warnsignalen." : "Coach summary with match control, focus player and warnings." },
        { icon: FileText, title: de ? "KI-Berichte in 3 Stilen" : "AI reports in 3 styles", desc: de ? "Vor-, Halbzeit- und Nachbericht — als analytischer Report, Social-Post oder Zeitungsartikel." : "Pre-match, halftime and post-match — as analytical report, social post or newspaper article." },
        { icon: Dumbbell, title: de ? "KI-Trainingsplan" : "AI training plan", desc: de ? "Automatische Trainingsempfehlungen basierend auf Analyse und Schwächen." : "Automatic training recommendations based on analysis and weaknesses." },
        { icon: TrendingUp, title: de ? "Match-Trend-Dashboard" : "Match trend dashboard", desc: de ? "Formkurve über mehrere Spiele — wiederkehrende Muster auf einen Blick." : "Form curve across matches — recurring patterns at a glance." },
        { icon: Share2, title: de ? "Export & Teilen" : "Export & share", desc: de ? "PDF, WhatsApp, E-Mail, X — Berichte sofort exportieren und teilen." : "PDF, WhatsApp, email, X — export and share reports instantly." },
        { icon: Brain, title: de ? "KI-Spielvorbereitung" : "AI match preparation", desc: de ? "Automatischer Matchplan mit Formations-Empfehlung, Gegner-Warnungen und Aufstellungs-Tipps." : "Automatic match plan with formation recommendations, opponent warnings and lineup tips." },
        { icon: ScanLine, title: de ? "Spielbericht-Scan" : "Match report scan", desc: de ? "Spielbericht abfotografieren und Events automatisch per KI nacherfassen." : "Photo-scan a match report and auto-import events via AI." },
        { icon: ClipboardEdit, title: de ? "Event-Nacherfassung" : "Post-match events", desc: de ? "Events nach dem Spiel manuell nachtragen oder korrigieren." : "Manually add or correct events after the match." },
      ],
    },
    {
      title: de ? "🔒 Scouting & Sicherheit" : "🔒 Scouting & Security",
      subtitle: de ? "Datenschutz und Gegneranalyse" : "Privacy and opponent analysis",
      accent: "from-accent/15 to-accent/5",
      features: [
        { icon: Eye, title: de ? "Gegner-Scouting" : "Opponent scouting", desc: de ? "Automatisches Gegner-Profil aus eigenen Spielen: Bilanz, Schwachstellen, taktische Empfehlungen." : "Automatic opponent profile from your own matches: record, weaknesses, tactical recommendations." },
        { icon: MessageSquare, title: de ? "KI-Assistent" : "AI assistant", desc: de ? "Chat-basierter Co-Trainer: Frage nach Taktik, Aufstellung oder Trainingsempfehlungen." : "Chat-based co-coach: Ask about tactics, lineup or training." },
        { icon: Shield, title: de ? "DSGVO-konform" : "GDPR compliant", desc: de ? "Einwilligung pro Spieler, keine Gesichtserkennung. Minderjährige brauchen Eltern-Zustimmung." : "Consent per player, no face recognition. Minors need parental consent." },
        { icon: Users, title: de ? "Für jedes Team" : "For every team", desc: de ? "Von der Kreisliga bis zur Regionalliga — für alle Altersklassen." : "From local leagues to regional divisions — for all age groups." },
      ],
    },
  ];

  return (
    <section id="features" className="py-16 md:py-36">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-10 md:mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-xs font-semibold text-primary font-display tracking-wider uppercase mb-3 block">
            {de ? "Alle Features" : "All features"}
          </span>
          <h2 className="text-2xl md:text-5xl font-bold font-display mb-4">
            {de ? (
              <>Alles, was dein Team<br /><span className="gradient-text">besser macht</span></>
            ) : (
              <>Everything that makes<br /><span className="gradient-text">your team better</span></>
            )}
          </h2>
        </motion.div>

        <div className="max-w-6xl mx-auto space-y-6 md:space-y-16">
          {groups.map((group, gi) => {
            const isOpen = openGroup === gi;

            return (
              <motion.div
                key={group.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6 }}
              >
                {/* Group header — clickable accordion on mobile */}
                <button
                  className="w-full mb-4 md:mb-6 flex items-center justify-between gap-2 text-left md:cursor-default"
                  onClick={() => isMobile && setOpenGroup(isOpen ? null : gi)}
                >
                  <div>
                    <h3 className="text-lg md:text-2xl font-bold font-display">{group.title}</h3>
                    <p className="text-xs md:text-sm text-muted-foreground">{group.subtitle}</p>
                  </div>
                  {isMobile && (
                    <ChevronDown className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                  )}
                </button>

                {/* Feature grid — always visible on desktop, accordion on mobile */}
                <div className={`grid sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 transition-all duration-300 ${
                  isMobile && !isOpen ? "hidden" : ""
                }`}>
                  {group.features.map((feature, fi) => (
                    <motion.div
                      key={feature.title}
                      className="group relative rounded-2xl border border-border/50 bg-card/50 p-4 md:p-6 transition-all duration-500 overflow-hidden hover:border-primary/30 active:scale-[0.98]"
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-30px" }}
                      transition={{ duration: 0.4, delay: fi * 0.06 }}
                      whileHover={isMobile ? undefined : { y: -4 }}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${group.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl`} />
                      <div className="relative">
                        <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 md:mb-4 group-hover:bg-primary/20 transition-colors">
                          <feature.icon className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                        </div>
                        <h4 className="text-xs md:text-sm font-semibold font-display mb-1">{feature.title}</h4>
                        <p className="text-[11px] md:text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
