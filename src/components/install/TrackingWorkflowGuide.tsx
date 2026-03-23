import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  PlusCircle,
  Users,
  Smartphone,
  Crosshair,
  Play,
  Timer,
  StopCircle,
  BarChart3,
} from "lucide-react";

interface WorkflowStep {
  id: string;
  icon: React.ReactNode;
  title: string;
  text: string;
}

const steps: WorkflowStep[] = [
  {
    id: "create-match",
    icon: <PlusCircle className="h-5 w-5" />,
    title: "1. Spiel anlegen",
    text: 'Gehe auf "Neues Spiel" und gib Gegner, Datum, Anstosszeit und den Platz ein. Falls du noch keinen Platz angelegt hast, erstelle ihn zuerst unter "Felder".',
  },
  {
    id: "roster",
    icon: <Users className="h-5 w-5" />,
    title: "2. Mannschaft aufstellen",
    text: "Waehle deine Startelf (11 Spieler) und trage bis zu 7 Wechselspieler ein. Ordne jedem Spieler eine Position und Trikotnummer zu – Trikotnummern sind optional, die KI erkennt Spieler auch ohne Nummern ueber ihre Positionen. Du kannst die Aufstellung auch noch waehrend des Spiels aendern.",
  },
  {
    id: "position-phones",
    icon: <Smartphone className="h-5 w-5" />,
    title: "3. Smartphones positionieren (1–3 Kameras)",
    text: "Du kannst 1, 2 oder 3 Smartphones verwenden – je mehr, desto genauer die Analyse.\n\n• 1 Kamera (Basis): Platziere das Smartphone erhoeht (1,5–2 m) in der Mitte der Seitenlinie. Gut fuer kleinere Spielfelder.\n\n• 2 Kameras (Empfohlen): Ein Smartphone in der Mitte, eines an einer der 16-Meter-Linien. Deckt ca. 85 % des Feldes ab.\n\n• 3 Kameras (Optimal): Ein Smartphone in der Mitte, je eines an den 16-Meter-Linien. Maximale Abdeckung und hoechste Zuordnungsgenauigkeit.\n\nBefestige sie an Absperrzaeunen, Stativen oder Handyhalterungen. Achte darauf, dass sich die Sichtbereiche leicht ueberlappen.",
  },
  {
    id: "camera-setup",
    icon: <Smartphone className="h-5 w-5" />,
    title: "4. Zusatz-Kameras anmelden",
    text: 'Jede zusaetzliche Kamera benoetigt einen 6-stelligen Kamera-Code (unter Einstellungen → Kamera-Codes erstellen, max. 3 Codes pro Verein). Oeffne auf dem Zusatz-Smartphone den Kamera-Link aus dem Spielbericht oder scanne den QR-Code. Gib den Code ein – kein Login noetig. Die Kameras muessen nicht die Spieler vorher kennen: Sie nehmen nur auf, das Backend fuehrt alle Kameradaten automatisch zusammen.',
  },
  {
    id: "calibrate",
    icon: <Crosshair className="h-5 w-5" />,
    title: "5. Feld kalibrieren",
    text: 'Oeffne FieldIQ auf jedem Smartphone und navigiere zum Spiel. Tippe auf "Kalibrieren": Mache ein Foto des Spielfelds und tippe die 4 Eckpunkte des Feldes an. Die KI benoetigt diese Referenzpunkte, um die Spielerpositionen korrekt auf das Feld zu projizieren. Speichere die Kalibrierung. Jede Kamera muss einzeln kalibriert werden.',
  },
  {
    id: "start-tracking",
    icon: <Play className="h-5 w-5" />,
    title: "6. Tracking starten",
    text: 'Tippe auf "Tracking starten" – auf jedem Smartphone separat. Das KI-Modell wird geladen (einmalig ~5 Sek.), dann aktiviert sich die Kamera. Du siehst einen gruenen Indikator, sobald die Spielererkennung aktiv ist. Alle Kameras laufen unabhaengig und muessen nicht exakt gleichzeitig gestartet werden – das Backend synchronisiert die Daten automatisch ueber Zeitstempel (±250 ms Toleranz).',
  },
  {
    id: "during-match",
    icon: <Timer className="h-5 w-5" />,
    title: "7. Waehrend des Spiels",
    text: '- Pause/Weiter: Bei Unterbrechungen (Verletzung, Trinkpause) tippe "Pause", danach "Weiter".\n- Halbzeit: Am Ende der 1. Halbzeit tippe "Halbzeit" – die Daten werden zwischengespeichert.\n- Wechsel melden: Tippe auf "Wechsel", waehle den Spieler der rausgeht, waehle den Einwechselspieler, gib die Minute ein und bestaetige.\n\nWechsel und Events muessen nur auf einem Geraet eingetragen werden. Die Zusatz-Kameras nehmen einfach weiter auf.',
  },
  {
    id: "end-upload",
    icon: <StopCircle className="h-5 w-5" />,
    title: "8. Spiel beenden & hochladen",
    text: 'Am Spielende tippe auf jedem Smartphone "Spiel beenden" und dann "Upload starten". Die Reihenfolge spielt keine Rolle. Jede Kamera laedt ihre Daten einzeln hoch (10–30 Sek. je Kamera). Die Verarbeitung startet automatisch sobald alle Uploads eingegangen sind. Bei mehreren Kameras werden die Daten im Backend automatisch fusioniert – Spieler die von mehreren Kameras gleichzeitig erfasst werden, erhalten eine hoehere Zuordnungs-Konfidenz.',
  },
  {
    id: "report",
    icon: <BarChart3 className="h-5 w-5" />,
    title: "9. Report ansehen",
    text: 'Nach der Verarbeitung stehen Heatmaps, Laufdistanzen, Sprintanalysen und Topspeed-Werte fuer jeden Spieler bereit. Gehe zu "Spiele", waehle das Spiel und oeffne den "Report". Im Report siehst du auch, wie viele Kameras verwendet wurden und wie hoch die Zuordnungs-Konfidenz ist. Du kannst den Report als PDF exportieren und mit deinem Team teilen.',
  },
];

export function TrackingWorkflowGuide() {
  return (
    <Accordion type="single" collapsible className="w-full space-y-2">
      {steps.map((step) => (
        <AccordionItem
          key={step.id}
          value={step.id}
          className="glass-card border-none px-5"
        >
          <AccordionTrigger className="hover:no-underline gap-3 py-4">
            <div className="flex items-center gap-3 text-left">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                {step.icon}
              </div>
              <span className="font-display font-semibold text-sm md:text-base">
                {step.title}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pl-12 pb-5">
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {step.text}
            </p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
