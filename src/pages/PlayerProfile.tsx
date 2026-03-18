import AppLayout from "@/components/AppLayout";
import { useParams, Link } from "react-router-dom";
import { Activity, ArrowLeft, Gauge, Goal, Pencil, Shield, Trophy, User, Zap } from "lucide-react";
import { usePlayer, useUpdatePlayer } from "@/hooks/use-players";
import { usePlayerAllStats } from "@/hooks/use-match-stats";
import { HeatmapField } from "@/components/HeatmapField";
import { PlayerCharts } from "@/components/PlayerCharts";
import { PerformanceAnalysis } from "@/components/PerformanceAnalysis";
import { SkeletonCard } from "@/components/SkeletonCard";
import { POSITION_LABELS } from "@/lib/constants";
import { mergeHeatmaps } from "@/lib/stats";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { POSITIONS } from "@/lib/constants";

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export default function PlayerProfile() {
  const { id } = useParams();
  const { data: player, isLoading } = usePlayer(id);
  const { data: allStats } = usePlayerAllStats(id);
  const updatePlayer = useUpdatePlayer();
  const [editOpen, setEditOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formNumber, setFormNumber] = useState("");
  const [formPosition, setFormPosition] = useState("");

  if (isLoading) return <AppLayout><div className="max-w-5xl mx-auto"><SkeletonCard count={3} /></div></AppLayout>;
  if (!player) return <AppLayout><div className="max-w-5xl mx-auto text-muted-foreground text-center py-20">Spieler nicht gefunden</div></AppLayout>;

  const stats = allStats ?? [];
  const totalGames = stats.length;
  const avgKm = totalGames > 0 ? stats.reduce((sum, st) => sum + (st.distance_km ?? 0), 0) / totalGames : 0;
  const maxTopSpeed = totalGames > 0 ? stats.reduce((max, st) => Math.max(max, st.top_speed_kmh ?? 0), 0) : 0;
  const totalKm = stats.reduce((sum, st) => sum + (st.distance_km ?? 0), 0);
  const totalSprints = stats.reduce((sum, st) => sum + (st.sprint_count ?? 0), 0);
  const totalGoals = stats.reduce((sum, st) => sum + (st.goals ?? 0), 0);
  const totalAssists = stats.reduce((sum, st) => sum + (st.assists ?? 0), 0);
  const totalPasses = stats.reduce((sum, st) => sum + (st.passes_total ?? 0), 0);
  const totalRecoveries = stats.reduce((sum, st) => sum + (st.ball_recoveries ?? 0), 0);
  const totalTackles = stats.reduce((sum, st) => sum + (st.tackles ?? 0), 0);
  const totalInterceptions = stats.reduce((sum, st) => sum + (st.interceptions ?? 0), 0);
  const avgPassAcc = totalGames > 0
    ? stats.filter((st) => st.pass_accuracy).reduce((sum, st) => sum + (st.pass_accuracy ?? 0), 0) / (stats.filter((st) => st.pass_accuracy).length || 1)
    : 0;
  const avgRating = totalGames > 0
    ? stats.filter((st) => st.rating).reduce((sum, st) => sum + (st.rating ?? 0), 0) / (stats.filter((st) => st.rating).length || 1)
    : 0;
  const totalDuelsWon = stats.reduce((sum, st) => sum + (st.duels_won ?? 0), 0);
  const totalDuels = stats.reduce((sum, st) => sum + (st.duels_total ?? 0), 0);
  const avgDuelRate = totalDuels > 0 ? (totalDuelsWon / totalDuels) * 100 : 0;

  const heatmapGrids = stats
    .filter((s) => s.heatmap_grid)
    .map((s) => s.heatmap_grid as number[][]);
  const avgHeatmap = heatmapGrids.length > 0 ? mergeHeatmaps(heatmapGrids) : null;

  const recentStats = stats.slice(0, 10);

  const openEdit = () => {
    setFormName(player.name);
    setFormNumber(player.number?.toString() ?? "");
    setFormPosition(player.position ?? "");
    setEditOpen(true);
  };

  const handleEdit = async () => {
    await updatePlayer.mutateAsync({
      id: player.id,
      name: formName.trim(),
      number: formNumber ? parseInt(formNumber) : null,
      position: formPosition || null,
    });
    setEditOpen(false);
  };

  const seasonStats = [
    { label: "Spiele", value: String(totalGames), icon: Trophy },
    { label: "Ø km/Spiel", value: avgKm > 0 ? avgKm.toFixed(1) : "—", icon: Activity },
    { label: "Top Speed", value: maxTopSpeed > 0 ? `${maxTopSpeed.toFixed(1)} km/h` : "—", icon: Zap },
    { label: "Passquote", value: avgPassAcc > 0 ? `${round(avgPassAcc, 0)}%` : "—", icon: Gauge },
    { label: "Zweikampfquote", value: avgDuelRate > 0 ? `${round(avgDuelRate, 0)}%` : "—", icon: Shield },
    { label: "Tore", value: String(totalGoals), icon: Goal },
    { label: "Assists", value: String(totalAssists), icon: Trophy },
    { label: "Ballgewinne", value: String(totalRecoveries), icon: Shield },
    { label: "Tackles", value: String(totalTackles), icon: Activity },
    { label: "Interceptions", value: String(totalInterceptions), icon: Shield },
    { label: "Pässe", value: String(totalPasses), icon: Gauge },
    { label: "Ø Rating", value: avgRating > 0 ? avgRating.toFixed(1) : "—", icon: Trophy },
  ];

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <Link to="/players" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Zurück zum Kader
        </Link>

        <div className="glass-card p-5 sm:p-6 overflow-hidden relative">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-primary/10 via-accent/10 to-transparent pointer-events-none" />
          <div className="relative flex flex-col lg:flex-row lg:items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl font-bold font-display text-primary shrink-0">
              {player.number ?? <User className="h-8 w-8" />}
            </div>
            <div className="flex-1 min-w-0 space-y-2 text-center lg:text-left">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold font-display truncate">{player.name}</h1>
                <p className="text-muted-foreground text-sm sm:text-base">
                  {player.position ? (POSITION_LABELS[player.position] || player.position) : "Keine Position"} {player.number ? `· #${player.number}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${player.active ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground"}`}>
                  {player.active ? "Aktiv" : "Inaktiv"}
                </span>
                <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-secondary text-secondary-foreground">
                  {round(totalKm, 1)} km Saisonleistung
                </span>
                <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-secondary text-secondary-foreground">
                  {totalSprints} Sprints
                </span>
              </div>
            </div>
            <Button variant="heroOutline" size="sm" onClick={openEdit} className="w-full lg:w-auto">
              <Pencil className="h-4 w-4 mr-1" /> Bearbeiten
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold font-display">Saisonübersicht</h2>
            <p className="text-sm text-muted-foreground">Komprimiertes Leistungsprofil aus Tracking, Zweikämpfen, Passspiel und Offensivaktionen.</p>
          </div>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {seasonStats.map((item) => (
              <div key={item.label} className="glass-card p-4 space-y-3 overflow-hidden relative">
                <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />
                <div className="relative flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Season</span>
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <item.icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="relative">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-xl font-bold font-display leading-tight">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold font-display mb-3">Letzte Spiele</h2>
          {recentStats.length > 0 ? (
            <div className="glass-card overflow-hidden">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs">Datum</th>
                    <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs">Gegner</th>
                    <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs">km</th>
                    <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs">Top</th>
                    <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs">Pässe</th>
                    <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs">Pass%</th>
                    <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs">Zwk%</th>
                    <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs">Ballgew.</th>
                    <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs">Tore</th>
                    <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs">Ass.</th>
                    <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {recentStats.map((st: any) => {
                    const duelRate = st.duels_total ? Math.round(((st.duels_won ?? 0) / st.duels_total) * 100) : null;
                    return (
                      <tr key={st.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-3">
                          <Link to={`/matches/${st.match_id}`} className="hover:text-primary transition-colors">
                            {st.matches?.date ? new Date(st.matches.date).toLocaleDateString("de-DE") : "—"}
                          </Link>
                        </td>
                        <td className="py-3 px-3 text-muted-foreground">{st.matches?.away_club_name ?? "—"}</td>
                        <td className="py-3 px-3 font-semibold">{st.distance_km?.toFixed(1) ?? "—"}</td>
                        <td className="py-3 px-3">{st.top_speed_kmh?.toFixed(1) ?? "—"}</td>
                        <td className="py-3 px-3">{st.passes_total ?? 0}</td>
                        <td className="py-3 px-3">{st.pass_accuracy ? `${Math.round(st.pass_accuracy)}%` : "—"}</td>
                        <td className="py-3 px-3">{duelRate !== null ? `${duelRate}%` : "—"}</td>
                        <td className="py-3 px-3">{st.ball_recoveries ?? 0}</td>
                        <td className="py-3 px-3 font-semibold">{st.goals ?? 0}</td>
                        <td className="py-3 px-3">{st.assists ?? 0}</td>
                        <td className="py-3 px-3">{st.rating ? st.rating.toFixed(1) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="glass-card p-8 text-center">
              <Activity className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Statistiken werden nach dem ersten Tracking sichtbar.</p>
            </div>
          )}
        </div>

        <PlayerCharts stats={stats} />

        <PerformanceAnalysis type="player" playerId={id} playerName={player.name} />

        <div>
          <h2 className="text-lg font-semibold font-display mb-3">Durchschnitts-Heatmap</h2>
          {avgHeatmap ? (
            <HeatmapField grid={avgHeatmap} />
          ) : (
            <div className="glass-card p-8 text-center">
              <Activity className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Heatmap wird nach dem ersten Tracking verfügbar.</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">Spieler bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Name</label>
              <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Nummer</label>
                <input type="number" value={formNumber} onChange={(e) => setFormNumber(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Position</label>
                <select value={formPosition} onChange={(e) => setFormPosition(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm">
                  <option value="">Keine</option>
                  {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <Button variant="hero" className="w-full" onClick={handleEdit} disabled={!formName.trim()}>
              Speichern
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
