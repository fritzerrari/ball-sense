import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, Download, Clapperboard, ChevronRight } from "lucide-react";
import { OsInstallTabs } from "@/components/install/OsInstallTabs";
import { TrackingWorkflowGuide } from "@/components/install/TrackingWorkflowGuide";
import { DeviceSelector } from "@/components/install/DeviceSelector";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";

export default function InstallGuide() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="font-display text-xl font-bold tracking-tight flex items-center gap-1.5">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-sm font-black text-primary-foreground">F</span>
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

      <div className="container mx-auto max-w-3xl px-4 pb-20 pt-28">
        <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Zurück zur Startseite
        </Link>

        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display md:text-3xl">Installationsanleitung</h1>
            <p className="text-sm text-muted-foreground">Von der App-Installation bis zum ersten Tracking-Report</p>
          </div>
        </div>

        <PwaInstallPrompt />

        <section className="mb-12 mt-8">
          <div className="mb-5 flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold font-display">App installieren</h2>
          </div>
          <p className="mb-6 text-sm text-muted-foreground">
            FieldIQ ist als PWA optimiert. Auf Android bekommst du einen direkten Install-Button, auf iPhone/iPad eine klare Homescreen-Anleitung.
          </p>
          <OsInstallTabs />
        </section>

        <section className="mb-12">
          <DeviceSelector />
        </section>

        <section className="mb-12">
          <div className="mb-5 flex items-center gap-2">
            <Clapperboard className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold font-display">So funktioniert das Tracking</h2>
          </div>
          <p className="mb-6 text-sm text-muted-foreground">
            Der komplette Ablauf von Spielanlage, Einwilligung und Feldkalibrierung bis zum Upload und Report.
          </p>
          <TrackingWorkflowGuide />
        </section>

        <div className="mt-12 text-center space-y-3">
          <p className="mb-4 text-sm text-muted-foreground">Du willst noch mehr wissen?</p>
          <Button variant="outline" size="lg" asChild>
            <Link to="/guide">
              <BookOpen className="mr-2 h-4 w-4" />
              Komplette Anleitung lesen
            </Link>
          </Button>
          <div className="pt-2">
            <Button variant="hero" size="xl" asChild>
              <Link to="/login">
                Kostenlos loslegen
                <ChevronRight className="ml-1 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
