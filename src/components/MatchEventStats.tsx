import {
  Goal,
  Flag,
  AlertTriangle,
  Shield,
  Crosshair,
  CornerDownRight,
  ArrowRightLeft,
  Hand,
  Footprints,
  Zap,
  Swords,
  HeartPulse,
  X,
  Circle,
} from "lucide-react";

const EVENT_LABELS: Record<string, { label: string; icon: React.ReactNode; category: string }> = {
  goal: { label: "Tore", icon: <Goal className="h-3.5 w-3.5" />, category: "offense" },
  own_goal: { label: "Eigentore", icon: <Goal className="h-3.5 w-3.5" />, category: "offense" },
  assist: { label: "Vorlagen", icon: <Zap className="h-3.5 w-3.5" />, category: "offense" },
  shot: { label: "Schüsse", icon: <Crosshair className="h-3.5 w-3.5" />, category: "offense" },
  shot_on_target: { label: "Torschüsse", icon: <Crosshair className="h-3.5 w-3.5" />, category: "offense" },
  blocked_shot: { label: "Geblockt", icon: <Shield className="h-3.5 w-3.5" />, category: "offense" },
  header: { label: "Kopfbälle", icon: <Circle className="h-3.5 w-3.5" />, category: "offense" },
  save: { label: "Paraden", icon: <Shield className="h-3.5 w-3.5" />, category: "defense" },
  corner: { label: "Ecken", icon: <CornerDownRight className="h-3.5 w-3.5" />, category: "standards" },
  free_kick: { label: "Freistöße", icon: <Flag className="h-3.5 w-3.5" />, category: "standards" },
  penalty: { label: "Elfmeter", icon: <Crosshair className="h-3.5 w-3.5" />, category: "standards" },
  throw_in: { label: "Einwürfe", icon: <ArrowRightLeft className="h-3.5 w-3.5" />, category: "standards" },
  set_piece: { label: "Standards", icon: <Flag className="h-3.5 w-3.5" />, category: "standards" },
  offside: { label: "Abseits", icon: <Flag className="h-3.5 w-3.5" />, category: "standards" },
  tackle: { label: "Tacklings", icon: <Swords className="h-3.5 w-3.5" />, category: "defense" },
  interception: { label: "Abfangen", icon: <Shield className="h-3.5 w-3.5" />, category: "defense" },
  ball_recovery: { label: "Ballgewinne", icon: <Zap className="h-3.5 w-3.5" />, category: "defense" },
  clearance: { label: "Klärungen", icon: <X className="h-3.5 w-3.5" />, category: "defense" },
  won_duel: { label: "Zweikämpfe gew.", icon: <Swords className="h-3.5 w-3.5" />, category: "defense" },
  lost_duel: { label: "Zweikämpfe verl.", icon: <Swords className="h-3.5 w-3.5" />, category: "defense" },
  dribble: { label: "Dribblings", icon: <Footprints className="h-3.5 w-3.5" />, category: "offense" },
  cross: { label: "Flanken", icon: <ArrowRightLeft className="h-3.5 w-3.5" />, category: "offense" },
  foul: { label: "Fouls", icon: <AlertTriangle className="h-3.5 w-3.5" />, category: "discipline" },
  yellow_card: { label: "Gelbe Karten", icon: <AlertTriangle className="h-3.5 w-3.5" />, category: "discipline" },
  red_card: { label: "Rote Karten", icon: <AlertTriangle className="h-3.5 w-3.5" />, category: "discipline" },
  yellow_red_card: { label: "Gelb-Rot", icon: <AlertTriangle className="h-3.5 w-3.5" />, category: "discipline" },
  handball: { label: "Handspiel", icon: <Hand className="h-3.5 w-3.5" />, category: "discipline" },
  counter_attack: { label: "Konter", icon: <Zap className="h-3.5 w-3.5" />, category: "offense" },
  bad_pass: { label: "Fehlpässe", icon: <X className="h-3.5 w-3.5" />, category: "offense" },
  conceded_goal: { label: "Gegentore", icon: <Goal className="h-3.5 w-3.5" />, category: "defense" },
  injury: { label: "Verletzungen", icon: <HeartPulse className="h-3.5 w-3.5" />, category: "other" },
  substitution: { label: "Wechsel", icon: <ArrowRightLeft className="h-3.5 w-3.5" />, category: "other" },
};

const CATEGORY_LABELS: Record<string, string> = {
  offense: "Offensive",
  defense: "Defensive",
  standards: "Standards",
  discipline: "Disziplin",
  other: "Sonstiges",
};

interface MatchEvent {
  id: string;
  event_type: string;
  team: string;
  minute: number;
  player_name?: string | null;
  event_zone?: string | null;
}

interface MatchEventStatsProps {
  events: MatchEvent[];
  homeName: string;
  awayName: string;
}

export function MatchEventStats({ events, homeName, awayName }: MatchEventStatsProps) {
  if (!events?.length) return null;

  // Count events by type and team
  const counts: Record<string, { home: number; away: number }> = {};
  for (const ev of events) {
    if (!counts[ev.event_type]) counts[ev.event_type] = { home: 0, away: 0 };
    if (ev.team === "home") counts[ev.event_type].home++;
    else counts[ev.event_type].away++;
  }

  // Group by category
  const categories: Record<string, Array<{ type: string; home: number; away: number; label: string; icon: React.ReactNode }>> = {};
  for (const [type, c] of Object.entries(counts)) {
    const meta = EVENT_LABELS[type];
    if (!meta) continue;
    const cat = meta.category;
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push({ type, home: c.home, away: c.away, label: meta.label, icon: meta.icon });
  }

  // Timeline
  const timeline = [...events]
    .sort((a, b) => a.minute - b.minute)
    .slice(-15);

  return (
    <div className="space-y-6">
      {/* Comparison grid */}
      <div className="glass-card p-5 space-y-5">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Match Events</p>
          <h3 className="text-lg font-semibold font-display">Ereignisstatistik</h3>
          <p className="text-sm text-muted-foreground">Alle erfassten Spielereignisse im direkten Heim/Gast-Vergleich.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(categories).map(([cat, items]) => (
            <div key={cat} className="rounded-xl border border-border bg-background/50 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{CATEGORY_LABELS[cat] ?? cat}</p>
              <div className="space-y-2">
                {items.map((item) => {
                  const total = item.home + item.away;
                  const homeW = total > 0 ? (item.home / total) * 100 : 50;
                  return (
                    <div key={item.type} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1.5">
                          <span className="text-primary">{item.icon}</span>
                          <span className="font-medium">{item.label}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{item.home} : {item.away}</span>
                      </div>
                      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-l-full bg-primary transition-all" style={{ width: `${homeW}%` }} />
                        <div className="h-full rounded-r-full bg-accent transition-all" style={{ width: `${100 - homeW}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-primary" />
            {homeName}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-accent" />
            {awayName}
          </div>
        </div>
      </div>

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className="glass-card p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Spielverlauf (letzte Events)</p>
          <div className="space-y-1.5">
            {timeline.map((ev) => {
              const meta = EVENT_LABELS[ev.event_type];
              return (
                <div key={ev.id} className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2 text-sm">
                  <span className="w-8 shrink-0 text-right font-bold font-display text-muted-foreground">{ev.minute}'</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${ev.team === "home" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent-foreground"}`}>
                    {ev.team === "home" ? "H" : "G"}
                  </span>
                  <span className="text-primary">{meta?.icon}</span>
                  <span className="font-medium">{meta?.label ?? ev.event_type}</span>
                  {ev.player_name && <span className="ml-auto text-xs text-muted-foreground truncate max-w-[120px]">{ev.player_name}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
