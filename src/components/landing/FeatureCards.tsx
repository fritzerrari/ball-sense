import { motion } from "framer-motion";
import { Smartphone, Brain, BarChart3, Shield, Users, Zap } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const features = [
  { icon: Smartphone, titleKey: "landing.feat1Title", descKey: "landing.feat1Desc" },
  { icon: Brain, titleKey: "landing.feat2Title", descKey: "landing.feat2Desc" },
  { icon: BarChart3, titleKey: "landing.feat3Title", descKey: "landing.feat3Desc" },
  { icon: Shield, titleKey: "landing.feat4Title", descKey: "landing.feat4Desc" },
  { icon: Users, titleKey: "landing.feat5Title", descKey: "landing.feat5Desc" },
  { icon: Zap, titleKey: "landing.feat6Title", descKey: "landing.feat6Desc" },
];

export function FeatureCards() {
  const { t } = useTranslation();

  return (
    <section id="features" className="py-24 md:py-36">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-5xl font-bold font-display mb-4">
            {t("landing.featuresTitle")}
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto text-lg">
            {t("landing.featuresDesc")}
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {features.map((f, i) => (
            <motion.div
              key={t(f.titleKey)}
              className="group relative rounded-2xl border border-border/50 bg-card/50 p-7 hover:border-primary/30 hover:bg-card transition-all duration-300"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={{ y: -4 }}
            >
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ boxShadow: "0 0 40px hsl(152 60% 36% / 0.08)" }} />
              <div className="relative">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold font-display mb-2">{t(f.titleKey)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(f.descKey)}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
