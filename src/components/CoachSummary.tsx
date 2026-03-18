import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, ShieldAlert, Sparkles, Target, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataQualityBadge } from "@/components/DataQualityBadge";
import { getQualitySummary } from "@/lib/data-quality";

type TeamStats = {
  possession_pct?: number | null;
  total_distance_km?: number | null;
};

type PlayerStat = {
  id: string;
  player_id?: string | null;
  top_speed_kmh?: number | null;
  avg_speed_kmh?: number | null;
  distance_km?: number | null;
  sprint_count?: number | null;
  minutes_played?: number | null;
  quality_score?: number | null;
  anomaly_flags?: unknown;
  suspected_cause?: string | null;
  corrected_top_speed_kmh?: number | null;
  corrected_avg_speed_kmh?: number | null;
  corrected_distance_km?: number | null;
  passes_total?: number | null;
  passes_completed?: number | null;
  pass_accuracy?: number | null;
  duels_won?: number | null;
  duels_total?: number | null;
  ball_recoveries?: number | null;
  rating?: number | null;
  team?: string;
  players?: { name?: string | null } | null;
};

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function aggregate(stats: PlayerStat[]) {
  const totals = stats.reduce(
    (acc, player) => {
      acc.passesTotal += player.passes_total ?? 0;
      acc.passesCompleted += player.passes_completed ?? 0;
      acc.duelsWon += player.duels_won ?? 0;
      acc.duelsTotal += player.duels_total ?? 0;
      acc.ballRecoveries += player.ball_recoveries ?? 0;
      return acc;
    },
    {
      passesTotal: 0,
      passesCompleted: 0,
      duelsWon: 0,
      duelsTotal: 0,
      ballRecoveries: 0,
    },
  );

  return {
    passAccuracy: totals.passesTotal > 0 ? round((totals.passesCompleted / totals.passesTotal) * 100, 0) : 0,
    duelRate: totals.duelsTotal > 0 ? round((totals.duelsWon / totals.duelsTotal) * 100, 0) : 0,
    ballRecoveries: totals.ballRecoveries,
  };
}

function getFocusPlayer(players: PlayerStat[]) {
  return [...players]
    .sort((a, b) => (b.rating ?? b.ball_recoveries ?? 0) - (a.rating ?? a.ball_recoveries ?? 0))
    .find((player) => player.player_id && player.players?.name);
}

export function CoachSummary({
  clubName,
  awayName,
  homeTeamStats,
  awayTeamStats,
  homePlayerStats,
  awayPlayerStats,
}: {
  clubName: string;
  awayName: string;
  homeTeamStats?: TeamStats | null;
  awayTeamStats?: TeamStats | null;
  homePlayerStats: PlayerStat[];
  awayPlayerStats: PlayerStat[];
}) {
  const homeAgg = aggregate(homePlayerStats);
  const awayAgg = aggregate(awayPlayerStats);
  const controlLeader = (homeTeamStats?.possession_pct ?? 0) === (awayTeamStats?.possession_pct ?? 0)
    ? "Ausgeglichen"
    : (homeTeamStats?.possession_pct ?? 0) > (awayTeamStats?.possession_pct ?? 0)
      ? clubName
      : awayName;

  const qualityCandidate = [...homePlayerStats, ...awayPlayerStats]
    .filter((player) => player.players?.name)
    .sort((a, b) => {
      const aScore = getQualitySummary({
        top_speed_kmh: a.top_speed_kmh,
        avg_speed_kmh: a.avg_speed_kmh,
        distance_km: a.distance_km,
        sprint_count: a.sprint_count,
        minutes_played: a.minutes_played,
        quality_score: a.quality_score,
        anomaly_flags: a.anomaly_flags,
        suspected_cause: a.suspected_cause,
        corrected_top_speed_kmh: a.corrected_top_speed_kmh,
        corrected_avg_speed_kmh: a.corrected_avg_speed_kmh,
        corrected_distance_km: a.corrected_distance_km,
      }).score;
      const bScore = getQualitySummary({
        top_speed_kmh: b.top_speed_kmh,
        avg_speed_kmh: b.avg_speed_kmh,
        distance_km: b.distance_km,
        sprint_count: b.sprint_count,
        minutes_played: b.minutes_played,
        quality_score: b.quality_score,
        anomaly_flags: b.anomaly_flags,
        suspected_cause: b.suspected_cause,
        corrected_top_speed_kmh: b.corrected_top_speed_kmh,
        corrected_avg_speed_kmh: b.corrected_avg_speed_kmh,
        corrected_distance_km: b.corrected_distance_km,
      }).score;
      return aScore - bScore;
    })[0];

  const focusPlayer = getFocusPlayer(homePlayerStats) ?? getFocusPlayer(awayPlayerStats);
  const recommendation = homeAgg.duelRate < 50
    ? "Restverteidigung und zweites Ballverhalten priorisieren – die Duellquote ist die klarste Stellschraube."
    : homeAgg.passAccuracy < 78
      ? "Im Aufbau einen passsicheren Spieler tiefer binden, damit das Team unter Druck sauberer bleibt."
      : "Nach Ballgewinnen früher vertikal werden – die Grundstruktur wirkt stabil genug für mutigere Anschlussaktionen.";

  return (
    <section className="glass-card relative overflow-hidden p-5 sm:p-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-primary/15 via-accent/10 to-transparent" />
      <div className="relative space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/70 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-muted-foreground backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Coach Summary
            </div>
            <div>
              <h2 className="text-xl font-semibold font-display sm:text-2xl">Schneller Überblick für Trainer & Coach</h2>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Erst die Kernaussage, dann die Details: Kontrolle, Auffälligkeiten und nächste Coaching-Aktion auf einen Blick.
              </p>
            </div>
          </div>

          {focusPlayer?.player_id ? (
            <Button variant="heroOutline" size="sm" asChild>
              <Link to={`/players/${focusPlayer.player_id}`}>
                Fokusspieler öffnen
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-border bg-background/70 p-4 backdrop-blur-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Spielkontrolle</p>
                <h3 className="mt-2 text-lg font-semibold font-display">{controlLeader}</h3>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Target className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {clubName}: {homeTeamStats?.possession_pct ? `${round(homeTeamStats.possession_pct, 0)}% Ballbesitz` : "keine Ballbesitzdaten"} · {awayName}: {awayTeamStats?.possession_pct ? `${round(awayTeamStats.possession_pct, 0)}%` : "—"}
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-background/70 p-4 backdrop-blur-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Risiko & Datenqualität</p>
                <h3 className="mt-2 text-lg font-semibold font-display">
                  {qualityCandidate?.players?.name ? qualityCandidate.players.name : "Keine Auffälligkeit"}
                </h3>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <DataQualityBadge
                metrics={{
                  top_speed_kmh: qualityCandidate?.top_speed_kmh,
                  avg_speed_kmh: qualityCandidate?.avg_speed_kmh,
                  distance_km: qualityCandidate?.distance_km,
                  sprint_count: qualityCandidate?.sprint_count,
                  minutes_played: qualityCandidate?.minutes_played,
                  quality_score: qualityCandidate?.quality_score,
                  anomaly_flags: qualityCandidate?.anomaly_flags,
                  suspected_cause: qualityCandidate?.suspected_cause,
                  corrected_top_speed_kmh: qualityCandidate?.corrected_top_speed_kmh,
                  corrected_avg_speed_kmh: qualityCandidate?.corrected_avg_speed_kmh,
                  corrected_distance_km: qualityCandidate?.corrected_distance_km,
                }}
              />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {qualityCandidate
                ? getQualitySummary({
                    top_speed_kmh: qualityCandidate.top_speed_kmh,
                    avg_speed_kmh: qualityCandidate.avg_speed_kmh,
                    distance_km: qualityCandidate.distance_km,
                    sprint_count: qualityCandidate.sprint_count,
                    minutes_played: qualityCandidate.minutes_played,
                    quality_score: qualityCandidate.quality_score,
                    anomaly_flags: qualityCandidate.anomaly_flags,
                    suspected_cause: qualityCandidate.suspected_cause,
                    corrected_top_speed_kmh: qualityCandidate.corrected_top_speed_kmh,
                    corrected_avg_speed_kmh: qualityCandidate.corrected_avg_speed_kmh,
                    corrected_distance_km: qualityCandidate.corrected_distance_km,
                  }).detail
                : "Alle zentralen Kennzahlen wirken aktuell plausibel."}
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-background/70 p-4 backdrop-blur-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Coaching-Empfehlung</p>
                <h3 className="mt-2 text-lg font-semibold font-display">Nächste Aktion</h3>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ShieldAlert className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{recommendation}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-4">
          <div className="rounded-2xl border border-border bg-background/60 p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Ballbesitz</p>
            <p className="mt-2 text-lg font-bold font-display">{homeTeamStats?.possession_pct ? `${round(homeTeamStats.possession_pct, 0)}%` : "—"}</p>
            <p className="text-xs text-muted-foreground">{clubName}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/60 p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Passquote</p>
            <p className="mt-2 text-lg font-bold font-display">{homeAgg.passAccuracy ? `${homeAgg.passAccuracy}%` : "—"}</p>
            <p className="text-xs text-muted-foreground">Aufbauqualität</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/60 p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Zweikampfquote</p>
            <p className="mt-2 text-lg font-bold font-display">{homeAgg.duelRate ? `${homeAgg.duelRate}%` : "—"}</p>
            <p className="text-xs text-muted-foreground">Defensivpräsenz</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/60 p-3 sm:col-span-3 xl:col-span-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Fokusspieler</p>
                <p className="mt-2 truncate text-lg font-bold font-display">{focusPlayer?.players?.name ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{focusPlayer?.ball_recoveries ?? 0} Ballgewinne · Rating {focusPlayer?.rating ? round(focusPlayer.rating, 1) : "—"}</p>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Trophy className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
