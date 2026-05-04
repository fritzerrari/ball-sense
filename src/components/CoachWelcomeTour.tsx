import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, Sparkles, Camera, Brain, FileText, Inbox, Bell, Trophy, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STORAGE_KEY = "coach_welcome_tour_dismissed_v2";

interface Step {
  icon: typeof Camera;
  title: string;
  desc: string;
  cta: string;
  href: string;
  isNew?: boolean;
}

const STEPS: Step[] = [
  {
    icon: Camera,
    title: "1. Spiel anlegen & filmen",
    desc: "Erstelle ein Match, stelle dein Smartphone auf und starte die Aufnahme. Auto-Kalibrierung übernimmt den Rest.",
    cta: "Neues Spiel",
    href: "/matches/new",
  },
  {
    icon: Brain,
    title: "2. KI analysiert automatisch",
    desc: "Heatmaps, Pässe, Pressing, Formationen, Torchancen — alles wird ohne Klick erkannt.",
    cta: "Spiele ansehen",
    href: "/matches",
  },
  {
    icon: FileText,
    title: "3. Bericht & Trainingsplan",
    desc: "Lies den Coach-Bericht, teile ihn per WhatsApp und übernimm Trainingsempfehlungen.",
    cta: "Berichte öffnen",
    href: "/matches",
  },
  {
    icon: Inbox,
    title: "4. Coach-Inbox (NEU)",
    desc: "Personalisierte KI-Empfehlungen aus deinen letzten 5 Spielen — Lob, Warnungen, Taktik-Tipps.",
    cta: "Inbox öffnen",
    href: "/inbox",
    isNew: true,
  },
  {
    icon: Bell,
    title: "5. Eltern-Push (NEU)",
    desc: "Eltern abonnieren ihr Kind und bekommen automatisch Push-Nachrichten nach dem Spiel.",
    cta: "Spieler verwalten",
    href: "/players",
    isNew: true,
  },
  {
    icon: Trophy,
    title: "6. Saison-Wrapped (NEU)",
    desc: "Am Saisonende: animierte Highlights, Top-Scorer, Best-of-Klips — geteilt mit einem Tap.",
    cta: "Hub öffnen",
    href: "/season",
    isNew: true,
  },
];

export function CoachWelcomeTour() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <AnimatePresence>
      <motion.section
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="glass-card p-5 md:p-6 border-primary/30 bg-gradient-to-br from-primary/10 via-background to-accent/5 relative overflow-hidden"
        aria-labelledby="welcome-tour-title"
      >
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Tour ausblenden"
        >
          <X className="h-4 w-4" />
        </button>

        <header className="flex items-center gap-2 mb-1 pr-8">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
            <GraduationCap className="h-4 w-4 text-primary" />
          </div>
          <h2 id="welcome-tour-title" className="text-base md:text-lg font-bold font-display">
            Willkommen, Coach! <Sparkles className="inline h-4 w-4 text-primary" />
          </h2>
        </header>
        <p className="text-xs md:text-sm text-muted-foreground mb-4 pr-8">
          In 6 Schritten verstehst du die App komplett. Du kannst jeden Schritt direkt starten.
        </p>

        <ol className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {STEPS.map((s) => (
            <li
              key={s.title}
              className="rounded-xl border border-border/60 bg-card/60 p-3 flex flex-col gap-2 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <s.icon className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-sm font-semibold leading-tight">{s.title}</h3>
                {s.isNew && (
                  <Badge variant="secondary" className="ml-auto text-[10px] py-0 px-1.5 bg-primary/15 text-primary border-primary/30">
                    NEU
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-snug flex-1">{s.desc}</p>
              <Button variant="ghost" size="sm" asChild className="justify-start h-7 px-2 text-xs">
                <Link to={s.href}>
                  {s.cta} <ChevronRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </li>
          ))}
        </ol>

        <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-border/40">
          <Button variant="link" size="sm" asChild className="px-0 h-auto text-xs">
            <Link to="/guide">Vollständige Anleitung lesen →</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDismiss} className="text-xs">
            Verstanden, ausblenden
          </Button>
        </div>
      </motion.section>
    </AnimatePresence>
  );
}
