import { AlertTriangle, Info, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDataQualityFlags, getDisplayMetric, getQualitySummary, type QualityMetrics } from "@/lib/data-quality";

export function DataQualityPanel({
  title = "Datenqualität",
  metrics,
}: {
  title?: string;
  metrics: QualityMetrics;
}) {
  const flags = getDataQualityFlags(metrics);
  const summary = getQualitySummary(metrics);
  const displayTopSpeed = getDisplayMetric(metrics.top_speed_kmh, metrics.corrected_top_speed_kmh);
  const displayAvgSpeed = getDisplayMetric(metrics.avg_speed_kmh, metrics.corrected_avg_speed_kmh);
  const displayDistance = getDisplayMetric(metrics.distance_km, metrics.corrected_distance_km);

  return (
    <Card className="border-border/80 bg-card/80">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-display">
          {summary.tone === "info" ? <Info className="h-4 w-4 text-primary" /> : <AlertTriangle className="h-4 w-4 text-warning" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border bg-background/60 p-4">
          <p className="text-sm font-semibold">{summary.label}</p>
          <p className="mt-1 text-sm text-muted-foreground">{summary.detail}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-background/60 p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Top-Speed</p>
            <p className="mt-2 text-lg font-bold font-display">{displayTopSpeed ? `${displayTopSpeed.toFixed(1)} km/h` : "—"}</p>
            {metrics.corrected_top_speed_kmh && metrics.top_speed_kmh !== metrics.corrected_top_speed_kmh ? (
              <p className="text-xs text-muted-foreground">Rohwert: {metrics.top_speed_kmh?.toFixed(1)} km/h</p>
            ) : null}
          </div>
          <div className="rounded-xl border border-border bg-background/60 p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Ø Speed</p>
            <p className="mt-2 text-lg font-bold font-display">{displayAvgSpeed ? `${displayAvgSpeed.toFixed(1)} km/h` : "—"}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/60 p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Distanz</p>
            <p className="mt-2 text-lg font-bold font-display">{displayDistance ? `${displayDistance.toFixed(1)} km` : "—"}</p>
          </div>
        </div>

        {flags.length > 0 ? (
          <div className="space-y-2">
            {flags.map((flag) => (
              <div key={flag.code} className="rounded-xl border border-border bg-background/60 p-3">
                <p className="text-sm font-semibold">{flag.label}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{flag.detail}</p>
              </div>
            ))}
            <div className="flex items-start gap-2 rounded-xl border border-border bg-secondary/50 p-3 text-xs text-muted-foreground">
              <Wrench className="mt-0.5 h-3.5 w-3.5 text-primary" />
              Wahrscheinliche Ursache: Platzkalibrierung, Feldgröße oder Tracking-Sprünge prüfen und bei Bedarf neu kalibrieren.
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
