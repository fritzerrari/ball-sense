import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PLAN_CONFIG } from "@/lib/constants";
import type { PlanType } from "@/lib/types";
import { Check, Zap } from "lucide-react";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: PlanType;
}

export function UpgradeModal({ open, onOpenChange, currentPlan }: UpgradeModalProps) {
  const plans: PlanType[] = ["starter", "club", "pro"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Plan upgraden
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Du hast das Limit deines aktuellen Plans erreicht. Upgrade für mehr Spiele pro Monat.</p>
        <div className="grid md:grid-cols-3 gap-4 mt-4">
          {plans.map((plan) => {
            const config = PLAN_CONFIG[plan];
            const isCurrent = plan === currentPlan;
            return (
              <div key={plan} className={`glass-card p-5 flex flex-col ${plan === "club" ? "glow-border" : ""}`}>
                <h3 className="text-sm font-semibold text-muted-foreground tracking-wider mb-2">{config.label.toUpperCase()}</h3>
                <div className="text-3xl font-bold font-display mb-1">€{config.price}</div>
                <div className="text-xs text-muted-foreground mb-4">/Monat</div>
                <div className="text-sm text-muted-foreground mb-4">
                  {config.maxMatches ? `${config.maxMatches} Spiele/Monat` : "Unbegrenzt"}
                </div>
                <div className="mt-auto">
                  {isCurrent ? (
                    <Button variant="ghost" size="sm" className="w-full" disabled>
                      <Check className="h-4 w-4 mr-1" /> Aktueller Plan
                    </Button>
                  ) : (
                    <Button variant={plan === "club" ? "hero" : "heroOutline"} size="sm" className="w-full">
                      Upgraden
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
