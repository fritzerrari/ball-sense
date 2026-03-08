import { motion } from "framer-motion";
import { Smartphone, Brain, BarChart3, Shield, Users, Zap } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const features = [
  { icon: Smartphone, titleKey: "landing.feat1Title", descKey: "landing.feat1Desc", span: "sm:col-span-2" },
  { icon: Brain, titleKey: "landing.feat2Title", descKey: "landing.feat2Desc", span: "" },
  { icon: BarChart3, titleKey: "landing.feat3Title", descKey: "landing.feat3Desc", span: "" },
  { icon: Shield, titleKey: "landing.feat4Title", descKey: "landing.feat4Desc", span: "sm:col-span-2" },
  { icon: Users, titleKey: "landing.feat5Title", descKey: "landing.feat5Desc", span: "" },
  { icon: Zap, titleKey: "landing.feat6Title", descKey: "landing.feat6Desc", span: "sm:col-span-2 lg:col-span-1" },
];

export function FeatureCards() {
  const { t } = useTranslation();

  return (
    <section id="features" className="py-24 md:py-36">
      <div className="container mx-auto px-4">
        {/* Right-aligned header for variety */}
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

        {/* Bento grid — varied card sizes */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {features.map((f, i) => (
            <motion.div
              key={t(f.titleKey)}
              className={`group relative rounded-2xl border border-border/50 bg-card/50 p-7 hover:border-primary/30 hover:bg-card transition-all duration-300 ${f.span}`}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              whileHover={{ y: -3 }}
            >
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ boxShadow: "var(--shadow-glow)" }} />
              <div className="relative">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
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
