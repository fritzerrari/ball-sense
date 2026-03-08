import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Smartphone, Brain, BarChart3, Check, ChevronRight,
  MonitorSmartphone, Zap, FileBarChart, Quote, Download,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useTranslation } from "@/lib/i18n";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const features = [
  {
    icon: Smartphone,
    title: "Nur Smartphones nötig",
    description: "Einfach Browser öffnen — fertig. Keine App, keine Hardware-Kosten.",
  },
  {
    icon: Brain,
    title: "KI erkennt alle Spieler",
    description: "Intelligente Erkennung läuft direkt auf dem Gerät. Kein Video verlässt das Handy.",
  },
  {
    icon: BarChart3,
    title: "Report in 30 Sekunden",
    description: "Nach dem Spiel: 1 Klick. Heatmaps, km, Topspeed — sofort.",
  },
];

const steps = [
  {
    icon: MonitorSmartphone,
    titleKey: "landing.step1Title",
    descKey: "landing.step1Desc",
  },
  {
    icon: Zap,
    titleKey: "landing.step2Title",
    descKey: "landing.step2Desc",
  },
  {
    icon: FileBarChart,
    titleKey: "landing.step3Title",
    descKey: "landing.step3Desc",
  },
];

const plans = [
  {
    name: "STARTER",
    price: "49",
    features: ["4 Spiele/Monat", "1 Team", "Basis-Reports", "E-Mail Support"],
  },
  {
    name: "CLUB",
    price: "99",
    popular: true,
    features: ["12 Spiele/Monat", "2 Teams", "Erweiterte Reports", "PDF Export", "Prioritäts-Support"],
  },
  {
    name: "PRO",
    price: "199",
    features: ["Unbegrenzte Spiele", "Alle Teams", "Alle Features", "API-Zugang", "Dedizierter Support"],
  },
];

const comparison = [
  { feature: "Monatliche Kosten", fieldiq: "ab €49", veo: "ab €199", pixellot: "ab €299", gps: "ab €5.000" },
  { feature: "Hardware nötig", fieldiq: "Nein", veo: "Ja (Kamera)", pixellot: "Ja (Kamera)", gps: "Ja (Westen)" },
  { feature: "Installation", fieldiq: "Keine", veo: "Profi-Montage", pixellot: "Profi-Montage", gps: "Keine" },
  { feature: "Datenschutz", fieldiq: "On-Device", veo: "Cloud-Upload", pixellot: "Cloud-Upload", gps: "Lokal" },
  { feature: "Für alle Ligen geeignet", fieldiq: "✓", veo: "Bedingt", pixellot: "Bedingt", gps: "✓" },
];

const testimonials = [
  {
    quote: "Mit FieldIQ haben wir endlich Profi-Daten — ohne Profi-Budget. Unsere Spieler lieben die Heatmaps.",
    author: "Thomas M.",
    role: "Trainer, Bezirksliga Bayern",
  },
  {
    quote: "Setup in 5 Minuten, Ergebnisse nach jedem Spiel. Das hat unsere Trainingsplanung komplett verändert.",
    author: "Sarah K.",
    role: "Co-Trainerin, Landesliga NRW",
  },
  {
    quote: "Endlich wissen wir, welche Spieler in der 2. Halbzeit nachlassen. Auswechslungen sind jetzt datenbasiert.",
    author: "Michael R.",
    role: "Sportlicher Leiter, Kreisliga Hessen",
  },
];

const faqs = [
  {
    q: "Welche Smartphones werden unterstützt?",
    a: "Alle modernen Smartphones mit aktuellem Browser (Chrome, Safari, Firefox). Ab Android 10 und iOS 15 aufwärts. Detaillierte Anleitungen findest du auf unserer Installationsseite.",
  },
  {
    q: "Wie genau ist das Tracking?",
    a: "Die KI-basierte Erkennung erreicht eine Genauigkeit von über 95% bei Laufdistanzen und Geschwindigkeiten. Je besser die Kameraposition, desto genauer die Daten.",
  },
  {
    q: "Werden Videos in die Cloud hochgeladen?",
    a: "Nein. Die Erkennung läuft komplett auf dem Gerät. Es werden nur die berechneten Positionsdaten (keine Videos oder Bilder) übertragen — DSGVO-konform.",
  },
  {
    q: "Kann ich FieldIQ kostenlos testen?",
    a: "Ja! Jeder Plan kann 30 Tage kostenlos getestet werden. Keine Kreditkarte nötig. Nach der Testphase wählst du deinen Plan.",
  },
  {
    q: "Wie viele Kameras brauche ich?",
    a: "Mindestens 2 Smartphones für eine Spielfeldhälfte, idealerweise 3 für das komplette Feld. Die Kameras werden einfach am Spielfeldrand platziert.",
  },
  {
    q: "Funktioniert es auch bei Regen oder Dämmerung?",
    a: "Ja, solange die Kamera ausreichend Kontrast hat. Bei starkem Regen oder Dunkelheit empfehlen wir Flutlicht für optimale Ergebnisse.",
  },
];

export default function LandingPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="font-display text-xl font-bold tracking-tight flex items-center gap-1.5">
            <span className="w-7 h-7 rounded bg-primary flex items-center justify-center text-primary-foreground text-sm font-black">F</span>
            <span className="text-foreground">Field</span>
            <span className="gradient-text">IQ</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("landing.howItWorks")}</a>
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("landing.features")}</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("landing.pricing")}</a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("landing.faq")}</a>
            <Link to="/install" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("landing.installation")}</Link>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">{t("landing.signIn")}</Link>
            </Button>
            <Button variant="hero" size="sm" asChild>
              <Link to="/login">{t("landing.tryFree")}</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 field-grid opacity-30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-glow-pulse" />
              {t("landing.betaTag")}
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 font-display">
              {t("landing.heroTitle")}{" "}
              <span className="gradient-text">{t("landing.heroHighlight")}</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-xl mx-auto leading-relaxed">
              {t("landing.heroDesc")}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="hero" size="xl" asChild>
                <Link to="/login">
                  {t("landing.tryFree")}
                  <ChevronRight className="ml-1 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="heroOutline" size="xl" asChild>
                <Link to="/install">
                  <Download className="mr-1.5 h-5 w-5" />
                  {t("landing.installGuide")}
                </Link>
              </Button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="mt-20 glass-card p-6 max-w-2xl mx-auto grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl md:text-3xl font-bold font-display gradient-text">3</div>
              <div className="text-xs text-muted-foreground mt-1">{t("landing.smartphonesEnough")}</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold font-display gradient-text">30s</div>
              <div className="text-xs text-muted-foreground mt-1">{t("landing.toReport")}</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold font-display gradient-text">0€</div>
              <div className="text-xs text-muted-foreground mt-1">{t("landing.hardwareCost")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">
              {t("landing.howItWorksTitle")}
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              {t("landing.howItWorksDesc")}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {steps.map((step, i) => (
              <div key={t(step.titleKey)} className="relative text-center group">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px border-t-2 border-dashed border-primary/20" />
                )}
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5 group-hover:bg-primary/20 transition-colors relative">
                  <step.icon className="h-7 w-7 text-primary" />
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </div>
                </div>
                <h3 className="text-lg font-semibold font-display mb-2">{t(step.titleKey)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{t(step.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="glass-card glow-border p-8 md:p-12 text-center max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold font-display mb-3">
              {t("landing.ctaTitle")}
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {t("landing.ctaDesc")}
            </p>
            <Button variant="hero" size="xl" asChild>
              <Link to="/login">
                {t("landing.ctaBtn")}
                <ChevronRight className="ml-1 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">
              {t("landing.featuresTitle")}
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              {t("landing.featuresDesc")}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {features.map((f, i) => (
              <div
                key={t(f.titleKey)}
                className="glass-card p-8 hover:border-primary/30 transition-all group"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold font-display mb-2">{t(f.titleKey)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(f.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">
              Das sagen unsere Nutzer
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {testimonials.map((t) => (
              <div key={t.author} className="glass-card p-6 flex flex-col">
                <Quote className="h-6 w-6 text-primary/40 mb-3 shrink-0" />
                <p className="text-sm text-foreground leading-relaxed flex-1 italic">
                  "{t.quote}"
                </p>
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="text-sm font-semibold">{t.author}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">
              Transparente Preise
            </h2>
            <p className="text-muted-foreground">Alle Pläne 30 Tage kostenlos testen</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`glass-card p-8 flex flex-col ${
                  plan.popular ? "glow-border ring-1 ring-primary/20 relative" : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                    Beliebt
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-muted-foreground tracking-wider mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold font-display">€{plan.price}</span>
                    <span className="text-muted-foreground text-sm">/Mo</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button variant={plan.popular ? "hero" : "heroOutline"} className="w-full" asChild>
                  <Link to="/login">Jetzt starten</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section id="compare" className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">
              FieldIQ vs. Alternativen
            </h2>
          </div>
          <div className="max-w-4xl mx-auto overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium"></th>
                  <th className="py-4 px-4 text-center">
                    <span className="gradient-text font-bold font-display">FieldIQ</span>
                  </th>
                  <th className="py-4 px-4 text-center text-muted-foreground">Veo</th>
                  <th className="py-4 px-4 text-center text-muted-foreground">Pixellot</th>
                  <th className="py-4 px-4 text-center text-muted-foreground">GPS-Westen</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.feature} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                    <td className="py-4 px-4 font-medium">{row.feature}</td>
                    <td className="py-4 px-4 text-center text-primary font-semibold">{row.fieldiq}</td>
                    <td className="py-4 px-4 text-center text-muted-foreground">{row.veo}</td>
                    <td className="py-4 px-4 text-center text-muted-foreground">{row.pixellot}</td>
                    <td className="py-4 px-4 text-center text-muted-foreground">{row.gps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">
              Häufige Fragen
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Alles, was du über FieldIQ wissen musst.
            </p>
          </div>
          <div className="max-w-2xl mx-auto">
            <Accordion type="single" collapsible className="space-y-2">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="glass-card px-6 border rounded-lg">
                  <AccordionTrigger className="text-sm font-medium hover:no-underline">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">
            Bereit für datenbasiertes Training?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Starte noch heute — kostenlos und ohne Verpflichtung.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button variant="hero" size="xl" asChild>
              <Link to="/login">
                Jetzt kostenlos starten
                <ChevronRight className="ml-1 h-5 w-5" />
              </Link>
            </Button>
            <Button variant="heroOutline" size="xl" asChild>
              <Link to="/install">Installationsanleitung</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="font-display text-lg font-bold flex items-center gap-1.5 mb-4">
                <span className="w-6 h-6 rounded bg-primary flex items-center justify-center text-primary-foreground text-xs font-black">F</span>
                <span className="text-foreground">Field</span>
                <span className="gradient-text">IQ</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Professionelles Spieler-Tracking für Amateurvereine. Nur mit Smartphones.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">Produkt</h4>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition-colors">Preise</a></li>
                <li><a href="#compare" className="hover:text-foreground transition-colors">Vergleich</a></li>
                <li><a href="#faq" className="hover:text-foreground transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">Hilfe</h4>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li><Link to="/install" className="hover:text-foreground transition-colors">Installation</Link></li>
                <li><Link to="/login" className="hover:text-foreground transition-colors">Anmelden</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">Rechtliches</h4>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li><Link to="/legal/impressum" className="hover:text-foreground transition-colors">Impressum</Link></li>
                <li><Link to="/legal/datenschutz" className="hover:text-foreground transition-colors">Datenschutz</Link></li>
                <li><Link to="/legal/agb" className="hover:text-foreground transition-colors">AGB</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              © 2026 FieldIQ. Alle Rechte vorbehalten.
            </p>
            <p className="text-xs text-muted-foreground">
              Made with ❤️ in Deutschland
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
