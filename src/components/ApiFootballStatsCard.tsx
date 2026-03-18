interface ApiStats {
  home_goals: number | null;
  away_goals: number | null;
  shots_home: number | null;
  shots_away: number | null;
  shots_on_target_home: number | null;
  shots_on_target_away: number | null;
  possession_home: number | null;
  possession_away: number | null;
  passes_home: number | null;
  passes_away: number | null;
  pass_accuracy_home: number | null;
  pass_accuracy_away: number | null;
  corners_home: number | null;
  corners_away: number | null;
  fouls_home: number | null;
  fouls_away: number | null;
  yellow_cards_home: number | null;
  yellow_cards_away: number | null;
  red_cards_home: number | null;
  red_cards_away: number | null;
  offsides_home: number | null;
  offsides_away: number | null;
}

interface Props {
  stats: ApiStats;
  homeLabel: string;
  awayLabel: string;
}

function StatBar({ label, home, away, suffix = "" }: { label: string; home: number | null; away: number | null; suffix?: string }) {
  const h = home ?? 0;
  const a = away ?? 0;
  const total = h + a || 1;
  const homePct = (h / total) * 100;

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm">
        <span className="min-w-0 break-words font-semibold font-display text-left">{h}{suffix}</span>
        <span className="text-center text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
        <span className="min-w-0 break-words font-semibold font-display text-right">{a}{suffix}</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        <div className="bg-primary transition-all" style={{ width: `${homePct}%` }} />
        <div className="flex-1 bg-secondary" />
      </div>
    </div>
  );
}

function SmallStat({ label, home, away, variant = "default" }: { label: string; home: number | null; away: number | null; variant?: "default" | "destructive" }) {
  return (
    <div className={`rounded-xl border p-3 ${variant === "destructive" ? "border-destructive/20 bg-destructive/10" : "border-border bg-secondary/60"}`}>
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-base font-bold font-display break-words">{home ?? 0} : {away ?? 0}</p>
    </div>
  );
}

export default function ApiFootballStatsCard({ stats, homeLabel, awayLabel }: Props) {
  return (
    <div className="glass-card space-y-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold font-display text-base">Offizielle Spielstatistiken</h3>
          <p className="text-sm text-muted-foreground">Tore, Ballbesitz, Fouls und Karten aus dem externen Match-Feed.</p>
        </div>
        <span className="rounded-full border border-border bg-secondary px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-secondary-foreground">
          API-Football
        </span>
      </div>

      {(stats.home_goals !== null || stats.away_goals !== null) && (
        <div className="rounded-2xl border border-border bg-background/60 px-4 py-5 text-center sm:px-6">
          <div className="grid grid-cols-3 items-center gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground break-words">{homeLabel}</p>
              <p className="mt-2 text-4xl font-bold font-display text-primary">{stats.home_goals ?? 0}</p>
            </div>
            <span className="text-2xl text-muted-foreground font-light">:</span>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground break-words">{awayLabel}</p>
              <p className="mt-2 text-4xl font-bold font-display">{stats.away_goals ?? 0}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <StatBar label="Ballbesitz" home={stats.possession_home} away={stats.possession_away} suffix="%" />
        <StatBar label="Schüsse" home={stats.shots_home} away={stats.shots_away} />
        <StatBar label="Schüsse aufs Tor" home={stats.shots_on_target_home} away={stats.shots_on_target_away} />
        <StatBar label="Pässe" home={stats.passes_home} away={stats.passes_away} />
        <StatBar label="Passquote" home={stats.pass_accuracy_home} away={stats.pass_accuracy_away} suffix="%" />
        <StatBar label="Ecken" home={stats.corners_home} away={stats.corners_away} />
        <StatBar label="Fouls" home={stats.fouls_home} away={stats.fouls_away} />
        <StatBar label="Abseits" home={stats.offsides_home} away={stats.offsides_away} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SmallStat label="Gelbe Karten" home={stats.yellow_cards_home} away={stats.yellow_cards_away} />
        <SmallStat label="Rote Karten" home={stats.red_cards_home} away={stats.red_cards_away} variant="destructive" />
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
        <span className="break-words">Heim: {homeLabel}</span>
        <span className="break-words text-right">Auswärts: {awayLabel}</span>
      </div>
    </div>
  );
}
