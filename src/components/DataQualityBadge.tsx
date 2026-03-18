import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getQualitySummary, type QualityMetrics } from "@/lib/data-quality";

export function DataQualityBadge({ metrics }: { metrics: QualityMetrics }) {
  const summary = getQualitySummary(metrics);

  if (summary.tone === "info") {
    return (
      <Badge variant="secondary" className="gap-1 text-[10px]">
        <ShieldCheck className="h-3 w-3" /> Daten plausibel
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="gap-1 border-warning/40 bg-warning/10 text-foreground text-[10px]">
      <AlertTriangle className="h-3 w-3 text-warning" /> {summary.label}
    </Badge>
  );
}
