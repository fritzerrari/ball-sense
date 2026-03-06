import { PLAN_CONFIG } from "@/lib/constants";
import type { PlanType } from "@/lib/types";

export function PlanBadge({ plan }: { plan: string }) {
  const config = PLAN_CONFIG[plan as PlanType] ?? PLAN_CONFIG.trial;
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
      {config.label}
    </span>
  );
}
