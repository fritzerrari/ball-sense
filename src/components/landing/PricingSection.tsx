import { motion } from "framer-motion";
import { Check, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useTranslation } from "@/lib/i18n";

const plans = [
  { name: "STARTER", price: "49", features: ["landing.plan1f1", "landing.plan1f2", "landing.plan1f3", "landing.plan1f4"] },
  { name: "CLUB", price: "99", popular: true, features: ["landing.plan2f1", "landing.plan2f2", "landing.plan2f3", "landing.plan2f4", "landing.plan2f5"] },
  { name: "PRO", price: "199", features: ["landing.plan3f1", "landing.plan3f2", "landing.plan3f3", "landing.plan3f4", "landing.plan3f5"] },
];

export function PricingSection() {
  const { t } = useTranslation();

  return (
    <section id="pricing" className="py-24 md:py-36 relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 field-grid opacity-[0.03]" />
      
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-xs font-semibold text-primary font-display tracking-wider uppercase mb-3 block">{t("landing.pricing")}</span>
          <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">{t("landing.pricingTitle")}</h2>
          <p className="text-muted-foreground max-w-md mx-auto">{t("landing.pricingDesc")}</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-5 max-w-4xl mx-auto items-stretch">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              className={`group relative rounded-2xl p-8 flex flex-col border transition-all duration-500 overflow-hidden ${
                plan.popular
                  ? "border-primary/40 bg-card scale-[1.02] z-10"
                  : "border-border/50 bg-card/50 hover:border-primary/20"
              }`}
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: plan.popular ? 1.02 : 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -8 }}
            >
              {/* Popular glow */}
              {plan.popular && (
                <>
                  <div className="absolute -inset-px rounded-2xl" style={{ boxShadow: "var(--shadow-glow)" }} />
                  <motion.div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold font-display flex items-center gap-1.5 shadow-lg"
                    initial={{ opacity: 0, y: -10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
                  >
                    <Sparkles className="h-3 w-3" />
                    {t("landing.popular")}
                  </motion.div>
                </>
              )}

              <div className="relative mb-6">
                <h3 className="text-xs font-semibold text-muted-foreground tracking-widest mb-3">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <motion.span
                    className="text-5xl font-bold font-display"
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
                  >
                    €{plan.price}
                  </motion.span>
                  <span className="text-muted-foreground text-sm">{t("landing.perMonth")}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8 flex-1 relative">
                {plan.features.map((fKey, fi) => (
                  <motion.li
                    key={fKey}
                    className="flex items-center gap-2.5 text-sm"
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 + fi * 0.06, duration: 0.3 }}
                  >
                    <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Check className="h-2.5 w-2.5 text-primary" />
                    </div>
                    <span className="text-muted-foreground">{t(fKey)}</span>
                  </motion.li>
                ))}
              </ul>

              <Button variant={plan.popular ? "hero" : "heroOutline"} className="w-full" asChild>
                <Link to="/login">
                  {t("landing.startNow")}
                  {plan.popular && <ChevronRight className="ml-1 h-4 w-4" />}
                </Link>
              </Button>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="text-center mt-10"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
        >
          <Link to="/compare" className="text-sm text-muted-foreground hover:text-primary transition-colors underline underline-offset-4">
            {language === "de" ? "Wie unterscheiden wir uns von GPS-Westen & Co.?" : "How do we compare to GPS vests & others?"}
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
