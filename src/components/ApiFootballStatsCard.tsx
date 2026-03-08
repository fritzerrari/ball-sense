import { Goal, Target, Footprints, Flag, AlertTriangle, CreditCard } from "lucide-react";

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

function StatBar({ label, home, away, suffix }: { label: string; home: number | null; away: number | null; suffix?: string }) {
  const h = home ?? 0;
  const a = away ?? 0;
  const total = h + a || 1;
  const homePct = (h / total) * 100;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-semibold font-display">{h}{suffix}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="font-semibold font-display">{a}{suffix}</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-muted">
        <div className="bg-primary transition-all" style={{ width: `${homePct}%` }} />
        <div className="bg-muted-foreground/30 flex-1" />
      </div>
    </div>
  );
}

export default function ApiFootballStatsCard({ stats, homeLabel, awayLabel }: Props) {
  return (
    <div className="glass-card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold font-display text-sm">Spielstatistiken</h3>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/50 text-accent-foreground border border-border">
          API-Football
        </span>
      </div>

      {/* Score */}
      {(stats.home_goals !== null || stats.away_goals !== null) && (
        <div className="text-center py-3">
          <div className="flex items-center justify-center gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">{homeLabel}</div>
              <div className="text-4xl font-bold font-display text-primary">{stats.home_goals ?? 0}</div>
            </div>
            <span className="text-2xl text-muted-foreground font-light">:</span>
            <div>
              <div className="text-xs text-muted-foreground mb-1">{awayLabel}</div>
              <div className="text-4xl font-bold font-display">{stats.away_goals ?? 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* Stat bars */}
      <div className="space-y-3">
        <StatBar label="Ballbesitz" home={stats.possession_home} away={stats.possession_away} suffix="%" />
        <StatBar label="Schüsse" home={stats.shots_home} away={stats.shots_away} />
        <StatBar label="Schüsse aufs Tor" home={stats.shots_on_target_home} away={stats.shots_on_target_away} />
        <StatBar label="Pässe" home={stats.passes_home} away={stats.passes_away} />
        <StatBar label="Passgenauigkeit" home={stats.pass_accuracy_home} away={stats.pass_accuracy_away} suffix="%" />
        <StatBar label="Ecken" home={stats.corners_home} away={stats.corners_away} />
        <StatBar label="Fouls" home={stats.fouls_home} away={stats.fouls_away} />
        <StatBar label="Abseits" home={stats.offsides_home} away={stats.offsides_away} />
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <div className="w-4 h-5 rounded-sm bg-yellow-500" />
          <span className="text-sm">{stats.yellow_cards_home ?? 0} : {stats.yellow_cards_away ?? 0}</span>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
          <div className="w-4 h-5 rounded-sm bg-destructive" />
          <span className="text-sm">{stats.red_cards_home ?? 0} : {stats.red_cards_away ?? 0}</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
        <span>{homeLabel}</span>
        <span>{awayLabel}</span>
      </div>
    </div>
  );
}
