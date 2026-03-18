import { ReactNode } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type DetailFact = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
};

interface MetricDetailDialogProps {
  title: string;
  subtitle?: string;
  insight?: ReactNode;
  facts?: DetailFact[];
  chips?: string[];
  triggerClassName?: string;
  contentClassName?: string;
  footer?: ReactNode;
  children: ReactNode;
}

export function MetricDetailDialog({
  title,
  subtitle,
  insight,
  facts = [],
  chips = [],
  triggerClassName,
  contentClassName,
  footer,
  children,
}: MetricDetailDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className={cn("metric-trigger group", triggerClassName)}>
          {children}
          <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-border bg-background/80 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
            Details
            <ChevronRight className="h-3 w-3" />
          </span>
        </button>
      </DialogTrigger>

      <DialogContent className={cn("max-h-[85vh] overflow-hidden border-border bg-card/95 p-0 sm:max-w-3xl", contentClassName)}>
        <div className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-primary/15 via-accent/10 to-transparent pointer-events-none" />
          <div className="relative max-h-[85vh] overflow-y-auto p-5 sm:p-6">
            <DialogHeader className="space-y-3 text-left">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Drilldown
              </div>
              <div className="space-y-2">
                <DialogTitle className="font-display text-xl break-words sm:text-2xl">{title}</DialogTitle>
                {subtitle && <DialogDescription className="max-w-2xl break-words text-sm leading-6">{subtitle}</DialogDescription>}
              </div>
            </DialogHeader>

            {chips.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-secondary-foreground"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            )}

            {insight && (
              <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/10 p-4 text-sm leading-6 text-foreground">
                {insight}
              </div>
            )}

            {facts.length > 0 && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {facts.map((fact) => (
                  <div key={fact.label} className="rounded-2xl border border-border bg-background/60 p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{fact.label}</p>
                    <p className="mt-2 break-words text-lg font-bold font-display text-foreground">{fact.value}</p>
                    {fact.hint && <p className="mt-2 text-xs leading-5 text-muted-foreground">{fact.hint}</p>}
                  </div>
                ))}
              </div>
            )}

            {footer && <div className="mt-5">{footer}</div>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
