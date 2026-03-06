import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Smartphone, Brain, BarChart3, Check, ChevronRight } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const features = [
  {
    icon: Smartphone,
    title: "Nur Smartphones nötig",
    description: "Einfach Browser öffnen — fertig. Keine App, keine Hardware-Kosten.",
  },
  {
    icon: Brain,
    title: "KI erkennt alle Spieler",
    description: "YOLOv8 läuft direkt auf dem Handy. Kein Video verlässt das Gerät.",
  },
  {
    icon: BarChart3,
    title: "Report in 30 Sekunden",
    description: "Nach dem Spiel: 1 Klick. Heatmaps, km, Topspeed — sofort.",
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
  { feature: "Regionalliga-tauglich", fieldiq: "✓", veo: "Bedingt", pixellot: "Bedingt", gps: "✓" },
];

export default function LandingPage() {
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
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Preise</a>
            <a href="#compare" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Vergleich</a>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Anmelden</Link>
            </Button>
            <Button variant="hero" size="sm" asChild>
              <Link to="/login">Kostenlos testen</Link>
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
              Jetzt in der Beta
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 font-display">
              Pro-Tracking für die{" "}
              <span className="gradient-text">Regionalliga</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-xl mx-auto leading-relaxed">
              Nur 3 Smartphones. Keine Installation.
              Heatmaps & Laufdaten nach jedem Spiel.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="hero" size="xl" asChild>
                <Link to="/login">
                  Kostenlos testen
                  <ChevronRight className="ml-1 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="heroOutline" size="xl">
                Demo ansehen
              </Button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="mt-20 glass-card p-6 max-w-2xl mx-auto grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl md:text-3xl font-bold font-display gradient-text">3</div>
              <div className="text-xs text-muted-foreground mt-1">Smartphones reichen</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold font-display gradient-text">30s</div>
              <div className="text-xs text-muted-foreground mt-1">bis zum Report</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold font-display gradient-text">0€</div>
              <div className="text-xs text-muted-foreground mt-1">Hardware-Kosten</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">
              So einfach wie noch nie
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Professionelles Tracking ohne teure Hardware oder komplizierte Software.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="glass-card p-8 hover:border-primary/30 transition-all group"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold font-display mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
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
      <section id="compare" className="py-20 md:py-32">
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

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="font-display text-lg font-bold flex items-center gap-1.5">
            <span className="w-6 h-6 rounded bg-primary flex items-center justify-center text-primary-foreground text-xs font-black">F</span>
            <span className="text-foreground">Field</span>
            <span className="gradient-text">IQ</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2026 FieldIQ. Alle Rechte vorbehalten.
          </p>
        </div>
      </footer>
    </div>
  );
}
