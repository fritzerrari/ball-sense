import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowLeftRight, Sparkles } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Auto-detected suggestion: true = swap, false = no swap, null = unknown */
  autoDetected: boolean | null;
  homeTeamName?: string;
  awayTeamName?: string;
  onConfirm: (swapped: boolean) => void;
}

export default function SideSwapDialog({
  open,
  onOpenChange,
  autoDetected,
  homeTeamName = "Heim",
  awayTeamName = "Gast",
  onConfirm,
}: Props) {
  // Default selection follows auto-detection; if unknown, default to true (standard football rule)
  const [selected, setSelected] = useState<"swap" | "no_swap">(
    autoDetected === false ? "no_swap" : "swap",
  );

  const handleConfirm = () => {
    onConfirm(selected === "swap");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            Seitenwechsel zur 2. Halbzeit?
          </DialogTitle>
          <DialogDescription className="text-sm">
            Damit Heatmaps und Pressing-Zonen richtig dargestellt werden, brauchen wir die Info
            ob die Mannschaften nach der Pause die Seiten getauscht haben.
          </DialogDescription>
        </DialogHeader>

        {autoDetected !== null && (
          <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Auto-Erkennung</p>
              <p className="text-muted-foreground mt-0.5">
                Basierend auf den letzten Frames vor der Pause:{" "}
                <span className="font-medium text-foreground">
                  {autoDetected ? "Seiten wurden getauscht" : "Keine Seiten getauscht"}
                </span>
                . Bitte prüfen.
              </p>
            </div>
          </div>
        )}

        <RadioGroup
          value={selected}
          onValueChange={(v) => setSelected(v as "swap" | "no_swap")}
          className="space-y-2"
        >
          <Label
            htmlFor="swap"
            className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
              selected === "swap" ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <RadioGroupItem value="swap" id="swap" />
            <div className="flex-1">
              <p className="font-medium text-sm">Ja, Seiten getauscht</p>
              <p className="text-xs text-muted-foreground">
                Standard im Fußball — {homeTeamName} und {awayTeamName} spielen jetzt auf der jeweils anderen Hälfte.
              </p>
            </div>
          </Label>
          <Label
            htmlFor="no_swap"
            className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
              selected === "no_swap" ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <RadioGroupItem value="no_swap" id="no_swap" />
            <div className="flex-1">
              <p className="font-medium text-sm">Nein, gleiche Seiten</p>
              <p className="text-xs text-muted-foreground">
                Beide Teams spielen weiterhin auf ihren bisherigen Hälften.
              </p>
            </div>
          </Label>
        </RadioGroup>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleConfirm}>Bestätigen & 2. Halbzeit starten</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
