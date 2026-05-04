// Saison-Wrapped — interne Aggregations-Seite (kein Public-Sharing).
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { SkeletonCard } from "@/components/SkeletonCard";
import { Trophy, Goal, Activity, Zap, Heart, Users, Sparkles } from "lucide-react";

interface WrappedTop { name: string; value: number; suffix: string }
interface WrappedData {
  from: string; to: string;
  totals: { games: number; wins: number; draws: number; losses: number; gf: number; ga: number; gd: number; points: number };
  top: { scorer: WrappedTop | null; runner: WrappedTop | null; sprinter: WrappedTop | null; assist: WrappedTop | null; ironman: WrappedTop | null };
  best_match: { date: string; opponent: string; score: string } | null;
  form_strip: Array<{ date: string; result: "W" | "D" | "L"; score: string }>;
}

const RESULT_COLORS = {
  W: "bg-emerald-500 text-white",
  D: "bg-amber-400 text-foreground",
  L: "bg-destructive text-destructive-foreground",
} as const;

export default function SeasonWrapped() {
  const [data, setData] = useState<WrappedData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: res, error: err } = await supabase.functions.invoke("season-wrapped", { body: {} });
      if (err) setError(err.message);
      else setData(res as WrappedData);
    })();
  }, []);

  if (error) return <AppLayout><div className="mx-auto max-w-5xl py-12 text-center text-destructive">{error}</div></AppLayout>;
  if (!data) return <AppLayout><div className="mx-auto max-w-5xl"><SkeletonCard count={4} /></div></AppLayout>;

  const winPct = data.totals.games > 0 ? Math.round((data.totals.wins / data.totals.games) * 100) : 0;

  const topCards = [
    { icon: Goal, label: "Torjäger", t: data.top.scorer, color: "text-emerald-600 bg-emerald-500/10" },
    { icon: Activity, label: "Marathonläufer", t: data.top.runner, color: "text-sky-600 bg-sky-500/10" },
    { icon: Zap, label: "Schnellster Spieler", t: data.top.sprinter, color: "text-amber-600 bg-amber-500/10" },
    { icon: Heart, label: "Bester Vorbereiter", t: data.top.assist, color: "text-rose-600 bg-rose-500/10" },
    { icon: Users, label: "Iron Man", t: data.top.ironman, color: "text-violet-600 bg-violet-500/10" },
  ];

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-6 pb-12">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-emerald-600 text-primary-foreground p-8 shadow-xl">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest opacity-80">
            <Sparkles className="h-4 w-4" /> Saison-Rückblick
          </div>
          <h1 className="mt-2 text-4xl font-bold">Eure Saison in Zahlen</h1>
          <p className="mt-1 text-sm opacity-80">{data.from} – {data.to}</p>

          <div className="mt-6 grid grid-cols-3 gap-4">
            <Stat big={data.totals.games} small="Spiele" />
            <Stat big={`${data.totals.wins}–${data.totals.draws}–${data.totals.losses}`} small="S–U–N" />
            <Stat big={`${data.totals.gf}:${data.totals.ga}`} small={`Tore (${data.totals.gd >= 0 ? "+" : ""}${data.totals.gd})`} />
          </div>

          <div className="mt-4 flex items-end justify-between text-sm">
            <span className="opacity-80">{data.totals.points} Punkte • {winPct}% Siegquote</span>
          </div>
        </div>

        {/* Top-Spieler */}
        <div>
          <h2 className="mb-3 text-lg font-semibold">Top-Spieler der Saison</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {topCards.map(({ icon: Icon, label, t, color }) => (
              <Card key={label} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-full p-2.5 ${color}`}><Icon className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
                      <p className="truncate font-bold">{t?.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{t ? `${t.value} ${t.suffix}` : "Keine Daten"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Best Match */}
        {data.best_match && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /> Bestes Spiel</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{data.best_match.score}</p>
              <p className="text-sm text-muted-foreground">vs. {data.best_match.opponent} • {data.best_match.date}</p>
            </CardContent>
          </Card>
        )}

        {/* Form-Strip */}
        {data.form_strip.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Letzte {data.form_strip.length} Spiele</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {data.form_strip.map((m, i) => (
                  <div key={i} className="text-center">
                    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-bold ${RESULT_COLORS[m.result]}`}>{m.result}</span>
                    <p className="mt-1 text-[9px] text-muted-foreground font-mono">{m.score}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

function Stat({ big, small }: { big: string | number; small: string }) {
  return (
    <div>
      <p className="text-3xl font-bold leading-none">{big}</p>
      <p className="mt-1 text-xs uppercase tracking-wider opacity-80">{small}</p>
    </div>
  );
}
