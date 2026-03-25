import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { useTranslation } from "@/lib/i18n";
import { Smartphone, Clock, CreditCard, Camera } from "lucide-react";

function AnimatedNumber({ value, suffix = "", prefix = "" }: { value: number; suffix?: string; prefix?: string }) {
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

  return <span ref={ref}>{prefix}{display}{suffix}</span>;
}

export function KeyNumbers() {
  const { language } = useTranslation();
  const de = language === "de";

  const stats = [
    {
      icon: Smartphone,
      value: 1,
      suffix: "",
      label: de ? "Smartphone genügt" : "smartphone is enough",
      sublabel: de ? "Kein Stativ, keine Sensoren, kein Extra-Equipment" : "No tripod, no sensors, no extra equipment",
    },
    {
      icon: Clock,
      value: 2,
      suffix: " Min",
      label: de ? "zum fertigen Report" : "to finished report",
      sublabel: de ? "KI analysiert automatisch nach dem Spiel" : "AI analyzes automatically after the match",
    },
    {
      icon: CreditCard,
      value: 0,
      suffix: "€",
      label: de ? "Hardware-Investition" : "hardware investment",
      sublabel: de ? "Nutze dein vorhandenes Smartphone" : "Use your existing smartphone",
    },
    {
      icon: Camera,
      value: 3,
      suffix: "",
      label: de ? "Kameras maximal" : "cameras maximum",
      sublabel: de ? "Für volle Spielfeld-Abdeckung" : "For full pitch coverage",
    },
  ];

  return (
    <section className="py-16 md:py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.02] via-transparent to-primary/[0.02]" />
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              className="relative group rounded-2xl border border-border/50 bg-card/50 p-6 text-center hover:border-primary/30 transition-all duration-300"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -4 }}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="text-4xl md:text-5xl font-bold font-display gradient-text mb-2">
                {stat.value === 0 ? (
                  <span>0€</span>
                ) : (
                  <AnimatedNumber value={stat.value} suffix={stat.suffix} />
                )}
              </div>
              <div className="text-sm font-semibold font-display mb-1">{stat.label}</div>
              <div className="text-xs text-muted-foreground">{stat.sublabel}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
