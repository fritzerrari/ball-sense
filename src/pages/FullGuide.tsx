import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Download,
  Smartphone,
  Monitor,
  Crosshair,
  Users,
  Play,
  Camera,
  Upload,
  BarChart3,
  Timer,
  Flag,
  Settings,
  Shield,
  Shirt,
  PlusCircle,
  StopCircle,
  Eye,
  Zap,
  HelpCircle,
  MapPin,
  RotateCcw,
  FileText,
  MessageSquare,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/* ---------- section data ---------- */

interface GuideSection {
  id: string;
  icon: React.ReactNode;
  title: string;
  content: React.ReactNode;
}

const sections: GuideSection[] = [
  /* ===== 1  INSTALLATION ===== */
  {
    id: "install-android",
    icon: <Download className="h-5 w-5" />,
    title: "App installieren – Android (Chrome)",
    content: (
      <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
        <li>Öffne <strong>Google Chrome</strong> auf deinem Android-Gerät und navigiere zu <code>ball-sense.lovable.app</code>.</li>
        <li>Warte 2–3 Sekunden – es erscheint automatisch ein Banner <em>„App installieren"</em> am unteren Bildschirmrand.</li>
        <li>Falls kein Banner erscheint: Tippe auf das <strong>Drei-Punkte-Menü (⋮)</strong> oben rechts und wähle <strong>„App installieren"</strong> bzw. <strong>„Zum Startbildschirm hinzufügen"</strong>.</li>
        <li>Bestätige mit <strong>„Installieren"</strong>.</li>
        <li>Die App liegt nun auf deinem Homescreen und startet im Vollbildmodus – ohne Browserleisten.</li>
        <li><strong>Tipp:</strong> Nach der Installation funktioniert die App auch offline (Grundfunktionen).</li>
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
        <li>Tippe unten in der Safari-Leiste auf das <strong>Teilen-Symbol</strong> (Quadrat mit Pfeil nach oben ↑).</li>
        <li>Scrolle im Menü nach unten und tippe auf <strong>„Zum Home-Bildschirm"</strong>.</li>
        <li>Vergib optional einen Namen (z.B. „FieldIQ") und tippe auf <strong>„Hinzufügen"</strong>.</li>
        <li>Die App erscheint nun als eigenes Icon auf deinem Homescreen.</li>
        <li><strong>Wichtig:</strong> Unter iOS muss die App über <strong>Safari</strong> installiert werden – andere Browser unterstützen PWA-Installation nicht.</li>
        <li><strong>Tipp:</strong> Die App dreht sich automatisch mit – sie funktioniert sowohl im Hoch- als auch im Querformat.</li>
      </ol>
    ),
  },

  /* ===== 2  ACCOUNT & SETUP ===== */
  {
    id: "account-setup",
    icon: <Settings className="h-5 w-5" />,
    title: "Account erstellen & Verein einrichten",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <ol className="list-decimal pl-5 space-y-2">
          <li>Öffne die App und tippe auf <strong>„Kostenlos testen"</strong>.</li>
          <li>Registriere dich mit deiner <strong>E-Mail-Adresse</strong> und einem sicheren Passwort.</li>
          <li>Du erhältst eine <strong>Bestätigungs-E-Mail</strong> – klicke den Link, um deinen Account zu verifizieren.</li>
          <li>Nach dem Login wirst du durch das <strong>Onboarding</strong> geführt: Vereinsname, Stadt und Liga eingeben.</li>
          <li>Optional: Lade dein <strong>Vereinslogo</strong> hoch (unter Einstellungen → Verein).</li>
        </ol>
        <p className="mt-3 rounded-lg bg-primary/5 p-3 text-xs">
          <strong>💡 Tipp:</strong> Der erste Nutzer im Verein wird automatisch zum Admin. Weitere Trainer kannst du später unter Einstellungen einladen.
        </p>
      </div>
    ),
  },

  /* ===== 3  KADER ===== */
  {
    id: "roster",
    icon: <Users className="h-5 w-5" />,
    title: "Kader anlegen & verwalten",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <ol className="list-decimal pl-5 space-y-2">
          <li>Navigiere zu <strong>„Kader"</strong> in der unteren Navigation.</li>
          <li>Tippe auf <strong>„+ Spieler hinzufügen"</strong> und gib Name, Position und (optional) Trikotnummer ein.</li>
          <li>Für viele Spieler: Nutze den <strong>CSV-Import</strong> – lade eine Datei mit den Spalten Name, Position, Nummer hoch.</li>
          <li>Jeder Spieler hat einen Status: <em>Aktiv</em> oder <em>Inaktiv</em>. Inaktive Spieler werden nicht in der Aufstellung angezeigt.</li>
        </ol>
        <h4 className="font-semibold text-foreground mt-4">Datenschutz & Einwilligung</h4>
        <p>Für das Tracking benötigt jeder Spieler eine <strong>Einwilligung</strong> (DSGVO). Der Status kann sein:</p>
        <ul className="list-disc pl-5 space-y-1 mt-1">
          <li><strong>Erteilt</strong> – Spieler wird getrackt</li>
          <li><strong>Abgelehnt</strong> – Spieler wird von der Analyse ausgeschlossen</li>
          <li><strong>Unbekannt</strong> – muss noch eingeholt werden</li>
        </ul>
        <p className="mt-2">Minderjährige Spieler benötigen die Einwilligung eines Erziehungsberechtigten.</p>
      </div>
    ),
  },

  /* ===== 4  POSITIONEN & TRIKOTNUMMERN ===== */
  {
    id: "no-jersey-numbers",
    icon: <Shirt className="h-5 w-5" />,
    title: "Spielererkennung ohne Positionen & Trikotnummern",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>
          <strong>Sowohl Positionen als auch Trikotnummern sind komplett optional.</strong> Die KI nutzt mehrere Methoden zur Spielererkennung:
        </p>
        <h4 className="font-semibold text-foreground mt-2">Wenn du die Positionen nicht kennst:</h4>
        <ol className="list-decimal pl-5 space-y-2">
          <li>Wähle in der Aufstellung bei der Position einfach <strong>„Auto (KI)"</strong> – das ist die Standardeinstellung.</li>
          <li>Die KI ordnet den Spieler basierend auf seiner <strong>Team-Hälfte</strong> (Heim unten, Gast oben) einem Track zu.</li>
          <li><strong>Nach dem Spiel</strong> analysiert die KI die Bewegungsmuster jedes Spielers und erkennt automatisch, ob er sich wie ein Torwart, Verteidiger, Mittelfeldspieler oder Stürmer bewegt hat.</li>
          <li>Die erkannte Position wird <strong>automatisch im Spielerprofil gespeichert</strong> – beim nächsten Spiel steht sie dann schon bereit.</li>
        </ol>
        <h4 className="font-semibold text-foreground mt-3">Erkennungsmethoden der KI:</h4>
        <ol className="list-decimal pl-5 space-y-2">
          <li><strong>Positionsbasierte Zuordnung:</strong> Wenn eine Position gesetzt ist, nutzt die KI die taktischen Zonen als Ausgangspunkt.</li>
          <li><strong>Team-Hälfte:</strong> Ohne Position wird die Team-Hälfte als grober Anhaltspunkt genutzt (Heim: untere Hälfte, Gast: obere Hälfte).</li>
          <li><strong>Bewegungsmuster:</strong> Nach dem Spiel analysiert die KI den Schwerpunkt der Bewegung (Centroid) und ordnet eine Position zu.</li>
          <li><strong>Räumliche Konsistenz:</strong> Spieler werden über die gesamte Spielzeit konsistent verfolgt.</li>
          <li><strong>Multi-Kamera-Bonus:</strong> Bei 2–3 Kameras steigt die Zuordnungs-Konfidenz, da die KI den gleichen Spieler aus verschiedenen Blickwinkeln erkennt.</li>
        </ol>
        <div className="rounded-lg bg-primary/5 p-3 text-xs mt-3">
          <strong>💡 Praxis-Tipp:</strong> Selbst wenn du gar keine Positionen und keine Trikotnummern einträgst, funktioniert das Tracking. Die Genauigkeit ist dann etwas niedriger (~70–80%), aber nach 2–3 Spielen hat die KI alle Positionen automatisch erkannt und die Genauigkeit steigt auf 90%+.
        </div>
        <div className="rounded-lg bg-primary/5 p-3 text-xs mt-2">
          <strong>💡 Best Practice:</strong> Wenn du grob weißt, wer Torwart und wer Stürmer ist – trage wenigstens diese ein. Für den Rest reicht „Auto (KI)".
        </div>
      </div>
    ),
  },

  /* ===== 5  FELDER ===== */
  {
    id: "fields",
    icon: <MapPin className="h-5 w-5" />,
    title: "Spielfeld anlegen",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <ol className="list-decimal pl-5 space-y-2">
          <li>Gehe zu <strong>„Felder"</strong> und tippe auf <strong>„+ Neues Feld"</strong>.</li>
          <li>Gib einen <strong>Namen</strong> ein (z.B. „Hauptplatz", „Kunstrasen 2").</li>
          <li>Trage die <strong>Abmessungen</strong> ein: Breite × Länge in Metern (Standard: 68 × 105 m).</li>
          <li>Das Feld ist jetzt angelegt, muss aber noch <strong>kalibriert</strong> werden (siehe nächster Abschnitt).</li>
        </ol>
        <p className="mt-2">Du kannst beliebig viele Felder anlegen – z.B. für Heim- und Auswärtsplätze.</p>
      </div>
    ),
  },

  /* ===== 6  KALIBRIERUNG ===== */
  {
    id: "calibration",
    icon: <Crosshair className="h-5 w-5" />,
    title: "Feld kalibrieren (4-Punkt-System)",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>Die Kalibrierung verknüpft die Kamera-Perspektive mit dem realen Spielfeld. Sie muss <strong>pro Kamera und pro Feld einmal</strong> durchgeführt werden.</p>
        <h4 className="font-semibold text-foreground mt-3">Schritt-für-Schritt:</h4>
        <ol className="list-decimal pl-5 space-y-2">
          <li>Öffne das Spiel und tippe auf <strong>„Kalibrieren"</strong>.</li>
          <li>Die Kamera öffnet sich – mache ein <strong>Foto des Spielfelds</strong> aus der Kameraposition.</li>
          <li>Tippe nacheinander die <strong>4 Eckpunkte</strong> des Spielfelds auf dem Foto an (Ecke oben-links → oben-rechts → unten-rechts → unten-links).</li>
          <li>Die Punkte können per <strong>Drag & Drop</strong> feinjustiert werden – zoome bei Bedarf in das Bild hinein.</li>
          <li>Optional: Tippe auf <strong>„KI-Erkennung"</strong> – die KI versucht, die Feldlinien automatisch zu erkennen und schlägt Eckpunkte vor.</li>
          <li>Tippe auf <strong>„Speichern"</strong> – die Kalibrierung wird dem Feld zugeordnet.</li>
        </ol>
        <h4 className="font-semibold text-foreground mt-4">Tipps für gute Kalibrierung:</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li>Alle 4 Ecken des Spielfelds müssen im Foto <strong>sichtbar</strong> sein.</li>
          <li>Je <strong>höher</strong> die Kamera positioniert ist, desto besser die Kalibrierung.</li>
          <li>Bei <strong>schlechtem Kontrast</strong> (Schnee, Nebel) die Punkte manuell setzen – die KI-Erkennung funktioniert am besten bei klaren Linien.</li>
          <li>Die Kalibrierung muss nur einmal pro Feld gemacht werden und bleibt für alle Spiele auf diesem Platz erhalten.</li>
        </ul>
      </div>
    ),
  },

  /* ===== 7  1 KAMERA ===== */
  {
    id: "setup-1cam",
    icon: <Smartphone className="h-5 w-5" />,
    title: "Setup mit 1 Kamera (Basis)",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>Das einfachste Setup – ideal zum Einstieg und für kleinere Spielfelder (z.B. Jugend).</p>
        <h4 className="font-semibold text-foreground">Positionierung:</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li>Platziere das Smartphone <strong>erhöht</strong> (1,5–2 m, z.B. am Absperrzaun oder Stativ) in der <strong>Mitte der Seitenlinie</strong>.</li>
          <li>Das Gerät sollte das gesamte Spielfeld erfassen – im <strong>Querformat</strong> aufnehmen.</li>
          <li>Achte auf <strong>Gegenlicht</strong>: Die Sonne sollte möglichst im Rücken oder seitlich sein.</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-3">Erwartete Abdeckung:</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li>Ca. <strong>60–70%</strong> des Feldes mit guter Auflösung</li>
          <li>Die gegenüberliegende Spielfeldhälfte wird erkannt, aber mit geringerer Zuordnungs-Konfidenz</li>
          <li>Für die meisten Amateurspiele ausreichend</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-3">Ablauf:</h4>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Smartphone positionieren und fixieren</li>
          <li>FieldIQ öffnen → Spiel auswählen → Kalibrieren → Tracking starten</li>
          <li>Das Gerät aufnehmen lassen – Bildschirm darf nicht ausgehen (Energiesparmodus deaktivieren!)</li>
        </ol>
      </div>
    ),
  },

  /* ===== 8  2 KAMERAS ===== */
  {
    id: "setup-2cam",
    icon: <Camera className="h-5 w-5" />,
    title: "Setup mit 2 Kameras (Empfohlen)",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>Das empfohlene Setup für die meisten Vereine – guter Kompromiss zwischen Aufwand und Datenqualität.</p>
        <h4 className="font-semibold text-foreground">Positionierung:</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Kamera 1 (Haupt):</strong> In der Mitte der Seitenlinie, erhöht (1,5–2 m)</li>
          <li><strong>Kamera 2 (Zusatz):</strong> An einer der 16-Meter-Linien, ebenfalls erhöht</li>
          <li>Die Sichtbereiche sollten sich <strong>leicht überlappen</strong> (ca. 10–15% Überlappung)</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-3">Erwartete Abdeckung:</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li>Ca. <strong>85%</strong> des Feldes mit guter Auflösung</li>
          <li>Spieler in der Überlappungszone erhalten den <strong>Multi-Cam-Bonus</strong> (höhere Zuordnungs-Konfidenz)</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-3">Zusatz-Kamera anmelden:</h4>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Auf dem <strong>Haupt-Gerät</strong>: Gehe zu Einstellungen → Kamera-Codes → Code erstellen (max. 3 Codes pro Verein)</li>
          <li>Auf dem <strong>Zusatz-Gerät</strong>: Öffne den Kamera-Link aus dem Spielbericht ODER scanne den QR-Code</li>
          <li>Gib den <strong>6-stelligen Kamera-Code</strong> ein – kein Login nötig!</li>
          <li>Die Kamera meldet sich automatisch für das Spiel an</li>
          <li>Kalibriere die Zusatz-Kamera separat (4-Punkt-System, siehe oben)</li>
        </ol>
      </div>
    ),
  },

  /* ===== 9  3 KAMERAS ===== */
  {
    id: "setup-3cam",
    icon: <Eye className="h-5 w-5" />,
    title: "Setup mit 3 Kameras (Optimal)",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>Die beste Datenqualität – maximale Feldabdeckung und höchste Zuordnungsgenauigkeit.</p>
        <h4 className="font-semibold text-foreground">Positionierung:</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Kamera 1:</strong> Mitte der Seitenlinie, erhöht</li>
          <li><strong>Kamera 2:</strong> Linke 16-Meter-Linie, erhöht</li>
          <li><strong>Kamera 3:</strong> Rechte 16-Meter-Linie, erhöht</li>
          <li>Alle drei Kameras decken zusammen das <strong>gesamte Spielfeld</strong> ab</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-3">Erwartete Abdeckung:</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>95–100%</strong> des Feldes abgedeckt</li>
          <li>Spieler in Überlappungszonen werden von 2–3 Kameras gleichzeitig erfasst → <strong>höchste Konfidenz</strong></li>
          <li>Die KI fusioniert die Daten automatisch über <strong>±250ms Zeitfenster</strong></li>
        </ul>
        <h4 className="font-semibold text-foreground mt-3">Anmeldung der Zusatz-Kameras:</h4>
        <p>Jede Zusatz-Kamera benötigt einen eigenen 6-stelligen Code (siehe 2-Kamera-Setup). Alle Kameras müssen <strong>einzeln kalibriert</strong> werden. Die Synchronisation erfolgt automatisch über Zeitstempel – die Kameras müssen <strong>nicht gleichzeitig</strong> gestartet werden.</p>
        <p className="rounded-lg bg-primary/5 p-3 text-xs mt-3">
          <strong>💡 Pro-Tipp:</strong> Bei 3 Kameras sinkt die Fehlerquote bei der Spielerzuordnung auf unter 5%. Ideal für Leistungsanalysen und Talentsichtung.
        </p>
      </div>
    ),
  },

  /* ===== 10  SPIEL ANLEGEN ===== */
  {
    id: "create-match",
    icon: <PlusCircle className="h-5 w-5" />,
    title: "Spiel anlegen",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <ol className="list-decimal pl-5 space-y-2">
          <li>Tippe auf <strong>„Neues Spiel"</strong> im Dashboard oder unter „Spiele".</li>
          <li>Wähle den <strong>Gegner</strong> (Vereinsname eingeben).</li>
          <li>Wähle <strong>Datum</strong> und <strong>Anstoßzeit</strong>.</li>
          <li>Wähle den <strong>Platz</strong> aus deinen angelegten Feldern.</li>
          <li>Wähle den <strong>Spieltyp</strong>: Pflichtspiel, Freundschaftsspiel oder Training.</li>
          <li>Optional: Entscheide, ob der <strong>Gegner mitgetrackt</strong> werden soll (erfordert separate Einwilligung).</li>
        </ol>
      </div>
    ),
  },

  /* ===== 11  AUFSTELLUNG ===== */
  {
    id: "lineup",
    icon: <Users className="h-5 w-5" />,
    title: "Aufstellung & Formation festlegen",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <ol className="list-decimal pl-5 space-y-2">
          <li>Öffne das angelegte Spiel und gehe zum Tab <strong>„Aufstellung"</strong>.</li>
          <li>Wähle <strong>11 Startspieler</strong> aus deinem Kader aus.</li>
          <li>Ordne jedem Spieler eine <strong>Position</strong> zu (TW, IV, LV, RV, ZM, LA, RA, ST, …).</li>
          <li>Optional: Trage <strong>Trikotnummern</strong> ein (nicht zwingend erforderlich – siehe Abschnitt „Spielererkennung ohne Trikotnummern").</li>
          <li>Füge bis zu <strong>7 Wechselspieler</strong> zur Bank hinzu.</li>
          <li>Wähle eine <strong>Formation</strong> (z.B. 4-3-3, 4-4-2, 3-5-2).</li>
        </ol>
        <p className="rounded-lg bg-primary/5 p-3 text-xs mt-3">
          <strong>💡 Tipp:</strong> Die Aufstellung kann auch <strong>während des Spiels</strong> noch geändert werden – z.B. nach taktischen Umstellungen.
        </p>
      </div>
    ),
  },

  /* ===== 12  TRACKING ===== */
  {
    id: "tracking-start",
    icon: <Play className="h-5 w-5" />,
    title: "Tracking starten",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <ol className="list-decimal pl-5 space-y-2">
          <li>Stelle sicher, dass die Kalibrierung abgeschlossen ist.</li>
          <li>Tippe auf <strong>„Tracking starten"</strong> – auf jedem Smartphone separat.</li>
          <li>Das KI-Modell wird einmalig geladen (<strong>~5 Sekunden</strong>).</li>
          <li>Du siehst einen <strong>grünen Indikator</strong>, sobald die Spielererkennung aktiv ist.</li>
          <li>Die Anzahl erkannter Spieler wird in Echtzeit angezeigt.</li>
        </ol>
        <h4 className="font-semibold text-foreground mt-3">Wichtig vor dem Start:</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Energiesparmodus deaktivieren</strong> – der Bildschirm darf sich nicht abschalten</li>
          <li><strong>Lautlos-Modus aktivieren</strong> – Anrufe/Benachrichtigungen könnten das Tracking unterbrechen</li>
          <li><strong>WLAN bevorzugen</strong> – stabiler als Mobilfunk, besonders für den Upload</li>
          <li>Smartphone <strong>fest fixieren</strong> – Bewegungen verfälschen die Kalibrierung</li>
        </ul>
      </div>
    ),
  },

  /* ===== 13  WÄHREND DES SPIELS ===== */
  {
    id: "during-match",
    icon: <Timer className="h-5 w-5" />,
    title: "Während des Spiels – Events & Steuerung",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>Während das Tracking läuft, kannst du Events eintragen. Dies geschieht nur auf <strong>einem Gerät</strong> (dem Haupt-Gerät). Zusatz-Kameras nehmen einfach weiter auf.</p>
        <h4 className="font-semibold text-foreground mt-2">Steuerung:</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Pause / Weiter:</strong> Bei Unterbrechungen (Verletzung, Trinkpause)</li>
          <li><strong>Halbzeit:</strong> Daten werden zwischengespeichert, optional Halbzeit-Upload für Vorab-Analyse</li>
          <li><strong>Wechsel:</strong> Spieler raus → Spieler rein → Minute eingeben → Bestätigen</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-3">Live-Events eintragen:</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li>Tor, Gegentor, Assist</li>
          <li>Gelbe/Rote Karte, Foul</li>
          <li>Ecke, Freistoß, Einwurf, Abseits</li>
          <li>Schuss, Schuss aufs Tor</li>
          <li>Dribblings, Zweikämpfe, Kopfbälle</li>
          <li>Und viele weitere taktische Events</li>
        </ul>
        <p className="rounded-lg bg-primary/5 p-3 text-xs mt-3">
          <strong>💡 Tipp:</strong> Events können auch nach dem Spiel noch nachgetragen oder korrigiert werden.
        </p>
      </div>
    ),
  },

  /* ===== 14  SPIEL BEENDEN & UPLOAD ===== */
  {
    id: "end-upload",
    icon: <Upload className="h-5 w-5" />,
    title: "Spiel beenden & Upload",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <ol className="list-decimal pl-5 space-y-2">
          <li>Am Spielende tippe auf jedem Smartphone <strong>„Spiel beenden"</strong>.</li>
          <li>Tippe auf <strong>„Upload starten"</strong> – die Reihenfolge zwischen den Geräten spielt keine Rolle.</li>
          <li>Jede Kamera lädt ihre Daten <strong>einzeln</strong> hoch (10–30 Sek. pro Kamera, je nach Verbindung).</li>
          <li>Ein <strong>Fortschrittsbalken</strong> zeigt den Upload-Status in Echtzeit.</li>
          <li>Die <strong>Verarbeitung startet automatisch</strong>, sobald alle Uploads eingegangen sind.</li>
        </ol>
        <h4 className="font-semibold text-foreground mt-3">Multi-Kamera-Fusion:</h4>
        <p>Bei mehreren Kameras werden die Daten im Backend automatisch fusioniert:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Zeitliche Synchronisation über ±250ms Fenster</li>
          <li>Räumliche Deduplizierung von Spieler-Tracks</li>
          <li>Spieler, die von mehreren Kameras gleichzeitig erfasst werden, erhalten eine höhere Zuordnungs-Konfidenz</li>
        </ul>
      </div>
    ),
  },

  /* ===== 15  REPORT ===== */
  {
    id: "report",
    icon: <BarChart3 className="h-5 w-5" />,
    title: "Report & Analyse verstehen",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>Nach der Verarbeitung (ca. 1–5 Minuten je nach Datenmenge) stehen folgende Analysen bereit:</p>
        <h4 className="font-semibold text-foreground mt-2">Spieler-Statistiken:</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Laufdistanz</strong> (km) – Gesamte zurückgelegte Strecke</li>
          <li><strong>Topspeed</strong> (km/h) – Höchste gemessene Geschwindigkeit</li>
          <li><strong>Durchschnittsgeschwindigkeit</strong> (km/h)</li>
          <li><strong>Sprint-Anzahl</strong> und <strong>Sprint-Distanz</strong></li>
          <li><strong>Heatmap</strong> – Wo hat sich der Spieler am meisten aufgehalten?</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-3">Team-Statistiken:</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li>Gesamte Teamdistanz und Durchschnittsdistanz pro Spieler</li>
          <li>Ballbesitz-Anteil</li>
          <li>Formations-Heatmap</li>
          <li>Team-Topspeed</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-3">Datenqualität:</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li>Jeder Report zeigt einen <strong>Qualitäts-Score</strong> an</li>
          <li>Anzahl der verwendeten Kameras</li>
          <li>Zuordnungs-Konfidenz pro Spieler</li>
          <li>Eventuell erkannte <strong>Anomalien</strong> (z.B. unrealistisch hohe Geschwindigkeiten)</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-3">Export:</h4>
        <p>Der Report kann als <strong>PDF exportiert</strong> und mit dem Team geteilt werden.</p>
      </div>
    ),
  },

  /* ===== 16  KI-ASSISTENT ===== */
  {
    id: "assistant",
    icon: <MessageSquare className="h-5 w-5" />,
    title: "KI-Assistent nutzen",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>Der integrierte KI-Assistent hilft dir bei der <strong>Analyse und Interpretation</strong> deiner Spieldaten.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Frage nach <strong>Leistungsvergleichen</strong> zwischen Spielern oder Spielen</li>
          <li>Lass dir <strong>taktische Empfehlungen</strong> geben</li>
          <li>Erhalte <strong>Trainingsvorschläge</strong> basierend auf den Daten</li>
          <li>Analysiere <strong>Schwachstellen</strong> und Stärken einzelner Spieler</li>
        </ul>
        <p>Der Assistent ist über das <strong>Nachrichten-Icon</strong> in der Navigation erreichbar.</p>
      </div>
    ),
  },

  /* ===== 17  WHAT-IF ===== */
  {
    id: "what-if",
    icon: <Zap className="h-5 w-5" />,
    title: "What-If-Board (Taktik-Simulation)",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>Das What-If-Board ermöglicht es dir, <strong>taktische Szenarien</strong> durchzuspielen:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Was passiert, wenn ich Spieler X durch Spieler Y ersetze?</li>
          <li>Wie verändert sich die Formation, wenn ich auf 3-5-2 umstelle?</li>
          <li>Vergleiche verschiedene Aufstellungen anhand historischer Daten</li>
        </ul>
      </div>
    ),
  },

  /* ===== 18  EINSTELLUNGEN ===== */
  {
    id: "settings",
    icon: <Settings className="h-5 w-5" />,
    title: "Einstellungen & Kamera-Codes",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <h4 className="font-semibold text-foreground">Kamera-Codes verwalten:</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li>Unter Einstellungen → <strong>Kamera-Codes</strong> kannst du bis zu 3 Codes erstellen</li>
          <li>Jeder Code ist ein <strong>6-stelliger Zahlencode</strong></li>
          <li>Codes können mit einem <strong>Label</strong> versehen werden (z.B. „Stativ Links")</li>
          <li>Codes können <strong>deaktiviert</strong> oder neu erstellt werden</li>
          <li>Kein Login auf Zusatz-Geräten nötig – nur der Code</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-3">Vereinseinstellungen:</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li>Vereinsname, Stadt und Liga ändern</li>
          <li>Vereinslogo hochladen</li>
          <li>Sprache umschalten (Deutsch/Englisch)</li>
          <li>Dark/Light Mode wechseln</li>
        </ul>
      </div>
    ),
  },

  /* ===== 19  TROUBLESHOOTING ===== */
  {
    id: "troubleshooting",
    icon: <HelpCircle className="h-5 w-5" />,
    title: "Häufige Probleme & Lösungen",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-foreground">❌ „Kamera startet nicht"</h4>
            <p className="mt-1">Stelle sicher, dass du FieldIQ die <strong>Kamera-Berechtigung</strong> erteilt hast. Unter iOS: Einstellungen → Safari → Kamera → „Erlauben". Unter Android: Einstellungen → Apps → Chrome → Berechtigungen → Kamera.</p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground">❌ „Tracking erkennt keine Spieler"</h4>
            <p className="mt-1">Prüfe die <strong>Kalibrierung</strong> – sind alle 4 Eckpunkte korrekt gesetzt? Ist das Smartphone <strong>stabil fixiert</strong>? Bewegt sich das Gerät, stimmt die Kalibrierung nicht mehr.</p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground">❌ „Upload schlägt fehl"</h4>
            <p className="mt-1">Prüfe deine <strong>Internetverbindung</strong>. WLAN ist empfohlen. Bei Mobilfunk: mindestens 4G/LTE. Versuche den Upload erneut – die Daten gehen nicht verloren.</p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground">❌ „Bildschirm geht während dem Tracking aus"</h4>
            <p className="mt-1">Deaktiviere den <strong>Energiesparmodus</strong> und stelle die Bildschirm-Timeout auf „Nie" oder „10 Minuten". Unter iOS: Einstellungen → Anzeige → Automatische Sperre → Nie.</p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground">❌ „Zusatz-Kamera meldet sich nicht an"</h4>
            <p className="mt-1">Stelle sicher, dass der <strong>6-stellige Code</strong> korrekt ist und der Code unter Einstellungen als <strong>aktiv</strong> markiert ist. Maximal 3 Codes pro Verein möglich.</p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground">❌ „Report zeigt unrealistische Werte"</h4>
            <p className="mt-1">Prüfe die <strong>Feldmaße</strong> – falsche Abmessungen führen zu falschen Distanzberechnungen. Prüfe auch den <strong>Datenqualitäts-Score</strong> im Report.</p>
          </div>
        </div>
      </div>
    ),
  },

  /* ===== 20  DATENSCHUTZ ===== */
  {
    id: "privacy",
    icon: <Shield className="h-5 w-5" />,
    title: "Datenschutz & DSGVO",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>FieldIQ ist <strong>DSGVO-konform</strong> konzipiert:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Alle Tracking-Daten werden nur mit <strong>ausdrücklicher Einwilligung</strong> der Spieler erhoben</li>
          <li>Minderjährige benötigen die Einwilligung eines <strong>Erziehungsberechtigten</strong></li>
          <li>Spieler können ihre Einwilligung jederzeit <strong>widerrufen</strong></li>
          <li>Spieler ohne Einwilligung werden automatisch vom Tracking <strong>ausgeschlossen</strong></li>
          <li>Gegnerische Spieler werden nur mit separater Bestätigung getrackt</li>
          <li>Die Datenschutzerklärung und Nutzungsbedingungen sind in der App unter „Rechtliches" einsehbar</li>
        </ul>
      </div>
    ),
  },
];

/* ---------- page component ---------- */

export default function FullGuide() {
  return (
    <div className="min-h-screen bg-background">
      {/* nav */}
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
            <p className="text-sm text-muted-foreground">Alles was du wissen musst – von der Installation bis zum Report</p>
          </div>
        </div>

        {/* quick nav */}
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

        {/* sections */}
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

        {/* version info */}
        <div className="mt-10 rounded-xl border border-border bg-card/60 p-4 flex items-start gap-3">
          <RotateCcw className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Anleitung wird laufend aktualisiert</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Diese Anleitung wird bei jedem neuen Feature oder jeder Verbesserung automatisch ergänzt. Schau regelmäßig vorbei, um alle neuen Funktionen kennenzulernen.
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-2 font-mono">Letzte Aktualisierung: März 2026 · Version 2.0</p>
          </div>
        </div>

        {/* CTA */}
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
