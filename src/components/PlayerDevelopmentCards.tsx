import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Target, Dumbbell, RefreshCw, Loader2, User } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PlayerCard {
  player_name: string;
  position?: string;
  rating?: number;
  strengths: { text: string; evidence_minute?: number }[];
  development_areas: { text: string; situation?: string }[];
  recommended_drill: string;
}

interface Props {
  matchId: string;
}

export default function PlayerDevelopmentCards({ matchId }: Props) {
  const [players, setPlayers] = useState<PlayerCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("player-development", {
        body: { match_id: matchId },
      });
      if (error) throw error;
      setPlayers(data?.players ?? []);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? "Spieler-Karten konnten nicht geladen werden");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (matchId) void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full" />)}
      </div>
    );
  }

  if (!players.length) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-10 text-center space-y-3">
          <User className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">Noch keine individuellen Spieler-Auswertungen vorhanden.</p>
          <Button onClick={() => load(true)} disabled={refreshing} size="sm" className="gap-2">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generieren
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-semibold font-display text-sm">Spieler-Entwicklung</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={() => load(true)} disabled={refreshing} className="gap-1.5 h-8">
          <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          <span className="text-xs">Neu</span>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {players.map((p, idx) => (
          <motion.div
            key={p.player_name + idx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06 }}
          >
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm h-full">
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm truncate">{p.player_name}</h4>
                    {p.position && (
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{p.position}</p>
                    )}
                  </div>
                  {p.rating != null && (
                    <Badge variant="outline" className="font-mono font-bold">
                      {p.rating.toFixed(1)}
                    </Badge>
                  )}
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-widest text-emerald-500 font-semibold mb-1.5">Stärken</p>
                  <ul className="space-y-1">
                    {p.strengths.map((s, i) => (
                      <li key={i} className="text-xs text-foreground/90 leading-relaxed flex items-start gap-1.5">
                        <span className="text-emerald-500 mt-0.5">✓</span>
                        <span>
                          {s.text}
                          {s.evidence_minute != null && (
                            <span className="text-muted-foreground/70 ml-1">(Min {s.evidence_minute})</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-widest text-amber-500 font-semibold mb-1.5">Entwicklungsfelder</p>
                  <ul className="space-y-1">
                    {p.development_areas.map((d, i) => (
                      <li key={i} className="text-xs text-foreground/90 leading-relaxed flex items-start gap-1.5">
                        <Target className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                        <span>
                          {d.text}
                          {d.situation && (
                            <span className="text-muted-foreground/70 block text-[11px] mt-0.5">→ {d.situation}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg bg-primary/5 border border-primary/20 px-2.5 py-2 flex items-start gap-1.5">
                  <Dumbbell className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <p className="text-[11px] leading-relaxed">
                    <span className="font-semibold text-primary">Übung: </span>
                    {p.recommended_drill}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
