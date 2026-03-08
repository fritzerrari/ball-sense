import { motion } from "framer-motion";
import { Smartphone, Play, FileBarChart } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const steps = [
  { icon: Smartphone, titleKey: "landing.step1Title", descKey: "landing.step1Desc", num: "01" },
  { icon: Play, titleKey: "landing.step2Title", descKey: "landing.step2Desc", num: "02" },
  { icon: FileBarChart, titleKey: "landing.step3Title", descKey: "landing.step3Desc", num: "03" },
];

export function HowItWorks() {
  const { t } = useTranslation();

  return (
    <section id="how-it-works" className="py-24 md:py-36 relative overflow-hidden">
      <div className="absolute inset-0 field-grid opacity-[0.04]" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Left-aligned header */}
        <div className="grid lg:grid-cols-3 gap-8 lg:gap-12 max-w-6xl mx-auto mb-16">
          <motion.div
            className="lg:col-span-1"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-xs font-semibold text-primary font-display tracking-wider uppercase mb-3 block">{t("landing.howItWorks")}</span>
            <h2 className="text-3xl md:text-4xl font-bold font-display leading-tight">
              {t("landing.howItWorksTitle")}
            </h2>
          </motion.div>
          <motion.div
            className="lg:col-span-2 flex items-end"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <p className="text-muted-foreground max-w-lg text-base leading-relaxed">
              {t("landing.howItWorksDesc")}
            </p>
          </motion.div>
        </div>

        {/* Steps — horizontal cards with large numbers */}
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-4">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              className="group relative rounded-2xl border border-border/50 bg-card/50 p-8 hover:border-primary/30 hover:bg-card transition-all duration-300 overflow-hidden"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              whileHover={{ y: -4 }}
            >
              {/* Large bg number */}
              <span className="absolute -top-4 -right-2 text-[120px] font-display font-bold text-foreground/[0.03] leading-none select-none pointer-events-none">
                {step.num}
              </span>

              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/15 transition-colors">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold font-display mb-2">{t(step.titleKey)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(step.descKey)}</p>
              </div>

              {/* Connecting arrow for desktop */}
              {i < 2 && (
                <div className="hidden md:block absolute top-1/2 -right-2 translate-x-full -translate-y-1/2 z-10">
                  <div className="w-4 h-px bg-border" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
