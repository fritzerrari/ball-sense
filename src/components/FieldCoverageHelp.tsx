import { useState } from "react";
import { ChevronDown, HelpCircle, Smartphone, Users, Maximize2 } from "lucide-react";

/**
 * Help block: "Was tun, wenn das ganze Feld nicht ins Bild passt?"
 * Embedded inside CameraSetupOverlay as an expandable hint.
 */
export default function FieldCoverageHelp() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <HelpCircle className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Mein Feld passt nicht ins Bild?</p>
            <p className="text-xs text-muted-foreground mt-0.5">3 Lösungen — tippen zum Ausklappen</p>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-border bg-background/50 p-3 space-y-2">
          <Option
            icon={Maximize2}
            title="1. Weitwinkel + höher stellen"
            desc="Aktiviere den 0.5x-Toggle (oben). Stell dich auf eine Bank, ein Auto oder den Zaun. Schon 1–2 m mehr Höhe macht oft den Unterschied."
          />
          <Option
            icon={Smartphone}
            title="2. Nur eine Hälfte filmen"
            desc='Wähle unten "Linke Hälfte" oder "Rechte Hälfte". Du bekommst dann ehrliche Kennzahlen für die sichtbare Hälfte — keine geschätzten Werte fürs ganze Feld.'
          />
          <Option
            icon={Users}
            title="3. Helfer mit zweitem Handy"
            desc='Brich ab, geh zurück und wähle "Helfer filmt". Beide Handys hinter beide Tore (45°-Winkel zur Mittellinie) — so deckt ihr das ganze Feld ab.'
          />
        </div>
      )}
    </div>
  );
}

function Option({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof HelpCircle;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
