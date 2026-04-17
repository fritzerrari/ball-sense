import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  MonitorSmartphone,
  Wifi,
  AlertTriangle,
  Battery,
  Clock,
  Signal,
  Smartphone,
  ArrowRight,
  Database,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isIOS: boolean;
}

export default function ExternalCameraSetup({ open, onOpenChange, onConfirm, isIOS }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <MonitorSmartphone className="h-5 w-5 text-primary" />
            Externe Kamera einrichten
          </DialogTitle>
          <DialogDescription className="text-sm">
            FieldIQ überträgt das Bild deiner WiFi-Kamera-App (z.B. SafetyCam) per Bildschirm-Freigabe.
          </DialogDescription>
        </DialogHeader>

        {isIOS ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <p className="font-semibold text-sm">iOS wird nicht unterstützt</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Apple Safari erlaubt keine Bildschirm-Freigabe im Browser. Bitte nutze ein Android-Gerät
              mit Chrome — oder filme direkt mit der Handy-Kamera.
            </p>
          </div>
        ) : (
          <>
            {/* Schritt 0: Netzwerk-Setup */}
            <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
              <p className="font-semibold text-sm flex items-center gap-2">
                <Signal className="h-4 w-4 text-primary" />
                Schritt 0: Netzwerk vorbereiten
              </p>

              {/* Visuelles Diagramm */}
              <div className="flex items-center justify-between gap-1 rounded-md bg-background/60 p-2.5 text-[10px] font-medium">
                <div className="flex flex-col items-center gap-0.5 text-center">
                  <MonitorSmartphone className="h-5 w-5 text-primary" />
                  <span>Kamera</span>
                </div>
                <div className="flex flex-col items-center text-primary">
                  <Wifi className="h-3.5 w-3.5" />
                  <span className="text-[9px]">WiFi</span>
                </div>
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <div className="flex flex-col items-center gap-0.5 text-center">
                  <Smartphone className="h-5 w-5 text-primary" />
                  <span>Phone</span>
                </div>
                <div className="flex flex-col items-center text-primary">
                  <Signal className="h-3.5 w-3.5" />
                  <span className="text-[9px]">4G/5G</span>
                </div>
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <div className="flex flex-col items-center gap-0.5 text-center">
                  <Database className="h-5 w-5 text-primary" />
                  <span>FieldIQ</span>
                </div>
              </div>

              <ol className="space-y-1.5 text-xs text-muted-foreground">
                <li>✅ <span className="text-foreground">Mobile Daten</span> einschalten (Einstellungen → Mobilfunk)</li>
                <li>✅ WiFi mit Kamera verbinden (z.B. „SafetyCam_XXXX")</li>
                <li>✅ Falls Android warnt „Kein Internet": <span className="text-foreground">„Trotzdem verbinden"</span></li>
                <li>⚠️ Android-Setting prüfen: <span className="text-foreground">„Mobile Daten bei WiFi-ohne-Internet erlauben"</span></li>
              </ol>
            </div>

            {/* Bisherige 3 Schritte */}
            <div className="space-y-2">
              <p className="font-semibold text-sm">Dann in der App:</p>
              <ol className="space-y-3 text-sm">
                {[
                  "Öffne die Kamera-App (z.B. SafetyCam) und starte die Live-Vorschau.",
                  'Tippe gleich auf "Bildschirm teilen" und wähle "Gesamten Bildschirm".',
                  "Wechsle zurück zur Kamera-App und stelle sie auf Vollbild.",
                ].map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-xs">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-primary" />
                Wichtig zu wissen
              </p>
              <ul className="space-y-1.5 text-muted-foreground">
                <li className="flex gap-2"><Database className="h-3.5 w-3.5 shrink-0 mt-0.5" /> Datenverbrauch: ca. <span className="text-foreground">8–15 MB pro 90-Min-Spiel</span> (nur Frames + Events, kein Video).</li>
                <li className="flex gap-2"><Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" /> Ca. 1–3 s Latenz je nach WiFi-Kamera.</li>
                <li className="flex gap-2"><Wifi className="h-3.5 w-3.5 shrink-0 mt-0.5" /> Kamera-App im Vordergrund halten — nicht zum Browser zurück.</li>
                <li className="flex gap-2"><Battery className="h-3.5 w-3.5 shrink-0 mt-0.5" /> Höherer Akku- &amp; Hitze-Verbrauch als normale Aufnahme.</li>
                <li className="flex gap-2"><Signal className="h-3.5 w-3.5 shrink-0 mt-0.5" /> Bei schlechtem Empfang puffern Frames automatisch und werden später synchronisiert.</li>
              </ul>
            </div>

            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs space-y-1">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-primary" />
                Hinweis zum Editor-Vorschau
              </p>
              <p className="text-muted-foreground">
                Im Lovable-Editor-Vorschau ist Bildschirm-Capture blockiert. Bitte öffne FieldIQ über die
                Live-URL (z.B. <span className="text-foreground font-medium">demo6.time2rise.de</span>) in
                Chrome, Edge oder Firefox.
              </p>
            </div>

            <p className="text-[11px] text-muted-foreground italic">
              Beta-Funktion. Funktioniert auf Android Chrome sowie Desktop Chrome/Edge/Firefox.
              Bildqualität abhängig von deiner Kamera.
            </p>
          </>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          {!isIOS && (
            <Button onClick={onConfirm} className="gap-2">
              <MonitorSmartphone className="h-4 w-4" />
              Bildschirm freigeben
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
