import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Download,
  Smartphone,
  Users,
  Play,
  BarChart3,
  Settings,
  Shield,
  PlusCircle,
  Eye,
  HelpCircle,
  MapPin,
  RotateCcw,
  FileText,
  MessageSquare,
  Video,
  Brain,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface GuideSection {
  id: string;
  icon: React.ReactNode;
  title: string;
  content: React.ReactNode;
}

const sections: GuideSection[] = [
  {
    id: "install-android",
    icon: <Download className="h-5 w-5" />,
    title: "App installieren – Android (Chrome)",
    content: (
      <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
        <li>Öffne <strong>Google Chrome</strong> auf deinem Android-Gerät und navigiere zu <code>ball-sense.lovable.app</code>.</li>
        <li>Warte 2–3 Sekunden – es erscheint automatisch ein Banner <em>„App installieren"</em> am unteren Bildschirmrand.</li>
        <li>Falls kein Banner erscheint: Tippe auf das <strong>Drei-Punkte-Menü (⋮)</strong> oben rechts und wähle <strong>„App installieren"</strong>.</li>
        <li>Bestätige mit <strong>„Installieren"</strong>.</li>
        <li>Die App liegt nun auf deinem Homescreen und startet im Vollbildmodus.</li>
      </ol>
    ),
  },
  {
    id: "install-ios",
    icon: <Download className="h-5 w-5" />,
    title: "App installieren – iPhone / iPad (Safari)",
    content: (
      <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
        <li>Öffne <strong>Safari</strong> (nicht Chrome!) und navigiere zu <code>ball-sense.lovable.app</code>.</li>
        <li>Tippe unten auf das <strong>Teilen-Symbol</strong> (□↑).</li>
        <li>Tippe auf <strong>„Zum Home-Bildschirm"</strong>.</li>
        <li>Vergib optional einen Namen und tippe auf <strong>„Hinzufügen"</strong>.</li>
        <li><strong>Wichtig:</strong> Unter iOS muss die App über <strong>Safari</strong> installiert werden.</li>
      </ol>
    ),
  },
  {
    id: "account-setup",
    icon: <Settings className="h-5 w-5" />,
    title: "Account erstellen & Verein einrichten",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <ol className="list-decimal pl-5 space-y-2">
          <li>Öffne die App und tippe auf <strong>„Kostenlos testen"</strong>.</li>
          <li>Registriere dich mit <strong>E-Mail</strong> und Passwort.</li>
          <li>Bestätige deine E-Mail über den Link in der Bestätigungsmail.</li>
          <li>Im <strong>Onboarding</strong>: Vereinsname, Stadt und Liga eingeben.</li>
          <li>Optional: Vereinslogo hochladen (unter Einstellungen → Verein).</li>
        </ol>
        <p className="mt-3 rounded-lg bg-primary/5 p-3 text-xs">
          <strong>💡 Tipp:</strong> Der erste Nutzer wird automatisch zum Admin.
        </p>
      </div>
    ),
  },
  {
    id: "roster",
    icon: <Users className="h-5 w-5" />,
    title: "Kader anlegen",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <ol className="list-decimal pl-5 space-y-2">
          <li>Navigiere zu <strong>„Kader"</strong> in der Navigation.</li>
          <li>Tippe auf <strong>„+ Spieler hinzufügen"</strong> und gib Name, Position und (optional) Trikotnummer ein.</li>
          <li>Für viele Spieler: Nutze den <strong>CSV-Import</strong>.</li>
          <li>Spieler können als <em>Aktiv</em> oder <em>Inaktiv</em> markiert werden.</li>
        </ol>
        <p className="mt-3 rounded-lg bg-primary/5 p-3 text-xs">
          <strong>💡 DSGVO:</strong> Jeder Spieler hat einen Einwilligungsstatus (Erteilt / Abgelehnt / Unbekannt). Minderjährige brauchen Eltern-Zustimmung.
        </p>
      </div>
    ),
  },
  {
    id: "fields",
    icon: <MapPin className="h-5 w-5" />,
    title: "Spielfeld anlegen",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <ol className="list-decimal pl-5 space-y-2">
          <li>Gehe zu <strong>„Felder"</strong> und tippe auf <strong>„+ Neues Feld"</strong>.</li>
          <li>Gib einen <strong>Namen</strong> ein (z.B. „Hauptplatz").</li>
          <li>Trage die <strong>Abmessungen</strong> ein (Standard: 68 × 105 m).</li>
        </ol>
        <p className="mt-2">Du kannst beliebig viele Felder anlegen.</p>
      </div>
    ),
  },
  {
    id: "create-match",
    icon: <PlusCircle className="h-5 w-5" />,
    title: "Spiel anlegen",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <ol className="list-decimal pl-5 space-y-2">
          <li>Tippe auf <strong>„Neues Spiel"</strong>.</li>
          <li>Wähle <strong>Gegner</strong>, <strong>Datum</strong>, <strong>Anstoßzeit</strong> und <strong>Platz</strong>.</li>
          <li>Wähle den <strong>Spieltyp</strong>: Pflichtspiel, Freundschaftsspiel oder Training.</li>
          <li>Stelle die <strong>Aufstellung</strong> zusammen (11 Starter + Wechselspieler).</li>
        </ol>
      </div>
    ),
  },
  {
    id: "recording",
    icon: <Video className="h-5 w-5" />,
    title: "Spiel aufnehmen",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>FieldIQ nutzt <strong>keine Echtzeit-Tracking-KI</strong>. Stattdessen filmst du das Spiel einfach mit deinem Smartphone:</p>
        <ol className="list-decimal pl-5 space-y-2">
          <li>Smartphone <strong>erhöht</strong> aufstellen (1,5–2 m, z.B. am Absperrzaun oder auf einem Stativ).</li>
          <li>Im <strong>Querformat</strong> ausrichten, so dass möglichst das ganze Feld sichtbar ist.</li>
          <li>Aufnahme starten — FieldIQ extrahiert automatisch <strong>1 Frame pro 30 Sekunden</strong> aus dem Video.</li>
          <li><strong>Energiesparmodus deaktivieren</strong>, damit der Bildschirm nicht ausgeht.</li>
        </ol>
        <p className="rounded-lg bg-primary/5 p-3 text-xs mt-3">
          <strong>💡 Tipp:</strong> Die Sonne sollte möglichst im Rücken oder seitlich sein. Je höher die Kamera, desto besser die KI-Erkennung.
        </p>
      </div>
    ),
  },
  {
    id: "during-match",
    icon: <Play className="h-5 w-5" />,
    title: "Während des Spiels — Events eintragen",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>Während die Aufnahme läuft, kannst du <strong>Events eintragen</strong>:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Tor, Gegentor, Assist</li>
          <li>Gelbe/Rote Karte, Foul</li>
          <li>Auswechslung (Spieler raus → rein → Minute)</li>
          <li>Ecke, Freistoß, Schuss, Zweikampf</li>
        </ul>
        <p className="rounded-lg bg-primary/5 p-3 text-xs mt-3">
          <strong>💡 Tipp:</strong> Events können auch nach dem Spiel noch nachgetragen werden. Bei der Halbzeit kannst du optional einen Halbzeit-Upload starten für eine frühe Analyse.
        </p>
      </div>
    ),
  },
  {
    id: "analysis",
    icon: <Brain className="h-5 w-5" />,
    title: "Analyse starten & Report verstehen",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>Nach dem Spiel startet die <strong>KI-Analyse</strong> automatisch:</p>
        <ol className="list-decimal pl-5 space-y-2">
          <li>Die extrahierten Frames werden an <strong>Gemini Vision</strong> gesendet.</li>
          <li>Die KI analysiert: <strong>Formationen, Spielphasen, Gefahrenzonen, Ballverlust-Muster</strong>.</li>
          <li>Geschätzte <strong>Spielerpositionen</strong> werden für das Spielzug-Replay berechnet.</li>
          <li>Nach 2–5 Minuten ist der <strong>Coaching-Report</strong> verfügbar.</li>
        </ol>
        <h4 className="font-semibold text-foreground mt-3">Was der Report enthält:</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Coach Summary</strong> — Spielkontrolle, Fokusspieler, Datenwarnung</li>
          <li><strong>Gefahrenzonen</strong> — Wo greift ihr an, wo seid ihr verwundbar?</li>
          <li><strong>Spielzug-Replay</strong> — Animierte Taktik-Grafik mit geschätzten Positionen</li>
          <li><strong>KI-Erkenntnisse</strong> — Automatische taktische Empfehlungen</li>
          <li><strong>Trainingsplan</strong> — Wochenplan basierend auf der Analyse</li>
        </ul>
        <p className="rounded-lg bg-warning/10 border border-warning/20 p-3 text-xs mt-3">
          <strong>⚠️ Hinweis:</strong> Die Positionen sind KI-Schätzungen (~70-80% Genauigkeit). Sie reichen für taktische Muster, nicht für exakte Laufwege.
        </p>
      </div>
    ),
  },
  {
    id: "tactical-replay",
    icon: <Eye className="h-5 w-5" />,
    title: "Spielzug-Replay nutzen",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>Das Spielzug-Replay zeigt eine <strong>animierte Taktik-Grafik</strong> mit den geschätzten Spielerpositionen.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Play/Pause</strong> — Animation starten und stoppen</li>
          <li><strong>Timeline-Slider</strong> — Zu jedem Zeitpunkt springen</li>
          <li><strong>Geschwindigkeit</strong> — 0.5× bis 4× Wiedergabe</li>
          <li><strong>Szenen-Marker</strong> — Klick auf erkannte Schlüsselszenen</li>
        </ul>
        <p className="mt-2">Spieler werden als <strong>farbige Kreise</strong> dargestellt (Heim = blau/grün, Gast = rot). Der Ball ist ein weißer Punkt.</p>
      </div>
    ),
  },
  {
    id: "assistant",
    icon: <MessageSquare className="h-5 w-5" />,
    title: "KI-Assistent nutzen",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>Der KI-Assistent hilft bei <strong>Analyse und Interpretation</strong>:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Frage nach <strong>taktischen Empfehlungen</strong></li>
          <li>Lass dir <strong>Aufstellungsvorschläge</strong> geben</li>
          <li>Erhalte <strong>Trainingsvorschläge</strong> basierend auf den Analysedaten</li>
          <li>Vergleiche Spiele oder Spieler</li>
        </ul>
      </div>
    ),
  },
  {
    id: "troubleshooting",
    icon: <HelpCircle className="h-5 w-5" />,
    title: "Tipps & Troubleshooting",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-foreground">❌ „Bildschirm geht während der Aufnahme aus"</h4>
            <p className="mt-1">Deaktiviere den <strong>Energiesparmodus</strong>. Unter iOS: Einstellungen → Anzeige → Automatische Sperre → Nie.</p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground">❌ „Analyse zeigt wenige Erkenntnisse"</h4>
            <p className="mt-1">Achte auf eine <strong>gute Kameraposition</strong> — je höher und zentraler, desto besser erkennt die KI das Spielgeschehen.</p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground">❌ „Spielzug-Replay fehlt"</h4>
            <p className="mt-1">Das Replay wird nur generiert, wenn die KI ausreichend <strong>Spielerpositionen</strong> schätzen konnte. Bei schlechter Bildqualität kann es fehlen.</p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground">❌ „Report zeigt unrealistische Werte"</h4>
            <p className="mt-1">Prüfe die <strong>Feldmaße</strong> — falsche Abmessungen können die KI-Schätzungen verfälschen.</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "privacy",
    icon: <Shield className="h-5 w-5" />,
    title: "Datenschutz & DSGVO",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>FieldIQ ist <strong>DSGVO-konform</strong>:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Einwilligung pro Spieler erforderlich</li>
          <li>Minderjährige brauchen Einwilligung des Erziehungsberechtigten</li>
          <li>Spieler ohne Einwilligung werden von der Analyse ausgeschlossen</li>
          <li>Aus dem Video werden nur Einzelframes extrahiert, kein Vollvideo gespeichert</li>
          <li>Einwilligung jederzeit widerrufbar</li>
        </ul>
      </div>
    ),
  },
];

export default function FullGuide() {
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

        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display md:text-3xl">Komplette Anleitung</h1>
            <p className="text-sm text-muted-foreground">Von der Installation bis zum KI-Coaching-Report</p>
          </div>
        </div>

        <div className="mb-8 rounded-xl border border-border bg-card/60 p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Inhaltsverzeichnis
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {sections.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="text-xs text-muted-foreground hover:text-primary transition-colors py-1 flex items-center gap-1.5"
              >
                <span className="text-primary/60 font-mono w-5 text-right">{i + 1}.</span>
                {s.title}
              </a>
            ))}
          </div>
        </div>

        <Accordion type="multiple" className="w-full space-y-2">
          {sections.map((section, i) => (
            <AccordionItem
              key={section.id}
              value={section.id}
              id={section.id}
              className="rounded-xl border border-border bg-card/60 px-5 scroll-mt-24"
            >
              <AccordionTrigger className="hover:no-underline gap-3 py-4">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                    {section.icon}
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-muted-foreground">Kapitel {i + 1}</span>
                    <p className="font-display font-semibold text-sm md:text-base">{section.title}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-12 pb-5">
                {section.content}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="mt-10 rounded-xl border border-border bg-card/60 p-4 flex items-start gap-3">
          <RotateCcw className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Anleitung wird laufend aktualisiert</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Diese Anleitung wird bei jedem neuen Feature automatisch ergänzt.
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-2 font-mono">Letzte Aktualisierung: März 2026 · Version 3.0</p>
          </div>
        </div>

        <div className="mt-10 text-center">
          <p className="mb-4 text-sm text-muted-foreground">Alles verstanden? Starte jetzt mit deinem Verein.</p>
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
