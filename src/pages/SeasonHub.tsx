import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Trophy,
  RefreshCw,
  TrendingUp,
  Calendar,
  Target,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Clock,
  Award,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";

type FixtureRow = {
  fixture_id?: string | number;
  date?: string;
  is_home?: boolean;
  opponent?: string;
  opponent_logo?: string | null;
  our_goals?: number | null;
  their_goals?: number | null;
  result?: "W" | "D" | "L" | null;
  matchday?: number | null;
  ai_briefing?: any;
};

type StandingRow = {
  rank?: number | null;
  team_name?: string;
  team_logo?: string | null;
  is_us?: boolean;
  matches?: number;
  won?: number;
  draw?: number;
  lost?: number;
  goals_for?: number;
  goals_against?: number;
  goal_diff?: number;
  points?: number;
  form?: string;
};

type SeasonData = {
  club: { name: string; league?: string | null };
  season?: number;
  source?: string;
  standings: StandingRow[];
  our_rank?: StandingRow | null;
  last_results: FixtureRow[];
  upcoming: FixtureRow[];
  next_match?: (FixtureRow & { ai_briefing?: any }) | null;
  top_scorers?: Array<{ name: string; team?: string; goals?: number; assists?: number; photo?: string }>;
  injuries?: Array<{ player: string; type?: string; reason?: string }>;
  note?: string;
  generated_at?: string;
};

export default function SeasonHub() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["season-hub", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("season-hub", { body: {} });
      if (error) throw error;
      return data as { cached: boolean; data?: SeasonData; source?: string; fetched_at?: string };
    },
    enabled: !!user,
    staleTime: 60 * 60 * 1000,
  });

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("season-hub", { body: { force: true } });
      if (error) throw error;
      qc.setQueryData(["season-hub", user?.id], data);
      toast.success("Season Hub aktualisiert");
    } catch (e: any) {
      toast.error("Aktualisierung fehlgeschlagen", { description: e?.message });
    } finally {
      setRefreshing(false);
    }
  }

  const payload: SeasonData | undefined = (data as any)?.data ?? (data as any);
  const source = data?.source ?? payload?.source;
  const fetchedAt = data?.fetched_at ?? payload?.generated_at;

  const sourceLabel =
    source === "api-football"
      ? "API-Football (live)"
      : source === "openligadb"
        ? "OpenLigaDB"
        : source === "own-history"
          ? "Eigene Match-Historie + KI"
          : "Unbekannt";

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              <span className="gradient-text">Season Hub</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tabelle, Spielplan, Form & Gegner-Analyse – automatisch aus den besten verfügbaren Quellen
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <Sparkles className="h-3 w-3" />
              {sourceLabel}
            </Badge>
            {fetchedAt && (
              <Badge variant="secondary" className="gap-1.5">
                <Clock className="h-3 w-3" />
                {new Date(fetchedAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshing || isLoading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Aktualisieren
            </Button>
          </div>
        </motion.div>

        {isLoading && <LoadingSkeleton />}

        {error && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="p-6 text-sm">
              Fehler beim Laden: {(error as Error).message}
            </CardContent>
          </Card>
        )}

        {payload && !isLoading && (
          <>
            {payload.note && (
              <Card className="border-amber-500/40 bg-amber-500/5">
                <CardContent className="flex items-start gap-3 p-4 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <p>{payload.note} – Verbinde unter Einstellungen die <strong>API-Football-Integration</strong> oder pflege deine Liga im Vereinsprofil für Live-Daten.</p>
                </CardContent>
              </Card>
            )}

            {/* KPI Row */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiCard
                icon={Trophy}
                label="Tabellenplatz"
                value={payload.our_rank?.rank ? `${payload.our_rank.rank}.` : "—"}
                sub={payload.our_rank?.points != null ? `${payload.our_rank.points} Pkt.` : undefined}
              />
              <KpiCard
                icon={TrendingUp}
                label="Bilanz"
                value={`${payload.our_rank?.won ?? 0}-${payload.our_rank?.draw ?? 0}-${payload.our_rank?.lost ?? 0}`}
                sub={`${payload.our_rank?.matches ?? 0} Spiele`}
              />
              <KpiCard
                icon={Target}
                label="Tore"
                value={`${payload.our_rank?.goals_for ?? 0}:${payload.our_rank?.goals_against ?? 0}`}
                sub={`Diff: ${payload.our_rank?.goal_diff != null && payload.our_rank.goal_diff > 0 ? "+" : ""}${payload.our_rank?.goal_diff ?? 0}`}
              />
              <KpiCard
                icon={Calendar}
                label="Nächstes Spiel"
                value={payload.next_match?.opponent ?? "—"}
                sub={payload.next_match?.date ? new Date(payload.next_match.date).toLocaleDateString("de-DE") : undefined}
              />
            </div>

            <Tabs defaultValue="next" className="w-full">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
                <TabsTrigger value="next">Nächster Gegner</TabsTrigger>
                <TabsTrigger value="standings">Tabelle</TabsTrigger>
                <TabsTrigger value="schedule">Spielplan</TabsTrigger>
                <TabsTrigger value="form">Form</TabsTrigger>
                <TabsTrigger value="stats">Stats</TabsTrigger>
              </TabsList>

              {/* Next Opponent */}
              <TabsContent value="next" className="mt-4 space-y-4">
                {payload.next_match ? (
                  <NextOpponentCard match={payload.next_match} />
                ) : (
                  <EmptyState text="Kein bevorstehendes Spiel gefunden." />
                )}
              </TabsContent>

              {/* Standings */}
              <TabsContent value="standings" className="mt-4">
                <StandingsTable standings={payload.standings} />
              </TabsContent>

              {/* Schedule */}
              <TabsContent value="schedule" className="mt-4 space-y-3">
                <h3 className="font-display text-lg font-semibold">Kommende Spiele</h3>
                {payload.upcoming.length === 0 ? (
                  <EmptyState text="Keine kommenden Spiele." />
                ) : (
                  <div className="space-y-2">
                    {payload.upcoming.map((m, i) => (
                      <FixtureRow key={i} fixture={m} />
                    ))}
                  </div>
                )}

                <h3 className="mt-6 font-display text-lg font-semibold">Letzte Ergebnisse</h3>
                {payload.last_results.length === 0 ? (
                  <EmptyState text="Noch keine Ergebnisse." />
                ) : (
                  <div className="space-y-2">
                    {payload.last_results.map((m, i) => (
                      <FixtureRow key={i} fixture={m} showResult />
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Form */}
              <TabsContent value="form" className="mt-4">
                <FormCard results={payload.last_results} ourRank={payload.our_rank} />
              </TabsContent>

              {/* Stats: Top scorers + Injuries */}
              <TabsContent value="stats" className="mt-4 grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Award className="h-4 w-4 text-primary" /> Top-Torjäger der Liga
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(payload.top_scorers ?? []).length === 0 ? (
                      <EmptyState text="Keine Daten verfügbar." />
                    ) : (
                      <div className="space-y-2">
                        {payload.top_scorers!.slice(0, 10).map((s, i) => (
                          <div key={i} className="flex items-center gap-3 rounded-lg border border-border/50 p-2">
                            <span className="w-6 text-center text-sm font-semibold text-muted-foreground">{i + 1}</span>
                            {s.photo && <img src={s.photo} alt={s.name} className="h-8 w-8 rounded-full object-cover" />}
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-sm font-medium">{s.name}</p>
                              <p className="truncate text-xs text-muted-foreground">{s.team}</p>
                            </div>
                            <Badge variant="secondary">{s.goals ?? 0} ⚽</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <AlertTriangle className="h-4 w-4 text-destructive" /> Eigene Verletzte / Sperren
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(payload.injuries ?? []).length === 0 ? (
                      <EmptyState text="Keine bekannten Ausfälle." />
                    ) : (
                      <div className="space-y-2">
                        {payload.injuries!.map((inj, i) => (
                          <div key={i} className="rounded-lg border border-border/50 p-2 text-sm">
                            <p className="font-medium">{inj.player}</p>
                            <p className="text-xs text-muted-foreground">{inj.reason ?? inj.type}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </AppLayout>
  );
}

// ───── Subcomponents ─────

function KpiCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur">
      <CardContent className="p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <p className="font-display text-2xl font-bold">{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function FixtureRow({ fixture, showResult }: { fixture: FixtureRow; showResult?: boolean }) {
  const dateStr = fixture.date
    ? new Date(fixture.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", weekday: "short" })
    : "TBA";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/40 p-3">
      <div className="w-20 text-xs text-muted-foreground">
        <p className="font-medium">{dateStr}</p>
        {fixture.matchday && <p>ST {fixture.matchday}</p>}
      </div>
      <Badge variant={fixture.is_home ? "default" : "secondary"} className="shrink-0">
        {fixture.is_home ? "Heim" : "Auswärts"}
      </Badge>
      {fixture.opponent_logo && <img src={fixture.opponent_logo} alt="" className="h-6 w-6 rounded object-contain" />}
      <p className="flex-1 truncate text-sm font-medium">{fixture.opponent}</p>
      {showResult && fixture.our_goals != null && fixture.their_goals != null && (
        <>
          <span className="font-mono text-sm font-semibold">
            {fixture.our_goals}:{fixture.their_goals}
          </span>
          <ResultBadge result={fixture.result} />
        </>
      )}
    </div>
  );
}

function ResultBadge({ result }: { result?: "W" | "D" | "L" | null }) {
  if (!result) return null;
  const colors = {
    W: "bg-green-500/20 text-green-700 dark:text-green-400",
    D: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
    L: "bg-red-500/20 text-red-700 dark:text-red-400",
  };
  return <span className={`flex h-6 w-6 items-center justify-center rounded text-xs font-bold ${colors[result]}`}>{result}</span>;
}

function StandingsTable({ standings }: { standings: StandingRow[] }) {
  if (!standings || standings.length === 0) {
    return <EmptyState text="Keine Tabelle verfügbar. Verbinde API-Football oder wähle eine deutsche Profi-Liga." />;
  }
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Mannschaft</th>
              <th className="px-2 py-2 text-center">Sp</th>
              <th className="px-2 py-2 text-center">S</th>
              <th className="px-2 py-2 text-center">U</th>
              <th className="px-2 py-2 text-center">N</th>
              <th className="px-2 py-2 text-center">Tore</th>
              <th className="px-2 py-2 text-center">Diff</th>
              <th className="px-2 py-2 text-center font-bold">Pkt</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, i) => (
              <tr
                key={i}
                className={`border-b last:border-0 ${row.is_us ? "bg-primary/10 font-semibold" : "hover:bg-muted/30"}`}
              >
                <td className="px-3 py-2">{row.rank}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {row.team_logo && <img src={row.team_logo} alt="" className="h-5 w-5 object-contain" />}
                    <span className="truncate">{row.team_name}</span>
                  </div>
                </td>
                <td className="px-2 py-2 text-center">{row.matches}</td>
                <td className="px-2 py-2 text-center">{row.won}</td>
                <td className="px-2 py-2 text-center">{row.draw}</td>
                <td className="px-2 py-2 text-center">{row.lost}</td>
                <td className="px-2 py-2 text-center text-xs">{row.goals_for}:{row.goals_against}</td>
                <td className="px-2 py-2 text-center">{row.goal_diff != null && row.goal_diff > 0 ? "+" : ""}{row.goal_diff}</td>
                <td className="px-2 py-2 text-center font-bold">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function FormCard({ results, ourRank }: { results: FixtureRow[]; ourRank?: StandingRow | null }) {
  const formStr = ourRank?.form || results.map((r) => r.result ?? "?").join("");
  const chars = formStr.split("").slice(-10);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Formkurve (zuletzt {chars.length} Spiele)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {chars.map((c, i) => (
            <ResultBadge key={i} result={c as any} />
          ))}
          {chars.length === 0 && <EmptyState text="Noch keine Formkurve." />}
        </div>
      </CardContent>
    </Card>
  );
}

function NextOpponentCard({ match }: { match: FixtureRow & { ai_briefing?: any } }) {
  const briefing = match.ai_briefing;
  const dateStr = match.date
    ? new Date(match.date).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })
    : "Datum TBA";

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            {match.opponent_logo && (
              <img src={match.opponent_logo} alt="" className="h-16 w-16 rounded-lg border border-border bg-background object-contain p-1" />
            )}
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Nächster Gegner</p>
              <h2 className="font-display text-2xl font-bold">{match.opponent}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {dateStr} • <Badge variant={match.is_home ? "default" : "secondary"} className="ml-1">{match.is_home ? "Heim" : "Auswärts"}</Badge>
              </p>
            </div>
            <ArrowRight className="hidden h-6 w-6 text-primary md:block" />
          </div>
        </CardContent>
      </Card>

      {briefing && <BriefingView briefing={briefing} />}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
