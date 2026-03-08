import { motion } from "framer-motion";
import { Smartphone, Play, FileBarChart } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const steps = [
  {
    icon: Smartphone,
    titleKey: "landing.step1Title",
    descKey: "landing.step1Desc",
    visual: "📱📱📱",
  },
  {
    icon: Play,
    titleKey: "landing.step2Title",
    descKey: "landing.step2Desc",
    visual: "⚽",
  },
  {
    icon: FileBarChart,
    titleKey: "landing.step3Title",
    descKey: "landing.step3Desc",
    visual: "📊",
  },
];

export function HowItWorks() {
  const { t } = useTranslation();

  return (
    <section id="how-it-works" className="py-24 md:py-36 bg-muted/30 relative overflow-hidden">
      <div className="absolute inset-0 field-grid opacity-20" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-5xl font-bold font-display mb-4">
            {t("landing.howItWorksTitle")}
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto text-lg">
            {t("landing.howItWorksDesc")}
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12 md:gap-8 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-px">
              <motion.div
                className="h-full w-full"
                style={{ background: "linear-gradient(90deg, transparent, hsl(152 60% 36% / 0.3), transparent)" }}
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: 0.5 }}
              />
            </div>

            {steps.map((step, i) => (
              <motion.div
                key={i}
                className="text-center relative"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.2 }}
              >
                {/* Step number */}
                <motion.div
                  className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center relative"
                  style={{ background: "linear-gradient(135deg, hsl(152 60% 36% / 0.15), hsl(142 55% 42% / 0.08))" }}
                  whileHover={{ scale: 1.05 }}
                >
                  <step.icon className="h-8 w-8 text-primary" />
                  <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center font-display shadow-lg">
                    {i + 1}
                  </div>
                </motion.div>

                <h3 className="text-xl font-semibold font-display mb-3">{t(step.titleKey)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
                  {t(step.descKey)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
