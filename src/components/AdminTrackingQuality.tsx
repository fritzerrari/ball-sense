import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Activity, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface TelemetryRow {
  id: string;
  date: string;
  away_club_name: string | null;
  tracking_telemetry: {
    frames_total?: number;
    frames_skipped_quality?: number;
    skipped_reasons?: { dark: number; uniform: number; blurry: number; duplicate: number };
    avg_players_detected?: number | null;
    avg_adaptive_interval_sec?: number | null;
    ai_model?: string;
    ai_tokens_total?: number | null;
    analysis_confidence?: number | null;
    h2_simulated?: boolean;
    updated_at?: string;
  } | null;
}

export function AdminTrackingQuality() {
  const [rows, setRows] = useState<TelemetryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("id, date, away_club_name, tracking_telemetry")
        .not("tracking_telemetry", "is", null)
        .order("date", { ascending: false })
        .limit(10);
      if (!error && data) setRows(data as TelemetryRow[]);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Lade Telemetrie…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="glass-card p-8 text-center text-muted-foreground">
        <Activity className="h-8 w-8 mx-auto mb-3 opacity-50" />
        <p>Noch keine Tracking-Telemetrie verfügbar.</p>
        <p className="text-xs mt-2">Daten werden automatisch nach jedem analysierten Spiel erfasst.</p>
      </div>
    );
  }

  // Aggregates over the last 10 matches
  const tels = rows.map((r) => r.tracking_telemetry).filter(Boolean) as NonNullable<TelemetryRow["tracking_telemetry"]>[];
  const avg = (key: keyof typeof tels[0]) => {
    const vals = tels.map((t) => t[key]).filter((v): v is number => typeof v === "number");
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const avgFrames = avg("frames_total");
  const avgSkipped = avg("frames_skipped_quality");
  const avgPlayers = avg("avg_players_detected");
  const avgTokens = avg("ai_tokens_total");
  const avgConf = avg("analysis_confidence");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Ø Frames" value={avgFrames?.toFixed(0) ?? "—"} />
        <StatCard label="Ø Skipped" value={avgSkipped?.toFixed(1) ?? "—"} hint="Qualitätsfilter" />
        <StatCard label="Ø Spieler/Frame" value={avgPlayers?.toFixed(1) ?? "—"} />
        <StatCard label="Ø AI-Tokens" value={avgTokens ? `${(avgTokens / 1000).toFixed(1)}k` : "—"} />
        <StatCard label="Ø Confidence" value={avgConf ? `${(avgConf * 100).toFixed(0)}%` : "—"} />
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Datum</th>
              <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Gegner</th>
              <th className="text-right py-3 px-4 text-muted-foreground font-medium text-xs">Frames</th>
              <th className="text-right py-3 px-4 text-muted-foreground font-medium text-xs hidden sm:table-cell">Skipped</th>
              <th className="text-right py-3 px-4 text-muted-foreground font-medium text-xs hidden md:table-cell">Spieler/F.</th>
              <th className="text-right py-3 px-4 text-muted-foreground font-medium text-xs hidden md:table-cell">Intervall</th>
              <th className="text-right py-3 px-4 text-muted-foreground font-medium text-xs hidden lg:table-cell">Tokens</th>
              <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Modell</th>
              <th className="text-right py-3 px-4 text-muted-foreground font-medium text-xs">Conf.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const t = r.tracking_telemetry!;
              const conf = typeof t.analysis_confidence === "number" ? t.analysis_confidence : null;
              return (
                <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="py-3 px-4 text-xs">{format(new Date(r.date), "dd.MM.yy", { locale: de })}</td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{r.away_club_name ?? "—"}</td>
                  <td className="py-3 px-4 text-right tabular-nums">{t.frames_total ?? "—"}</td>
                  <td className="py-3 px-4 text-right text-muted-foreground tabular-nums hidden sm:table-cell">{t.frames_skipped_quality ?? "—"}</td>
                  <td className="py-3 px-4 text-right tabular-nums hidden md:table-cell">{t.avg_players_detected ?? "—"}</td>
                  <td className="py-3 px-4 text-right text-muted-foreground tabular-nums hidden md:table-cell">{t.avg_adaptive_interval_sec ? `${t.avg_adaptive_interval_sec}s` : "—"}</td>
                  <td className="py-3 px-4 text-right text-muted-foreground tabular-nums hidden lg:table-cell">{t.ai_tokens_total ? `${(t.ai_tokens_total / 1000).toFixed(1)}k` : "—"}</td>
                  <td className="py-3 px-4 text-xs"><Badge variant="secondary" className="text-[10px]">{t.ai_model?.replace("google/gemini-", "") ?? "—"}</Badge></td>
                  <td className="py-3 px-4 text-right tabular-nums">
                    {conf !== null ? (
                      <Badge variant={conf >= 0.7 ? "default" : conf >= 0.5 ? "secondary" : "destructive"} className="text-[10px]">
                        {(conf * 100).toFixed(0)}%
                      </Badge>
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="glass-card p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xl font-bold tabular-nums mt-1">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}
