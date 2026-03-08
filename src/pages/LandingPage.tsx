import { motion } from "framer-motion";
import { ChevronRight, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useTranslation } from "@/lib/i18n";
import { HeroPitch } from "@/components/landing/HeroPitch";
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
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/30 bg-background/70 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="font-display text-xl font-bold tracking-tight flex items-center gap-1.5">
            <span className="w-7 h-7 rounded bg-primary flex items-center justify-center text-primary-foreground text-sm font-black">F</span>
            <span>Field</span>
            <span className="gradient-text">IQ</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("landing.howItWorks")}</a>
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("landing.features")}</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("landing.pricing")}</a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("landing.faq")}</a>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">{t("landing.signIn")}</Link>
            </Button>
            <Button variant="hero" size="sm" asChild className="hidden sm:inline-flex">
              <Link to="/login">{t("landing.tryFree")}</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-28 pb-16 md:pt-40 md:pb-28 overflow-hidden min-h-[90vh] flex items-center">
        {/* Animated pitch background */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 60%, hsl(152 60% 36% / 0.06) 0%, transparent 70%)" }} />
        <HeroPitch />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-medium mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {t("landing.betaTag")}
            </motion.div>

            <motion.h1
              className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6 font-display leading-[0.95]"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
            >
              {t("landing.heroTitle2")}{" "}
              <span className="gradient-text">{t("landing.heroHighlight2")}</span>
            </motion.h1>

            <motion.p
              className="text-lg md:text-xl text-muted-foreground mb-12 max-w-xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              {t("landing.heroDesc2")}
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <Button variant="hero" size="xl" asChild>
                <Link to="/login">
                  {t("landing.startFreeTrial")}
                  <ChevronRight className="ml-1 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="heroOutline" size="xl" asChild>
                <Link to="/install">
                  <Play className="mr-1.5 h-4 w-4" />
                  {t("landing.seeDemo")}
                </Link>
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* Key Numbers */}
      <KeyNumbers />

      {/* How it works */}
      <HowItWorks />

      {/* Analytics Showcase (dark section) */}
      <AnalyticsShowcase />

      {/* Features */}
      <FeatureCards />

      {/* Trust & Testimonials */}
      <TrustSection />

      {/* Pricing */}
      <PricingSection />

      {/* FAQ */}
      <FAQSection />

      {/* Final CTA */}
      <section className="py-24 md:py-36 relative overflow-hidden">
        <div className="absolute inset-0 field-grid opacity-20" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
        
        <div className="container mx-auto px-4 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-5xl font-bold font-display mb-5">
              {t("landing.finalCtaTitle")}
            </h2>
            <p className="text-muted-foreground mb-10 max-w-md mx-auto text-lg">
              {t("landing.finalCtaDesc")}
            </p>
            <Button variant="hero" size="xl" asChild>
              <Link to="/login">
                {t("landing.finalCtaBtn")}
                <ChevronRight className="ml-1 h-5 w-5" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
