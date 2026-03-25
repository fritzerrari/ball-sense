import { motion } from "framer-motion";
import { Smartphone, Hand, Sparkles, Clock, MousePointerClick, Bot } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export function TransparencySection() {
  const { language } = useTranslation();

  const title = language === "de" ? "Was musst du tun?" : "What do you need to do?";
  const desc =
    language === "de"
      ? "Transparent und einfach: Dein Aufwand pro Spiel."
      : "Transparent and simple: Your effort per match.";

  const manualLabel = language === "de" ? "Manuell" : "Manual";
  const autoLabel = language === "de" ? "Automatisch" : "Automatic";
  const optionalLabel = language === "de" ? "Optional" : "Optional";

  const phases = language === "de"
    ? [
        {
          icon: Smartphone,
          phase: "Vor dem Spiel",
          time: "2 Minuten",
          steps: [
            { text: "Smartphone aufstellen", type: "manual" as const },
            { text: "Feld-Kalibrierung (4 Ecken antippen)", type: "manual" as const },
            { text: "Aufstellung aus Kader wählen", type: "manual" as const },
          ],
        },
        {
          icon: Hand,
          phase: "Während des Spiels",
          time: "Optional",
          steps: [
            { text: "Events antippen (Tor, Karte, Ecke, Chance)", type: "optional" as const },
            { text: "Löst automatisch Highlight-Clips aus", type: "auto" as const },
            { text: "Die KI analysiert durchgehend im Hintergrund", type: "auto" as const },
          ],
        },
        {
          icon: Sparkles,
          phase: "Nach dem Spiel",
          time: "~2 Min Wartezeit",
          steps: [
            { text: "Aufnahme stoppen", type: "manual" as const },
            { text: "KI erstellt vollständigen Report", type: "auto" as const },
            { text: "Taktik, Pressing, Scouting, Trainingsplan — fertig", type: "auto" as const },
          ],
        },
      ]
    : [
        {
          icon: Smartphone,
          phase: "Before the match",
          time: "2 minutes",
          steps: [
            { text: "Set up your smartphone", type: "manual" as const },
            { text: "Field calibration (tap 4 corners)", type: "manual" as const },
            { text: "Select lineup from squad", type: "manual" as const },
          ],
        },
        {
          icon: Hand,
          phase: "During the match",
          time: "Optional",
          steps: [
            { text: "Tap events (goal, card, corner, chance)", type: "optional" as const },
            { text: "Automatically triggers highlight clips", type: "auto" as const },
            { text: "AI analyzes continuously in the background", type: "auto" as const },
          ],
        },
        {
          icon: Sparkles,
          phase: "After the match",
          time: "~2 min wait",
          steps: [
            { text: "Stop recording", type: "manual" as const },
            { text: "AI creates complete report", type: "auto" as const },
            { text: "Tactics, pressing, scouting, training plan — done", type: "auto" as const },
          ],
        },
      ];

  const typeConfig = {
    manual: { label: manualLabel, class: "bg-muted text-muted-foreground", icon: MousePointerClick },
    optional: { label: optionalLabel, class: "bg-accent/10 text-accent-foreground", icon: Hand },
    auto: { label: autoLabel, class: "bg-primary/10 text-primary", icon: Bot },
  };

  return (
    <section className="py-24 md:py-36">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-xs font-semibold text-primary font-display tracking-wider uppercase mb-3 block">
            {language === "de" ? "Transparenz" : "Transparency"}
          </span>
          <h2 className="text-3xl md:text-4xl font-bold font-display mb-3">{title}</h2>
          <p className="text-muted-foreground max-w-md mx-auto">{desc}</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {phases.map((phase, i) => (
            <motion.div
              key={i}
              className="rounded-2xl border border-border/50 bg-card/50 p-6 md:p-7 relative overflow-hidden group"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
            >
              {/* Phase header */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <phase.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-semibold font-display">{phase.phase}</h3>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {phase.time}
                  </div>
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-3">
                {phase.steps.map((step, j) => {
                  const cfg = typeConfig[step.type];
                  return (
                    <div key={j} className="flex items-start gap-2.5">
                      <span
                        className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${cfg.class} flex-shrink-0 mt-0.5`}
                      >
                        <cfg.icon className="h-2.5 w-2.5" />
                        {cfg.label}
                      </span>
                      <span className="text-sm text-foreground/80 leading-snug">{step.text}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
