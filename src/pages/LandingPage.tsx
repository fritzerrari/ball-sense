import { motion } from "framer-motion";
import { ChevronRight, Play, ArrowDown } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useTranslation } from "@/lib/i18n";
import { HeroSlider } from "@/components/landing/HeroSlider";
import { DemoSection } from "@/components/landing/DemoSection";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { AnalyticsShowcase } from "@/components/landing/AnalyticsShowcase";
import { FeatureCards } from "@/components/landing/FeatureCards";
import { KeyNumbers } from "@/components/landing/KeyNumbers";
import { TrustSection } from "@/components/landing/TrustSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { Footer } from "@/components/landing/Footer";

export default function LandingPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Nav — tighter, more confident */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link to="/" className="font-display text-lg font-bold tracking-tight flex items-center gap-1.5">
            <span className="w-6 h-6 rounded bg-primary flex items-center justify-center text-primary-foreground text-xs font-black">F</span>
            <span>Field</span>
            <span className="gradient-text">IQ</span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <a href="#how-it-works" className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">{t("landing.howItWorks")}</a>
            <a href="#features" className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">{t("landing.features")}</a>
            <a href="#pricing" className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">{t("landing.pricing")}</a>
            <a href="#faq" className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">{t("landing.faq")}</a>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild className="text-xs">
              <Link to="/login">{t("landing.signIn")}</Link>
            </Button>
            <Button size="sm" asChild className="hidden sm:inline-flex text-xs h-8 px-4">
              <Link to="/login">{t("landing.tryFree")}</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero — Asymmetric Split Layout */}
      <section className="relative pt-24 pb-12 md:pt-28 md:pb-20 overflow-hidden min-h-[90vh] flex items-center">
        {/* Background texture */}
        <div className="absolute inset-0 field-grid opacity-[0.04]" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/[0.03] to-transparent" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/[0.04] rounded-full blur-[100px]" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            {/* Left — Text */}
            <div className="max-w-xl">
              {/* Beta tag */}
              <motion.div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-[11px] font-semibold mb-6 font-display"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                {t("landing.betaTag")}
              </motion.div>

              {/* Headline */}
              <motion.h1
                className="text-4xl md:text-5xl lg:text-[3.5rem] font-bold tracking-tight mb-5 font-display leading-[1.08]"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                {t("landing.heroLine1")}
                <br />
                <span className="gradient-text">{t("landing.heroLine2")}</span>
              </motion.h1>

              {/* Subhead */}
              <motion.p
                className="text-base text-muted-foreground mb-8 leading-relaxed max-w-md"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.25 }}
              >
                {t("landing.heroDesc2")}
              </motion.p>

              {/* CTAs */}
              <motion.div
                className="flex flex-wrap items-center gap-3"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.35 }}
              >
                <Button variant="hero" size="lg" asChild>
                  <Link to="/login">
                    {t("landing.startFreeTrial")}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="heroOutline" size="lg" asChild>
                  <a href="#demo">
                    <Play className="mr-1 h-3.5 w-3.5" />
                    {t("landing.seeDemo")}
                  </a>
                </Button>
              </motion.div>

              {/* Social proof line */}
              <motion.div
                className="mt-8 flex items-center gap-4 text-xs text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                <div className="flex -space-x-2">
                  {[
                    "bg-primary/20 text-primary",
                    "bg-accent/20 text-accent",
                    "bg-warning/20 text-foreground",
                  ].map((cls, i) => (
                    <div key={i} className={`w-7 h-7 rounded-full border-2 border-background flex items-center justify-center text-[9px] font-bold ${cls}`}>
                      {["FC", "SV", "SC"][i]}
                    </div>
                  ))}
                </div>
                <span>{t("landing.trustClubs")}</span>
              </motion.div>
            </div>

            {/* Right — Product Mockup */}
            <div className="lg:pl-4">
              <HeroSlider />
            </div>
          </div>

          {/* Scroll indicator */}
          <motion.div
            className="hidden md:flex justify-center mt-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2, duration: 0.5 }}
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <ArrowDown className="h-4 w-4 text-muted-foreground/40" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      <KeyNumbers />
      <DemoSection />
      <HowItWorks />
      <AnalyticsShowcase />
      <FeatureCards />
      <TrustSection />
      <PricingSection />
      <FAQSection />

      {/* Final CTA — less padding, tighter */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 field-grid opacity-[0.04]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/[0.04] rounded-full blur-[100px]" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-5xl font-bold font-display mb-4">{t("landing.finalCtaTitle")}</h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">{t("landing.finalCtaDesc")}</p>
            <Button variant="hero" size="xl" asChild>
              <Link to="/login">
                {t("landing.finalCtaBtn")}
                <ChevronRight className="ml-1 h-5 w-5" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
