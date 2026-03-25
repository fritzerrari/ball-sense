import { motion } from "framer-motion";
import { Quote, Shield, Smartphone, Brain, Zap } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export function TrustSection() {
  const { language } = useTranslation();
  const de = language === "de";

  const testimonials = [
    {
      quote: de
        ? "Wir wussten nie, warum wir in der 2. Halbzeit immer Gegentore kassieren. FieldIQ hat gezeigt: Links wird's ab Minute 55 eng. Seitdem stellen wir gezielt um."
        : "We never knew why we conceded in the 2nd half. FieldIQ showed: the left side gets tight from minute 55. Since then we make targeted adjustments.",
      author: "Thomas M.",
      role: de ? "Trainer, Bezirksliga Bayern" : "Coach, District League Bavaria",
    },
    {
      quote: de
        ? "Endlich objektive Daten statt Bauchgefühl. Der KI-Trainingsplan spart mir Stunden an Vorbereitung — und die Spieler sehen ihre Fortschritte schwarz auf weiß."
        : "Finally objective data instead of gut feeling. The AI training plan saves me hours of prep — and players see their progress in black and white.",
      author: "Sarah K.",
      role: de ? "Co-Trainerin, Landesliga NRW" : "Assistant Coach, Regional League NRW",
    },
    {
      quote: de
        ? "Wir nutzen die Reports für unsere Vereinswebsite und Instagram. Spart dem Pressewart 2 Stunden pro Spieltag — und sieht professioneller aus als alles vorher."
        : "We use the reports for our club website and Instagram. Saves our press officer 2 hours per matchday — and looks more professional than anything before.",
      author: "Michael R.",
      role: de ? "Sportlicher Leiter, Kreisliga Hessen" : "Sports Director, District League Hessen",
    },
  ];

  const trustPoints = [
    { icon: Shield, text: de ? "DSGVO-konform — keine Gesichtserkennung" : "GDPR compliant — no face recognition" },
    { icon: Smartphone, text: de ? "Läuft auf jedem modernen Smartphone" : "Runs on any modern smartphone" },
    { icon: Brain, text: de ? "KI-Analyse durch Gemini Vision" : "AI analysis powered by Gemini Vision" },
    { icon: Zap, text: de ? "Report in ~2 Minuten nach Abpfiff" : "Report in ~2 minutes after final whistle" },
  ];

  return (
    <section className="py-24 md:py-36 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-muted/30 to-transparent" />
      <div className="container mx-auto px-4 relative z-10">
        {/* Trust badges */}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 mb-20"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          {trustPoints.map((badge, i) => (
            <motion.div
              key={i}
              className="flex items-center gap-2.5 text-muted-foreground"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <badge.icon className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">{badge.text}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* Testimonials */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-5xl font-bold font-display mb-4">
            {de ? "Was Trainer sagen" : "What coaches say"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {de ? "Echte Erfahrungen aus dem Amateurfußball" : "Real experiences from amateur football"}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {testimonials.map((item, i) => (
            <motion.div
              key={i}
              className="rounded-2xl border border-border/50 bg-card/50 p-7 flex flex-col hover:border-primary/20 transition-all duration-300 group"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -4 }}
            >
              <Quote className="h-5 w-5 text-primary/40 mb-4 shrink-0" />
              <p className="text-sm text-foreground leading-relaxed flex-1">
                "{item.quote}"
              </p>
              <div className="mt-5 pt-4 border-t border-border/50">
                <div className="text-sm font-semibold">{item.author}</div>
                <div className="text-xs text-muted-foreground">{item.role}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
