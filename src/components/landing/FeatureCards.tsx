import { motion } from "framer-motion";
import { Smartphone, Brain, BarChart3, Shield, Users, Zap, FileText, Dumbbell, Share2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const features = [
  { icon: Smartphone, titleKey: "landing.feat1Title", descKey: "landing.feat1Desc", span: "sm:col-span-2", accent: "from-primary/20 to-primary/5" },
  { icon: Brain, titleKey: "landing.feat2Title", descKey: "landing.feat2Desc", span: "", accent: "from-accent/20 to-accent/5" },
  { icon: BarChart3, titleKey: "landing.feat3Title", descKey: "landing.feat3Desc", span: "", accent: "from-primary/15 to-transparent" },
  { icon: FileText, titleKey: "landing.feat7Title", descKey: "landing.feat7Desc", span: "sm:col-span-2", accent: "from-accent/15 to-transparent" },
  { icon: Dumbbell, titleKey: "landing.feat8Title", descKey: "landing.feat8Desc", span: "", accent: "from-primary/20 to-primary/5" },
  { icon: Share2, titleKey: "landing.feat9Title", descKey: "landing.feat9Desc", span: "", accent: "from-accent/20 to-accent/5" },
  { icon: Shield, titleKey: "landing.feat4Title", descKey: "landing.feat4Desc", span: "", accent: "from-primary/15 to-transparent" },
  { icon: Users, titleKey: "landing.feat5Title", descKey: "landing.feat5Desc", span: "", accent: "from-accent/15 to-transparent" },
  { icon: Zap, titleKey: "landing.feat6Title", descKey: "landing.feat6Desc", span: "sm:col-span-2 lg:col-span-1", accent: "from-primary/20 to-primary/5" },
];

export function FeatureCards() {
  const { t } = useTranslation();

  return (
    <section id="features" className="py-24 md:py-36">
      <div className="container mx-auto px-4">
        {/* Header with animated line */}
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
            {t("landing.featuresDesc")}
          </p>
        </motion.div>

        {/* Animated divider */}
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

        {/* Bento grid with staggered entrance + hover effects */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {features.map((f, i) => (
            <motion.div
              key={t(f.titleKey)}
              className={`group relative rounded-2xl border border-border/50 bg-card/50 p-7 transition-all duration-500 overflow-hidden ${f.span}`}
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -6, borderColor: "hsl(var(--primary) / 0.3)" }}
            >
              {/* Gradient reveal on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${f.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl`} />
              
              {/* Glow on hover */}
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
                  <f.icon className="h-5 w-5 text-primary" />
                </motion.div>
                <h3 className="text-base font-semibold font-display mb-2">{t(f.titleKey)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(f.descKey)}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
