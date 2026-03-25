import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RECOMMENDED_FRAMES } from "@/components/RecordingGuard";

interface StopConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  frameCount: number;
}

function getQualityLevel(frames: number) {
  if (frames < 5) return { label: "Sehr wenig Daten", color: "text-destructive", emoji: "🔴" };
  if (frames < 15) return { label: "Wenig Daten", color: "text-amber-500", emoji: "🟡" };
  if (frames < RECOMMENDED_FRAMES) return { label: "Ausreichend", color: "text-amber-500", emoji: "🟡" };
  return { label: "Gute Datenbasis", color: "text-primary", emoji: "🟢" };
}

export default function StopConfirmDialog({ open, onOpenChange, onConfirm, frameCount }: StopConfirmDialogProps) {
  const quality = getQualityLevel(frameCount);
  const remainingForGood = Math.max(0, RECOMMENDED_FRAMES - frameCount);
  const remainingMinutes = Math.ceil(remainingForGood * 0.5); // ~30s per frame

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Aufnahme beenden?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span>{quality.emoji}</span>
                <span className={`font-semibold ${quality.color}`}>{quality.label}</span>
                <span className="text-muted-foreground">— {frameCount} Frames</span>
              </div>

              {frameCount < 5 && (
                <p className="text-destructive font-medium text-sm">
                  ⚠ Sehr wenige Daten — die Analyse wird kaum verwertbar sein.
                  Empfehlung: Noch ~{remainingMinutes} Min. aufnehmen.
                </p>
              )}

              {frameCount >= 5 && frameCount < RECOMMENDED_FRAMES && (
                <p className="text-amber-500 font-medium text-sm">
                  Die Analyse wird funktionieren, aber noch ~{remainingMinutes} Min. ergeben deutlich bessere Ergebnisse.
                </p>
              )}

              {frameCount >= RECOMMENDED_FRAMES && (
                <p className="text-sm text-muted-foreground">
                  Genug Daten für eine aussagekräftige Analyse. Die KI-Auswertung wird jetzt gestartet.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Weiter aufnehmen</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={
              frameCount < RECOMMENDED_FRAMES
                ? "bg-amber-500 text-white hover:bg-amber-600"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }
          >
            {frameCount < RECOMMENDED_FRAMES ? "Trotzdem stoppen" : "Stoppen & Analyse starten"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
