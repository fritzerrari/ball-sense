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
  Database,
  ExternalLink,
  Video,
  KeyRound,
  Upload,
} from "lucide-react";
import { isInIframe, isMobileBrowser, isAndroid } from "@/hooks/use-display-capture";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isIOS: boolean;
  onPickAlternative?: (mode: "self" | "helper" | "upload") => void;
}

const LIVE_URL = "https://demo6.time2rise.de";

export default function ExternalCameraSetup({ open, onOpenChange, onConfirm, isIOS, onPickAlternative }: Props) {
  const inFrame = isInIframe();
  const mobile = isMobileBrowser();
  const android = isAndroid();
  const mobileBlocked = mobile && !isIOS; // Android mobile (iOS handled separately)

  const openLiveUrl = () => {
    window.open(LIVE_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <MonitorSmartphone className="h-5 w-5 text-primary" />
            Externe Kamera einrichten
          </DialogTitle>
          <DialogDescription className="text-sm">
            FieldIQ überträgt das Bild deiner WiFi-Kamera-App per Bildschirm-Freigabe — nur in Desktop-Browsern verfügbar.
          </DialogDescription>
        </DialogHeader>

        {isIOS ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <p className="font-semibold text-sm">iOS wird nicht unterstützt</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Apple Safari erlaubt keine Bildschirm-Freigabe im Browser. Bitte wähle eine der Alternativen.
            </p>
            {onPickAlternative && (
              <div className="grid grid-cols-1 gap-2 pt-1">
                <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => onPickAlternative("self")}>
                  <Video className="h-4 w-4" /> Ich filme selbst
                </Button>
                <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => onPickAlternative("helper")}>
                  <KeyRound className="h-4 w-4" /> Helfer filmt
                </Button>
                <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => onPickAlternative("upload")}>
                  <Upload className="h-4 w-4" /> Video hochladen
                </Button>
              </div>
            )}
          </div>
        ) : mobileBlocked ? (
          <div className="rounded-lg border-2 border-destructive/50 bg-destructive/10 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <p className="font-semibold text-sm">
                {android ? "Android-Browser" : "Mobiler Browser"} unterstützt das nicht
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Mobile Browser können das Bild einer anderen App (z.B. SafetyCam) <span className="font-medium text-foreground">technisch nicht per Bildschirm-Freigabe</span> übernehmen.
              Diese Funktion ist nur in Desktop-Browsern (Chrome, Edge, Firefox) verfügbar.
            </p>
            <p className="text-xs font-semibold text-foreground pt-1">Bitte wähle stattdessen:</p>
            {onPickAlternative ? (
              <div className="grid grid-cols-1 gap-2">
                <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => onPickAlternative("self")}>
                  <Video className="h-4 w-4" /> Ich filme selbst — Handy aufstellen
                </Button>
                <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => onPickAlternative("helper")}>
                  <KeyRound className="h-4 w-4" /> Helfer filmt — Code teilen
                </Button>
                <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => onPickAlternative("upload")}>
                  <Upload className="h-4 w-4" /> Video hochladen — nachträglich analysieren
                </Button>
              </div>
            ) : (
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li>• <span className="text-foreground">Ich filme selbst</span> — Handy aufstellen</li>
                <li>• <span className="text-foreground">Helfer filmt</span> — 6-stelligen Code teilen</li>
                <li>• <span className="text-foreground">Video hochladen</span> — nachträglich analysieren</li>
              </ul>
            )}
          </div>
        ) : (
          <>
            {inFrame && (
              <div className="rounded-lg border-2 border-destructive/50 bg-destructive/10 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                  <p className="font-semibold text-sm">Editor-Vorschau blockiert Bildschirm-Capture</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Der Lovable-Editor lädt FieldIQ in einem iframe ohne Display-Capture-Berechtigung.
                  Bitte öffne die Live-URL in einem eigenen Tab und versuche es dort erneut.
                </p>
                <Button onClick={openLiveUrl} className="w-full gap-2" size="sm">
                  <ExternalLink className="h-4 w-4" />
                  FieldIQ in neuem Tab öffnen
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">
                  Öffnet <span className="font-medium text-foreground">demo6.time2rise.de</span> in neuem Tab
                </p>
              </div>
            )}

            <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
              <p className="font-semibold text-sm flex items-center gap-2">
                <MonitorSmartphone className="h-4 w-4 text-primary" />
                Desktop-Beta — so funktioniert's
              </p>
              <ol className="space-y-3 text-sm">
                {[
                  "Öffne die WiFi-Kamera-App (z.B. SafetyCam, V380) auf einem zweiten Gerät oder im selben PC.",
                  'Klicke unten "Bildschirmfreigabe starten" und wähle das Fenster der Kamera-App oder "Gesamten Bildschirm".',
                  "Die App nimmt das freigegebene Bild auf, bis du Stopp drückst.",
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
                <li className="flex gap-2"><Database className="h-3.5 w-3.5 shrink-0 mt-0.5" /> Datenverbrauch: ca. <span className="text-foreground">8–15 MB pro 90-Min-Spiel</span> (nur Frames + Events).</li>
                <li className="flex gap-2"><Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" /> Ca. 1–3 s Latenz je nach WiFi-Kamera.</li>
                <li className="flex gap-2"><Wifi className="h-3.5 w-3.5 shrink-0 mt-0.5" /> Kamera-App-Fenster im Vordergrund halten — sonst friert das Bild ein.</li>
                <li className="flex gap-2"><Battery className="h-3.5 w-3.5 shrink-0 mt-0.5" /> Höherer Energieverbrauch als normale Aufnahme.</li>
                <li className="flex gap-2"><Signal className="h-3.5 w-3.5 shrink-0 mt-0.5" /> Bei kurzem Verbindungsverlust werden Frames automatisch gepuffert.</li>
              </ul>
            </div>

            <p className="text-[11px] text-muted-foreground italic">
              Beta-Funktion. Funktioniert nur in Desktop-Browsern (Chrome, Edge, Firefox).
              Mobile Browser (Android/iOS) können kein Screen-Capture anderer Apps durchführen.
            </p>
          </>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {mobileBlocked || isIOS ? "Schließen" : "Abbrechen"}
          </Button>
          {!isIOS && !mobileBlocked && (
            <div className="flex flex-col gap-1.5 sm:items-end">
              <Button onClick={onConfirm} className="gap-2" variant={inFrame ? "outline" : "default"}>
                <MonitorSmartphone className="h-4 w-4" />
                {inFrame ? "Trotzdem versuchen" : "Bildschirmfreigabe starten"}
              </Button>
              <p className="text-[10px] text-muted-foreground sm:text-right">
                Der Systemdialog erscheint direkt nach dem Tippen.
              </p>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
