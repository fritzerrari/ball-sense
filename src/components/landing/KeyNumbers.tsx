import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { useTranslation } from "@/lib/i18n";

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
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
    { value: 3, suffix: "", label: t("landing.smartphonesEnough"), sublabel: t("landing.keyNumberSmartphones") },
    { value: 30, suffix: "s", label: t("landing.toReport"), sublabel: t("landing.keyNumberReport") },
    { value: 0, suffix: "€", label: t("landing.hardwareCost"), sublabel: t("landing.keyNumberHardware") },
  ];

  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              className="text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
            >
              <div className="text-6xl md:text-7xl font-bold font-display gradient-text mb-2">
                {stat.value === 0 ? (
                  <span>0€</span>
                ) : (
                  <AnimatedNumber value={stat.value} suffix={stat.suffix} />
                )}
              </div>
              <div className="text-lg font-semibold font-display mb-1">{stat.label}</div>
              <div className="text-sm text-muted-foreground">{stat.sublabel}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
