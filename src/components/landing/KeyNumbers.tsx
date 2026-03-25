import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { useTranslation } from "@/lib/i18n";

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const duration = 1500;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(tick);
    };
    tick();
  }, [isInView, value]);

  return <span ref={ref}>{display}{suffix}</span>;
}

export function KeyNumbers() {
  const { t } = useTranslation();

  const stats = [
    { value: 1, suffix: "", label: t("landing.smartphonesEnough"), sublabel: t("landing.keyNumberSmartphones") },
    { value: 30, suffix: "s", label: t("landing.toReport"), sublabel: t("landing.keyNumberReport") },
    { value: 0, suffix: "€", label: t("landing.hardwareCost"), sublabel: t("landing.keyNumberHardware") },
  ];

  return (
    <section className="py-16 md:py-24 border-y border-border/30">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-3 divide-x divide-border/30">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              className="text-center px-4 md:px-8"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
            >
              <div className="text-4xl md:text-6xl font-bold font-display gradient-text mb-1">
                {stat.value === 0 ? (
                  <span>0€</span>
                ) : (
                  <AnimatedNumber value={stat.value} suffix={stat.suffix} />
                )}
              </div>
              <div className="text-sm md:text-base font-semibold font-display mb-0.5">{stat.label}</div>
              <div className="text-xs text-muted-foreground hidden md:block">{stat.sublabel}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
