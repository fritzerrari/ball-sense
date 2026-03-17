import AppLayout from "@/components/AppLayout";
import { useParams, Link } from "react-router-dom";
import { BarChart3, Zap, Route, Trophy, Pencil, ArrowLeft, User } from "lucide-react";
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

export default function PlayerProfile() {
  const { id } = useParams();
  const { data: player, isLoading } = usePlayer(id);
  const { data: allStats } = usePlayerAllStats(id);
  const updatePlayer = useUpdatePlayer();
  const [editOpen, setEditOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formNumber, setFormNumber] = useState("");
  const [formPosition, setFormPosition] = useState("");

  if (isLoading) return <AppLayout><div className="max-w-4xl mx-auto"><SkeletonCard count={3} /></div></AppLayout>;
  if (!player) return <AppLayout><div className="max-w-4xl mx-auto text-muted-foreground text-center py-20">Spieler nicht gefunden</div></AppLayout>;

  const stats = allStats ?? [];
  const totalGames = stats.length;
  const avgKm = totalGames > 0 ? (stats.reduce((s, st) => s + (st.distance_km ?? 0), 0) / totalGames) : 0;
  const avgTopSpeed = totalGames > 0 ? (stats.reduce((s, st) => Math.max(s, st.top_speed_kmh ?? 0), 0)) : 0;
  const totalKm = stats.reduce((s, st) => s + (st.distance_km ?? 0), 0);
  const totalSprints = stats.reduce((s, st) => s + (st.sprint_count ?? 0), 0);
  const totalGoals = stats.reduce((s, st) => s + (st.goals ?? 0), 0);
  const totalAssists = stats.reduce((s, st) => s + (st.assists ?? 0), 0);
  const avgPassAcc = totalGames > 0 ? stats.filter(st => st.pass_accuracy).reduce((s, st) => s + (st.pass_accuracy ?? 0), 0) / (stats.filter(st => st.pass_accuracy).length || 1) : 0;
  const avgRating = totalGames > 0 ? stats.filter(st => st.rating).reduce((s, st) => s + (st.rating ?? 0), 0) / (stats.filter(st => st.rating).length || 1) : 0;

  const heatmapGrids = stats
    .filter(s => s.heatmap_grid)
    .map(s => s.heatmap_grid as number[][]);
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

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <Link to="/players" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Zurück zum Kader
        </Link>

        {/* Header */}
        <div className="glass-card p-4 sm:p-6 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-primary/10 flex items-center justify-center text-2xl sm:text-3xl font-bold font-display text-primary shrink-0">
            {player.number ?? <User className="h-6 w-6 sm:h-8 sm:w-8" />}
          </div>
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <h1 className="text-xl sm:text-2xl font-bold font-display truncate">{player.name}</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              {player.position ? (POSITION_LABELS[player.position] || player.position) : "Keine Position"} {player.number ? `· #${player.number}` : ""}
            </p>
            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${player.active ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
              {player.active ? "Aktiv" : "Inaktiv"}
            </span>
          </div>
          <Button variant="heroOutline" size="sm" onClick={openEdit} className="w-full sm:w-auto">
            <Pencil className="h-4 w-4 mr-1" /> Bearbeiten
          </Button>
        </div>

        {/* Season stats */}
        <div>
          <h2 className="text-lg font-semibold font-display mb-3">Saisonübersicht</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: "Spiele", value: String(totalGames), icon: Trophy },
              { label: "Ø km/Spiel", value: avgKm > 0 ? avgKm.toFixed(1) : "—", icon: Route },
              { label: "Top Speed", value: avgTopSpeed > 0 ? `${avgTopSpeed.toFixed(1)}` : "—", icon: Zap },
              { label: "Sprints", value: String(totalSprints), icon: BarChart3 },
              { label: "Tore", value: String(totalGoals), icon: Trophy },
              { label: "Assists", value: String(totalAssists), icon: Route },
              { label: "Ø Passquote", value: avgPassAcc > 0 ? `${avgPassAcc.toFixed(0)}%` : "—", icon: BarChart3 },
              { label: "Ø Rating", value: avgRating > 0 ? avgRating.toFixed(1) : "—", icon: Zap },
            ].map((s) => (
              <div key={s.label} className="glass-card p-3">
                <s.icon className="h-3.5 w-3.5 text-primary mb-1.5" />
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
                <div className="text-lg font-bold font-display">{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent games table */}
        <div>
          <h2 className="text-lg font-semibold font-display mb-3">Letzte Spiele</h2>
          {recentStats.length > 0 ? (
            <div className="glass-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Datum</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Gegner</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">km</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Top km/h</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Sprints</th>
                  </tr>
                </thead>
                <tbody>
                  {recentStats.map((st: any) => (
                    <tr key={st.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4">
                        <Link to={`/matches/${st.match_id}`} className="hover:text-primary transition-colors">
                          {st.matches?.date ? new Date(st.matches.date).toLocaleDateString("de-DE") : "—"}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{st.matches?.away_club_name ?? "—"}</td>
                      <td className="py-3 px-4 font-semibold">{st.distance_km?.toFixed(1) ?? "—"}</td>
                      <td className="py-3 px-4">{st.top_speed_kmh?.toFixed(1) ?? "—"}</td>
                      <td className="py-3 px-4">{st.sprint_count ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="glass-card p-8 text-center">
              <BarChart3 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Statistiken werden nach dem ersten Tracking sichtbar.</p>
            </div>
          )}
        </div>

        {/* Trend Charts */}
        <PlayerCharts stats={stats} />

        {/* KI Analysis */}
        <PerformanceAnalysis type="player" playerId={id} playerName={player.name} />

        {/* Average Heatmap */}
        <div>
          <h2 className="text-lg font-semibold font-display mb-3">Durchschnitts-Heatmap</h2>
          {avgHeatmap ? (
            <HeatmapField grid={avgHeatmap} />
          ) : (
            <div className="glass-card p-8 text-center">
              <BarChart3 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Heatmap wird nach dem ersten Tracking verfügbar.</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
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
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
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
