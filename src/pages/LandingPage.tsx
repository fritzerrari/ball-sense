import { motion } from "framer-motion";
import { ChevronRight, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useTranslation } from "@/lib/i18n";
import { HeroScanReveal, ScanRevealText, ScanRevealSub, SmartphoneIndicator } from "@/components/landing/HeroScanReveal";
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
      <section className="relative pt-28 pb-16 md:pt-36 md:pb-24 overflow-hidden min-h-[85vh] flex items-center">
        {/* Subtle grid bg */}
        <div className="absolute inset-0 field-grid opacity-20" />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 50%, hsl(152 60% 36% / 0.04) 0%, transparent 60%)" }} />
        
        {/* Scanning animation */}
        <HeroScanReveal />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            {/* Beta badge */}
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-medium mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 2.4 }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {t("landing.betaTag")}
            </motion.div>

            {/* Headline — scanned into existence */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 font-display leading-[1.1]">
              <ScanRevealText delay={0}>
                {t("landing.heroLine1")}
              </ScanRevealText>
              <br />
              <ScanRevealText delay={0.3}>
                <span className="gradient-text">{t("landing.heroLine2")}</span>
              </ScanRevealText>
            </h1>

            {/* Subheadline */}
            <ScanRevealSub>
              <p className="text-base md:text-lg text-muted-foreground mb-10 max-w-lg mx-auto leading-relaxed">
                {t("landing.heroDesc2")}
              </p>
            </ScanRevealSub>

            {/* CTAs */}
            <ScanRevealSub delay={0.3}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
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
              </div>
            </ScanRevealSub>

            {/* 3 dots indicator */}
            <SmartphoneIndicator />
          </div>
        </div>
      </section>

      <KeyNumbers />
      <HowItWorks />
      <AnalyticsShowcase />
      <FeatureCards />
      <TrustSection />
      <PricingSection />
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
            <h2 className="text-3xl md:text-5xl font-bold font-display mb-5">{t("landing.finalCtaTitle")}</h2>
            <p className="text-muted-foreground mb-10 max-w-md mx-auto text-lg">{t("landing.finalCtaDesc")}</p>
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
