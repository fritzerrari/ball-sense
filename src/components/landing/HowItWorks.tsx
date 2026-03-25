import { motion } from "framer-motion";
import { Smartphone, Brain, FileBarChart, ChevronRight } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export function HowItWorks() {
  const { language } = useTranslation();
  const de = language === "de";

  const steps = [
    {
      icon: Smartphone,
      num: "01",
      title: de ? "Aufstellen & Aufnehmen" : "Set up & Record",
      desc: de
        ? "Smartphone am Spielfeldrand aufstellen. Code eingeben. Aufnahme starten. Fertig — das dauert 30 Sekunden."
        : "Set up smartphone at the sideline. Enter code. Start recording. Done — takes 30 seconds.",
      detail: de ? "1–3 Kameras für volle Abdeckung" : "1–3 cameras for full coverage",
    },
    {
      icon: Brain,
      num: "02",
      title: de ? "KI analysiert automatisch" : "AI analyzes automatically",
      desc: de
        ? "Gemini Vision erkennt Formationen, Spielzüge und Gefahrenzonen. Spieler werden automatisch identifiziert."
        : "Gemini Vision detects formations, plays and danger zones. Players are identified automatically.",
      detail: de ? "~70-80% Genauigkeit" : "~70-80% accuracy",
    },
    {
      icon: FileBarChart,
      num: "03",
      title: de ? "Coaching-Report in ~2 Min" : "Coaching report in ~2 min",
      desc: de
        ? "Fertige Insights, Trainingsplan, Gegner-Scouting und Spielzug-Replay — direkt im Browser. Kein manueller Aufwand."
        : "Ready-made insights, training plan, opponent scouting and tactical replay — right in the browser. No manual effort.",
      detail: de ? "Exportierbar als PDF" : "Exportable as PDF",
    },
  ];

  return (
    <section id="how-it-works" className="py-24 md:py-36 relative overflow-hidden">
      <div className="absolute inset-0 field-grid opacity-[0.04]" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-xs font-semibold text-primary font-display tracking-wider uppercase mb-3 block">
            {de ? "So funktioniert's" : "How it works"}
          </span>
          <h2 className="text-3xl md:text-5xl font-bold font-display mb-4">
            {de ? (
              <>3 Schritte.<br /><span className="gradient-text">Null Aufwand.</span></>
            ) : (
              <>3 steps.<br /><span className="gradient-text">Zero effort.</span></>
            )}
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            {de ? "Vom Smartphone-Video zur fertigen Taktik-Analyse." : "From smartphone video to complete tactical analysis."}
          </p>
        </motion.div>

        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-4 relative">
          {/* Desktop step connectors */}
          {[0, 1].map((idx) => (
            <div
              key={idx}
              className="hidden md:flex absolute top-1/2 -translate-y-1/2 z-10 items-center"
              style={{ left: `${((idx + 1) * 100) / 3}%`, transform: "translate(-50%, -50%)" }}
            >
              <ChevronRight className="w-5 h-5 text-primary/30" />
            </div>
          ))}

          {steps.map((step, i) => (
            <motion.div
              key={i}
              className="group relative rounded-2xl border border-border/50 bg-card/50 p-8 hover:border-primary/30 transition-all duration-300 overflow-hidden"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              whileHover={{ y: -6 }}
            >
              {/* Background number */}
              <span className="absolute -top-4 -right-2 text-[120px] font-display font-bold text-foreground/[0.03] leading-none select-none pointer-events-none">
                {step.num}
              </span>

              {/* Number badge */}
              <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <span className="text-xs font-bold text-primary font-display">{step.num}</span>
              </div>

              <div className="relative">
                <motion.div
                  className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/15 transition-colors"
                  whileHover={{ scale: 1.05, rotate: [0, -5, 5, 0] }}
                >
                  <step.icon className="h-6 w-6 text-primary" />
                </motion.div>
                <h3 className="text-lg font-semibold font-display mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">{step.desc}</p>
                <span className="text-[10px] font-medium text-primary/70 bg-primary/5 px-2 py-1 rounded-full border border-primary/10">
                  {step.detail}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
