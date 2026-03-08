import { motion } from "framer-motion";
import { Quote, Shield, Users, Trophy } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const testimonials = [
  { quoteKey: "landing.testimonial1", authorKey: "landing.testimonial1Author", roleKey: "landing.testimonial1Role" },
  { quoteKey: "landing.testimonial2", authorKey: "landing.testimonial2Author", roleKey: "landing.testimonial2Role" },
  { quoteKey: "landing.testimonial3", authorKey: "landing.testimonial3Author", roleKey: "landing.testimonial3Role" },
];

export function TrustSection() {
  const { t } = useTranslation();

  return (
    <section className="py-24 md:py-36 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Trust badges */}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-8 mb-20"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          {[
            { icon: Shield, label: t("landing.trustDsgvo") },
            { icon: Users, label: t("landing.trustClubs") },
            { icon: Trophy, label: t("landing.trustLeagues") },
          ].map((badge, i) => (
            <div key={i} className="flex items-center gap-2.5 text-muted-foreground">
              <badge.icon className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">{badge.label}</span>
            </div>
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
            {t("landing.testimonialsTitle")}
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((item, i) => (
            <motion.div
              key={i}
              className="rounded-2xl border border-border/50 bg-card/50 p-7 flex flex-col hover:border-primary/20 transition-colors"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <Quote className="h-5 w-5 text-primary/40 mb-4 shrink-0" />
              <p className="text-sm text-foreground leading-relaxed flex-1 italic">
                "{t(item.quoteKey)}"
              </p>
              <div className="mt-5 pt-4 border-t border-border/50">
                <div className="text-sm font-semibold">{t(item.authorKey)}</div>
                <div className="text-xs text-muted-foreground">{t(item.roleKey)}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
