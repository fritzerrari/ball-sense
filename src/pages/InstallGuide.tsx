import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, Download, Clapperboard, ChevronRight } from "lucide-react";
import { OsInstallTabs } from "@/components/install/OsInstallTabs";
import { TrackingWorkflowGuide } from "@/components/install/TrackingWorkflowGuide";
import { DeviceSelector } from "@/components/install/DeviceSelector";

export default function InstallGuide() {
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
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="hero" size="sm" asChild>
              <Link to="/login">Kostenlos testen</Link>
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 pt-28 pb-20 max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" /> Zurueck zur Startseite
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-display">Installationsanleitung</h1>
            <p className="text-sm text-muted-foreground">Von der Installation bis zum ersten Tracking-Report</p>
          </div>
        </div>

        {/* Section A: App installieren */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-5">
            <Download className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold font-display">App installieren</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            FieldIQ ist eine Web-App (PWA) - du kannst sie direkt aus dem Browser auf deinem Homescreen installieren. Waehle dein Betriebssystem:
          </p>
          <OsInstallTabs />
        </section>

        {/* Device-specific tips */}
        <section className="mb-12">
          <DeviceSelector />
        </section>

        {/* Section B: Tracking Workflow */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-5">
            <Clapperboard className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold font-display">So funktioniert das Tracking</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Der komplette Ablauf von der Spielerstellung bis zum fertigen Report. Tippe auf einen Schritt fuer Details.
          </p>
          <TrackingWorkflowGuide />
        </section>

        {/* CTA */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground text-sm mb-4">
            Alles bereit? Starte jetzt mit deinem Verein.
          </p>
          <Button variant="hero" size="xl" asChild>
            <Link to="/login">
              Kostenlos loslegen
              <ChevronRight className="ml-1 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
