import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function HeroScanReveal() {
  const [phase, setPhase] = useState<"scanning" | "revealed">("scanning");

  useEffect(() => {
    const timer = setTimeout(() => setPhase("revealed"), 2800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* 3 Scanner dots — they sweep across and "reveal" the content */}
      {[
        { delay: 0, startX: "-10%", startY: "30%", endX: "110%", endY: "35%", midY: "25%" },
        { delay: 0.3, startX: "-10%", startY: "50%", endX: "110%", endY: "55%", midY: "50%" },
        { delay: 0.6, startX: "-10%", startY: "70%", endX: "110%", endY: "65%", midY: "75%" },
      ].map((dot, i) => (
        <motion.div
          key={i}
          className="absolute"
          initial={{ left: dot.startX, top: dot.startY, opacity: 0 }}
          animate={{
            left: phase === "revealed" 
              ? ["110%", i === 0 ? "46%" : i === 1 ? "50%" : "54%"]
              : [dot.startX, dot.endX],
            top: phase === "revealed"
              ? [dot.endY, i === 0 ? "80%" : i === 1 ? "85%" : "80%"]
              : [dot.startY, dot.endY],
            opacity: [0, 1, 1, phase === "revealed" ? 0.6 : 0.8],
          }}
          transition={{
            duration: phase === "revealed" ? 1.2 : 2.2,
            delay: phase === "revealed" ? 0 : dot.delay,
            ease: "easeInOut",
          }}
        >
          {/* Dot core */}
          <div className="relative">
            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
            {/* Glow */}
            <div className="absolute -inset-3 rounded-full bg-primary/20 blur-md" />
            {/* Scan beam — horizontal line trailing behind */}
            {phase === "scanning" && (
              <motion.div
                className="absolute top-1/2 right-full -translate-y-1/2 h-px"
                style={{ width: 120, background: "linear-gradient(90deg, transparent, hsl(152 60% 45% / 0.4))" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.6, 0.6, 0] }}
                transition={{ duration: 2.2, delay: dot.delay }}
              />
            )}
          </div>
        </motion.div>
      ))}

      {/* Scan line flash */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(90deg, transparent 0%, hsl(152 60% 45% / 0.03) 50%, transparent 100%)",
        }}
        initial={{ x: "-100%" }}
        animate={{ x: "200%" }}
        transition={{ duration: 2.5, ease: "easeInOut" }}
      />
    </div>
  );
}

// Headline text that reveals as if being scanned
export function ScanRevealText({ children, delay = 0 }: { children: string; delay?: number }) {
  return (
    <motion.span
      className="inline-block"
      initial={{ opacity: 0, filter: "blur(12px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.8, delay: 0.6 + delay, ease: "easeOut" }}
    >
      {children}
    </motion.span>
  );
}

// Subtext appears after headline
export function ScanRevealSub({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 1.8 + delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

// Small label with 3 dots icon after reveal
export function SmartphoneIndicator() {
  return (
    <motion.div
      className="inline-flex items-center gap-2 text-xs text-muted-foreground mt-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 3, duration: 0.8 }}
    >
      <div className="flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.3s" }} />
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.6s" }} />
      </div>
      <span>3 Smartphones · 1 Match · Fertig</span>
    </motion.div>
  );
}
