import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const comparisons = {
  de: [
    {
      classic: "9,2 km Laufleistung",
      fieldiq: "Sprint-Intensität sinkt ab Min. 60 um 40% — Ermüdung auf der linken Seite",
    },
    {
      classic: "23 km/h Topspeed",
      fieldiq: "Konter-Geschwindigkeit: 3 Spieler in 5 Sekunden in Position",
    },
    {
      classic: "58% Ballbesitz",
      fieldiq: "Dominanz nur in HZ 1 — ab Min. 40 Kontrollverlust über links",
    },
    {
      classic: "12 Torschüsse",
      fieldiq: "62% Angriffe über rechts — der Gegner liest euch",
    },
  ],
  en: [
    {
      classic: "9.2 km running distance",
      fieldiq: "Sprint intensity drops 40% after min. 60 — fatigue on the left side",
    },
    {
      classic: "23 km/h top speed",
      fieldiq: "Counter-attack speed: 3 players in position within 5 seconds",
    },
    {
      classic: "58% possession",
      fieldiq: "Dominance only in 1st half — loss of control from min. 40 on the left",
    },
    {
      classic: "12 shots on goal",
      fieldiq: "62% attacks down the right — opponent reads your patterns",
    },
  ],
};

export function WhyFieldIQ() {
  const { language } = useTranslation();
  const items = comparisons[language];

  const title =
    language === "de"
      ? "Es geht nicht um Kilometer."
      : "It's not about kilometers.";
  const subtitle =
    language === "de"
      ? "Es geht darum, WARUM dein Team in der 70. Minute die Kontrolle verliert."
      : "It's about WHY your team loses control in the 70th minute.";
  const intro =
    language === "de"
      ? "Klassische Statistiken wie Laufdistanz oder Topspeed sagen dir, WAS passiert ist. FieldIQ sagt dir, WARUM — und was du ändern kannst."
      : "Classic stats like running distance or top speed tell you WHAT happened. FieldIQ tells you WHY — and what you can change.";
  const classicLabel = language === "de" ? "Klassisch" : "Classic";
  const fieldiqLabel = "FieldIQ";

  return (
    <section className="py-24 md:py-36 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.02] to-transparent" />
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start max-w-6xl mx-auto">
          {/* Left — Text */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:sticky lg:top-32"
          >
            <span className="text-xs font-semibold text-primary font-display tracking-wider uppercase mb-4 block">
              {language === "de" ? "Warum FieldIQ?" : "Why FieldIQ?"}
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-[2.75rem] font-bold font-display leading-tight mb-3">
              {title}
            </h2>
            <p className="text-xl md:text-2xl font-semibold font-display gradient-text mb-6">
              {subtitle}
            </p>
            <p className="text-muted-foreground leading-relaxed max-w-md">
              {intro}
            </p>
          </motion.div>

          {/* Right — Comparison cards */}
          <div className="space-y-4">
            {items.map((item, i) => (
              <motion.div
                key={i}
                className="rounded-2xl border border-border/50 bg-card/50 p-5 md:p-6 group hover:border-primary/30 transition-all duration-300"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Classic stat */}
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1 block">
                      {classicLabel}
                    </span>
                    <p className="text-sm text-muted-foreground line-through decoration-muted-foreground/30">
                      {item.classic}
                    </p>
                  </div>

                  <ArrowRight className="hidden sm:block h-4 w-4 text-primary/40 flex-shrink-0" />

                  {/* FieldIQ insight */}
                  <div className="flex-[1.6] min-w-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1 block">
                      {fieldiqLabel}
                    </span>
                    <p className="text-sm font-medium text-foreground leading-relaxed">
                      {item.fieldiq}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
