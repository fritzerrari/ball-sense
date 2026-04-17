import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MonitorSmartphone, Wifi, AlertTriangle, Battery, Clock } from "lucide-react";

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
            <ol className="space-y-3 text-sm">
              {[
                "Öffne die Kamera-App (z.B. SafetyCam) und starte die Live-Vorschau.",
                "Tippe gleich auf 'Bildschirm teilen' und wähle 'Gesamten Bildschirm'.",
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

            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-xs">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                Wichtig zu wissen
              </p>
              <ul className="space-y-1.5 text-muted-foreground">
                <li className="flex gap-2"><Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" /> Ca. 1–3s Latenz je nach WiFi-Kamera.</li>
                <li className="flex gap-2"><Wifi className="h-3.5 w-3.5 shrink-0 mt-0.5" /> Lass die Kamera-App im Vordergrund — nicht zum Browser zurückwechseln.</li>
                <li className="flex gap-2"><Battery className="h-3.5 w-3.5 shrink-0 mt-0.5" /> Höherer Akku- &amp; Hitze-Verbrauch als normale Aufnahme.</li>
              </ul>
            </div>

            <p className="text-[11px] text-muted-foreground italic">
              Beta-Funktion. Funktioniert nur auf Android Chrome. Bildqualität abhängig von deiner Kamera.
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
