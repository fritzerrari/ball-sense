import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PLAN_CONFIG } from "@/lib/constants";
import type { PlanType } from "@/lib/types";
import { Check, Zap } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: PlanType;
}

export function UpgradeModal({ open, onOpenChange, currentPlan }: UpgradeModalProps) {
  const plans: PlanType[] = ["starter", "club", "pro"];
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> {t("upgrade.title")}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t("upgrade.desc")}</p>
        <div className="grid md:grid-cols-3 gap-4 mt-4">
          {plans.map((plan) => {
            const config = PLAN_CONFIG[plan];
            const isCurrent = plan === currentPlan;
            return (
              <div key={plan} className={`glass-card p-5 flex flex-col ${plan === "club" ? "glow-border" : ""}`}>
                <h3 className="text-sm font-semibold text-muted-foreground tracking-wider mb-2">{config.label.toUpperCase()}</h3>
                <div className="text-3xl font-bold font-display mb-1">€{config.price}</div>
                <div className="text-xs text-muted-foreground mb-4">{t("settings.perMonth")}</div>
                <div className="text-sm text-muted-foreground mb-4">
                  {config.maxMatches ? `${config.maxMatches} ${t("settings.matchesPerMonth")}` : t("settings.unlimited")}
                </div>
                <div className="mt-auto">
                  {isCurrent ? (
                    <Button variant="ghost" size="sm" className="w-full" disabled>
                      <Check className="h-4 w-4 mr-1" /> {t("settings.current")}
                    </Button>
                  ) : (
                    <Button variant={plan === "club" ? "hero" : "heroOutline"} size="sm" className="w-full">
                      {t("common.upgrade")}
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
