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
    text: "Waehle deine Startelf (11 Spieler) und trage bis zu 7 Wechselspieler ein. Ordne jedem Spieler eine Position und Trikotnummer zu. Du kannst die Aufstellung auch noch waehrend des Spiels aendern.",
  },
  {
    id: "position-phones",
    icon: <Smartphone className="h-5 w-5" />,
    title: "3. Smartphones positionieren",
    text: "Platziere 2-3 Smartphones entlang der Seitenlinie, moeglichst erhoeht (1,5-2 m). Ideal: Ein Geraet in der Mitte, je eines an den 16-Meter-Linien. Befestige sie an Absperrzaeunen, Stativen oder Handyhalterungen. Achte darauf, dass das gesamte Spielfeld abgedeckt ist.",
  },
  {
    id: "calibrate",
    icon: <Crosshair className="h-5 w-5" />,
    title: "4. Feld kalibrieren",
    text: "Öffne FieldIQ auf jedem Smartphone und navigiere zum Spiel. Tippe auf „Kalibrieren": Mache ein Foto des Spielfelds und tippe die 4 Eckpunkte des Feldes an. Die KI benötigt diese Referenzpunkte, um die Spielerpositionen korrekt auf das Feld zu projizieren. Speichere die Kalibrierung.",
  },
  {
    id: "start-tracking",
    icon: <Play className="h-5 w-5" />,
    title: "5. Tracking starten",
    text: "Tippe auf „Tracking starten". Das KI-Modell wird geladen (einmalig ~5 Sek.), dann aktiviert sich die Kamera. Du siehst einen grünen Indikator, sobald die Spielererkennung aktiv ist. Jetzt werden alle Bewegungen automatisch aufgezeichnet.",
  },
  {
    id: "during-match",
    icon: <Timer className="h-5 w-5" />,
    title: "6. Während des Spiels",
    text: "• Pause/Weiter: Bei Unterbrechungen (Verletzung, Trinkpause) tippe „Pause", danach „Weiter".\n• Halbzeit: Am Ende der 1. Halbzeit tippe „Halbzeit" – die Daten werden zwischengespeichert.\n• Wechsel melden: Tippe auf „Wechsel" → wähle den Spieler, der rausgeht → wähle den Einwechselspieler → gib die Minute ein → Bestätigen. Der Wechsel wird sofort in der Aufstellung übernommen.",
  },
  {
    id: "end-upload",
    icon: <StopCircle className="h-5 w-5" />,
    title: "7. Spiel beenden & hochladen",
    text: "Am Spielende tippe auf „Spiel beenden". Die Positionsdaten werden komprimiert und an FieldIQ übertragen. Stelle sicher, dass eine Internetverbindung besteht (WLAN oder Mobilfunk). Der Upload dauert je nach Datenmenge 10–30 Sekunden.",
  },
  {
    id: "report",
    icon: <BarChart3 className="h-5 w-5" />,
    title: "8. Report ansehen",
    text: "Nach dem Upload stehen sofort Heatmaps, Laufdistanzen, Sprintanalysen und Topspeed-Werte für jeden Spieler bereit. Gehe zu „Spiele" → wähle das Spiel → „Report". Du kannst den Report auch als PDF exportieren und mit deinem Team teilen.",
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
