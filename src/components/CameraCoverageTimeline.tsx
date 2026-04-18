import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Loader2 } from "lucide-react";
import { fetchCameraCoverage, cameraLabel, type CameraCoverageResult } from "@/lib/camera-coverage";

interface Props {
  matchId: string;
}

/**
 * Visual strip showing which camera covered which time range during the match.
 * Each camera renders as a horizontal bar positioned and sized relative to the
 * match recording window. Rendered only when 2+ cameras contributed.
 */
export default function CameraCoverageTimeline({ matchId }: Props) {
  const [data, setData] = useState<CameraCoverageResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchCameraCoverage(matchId).then((res) => {
      if (cancelled) return;
      setData(res);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [matchId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Kamera-Abdeckung wird geladen…
        </CardContent>
      </Card>
    );
  }

  if (!data || data.cameras.length < 2) return null;

  const recStart = data.recording_started_at ? new Date(data.recording_started_at).getTime() : null;
  const recEnd = data.recording_ended_at ? new Date(data.recording_ended_at).getTime() : null;

  // Establish global window: prefer match record, otherwise span of all cameras.
  const allTs = data.cameras
    .flatMap((c) => [c.first_ts, c.last_ts])
    .filter((v): v is number => typeof v === "number");
  const windowStart = recStart ?? (allTs.length ? Math.min(...allTs) : null);
  const windowEnd = recEnd ?? (allTs.length ? Math.max(...allTs) : null);
  if (windowStart === null || windowEnd === null || windowEnd <= windowStart) return null;

  const totalMs = windowEnd - windowStart;
  const totalMinutes = Math.round(totalMs / 60000);

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Kamera-Abdeckung über die Zeit</h3>
          <span className="text-[10px] text-muted-foreground ml-auto">
            {data.cameras.length} Kameras · {totalMinutes} Min Aufnahme
          </span>
        </div>

        <div className="space-y-2">
          {data.cameras
            .sort((a, b) => a.camera_index - b.camera_index)
            .map((cam) => {
              const hasSpan = cam.first_ts !== null && cam.last_ts !== null;
              const startPct = hasSpan
                ? Math.max(0, Math.min(100, ((cam.first_ts! - windowStart) / totalMs) * 100))
                : 0;
              const endPct = hasSpan
                ? Math.max(0, Math.min(100, ((cam.last_ts! - windowStart) / totalMs) * 100))
                : 100;
              const widthPct = Math.max(1, endPct - startPct);

              const startMin = hasSpan ? Math.round((cam.first_ts! - windowStart) / 60000) : 0;
              const endMin = hasSpan ? Math.round((cam.last_ts! - windowStart) / 60000) : totalMinutes;

              return (
                <div key={cam.camera_index} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium">
                      {cameraLabel(cam.camera_index)}
                      <span className="text-muted-foreground font-normal ml-1.5">
                        (Cam {cam.camera_index})
                      </span>
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {hasSpan ? `${startMin}–${endMin}'` : "Zeit unbekannt"} ·{" "}
                      {cam.frame_count} Frames
                    </span>
                  </div>
                  <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="absolute top-0 h-full rounded-full bg-primary/80"
                      style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </div>

        <p className="text-[10px] text-muted-foreground italic">
          Frames aus allen Kameras werden zeitsortiert zur KI-Analyse zusammengeführt — Überlappungen
          erhöhen die Präzision, Lücken werden ehrlich dargestellt.
        </p>
      </CardContent>
    </Card>
  );
}
