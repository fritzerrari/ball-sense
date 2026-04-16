import { Suspense, lazy, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Play, ArrowDown, Smartphone, Zap, Shield, Trophy, Menu, X, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useTranslation } from "@/lib/i18n";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const HeroSlider = lazy(() => import("@/components/landing/HeroSlider").then((module) => ({ default: module.HeroSlider })));
const DemoSection = lazy(() => import("@/components/landing/DemoSection").then((module) => ({ default: module.DemoSection })));
const HowItWorks = lazy(() => import("@/components/landing/HowItWorks").then((module) => ({ default: module.HowItWorks })));
const AnalyticsShowcase = lazy(() => import("@/components/landing/AnalyticsShowcase").then((module) => ({ default: module.AnalyticsShowcase })));
const FeatureCards = lazy(() => import("@/components/landing/FeatureCards").then((module) => ({ default: module.FeatureCards })));
const KeyNumbers = lazy(() => import("@/components/landing/KeyNumbers").then((module) => ({ default: module.KeyNumbers })));
const TrustSection = lazy(() => import("@/components/landing/TrustSection").then((module) => ({ default: module.TrustSection })));
const PricingSection = lazy(() => import("@/components/landing/PricingSection").then((module) => ({ default: module.PricingSection })));
const FAQSection = lazy(() => import("@/components/landing/FAQSection").then((module) => ({ default: module.FAQSection })));
const WhyFieldIQ = lazy(() => import("@/components/landing/WhyFieldIQ").then((module) => ({ default: module.WhyFieldIQ })));
const TransparencySection = lazy(() => import("@/components/landing/TransparencySection").then((module) => ({ default: module.TransparencySection })));
const CompareInline = lazy(() => import("@/components/landing/CompareInline").then((module) => ({ default: module.CompareInline })));
const Footer = lazy(() => import("@/components/landing/Footer").then((module) => ({ default: module.Footer })));

function LandingSectionSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`container mx-auto px-4 py-12 md:py-20 ${className}`}>
      <div className="rounded-3xl border border-border/40 bg-card/30 p-6 md:p-10 animate-pulse">
        <div className="h-5 w-32 rounded bg-muted mb-4" />
        <div className="h-10 w-3/4 rounded bg-muted mb-3" />
        <div className="h-4 w-full rounded bg-muted/80 mb-2" />
        <div className="h-4 w-5/6 rounded bg-muted/80 mb-8" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-48 rounded-2xl bg-muted/70" />
          <div className="h-48 rounded-2xl bg-muted/70" />
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { t, language } = useTranslation();
  const de = language === "de";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [deferredSectionsReady, setDeferredSectionsReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(() => setDeferredSectionsReady(true), { timeout: 1200 });

      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = setTimeout(() => setDeferredSectionsReady(true), 300);
    return () => clearTimeout(timeoutId);
  }, []);

  const navLinks = [
    { href: "#how-it-works", label: t("landing.howItWorks") },
    { href: "#features", label: t("landing.features") },
    { href: "#demo", label: "Demo" },
    { href: "#pricing", label: t("landing.pricing") },
  ];

  const tutorialLabel = de ? "Tutorial" : "Tutorial";

  const scrollTo = (href: string) => {
    setMobileNavOpen(false);
    const el = document.querySelector(href);
    el?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden scroll-smooth">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link to="/" className="font-display text-lg font-bold tracking-tight flex items-center gap-1.5">
            <span className="w-6 h-6 rounded bg-primary flex items-center justify-center text-primary-foreground text-xs font-black">F</span>
            <span>Field</span>
            <span className="gradient-text">IQ</span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </button>
            ))}
            <Link
              to="/tutorial"
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {tutorialLabel}
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild className="text-xs hidden sm:inline-flex">
              <Link to="/login">{t("landing.signIn")}</Link>
            </Button>
            <Button size="sm" asChild className="hidden sm:inline-flex text-xs h-8 px-4">
              <Link to="/login">{t("landing.tryFree")}</Link>
            </Button>
            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 -mr-2 text-foreground"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Nav Sheet */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="right" className="w-72 bg-background border-border p-6">
          <div className="flex flex-col gap-6 mt-8">
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className="text-left text-base font-medium text-foreground hover:text-primary transition-colors"
              >
                {link.label}
              </button>
            ))}
            <Link
              to="/tutorial"
              onClick={() => setMobileNavOpen(false)}
              className="text-left text-base font-medium text-foreground hover:text-primary transition-colors flex items-center gap-2"
            >
              <BookOpen className="h-4 w-4" />
              {tutorialLabel}
            </Link>
            <hr className="border-border" />
            <Button variant="ghost" asChild className="justify-start">
              <Link to="/login" onClick={() => setMobileNavOpen(false)}>{t("landing.signIn")}</Link>
            </Button>
            <Button asChild>
              <Link to="/login" onClick={() => setMobileNavOpen(false)}>{t("landing.tryFree")}</Link>
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Hero */}
      <section className="relative pt-20 pb-8 md:pt-28 md:pb-16 overflow-hidden min-h-[85vh] md:min-h-[92vh] flex items-center">
        <div className="absolute inset-0 field-grid opacity-[0.04]" />
        <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-l from-primary/[0.04] to-transparent" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary/[0.06] rounded-full blur-[120px]" />
        <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] bg-primary/[0.03] rounded-full blur-[80px]" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-8 items-center">
            <div className="max-w-xl">
              {/* Beta badge */}
              <motion.div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold mb-4 md:mb-6 font-display"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                {de ? "Early Access — Jetzt kostenlos testen" : "Early Access — Try free now"}
              </motion.div>

              {/* Headline */}
              <motion.h1
                className="text-3xl md:text-5xl lg:text-[3.75rem] font-bold tracking-tight mb-4 md:mb-6 font-display leading-[1.06]"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                {de ? (
                  <>
                    Dein Spiel.<br />
                    <span className="gradient-text">Deine Daten.</span><br />
                    Dein Vorteil.
                  </>
                ) : (
                  <>
                    Your match.<br />
                    <span className="gradient-text">Your data.</span><br />
                    Your edge.
                  </>
                )}
              </motion.h1>

              {/* Subhead */}
              <motion.p
                className="text-base md:text-lg text-muted-foreground mb-6 md:mb-8 leading-relaxed max-w-md"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.25 }}
              >
                {de
                  ? "Smartphone aufstellen. KI analysiert Taktik, Pressing und Schwachstellen. Coaching-Report in Minuten — nicht Stunden."
                  : "Set up your smartphone. AI analyzes tactics, pressing and weaknesses. Coaching report in minutes — not hours."}
              </motion.p>

              {/* CTAs */}
              <motion.div
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.35 }}
              >
                <Button variant="hero" size="lg" asChild className="h-12">
                  <Link to="/login">
                    {t("landing.startFreeTrial")}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="heroOutline" size="lg" asChild className="h-12">
                  <a href="#demo" onClick={(e) => { e.preventDefault(); scrollTo("#demo"); }}>
                    <Play className="mr-1 h-3.5 w-3.5" />
                    {de ? "Live-Demo testen" : "Try live demo"}
                  </a>
                </Button>
              </motion.div>

              {/* Proof points */}
              <motion.div
                className="mt-8 md:mt-10 flex flex-wrap gap-4 md:grid md:grid-cols-3 md:gap-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                {[
                  { icon: Smartphone, text: de ? "1 Smartphone reicht" : "1 smartphone is enough" },
                  { icon: Zap, text: de ? "Report in ~2 Min" : "Report in ~2 min" },
                  { icon: Shield, text: de ? "DSGVO-konform" : "GDPR compliant" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <item.icon className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium">{item.text}</span>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right — Product Mockup */}
            <div className="lg:pl-4 hidden md:block">
              <Suspense fallback={<div className="h-[520px] rounded-[2rem] border border-border/40 bg-card/30 animate-pulse" />}>
                <HeroSlider />
              </Suspense>
            </div>
          </div>

          {/* Scroll indicator */}
          <motion.div
            className="hidden md:flex justify-center mt-12"
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

      {/* Optimized section order for conversion */}
      {deferredSectionsReady ? (
        <Suspense fallback={<LandingSectionSkeleton className="pt-0" />}>
          <KeyNumbers />
          <WhyFieldIQ />
          <HowItWorks />
          <FeatureCards />
          <TransparencySection />
          <CompareInline />
          <AnalyticsShowcase />
          <DemoSection />
          <TrustSection />
          <PricingSection />
          <FAQSection />
        </Suspense>
      ) : (
        <LandingSectionSkeleton className="pt-0" />
      )}

      {/* Final CTA */}
      <section className="py-16 md:py-36 relative overflow-hidden">
        <div className="absolute inset-0 field-grid opacity-[0.04]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/[0.06] rounded-full blur-[120px]" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-semibold mb-6"
              initial={{ scale: 0.9 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
            >
              <Trophy className="h-3.5 w-3.5" />
              {de ? "30 Tage kostenlos — keine Kreditkarte" : "30 days free — no credit card"}
            </motion.div>
            <h2 className="text-2xl md:text-5xl lg:text-6xl font-bold font-display mb-5 leading-tight">
              {de ? (
                <>Bereit, dein Team<br /><span className="gradient-text">besser zu machen?</span></>
              ) : (
                <>Ready to make<br /><span className="gradient-text">your team better?</span></>
              )}
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto text-sm md:text-base">
              {de
                ? "Nächstes Spiel, nächste Chance. Starte jetzt und sieh, was deine KI über dein Team herausfindet."
                : "Next match, next chance. Start now and see what AI discovers about your team."}
            </p>
            <Button variant="hero" size="xl" asChild>
              <Link to="/login">
                {de ? "Jetzt kostenlos starten" : "Start free now"}
                <ChevronRight className="ml-1 h-5 w-5" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {deferredSectionsReady ? (
        <Suspense fallback={<div className="h-32" />}>
          <Footer />
        </Suspense>
      ) : (
        <div className="h-32" />
      )}
    </div>
  );
}
