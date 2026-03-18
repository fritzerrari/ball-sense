import AppLayout from "@/components/AppLayout";
import { useParams, Link } from "react-router-dom";
import { useState, Fragment } from "react";
import { Activity, ArrowLeft, ArrowUpDown, Camera, ChevronDown, ChevronUp, Crosshair, Download, FileText, Gauge, Loader2, Shield, Share2, Sparkles } from "lucide-react";
import ReportGenerator from "@/components/ReportGenerator";
import ApiFootballStatsCard from "@/components/ApiFootballStatsCard";
import { MatchKpiStrip, MatchRadarChart, TopPlayersChart, ComparisonBarChart } from "@/components/MatchCharts";
import { PerformanceAnalysis } from "@/components/PerformanceAnalysis";
import { useMatch, useTrackingUploads } from "@/hooks/use-matches";
import { usePlayerMatchStats, useTeamMatchStats, useApiFootballStats } from "@/hooks/use-match-stats";
import { useAuth } from "@/components/AuthProvider";
import { HeatmapField } from "@/components/HeatmapField";
import { StatusBadge } from "@/components/StatusBadge";
import { SkeletonCard } from "@/components/SkeletonCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const tabs = ["Übersicht", "Heim", "Auswärts", "Vergleich", "KI-Bericht"];

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function aggregatePlayerMetrics(stats: any[]) {
  const totals = stats.reduce(
    (acc, player) => {
      acc.passesTotal += player.passes_total ?? 0;
      acc.passesCompleted += player.passes_completed ?? 0;
      acc.duelsWon += player.duels_won ?? 0;
      acc.duelsTotal += player.duels_total ?? 0;
      acc.tackles += player.tackles ?? 0;
      acc.interceptions += player.interceptions ?? 0;
      acc.ballRecoveries += player.ball_recoveries ?? 0;
      acc.shots += player.shots_total ?? 0;
      acc.shotsOnTarget += player.shots_on_target ?? 0;
      acc.goals += player.goals ?? 0;
      acc.assists += player.assists ?? 0;
      acc.fouls += player.fouls_committed ?? 0;
      acc.yellow += player.yellow_cards ?? 0;
      acc.red += player.red_cards ?? 0;
      acc.ballContacts += player.ball_contacts ?? 0;
      acc.aerialWon += player.aerial_won ?? 0;
      return acc;
    },
    {
      passesTotal: 0,
      passesCompleted: 0,
      duelsWon: 0,
      duelsTotal: 0,
      tackles: 0,
      interceptions: 0,
      ballRecoveries: 0,
      shots: 0,
      shotsOnTarget: 0,
      goals: 0,
      assists: 0,
      fouls: 0,
      yellow: 0,
      red: 0,
      ballContacts: 0,
      aerialWon: 0,
    },
  );

  return {
    ...totals,
    passAccuracy: totals.passesTotal > 0 ? round((totals.passesCompleted / totals.passesTotal) * 100, 0) : 0,
    duelRate: totals.duelsTotal > 0 ? round((totals.duelsWon / totals.duelsTotal) * 100, 0) : 0,
  };
}

export default function MatchReport() {
  const { id } = useParams();
  const { clubName } = useAuth();
  const { data: match, isLoading } = useMatch(id);
  const { data: playerStats } = usePlayerMatchStats(id);
  const { data: teamStats } = useTeamMatchStats(id);
  const { data: uploads } = useTrackingUploads(id);
  const { data: apiStats } = useApiFootballStats(id);
  const [activeTab, setActiveTab] = useState("Übersicht");
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string>("distance_km");
  const [sortAsc, setSortAsc] = useState(false);

  if (isLoading) return <AppLayout><div className="max-w-6xl mx-auto"><SkeletonCard count={3} /></div></AppLayout>;
  if (!match) return <AppLayout><div className="max-w-6xl mx-auto text-muted-foreground text-center py-20">Spiel nicht gefunden</div></AppLayout>;

  const homeTeamStats = teamStats?.find((t) => t.team === "home");
  const awayTeamStats = teamStats?.find((t) => t.team === "away");
  const homePlayerStats = (playerStats ?? []).filter((s) => s.team === "home");
  const awayPlayerStats = (playerStats ?? []).filter((s) => s.team === "away");
  const hasStats = (playerStats?.length ?? 0) > 0;

  const homeAgg = aggregatePlayerMetrics(homePlayerStats);
  const awayAgg = aggregatePlayerMetrics(awayPlayerStats);

  const sortPlayers = (stats: any[]) => {
    return [...stats].sort((a, b) => {
      const va = a[sortKey] ?? 0;
      const vb = b[sortKey] ?? 0;
      return sortAsc ? va - vb : vb - va;
    });
  };

  const handleSort = (key: string) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const SortHeader = ({ label, field }: { label: string; field: string }) => (
    <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort(field)}>
      <span className="flex items-center gap-1">{label} <ArrowUpDown className="h-3 w-3" /></span>
    </th>
  );

  const renderTeamCard = (label: string, stats: any, agg: ReturnType<typeof aggregatePlayerMetrics>) => (
    <div className="glass-card p-5 sm:p-6 space-y-4 overflow-hidden relative">
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />
      <div className="relative flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold font-display text-lg">{label}</h3>
          <p className="text-sm text-muted-foreground">Moderne Match-Zusammenfassung aus Team- und Einzelwerten.</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4" />
        </div>
      </div>
      <div className="relative grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: "Gesamtdistanz", value: stats?.total_distance_km ? `${stats.total_distance_km.toFixed(1)} km` : "—", icon: Activity },
          { label: "Ballbesitz", value: stats?.possession_pct ? `${round(stats.possession_pct, 0)}%` : "—", icon: Gauge },
          { label: "Passquote", value: agg.passAccuracy ? `${agg.passAccuracy}%` : "—", icon: Gauge },
          { label: "Zweikampfquote", value: agg.duelRate ? `${agg.duelRate}%` : "—", icon: Shield },
          { label: "Ballgewinne", value: String(agg.ballRecoveries), icon: Shield },
          { label: "Schüsse", value: String(agg.shots), icon: Crosshair },
          { label: "Scorer", value: String(agg.goals + agg.assists), icon: Sparkles },
          { label: "Fouls / Karten", value: `${agg.fouls} / ${agg.yellow + agg.red}`, icon: Shield },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-background/50 p-3 space-y-2">
            <item.icon className="h-4 w-4 text-primary" />
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
              <p className="text-lg font-bold font-display">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPlayerTable = (stats: any[]) => {
    if (stats.length === 0) {
      return (
        <div className="glass-card p-8 text-center">
          <Activity className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Noch keine Spielerstatistiken verfügbar.</p>
        </div>
      );
    }
    return (
      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs">Spieler</th>
              <th className="text-left py-3 px-2 text-muted-foreground font-medium text-xs">#</th>
              <SortHeader label="km" field="distance_km" />
              <SortHeader label="Top" field="top_speed_kmh" />
              <SortHeader label="Pässe" field="passes_total" />
              <SortHeader label="Pass%" field="pass_accuracy" />
              <SortHeader label="Zwk%" field="duels_won" />
              <SortHeader label="Ballgew." field="ball_recoveries" />
              <SortHeader label="Tore" field="goals" />
              <SortHeader label="Ass." field="assists" />
              <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs hidden sm:table-cell">Min</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {sortPlayers(stats).map((p: any) => {
              const duelPct = p.duels_total > 0 ? Math.round((p.duels_won / p.duels_total) * 100) : null;
              return (
                <Fragment key={p.id}>
                  <tr className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setExpandedPlayer(expandedPlayer === p.id ? null : p.id)}>
                    <td className="py-3 px-3 font-medium truncate max-w-[140px]">{p.players?.name ?? "—"}</td>
                    <td className="py-3 px-2 text-muted-foreground">{p.players?.number ?? "—"}</td>
                    <td className="py-3 px-3 font-semibold">{p.distance_km?.toFixed(1) ?? "—"}</td>
                    <td className="py-3 px-3">{p.top_speed_kmh?.toFixed(1) ?? "—"}</td>
                    <td className="py-3 px-3">{p.passes_total ?? 0}</td>
                    <td className="py-3 px-3">{p.pass_accuracy ? `${Math.round(p.pass_accuracy)}%` : "—"}</td>
                    <td className="py-3 px-3">{duelPct !== null ? `${duelPct}%` : "—"}</td>
                    <td className="py-3 px-3">{p.ball_recoveries ?? 0}</td>
                    <td className="py-3 px-3 font-semibold">{p.goals ?? 0}</td>
                    <td className="py-3 px-3">{p.assists ?? 0}</td>
                    <td className="py-3 px-3 text-muted-foreground hidden sm:table-cell">{p.minutes_played ?? "—"}</td>
                    <td className="py-3 px-2">{expandedPlayer === p.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</td>
                  </tr>
                  {expandedPlayer === p.id && (
                    <tr>
                      <td colSpan={12} className="p-4 bg-muted/10">
                        <div className="grid lg:grid-cols-[1.1fr,1fr,1fr] gap-4">
                          <HeatmapField label="Heatmap" grid={p.heatmap_grid as number[][] | null} compact />
                          <div className="space-y-3">
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Physis & Ball</div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="rounded-xl border border-border bg-background/50 p-3"><div className="text-[10px] text-muted-foreground">Ø Speed</div><div className="text-sm font-bold font-display">{p.avg_speed_kmh?.toFixed(1) ?? "—"} km/h</div></div>
                              <div className="rounded-xl border border-border bg-background/50 p-3"><div className="text-[10px] text-muted-foreground">Sprint-Distanz</div><div className="text-sm font-bold font-display">{p.sprint_distance_m ? `${Math.round(p.sprint_distance_m)} m` : "—"}</div></div>
                              <div className="rounded-xl border border-border bg-background/50 p-3"><div className="text-[10px] text-muted-foreground">Ballkontakte</div><div className="text-sm font-bold font-display">{p.ball_contacts ?? "—"}</div></div>
                              <div className="rounded-xl border border-border bg-background/50 p-3"><div className="text-[10px] text-muted-foreground">Rating</div><div className="text-sm font-bold font-display">{p.rating ? p.rating.toFixed(1) : "—"}</div></div>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Taktische Aktionen</div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="rounded-xl border border-border bg-background/50 p-3"><div className="text-[10px] text-muted-foreground">Pässe</div><div className="text-sm font-bold font-display">{p.passes_completed ?? 0}/{p.passes_total ?? 0}</div></div>
                              <div className="rounded-xl border border-border bg-background/50 p-3"><div className="text-[10px] text-muted-foreground">Tackles</div><div className="text-sm font-bold font-display">{p.tackles ?? 0}</div></div>
                              <div className="rounded-xl border border-border bg-background/50 p-3"><div className="text-[10px] text-muted-foreground">Interceptions</div><div className="text-sm font-bold font-display">{p.interceptions ?? 0}</div></div>
                              <div className="rounded-xl border border-border bg-background/50 p-3"><div className="text-[10px] text-muted-foreground">Schüsse</div><div className="text-sm font-bold font-display">{p.shots_on_target ?? 0}/{p.shots_total ?? 0}</div></div>
                              <div className="rounded-xl border border-border bg-background/50 p-3"><div className="text-[10px] text-muted-foreground">Fouls</div><div className="text-sm font-bold font-display">{p.fouls_committed ?? 0}</div></div>
                              <div className="rounded-xl border border-border bg-background/50 p-3"><div className="text-[10px] text-muted-foreground">Kopfbälle</div><div className="text-sm font-bold font-display">{p.aerial_won ?? 0}</div></div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <PerformanceAnalysis type="player" playerId={p.player_id} playerName={p.players?.name} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <Link to="/matches" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Zurück zu Spiele
        </Link>

        <div className="glass-card p-6 overflow-hidden relative">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-primary/10 via-accent/10 to-transparent pointer-events-none" />
          <div className="relative flex items-center justify-between mb-3 gap-4 flex-wrap">
            <StatusBadge status={match.status} />
            <div className="flex gap-2 flex-wrap">
              <Button variant="ghost" size="sm" onClick={() => toast.info("PDF-Export wird vorbereitet...")}><FileText className="h-4 w-4 mr-1" /> PDF</Button>
              <Button variant="ghost" size="sm" onClick={() => toast.info("Excel-Export wird vorbereitet...")}><Download className="h-4 w-4 mr-1" /> Excel</Button>
              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link kopiert!"); }}><Share2 className="h-4 w-4 mr-1" /> Teilen</Button>
            </div>
          </div>
          <div className="relative space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold font-display">{clubName} vs {match.away_club_name || "TBD"}</h1>
            <p className="text-sm text-muted-foreground">
              {new Date(match.date).toLocaleDateString("de-DE")}
              {match.kickoff && ` · ${match.kickoff}`}
              {match.fields && ` · ${(match.fields as any).name}`}
            </p>
          </div>

          {match.status === "setup" && (
            <div className="mt-4 space-y-3 relative">
              <Button variant="tracking" className="w-full" asChild>
                <Link to={`/matches/${id}/track?cam=0`}>
                  <Camera className="h-5 w-5 mr-2" /> Tracking starten
                </Link>
              </Button>
              <details className="group">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors flex items-center gap-1">
                  <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" />
                  Weitere Kameras hinzufügen (Multi-Kamera)
                </summary>
                <div className="mt-2 p-3 rounded-lg bg-muted/30 border border-border space-y-2">
                  <p className="text-xs text-muted-foreground mb-2">Kopiere diese Links auf weitere Smartphones für Multi-Kamera-Tracking. Beim Öffnen wird ein 6-stelliger Kamera-Code abgefragt:</p>
                  {[1, 2].map((i) => (
                    <button
                      key={i}
                      onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/camera/${id}/track?cam=${i}`); toast.success(`Link Kamera ${i + 1} kopiert!`); }}
                      className="flex items-center gap-2 w-full text-left text-xs font-mono text-muted-foreground hover:text-primary transition-colors p-2 rounded-md hover:bg-muted/50"
                    >
                      <Camera className="h-3.5 w-3.5 shrink-0" />
                      Kamera {i + 1} — Link kopieren
                    </button>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>

        {match.status === "processing" && (
          <div className="glass-card p-5 glow-border space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              </div>
              <div>
                <h3 className="font-semibold font-display text-sm">Daten werden verarbeitet</h3>
                <p className="text-xs text-muted-foreground">Die KI analysiert die Tracking-Daten. Dies kann einige Minuten dauern.</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Upload", done: true },
                { label: "Spieler-Erkennung", done: false },
                { label: "Statistiken", done: false },
                { label: "Heatmaps", done: false },
              ].map((step, index) => (
                <div key={step.label} className="text-center">
                  <div className={`h-1.5 rounded-full mb-1 ${step.done ? "bg-primary" : index === 1 ? "bg-primary/40 animate-pulse" : "bg-muted"}`} />
                  <span className="text-[10px] text-muted-foreground">{step.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {match.status === "live" && (
          <div className="glass-card p-4 glow-border flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-medium font-display">Live-Tracking läuft</span>
            <span className="text-xs text-muted-foreground ml-auto">Daten werden nach Spielende verfügbar</span>
          </div>
        )}

        {uploads && uploads.length > 0 && match.status !== "processing" && (
          <div className="flex gap-3 flex-wrap">
            {uploads.map((u: any) => (
              <div key={u.id} className="glass-card p-3 flex-1 min-w-[160px]">
                <div className="text-xs text-muted-foreground">Kamera {u.camera_index + 1}</div>
                <StatusBadge status={u.status} />
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-1 bg-muted/30 rounded-lg p-1 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap flex-shrink-0 sm:flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "Übersicht" && (
          <div className="space-y-6">
            {apiStats && (
              <ApiFootballStatsCard
                stats={apiStats}
                homeLabel={clubName ?? "Heim"}
                awayLabel={match.away_club_name ?? "Auswärts"}
              />
            )}

            {hasStats && (
              <MatchKpiStrip
                homeTeamStats={homeTeamStats}
                awayTeamStats={awayTeamStats}
                homePlayerStats={homePlayerStats}
                awayPlayerStats={awayPlayerStats}
                homeName={clubName ?? "Heim"}
                awayName={match.away_club_name ?? "Auswärts"}
              />
            )}

            <div className="grid xl:grid-cols-2 gap-4">
              {renderTeamCard(clubName ?? "Heim", homeTeamStats, homeAgg)}
              {renderTeamCard(match.away_club_name ?? "Auswärts", awayTeamStats, awayAgg)}
            </div>

            {hasStats ? (
              <>
                <ComparisonBarChart
                  homeTeamStats={homeTeamStats}
                  awayTeamStats={awayTeamStats}
                  homePlayerStats={homePlayerStats}
                  awayPlayerStats={awayPlayerStats}
                  homeName={clubName ?? "Heim"}
                  awayName={match.away_club_name ?? "Auswärts"}
                />
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <TopPlayersChart stats={[...homePlayerStats, ...awayPlayerStats]} title="Top Laufdistanz" metric="distance_km" unit="km" />
                  <TopPlayersChart stats={[...homePlayerStats, ...awayPlayerStats]} title="Top Speed" metric="top_speed_kmh" unit="km/h" />
                  <TopPlayersChart stats={[...homePlayerStats, ...awayPlayerStats]} title="Top Sprints" metric="sprint_count" unit="" />
                  <TopPlayersChart stats={[...homePlayerStats, ...awayPlayerStats]} title="Top Passgeber" metric="passes_total" unit="" />
                  <TopPlayersChart stats={[...homePlayerStats, ...awayPlayerStats]} title="Top Tackles" metric="tackles" unit="" />
                  <TopPlayersChart stats={[...homePlayerStats, ...awayPlayerStats]} title="Top Ballgewinne" metric="ball_recoveries" unit="" />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <HeatmapField label="Team-Heatmap Heim" grid={homeTeamStats?.formation_heatmap as number[][] | null} />
                  <HeatmapField label="Team-Heatmap Auswärts" grid={awayTeamStats?.formation_heatmap as number[][] | null} />
                </div>
                <PerformanceAnalysis type="team" matchId={match.id} />
              </>
            ) : (
              <div className="glass-card p-8 text-center">
                <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Statistiken werden nach dem Tracking verfügbar.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "KI-Bericht" && (
          <ReportGenerator
            matchId={match.id}
            matchStatus={match.status}
            clubName={clubName ?? "Heim"}
            awayClubName={match.away_club_name ?? "Gegner"}
            matchDate={match.date}
          />
        )}

        {activeTab === "Heim" && renderPlayerTable(homePlayerStats)}
        {activeTab === "Auswärts" && renderPlayerTable(awayPlayerStats)}

        {activeTab === "Vergleich" && (
          <div className="space-y-6">
            {hasStats ? (
              <>
                <ComparisonBarChart
                  homeTeamStats={homeTeamStats}
                  awayTeamStats={awayTeamStats}
                  homePlayerStats={homePlayerStats}
                  awayPlayerStats={awayPlayerStats}
                  homeName={clubName ?? "Heim"}
                  awayName={match.away_club_name ?? "Auswärts"}
                />
                <MatchRadarChart
                  homeTeamStats={homeTeamStats}
                  awayTeamStats={awayTeamStats}
                  homePlayerStats={homePlayerStats}
                  awayPlayerStats={awayPlayerStats}
                  homeName={clubName ?? "Heim"}
                  awayName={match.away_club_name ?? "Auswärts"}
                />
              </>
            ) : (
              <div className="glass-card p-8 text-center">
                <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Vergleichs-Charts werden nach dem ersten Tracking verfügbar.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
