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

interface StopConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  frameCount: number;
}

export default function StopConfirmDialog({ open, onOpenChange, onConfirm, frameCount }: StopConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Aufnahme beenden?</AlertDialogTitle>
          <AlertDialogDescription>
            Du hast {frameCount} Frames aufgenommen. Die KI-Analyse wird mit diesen Daten gestartet.
            {frameCount < 10 && (
              <span className="block mt-2 text-amber-500 font-medium">
                ⚠ Wenige Frames — die Analyse wird weniger genau. Empfohlen: mindestens 10 Frames (~5 Min.).
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Weiter aufnehmen</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Stoppen & Analyse starten
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
