import { motion } from "framer-motion";
import { Check, ChevronRight } from "lucide-react";
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
    <section id="pricing" className="py-24 md:py-36">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-5xl font-bold font-display mb-4">{t("landing.pricingTitle")}</h2>
          <p className="text-muted-foreground text-lg">{t("landing.pricingDesc")}</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              className={`rounded-2xl p-8 flex flex-col border transition-all ${
                plan.popular
                  ? "border-primary/30 bg-card relative shadow-[0_0_40px_hsl(152_60%_36%/0.1)]"
                  : "border-border/50 bg-card/50"
              }`}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold font-display">
                  {t("landing.popular")}
                </div>
              )}
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-muted-foreground tracking-widest mb-3">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold font-display">€{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{t("landing.perMonth")}</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((fKey) => (
                  <li key={fKey} className="flex items-center gap-2.5 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-muted-foreground">{t(fKey)}</span>
                  </li>
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
      </div>
    </section>
  );
}
