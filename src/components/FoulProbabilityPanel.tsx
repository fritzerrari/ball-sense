import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// lucide-react has no "Whistle" icon — fall back to a referee-style alert icon
function Whistle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 12h10l4-4v8l-4-4" />
      <circle cx="18" cy="12" r="4" />
    </svg>
  );
}

interface FoulEvent {
  id: string;
  minute: number;
  probability: number;
  severity: "none" | "foul" | "yellow" | "red";
  team: "home" | "away" | "unknown";
  zone: string | null;
  description: string | null;
}

const SEVERITY_STYLE: Record<FoulEvent["severity"], string> = {
  none: "bg-muted text-muted-foreground border-border",
  foul: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  yellow: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  red: "bg-red-500/15 text-red-400 border-red-500/30",
};

const SEVERITY_LABEL: Record<FoulEvent["severity"], string> = {
  none: "Kein Foul",
  foul: "Foul",
  yellow: "Gelb",
  red: "Rot",
};

interface Props {
  matchId: string;
}

export default function FoulProbabilityPanel({ matchId }: Props) {
  const [events, setEvents] = useState<FoulEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("foul_probability_events")
        .select("*")
        .eq("match_id", matchId)
        .order("minute", { ascending: true });
      if (!alive) return;
      setEvents((data ?? []) as FoulEvent[]);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [matchId]);

  if (loading) return <Skeleton className="h-40 w-full" />;

  if (!events.length) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8 text-center space-y-2">
          <Whistle className="h-8 w-8 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">Keine Schiri-Assist-Bewertungen für dieses Spiel vorhanden.</p>
          <p className="text-xs text-muted-foreground/70">Trainer können während/nach dem Spiel Zweikampfszenen zur Bewertung einreichen.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Whistle className="h-4 w-4 text-primary" />
          <h3 className="font-semibold font-display text-sm">Schiri-Assist (KI)</h3>
          <Badge variant="outline" className="text-[10px]">Beta</Badge>
        </div>
        <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-400" />
          <span className="text-amber-400/90">KI-Einschätzung — kein Ersatz für Schiedsrichterentscheidungen.</span>
        </div>
        <div className="space-y-2">
          {events.map((e) => (
            <div key={e.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/60 p-3">
              <Badge variant="outline" className="text-[10px] shrink-0">{e.minute}'</Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{e.description ?? "Zweikampfbewertung"}</p>
                <p className="text-[11px] text-muted-foreground">
                  {e.team !== "unknown" ? (e.team === "home" ? "Heim" : "Gast") : "—"}{e.zone ? ` · ${e.zone}` : ""}
                </p>
              </div>
              <div className="text-right">
                <Badge className={`text-[10px] ${SEVERITY_STYLE[e.severity]}`} variant="outline">
                  {SEVERITY_LABEL[e.severity]}
                </Badge>
                <p className="text-[11px] text-muted-foreground mt-0.5">{Math.round(e.probability * 100)}%</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
