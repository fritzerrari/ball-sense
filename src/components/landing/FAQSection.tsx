import { motion } from "framer-motion";
import { useTranslation } from "@/lib/i18n";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqKeys = [
  { q: "landing.faq1q", a: "landing.faq1a" },
  { q: "landing.faq2q", a: "landing.faq2a" },
  { q: "landing.faq3q", a: "landing.faq3a" },
  { q: "landing.faq4q", a: "landing.faq4a" },
  { q: "landing.faq5q", a: "landing.faq5a" },
  { q: "landing.faq6q", a: "landing.faq6a" },
];

export function FAQSection() {
  const { t } = useTranslation();

  return (
    <section id="faq" className="py-24 md:py-36">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-5xl font-bold font-display mb-4">{t("landing.faqTitle")}</h2>
          <p className="text-muted-foreground max-w-md mx-auto">{t("landing.faqDesc")}</p>
        </motion.div>

        <motion.div
          className="max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
        >
          <Accordion type="single" collapsible className="space-y-3">
            {faqKeys.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="rounded-xl border border-border/50 bg-card/50 px-6"
              >
                <AccordionTrigger className="text-sm font-medium hover:no-underline py-5">
                  {t(faq.q)}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-5">
                  {t(faq.a)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
