import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, Shield, ArrowRight, Target } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface ScoutingData {
  preferred_attack_side: string;
  formation_weaknesses: string;
  recommended_counter_strategy: string;
  pressing_behavior?: string;
  transition_speed?: string;
}

interface Props {
  data: ScoutingData;
}

export default function OpponentScoutReport({ data }: Props) {
  const { language } = useTranslation();
  const de = language === "de";

  const sideLabels: Record<string, string> = de
    ? { left: "Links", right: "Rechts", center: "Zentral", mixed: "Gemischt" }
    : { left: "Left", right: "Right", center: "Center", mixed: "Mixed" };

  return (
    <Card className="border-accent/30">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-accent-foreground" />
          <h2 className="font-semibold font-display">{de ? "Gegner-Scouting" : "Opponent Scouting"}</h2>
          <Badge variant="outline" className="text-[9px] border-accent/30 text-accent-foreground">
            {de ? "KI-generiert" : "AI-generated"}
          </Badge>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-primary" />
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {de ? "Bevorzugte Angriffsseite" : "Preferred attack side"}
              </p>
            </div>
            <p className="text-lg font-bold font-display">{sideLabels[data.preferred_attack_side] ?? data.preferred_attack_side}</p>
          </div>

          {data.pressing_behavior && (
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-primary" />
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  {de ? "Pressing-Verhalten" : "Pressing behavior"}
                </p>
              </div>
              <p className="text-lg font-bold font-display capitalize">{data.pressing_behavior}</p>
            </div>
          )}

          {data.transition_speed && (
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowRight className="h-4 w-4 text-primary" />
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  {de ? "Umschalt-Tempo" : "Transition speed"}
                </p>
              </div>
              <p className="text-lg font-bold font-display capitalize">{data.transition_speed}</p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-xs font-semibold text-destructive mb-1">{de ? "Schwachstellen" : "Weaknesses"}</p>
          <p className="text-sm leading-relaxed text-foreground/90">{data.formation_weaknesses}</p>
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-xs font-semibold text-primary mb-1">{de ? "Empfohlene Gegenstrategie" : "Recommended counter-strategy"}</p>
          <p className="text-sm leading-relaxed text-foreground/90">{data.recommended_counter_strategy}</p>
        </div>
      </CardContent>
    </Card>
  );
}
