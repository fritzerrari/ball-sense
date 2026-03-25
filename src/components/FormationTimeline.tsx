import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layers } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface FormationEntry {
  frame_index: number;
  minute_approx: number;
  home_formation: string;
  away_formation: string;
  change_trigger?: string;
}

interface Props {
  data: FormationEntry[];
}

const FORMATION_COLORS = [
  "bg-primary", "bg-accent", "bg-chart-3", "bg-chart-4", "bg-chart-5",
];

export default function FormationTimeline({ data }: Props) {
  const { language } = useTranslation();
  const de = language === "de";

  if (!data.length) return null;

  const sorted = [...data].sort((a, b) => a.minute_approx - b.minute_approx);
  const maxMinute = Math.max(90, sorted[sorted.length - 1]?.minute_approx ?? 90);

  const homeFormations = sorted.map((e, i) => ({
    ...e,
    endMinute: i < sorted.length - 1 ? sorted[i + 1].minute_approx : maxMinute,
  }));

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h2 className="font-semibold font-display">{de ? "Formations-Timeline" : "Formation Timeline"}</h2>
        </div>

        {/* Visual timeline */}
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{de ? "Heim" : "Home"}</p>
          <div className="relative h-8 rounded-lg overflow-hidden bg-muted/30 border border-border/50">
            {homeFormations.map((entry, i) => {
              const left = (entry.minute_approx / maxMinute) * 100;
              const width = ((entry.endMinute - entry.minute_approx) / maxMinute) * 100;
              return (
                <div
                  key={i}
                  className={`absolute top-0 h-full flex items-center justify-center text-[10px] font-bold text-primary-foreground ${FORMATION_COLORS[i % FORMATION_COLORS.length]}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${entry.minute_approx}' - ${entry.endMinute}': ${entry.home_formation}`}
                >
                  {width > 10 && entry.home_formation}
                </div>
              );
            })}
          </div>

          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{de ? "Gast" : "Away"}</p>
          <div className="relative h-8 rounded-lg overflow-hidden bg-muted/30 border border-border/50">
            {homeFormations.map((entry, i) => {
              const left = (entry.minute_approx / maxMinute) * 100;
              const width = ((entry.endMinute - entry.minute_approx) / maxMinute) * 100;
              return (
                <div
                  key={i}
                  className="absolute top-0 h-full flex items-center justify-center text-[10px] font-bold bg-destructive/70 text-destructive-foreground"
                  style={{ left: `${left}%`, width: `${width}%`, opacity: 0.5 + (i * 0.15) }}
                  title={`${entry.minute_approx}' - ${entry.endMinute}': ${entry.away_formation}`}
                >
                  {width > 10 && entry.away_formation}
                </div>
              );
            })}
          </div>

          {/* Minute markers */}
          <div className="flex justify-between text-[9px] text-muted-foreground px-1">
            <span>0'</span><span>15'</span><span>30'</span><span>45'</span><span>60'</span><span>75'</span><span>90'</span>
          </div>
        </div>

        {/* Changes list */}
        {sorted.length > 1 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{de ? "Formationswechsel" : "Formation changes"}</p>
            {sorted.slice(1).map((entry, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-border/50 p-3 text-sm">
                <Badge variant="outline" className="text-[10px] shrink-0">{entry.minute_approx}'</Badge>
                <div>
                  <span className="font-medium">{sorted[i].home_formation} → {entry.home_formation}</span>
                  {entry.change_trigger && (
                    <span className="text-xs text-muted-foreground ml-2">({entry.change_trigger})</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
