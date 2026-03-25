import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";
import { ArrowRight, ArrowUpRight } from "lucide-react";

interface PassDirections {
  home: { long_pct: number; short_pct: number; build_up_left_pct: number; build_up_center_pct: number; build_up_right_pct: number };
  away: { long_pct: number; short_pct: number; build_up_left_pct: number; build_up_center_pct: number; build_up_right_pct: number };
}

interface Props {
  data: PassDirections;
}

function BuildUpBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-14 text-right">{label}</span>
      <div className="flex-1 h-3 rounded-full bg-muted/30 overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-medium w-8">{Math.round(pct)}%</span>
    </div>
  );
}

function TeamPassCard({ title, dirs, de }: { title: string; dirs: PassDirections["home"]; de: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
      <p className="text-xs font-semibold font-display">{title}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-card/60 p-2 text-center border border-border/40">
          <p className="text-xl font-bold font-display">{Math.round(dirs.short_pct)}%</p>
          <p className="text-[9px] text-muted-foreground">{de ? "Kurzpass" : "Short"}</p>
        </div>
        <div className="rounded-lg bg-card/60 p-2 text-center border border-border/40">
          <p className="text-xl font-bold font-display">{Math.round(dirs.long_pct)}%</p>
          <p className="text-[9px] text-muted-foreground">{de ? "Langball" : "Long"}</p>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">{de ? "Spielaufbau-Verteilung" : "Build-up distribution"}</p>
      <div className="space-y-1.5">
        <BuildUpBar label={de ? "Links" : "Left"} pct={dirs.build_up_left_pct} />
        <BuildUpBar label={de ? "Zentral" : "Center"} pct={dirs.build_up_center_pct} />
        <BuildUpBar label={de ? "Rechts" : "Right"} pct={dirs.build_up_right_pct} />
      </div>
    </div>
  );
}

export default function PassDirectionMap({ data }: Props) {
  const { language } = useTranslation();
  const de = language === "de";

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <ArrowUpRight className="h-5 w-5 text-primary" />
          <h2 className="font-semibold font-display">{de ? "Passrichtungs-Karte" : "Pass Direction Map"}</h2>
        </div>

        {/* SVG Field overlay */}
        <div className="aspect-[105/68] rounded-lg border border-border/50 relative overflow-hidden bg-[hsl(160,45%,30%)]">
          <svg className="w-full h-full" viewBox="0 0 105 68" preserveAspectRatio="xMidYMid slice">
            <rect x="0" y="0" width="105" height="68" fill="hsl(160, 45%, 35%)" />
            <g stroke="white" strokeOpacity="0.3" fill="none" strokeWidth="0.3">
              <rect x="1" y="1" width="103" height="66" />
              <line x1="52.5" y1="1" x2="52.5" y2="67" />
              <circle cx="52.5" cy="34" r="9.15" />
            </g>
            {/* Home arrows from left side */}
            <g opacity="0.8">
              {/* Left channel */}
              <line x1="25" y1="12" x2="65" y2="12" stroke="hsl(var(--primary))" strokeWidth={Math.max(0.5, data.home.build_up_left_pct / 25)} markerEnd="url(#arrowHome)" />
              {/* Center channel */}
              <line x1="25" y1="34" x2="65" y2="34" stroke="hsl(var(--primary))" strokeWidth={Math.max(0.5, data.home.build_up_center_pct / 25)} markerEnd="url(#arrowHome)" />
              {/* Right channel */}
              <line x1="25" y1="56" x2="65" y2="56" stroke="hsl(var(--primary))" strokeWidth={Math.max(0.5, data.home.build_up_right_pct / 25)} markerEnd="url(#arrowHome)" />
            </g>
            <defs>
              <marker id="arrowHome" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
                <path d="M0,0 L4,2 L0,4" fill="hsl(var(--primary))" />
              </marker>
            </defs>
          </svg>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <TeamPassCard title={de ? "Heim-Team" : "Home Team"} dirs={data.home} de={de} />
          <TeamPassCard title={de ? "Gast-Team" : "Away Team"} dirs={data.away} de={de} />
        </div>
      </CardContent>
    </Card>
  );
}
