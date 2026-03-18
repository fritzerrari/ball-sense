import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, ShieldAlert, Siren, Target } from "lucide-react";
import { HeatmapField } from "@/components/HeatmapField";
import { MetricDetailDialog } from "@/components/MetricDetailDialog";
import { Button } from "@/components/ui/button";
import {
  deriveConcededGoalAnalysis,
  deriveWeaknessHeatmap,
  deriveZoneInsights,
  getTopPlayersForMetric,
  type ApiMatchStatsLite,
  type MatchEventLite,
  type PlayerMetricStat,
} from "@/lib/match-analysis";

interface MatchInsightsPanelProps {
  matchId: string;
  homeHeatmap?: number[][] | null;
  awayHeatmap?: number[][] | null;
  homePlayerStats: PlayerMetricStat[];
  awayPlayerStats: PlayerMetricStat[];
  apiStats?: ApiMatchStatsLite | null;
  events: MatchEventLite[];
}

function severityLabel(value: number) {
  if (value >= 75) return "hoch";
  if (value >= 55) return "mittel";
  return "beobachten";
}

export function MatchInsightsPanel({
  matchId,
  homeHeatmap,
  awayHeatmap,
  homePlayerStats,
  awayPlayerStats,
  apiStats,
  events,
}: MatchInsightsPanelProps) {
  const weaknessGrid = deriveWeaknessHeatmap(homeHeatmap, awayHeatmap, apiStats);
  const zones = deriveZoneInsights(weaknessGrid, homePlayerStats, apiStats, 3);
  const conceded = deriveConcededGoalAnalysis(
    events,
    apiStats,
    {
      duelRate: homePlayerStats.reduce((sum, item) => sum + ((item.duels_total ?? 0) > 0 ? ((item.duels_won ?? 0) / (item.duels_total ?? 1)) * 100 : 0), 0) /
        Math.max(homePlayerStats.filter((item) => (item.duels_total ?? 0) > 0).length, 1),
      ballRecoveries: homePlayerStats.reduce((sum, item) => sum + (item.ball_recoveries ?? 0), 0),
      fouls: homePlayerStats.reduce((sum, item) => sum + (item.fouls_committed ?? 0), 0),
      passAccuracy:
        homePlayerStats.reduce((sum, item) => sum + (item.pass_accuracy ?? 0), 0) /
        Math.max(homePlayerStats.filter((item) => item.pass_accuracy).length, 1),
    },
    {
      shotsOnTarget: apiStats?.shots_on_target_away ?? 0,
      shots: apiStats?.shots_away ?? 0,
      ballRecoveries: awayPlayerStats.reduce((sum, item) => sum + (item.ball_recoveries ?? 0), 0),
    },
  );

  const defensiveLeaders = getTopPlayersForMetric(homePlayerStats, "ball_recoveries", 3, true);
  const buildUpLeaders = getTopPlayersForMetric(homePlayerStats, "passes_total", 3, true);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
      <MetricDetailDialog
        title="Schwachstellen-Heatmap"
        subtitle="Diese Ansicht markiert Problemzonen aus Raumkontrolle, gegnerischer Präsenz und Drucksignalen aus dem Spiel.")
        chips={["Schwachstellen", "Raumkontrolle", "Drilldown"]}
        insight="Die Heatmap ist eine intelligente Risikosicht: Rot heißt nicht automatisch Fehler, sondern priorisierte Zone für Coaching, Restverteidigung und Nachschieben."
        facts={zones.map((zone) => ({
          label: zone.label,
          value: `${zone.severity}% Risiko`,
          hint: zone.description,
        }))}
        footer={
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Direkt zu betroffenen Spielern</p>
            <div className="flex flex-wrap gap-2">
              {zones.flatMap((zone) => zone.players).slice(0, 4).map((player) =>
                player.id ? (
                  <Button key={`${player.id}-${player.name}`} variant="heroOutline" size="sm" asChild>
                    <Link to={`/players/${player.id}`}>{player.name}</Link>
                  </Button>
                ) : null,
              )}
            </div>
          </div>
        }
        contentClassName="sm:max-w-5xl"
      >
        <div className="game-panel p-5 sm:p-6 space-y-4 h-full">
          <div className="flex items-start justify-between gap-3 pr-16">
            <div>
              <h3 className="text-base font-semibold font-display">Schwachstellen-Heatmap</h3>
              <p className="text-sm text-muted-foreground">Problemzonen der Mannschaft mit direkter Trainer-Priorisierung.</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Target className="h-4 w-4" />
            </div>
          </div>
          <HeatmapField label="Risikozonen" grid={weaknessGrid} />
          <div className="grid gap-2 md:grid-cols-3">
            {zones.map((zone) => (
              <div key={zone.id} className="rounded-2xl border border-border bg-background/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold font-display break-words">{zone.label}</p>
                  <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-secondary-foreground">
                    {severityLabel(zone.severity)}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{zone.description}</p>
              </div>
            ))}
          </div>
        </div>
      </MetricDetailDialog>

      <div className="space-y-4">
        <div className="glass-card p-5 sm:p-6 space-y-4 overflow-hidden relative">
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-primary/10 via-accent/10 to-transparent pointer-events-none" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold font-display">Gegentor-Analyse</h3>
              <p className="text-sm text-muted-foreground">Wann, wie und warum das Team unter Druck geraten ist.</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Siren className="h-4 w-4" />
            </div>
          </div>

          <div className="relative rounded-2xl border border-border bg-background/60 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Datenlage</p>
            <p className="mt-2 text-lg font-bold font-display">{conceded.concededGoals} Gegentore</p>
            <p className="mt-1 text-xs text-muted-foreground">{conceded.dataQuality}</p>
          </div>

          <div className="space-y-3">
            {conceded.riskFactors.length > 0 ? (
              conceded.riskFactors.map((factor) => (
                <div key={factor.title} className="rounded-2xl border border-border bg-background/60 p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-semibold">{factor.title}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{factor.detail}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
                Keine klaren Gegentor-Signale erkannt – entweder sauber verteidigt oder noch zu wenig strukturierte Eventdaten vorhanden.
              </div>
            )}
          </div>

          {conceded.structuredEvents.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Timeline</p>
              {conceded.structuredEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-3 rounded-xl border border-border bg-background/60 px-3 py-2">
                  <span className="min-w-10 rounded-full bg-secondary px-2 py-1 text-center text-xs font-semibold text-secondary-foreground">
                    {event.minute}'
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium break-words">{event.event_cause ?? event.event_pattern ?? "Gegentor"}</p>
                    <p className="text-xs text-muted-foreground break-words">
                      {event.event_zone ?? "Zone offen"}
                      {event.affected_line ? ` · ${event.affected_line}` : ""}
                      {event.notes ? ` · ${event.notes}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold font-display">Coach-Navigation</h3>
              <p className="text-sm text-muted-foreground">Schnelle Wege von der Teamanalyse in die passenden Spielerprofile.</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Defensive Fokusspieler</p>
            {defensiveLeaders.map((player) => (
              <Link key={player.id} to={`/players/${player.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-3 py-2 hover:border-primary/40 transition-colors">
                <span className="flex-1 min-w-0 text-sm font-medium truncate">{player.name}</span>
                <span className="text-xs text-muted-foreground">{player.value} Ballgewinne</span>
                <ArrowRight className="h-4 w-4 text-primary" />
              </Link>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Aufbauspiel prüfen</p>
            {buildUpLeaders.map((player) => (
              <Link key={player.id} to={`/players/${player.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-3 py-2 hover:border-primary/40 transition-colors">
                <span className="flex-1 min-w-0 text-sm font-medium truncate">{player.name}</span>
                <span className="text-xs text-muted-foreground">{player.value} Pässe</span>
                <ArrowRight className="h-4 w-4 text-primary" />
              </Link>
            ))}
          </div>

          <Button variant="heroOutline" size="sm" asChild>
            <Link to={`/matches/${matchId}`}>Zum Coaching-Cockpit</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
