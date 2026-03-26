import { motion } from "framer-motion";
import { ArrowRight, X, Sparkles } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export function WhyFieldIQ() {
  const { language } = useTranslation();
  const de = language === "de";

  const comparisons = de
    ? [
        { classic: "9,2 km Laufdistanz", fieldiq: "Sprint-Intensität sinkt ab Min. 60 um 40% — Ermüdung auf der linken Seite", category: "Physisch → Taktisch" },
        { classic: "58% Ballbesitz", fieldiq: "Dominanz nur in HZ 1 — ab Min. 40 Kontrollverlust über die linke Seite", category: "Zahl → Kontext" },
        { classic: "12 Torschüsse", fieldiq: "62% Angriffe über rechts — der Gegner liest euren Spielaufbau", category: "Statistik → Muster" },
        { classic: "2 Stunden Analyse nach dem Spiel", fieldiq: "Kompletter KI-Report in ~2 Minuten — sofort nutzbar für die Kabinenansprache", category: "Manuell → Automatisch" },
      ]
    : [
        { classic: "9.2 km running distance", fieldiq: "Sprint intensity drops 40% after min. 60 — fatigue on the left side", category: "Physical → Tactical" },
        { classic: "58% possession", fieldiq: "Dominance only in 1st half — loss of control from min. 40 on the left", category: "Number → Context" },
        { classic: "12 shots on goal", fieldiq: "62% attacks down the right — opponent reads your build-up", category: "Stat → Pattern" },
        { classic: "2 hours post-match analysis", fieldiq: "Complete AI report in ~2 minutes — ready for the locker room talk", category: "Manual → Automatic" },
      ];

  return (
    <section className="py-24 md:py-36 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] via-transparent to-primary/[0.02]" />
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-xs font-semibold text-primary font-display tracking-wider uppercase mb-4 block">
              {de ? "Der Unterschied" : "The difference"}
            </span>
            <h2 className="text-3xl md:text-5xl font-bold font-display leading-tight mb-4">
              {de ? (
                <>Die anderen liefern <span className="line-through text-muted-foreground/50">Zahlen</span>.<br />
                <span className="gradient-text">Wir liefern Antworten.</span></>
              ) : (
                <>Others deliver <span className="line-through text-muted-foreground/50">numbers</span>.<br />
                <span className="gradient-text">We deliver answers.</span></>
              )}
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto text-base">
              {de
                ? "Klassische Statistiken erzählen eine halbe Geschichte. FieldIQ liefert die ganze — mit konkreten Handlungsempfehlungen."
                : "Classic statistics tell half the story. FieldIQ delivers the full picture — with actionable recommendations."}
            </p>
          </motion.div>

          {/* Comparison cards */}
          <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {comparisons.map((item, i) => (
              <motion.div
                key={i}
                className="group rounded-2xl border border-border/50 bg-card/50 p-6 hover:border-primary/30 transition-all duration-300 overflow-hidden relative"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                whileHover={{ y: -4 }}
              >
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="text-[10px] font-semibold uppercase tracking-wider text-primary/60 mb-4 font-display">
                  {item.category}
                </div>

                {/* Classic - crossed out */}
                <div className="flex items-start gap-2 mb-4 opacity-50">
                  <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground line-through decoration-destructive/40">
                    {item.classic}
                  </p>
                </div>

                {/* FieldIQ insight */}
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-foreground leading-relaxed">
                    {item.fieldiq}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
