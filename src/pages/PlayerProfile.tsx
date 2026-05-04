import AppLayout from "@/components/AppLayout";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Activity, ArrowLeft, ArrowRight, Gauge, Goal, Pencil, Shield, Trophy, User, Users, Zap, Mail } from "lucide-react";
import { usePlayer, useUpdatePlayer, useUpdatePlayerConsent } from "@/hooks/use-players";
import { usePlayerAllStats } from "@/hooks/use-match-stats";
import { HeatmapField } from "@/components/HeatmapField";
import { PlayerCharts } from "@/components/PlayerCharts";
import { PerformanceAnalysis } from "@/components/PerformanceAnalysis";
import PlayerFormCurve from "@/components/PlayerFormCurve";
import { SkeletonCard } from "@/components/SkeletonCard";
import { POSITION_LABELS, POSITIONS } from "@/lib/constants";
import { mergeHeatmaps } from "@/lib/stats";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConsentStatusBadge, getConsentHint } from "@/components/ConsentStatusBadge";
import { PlayerConsentFields } from "@/components/PlayerConsentFields";
import { useAuth } from "@/components/AuthProvider";
import type { TrackingConsentStatus } from "@/lib/types";
import PlayerPortalInviteDialog from "@/components/PlayerPortalInviteDialog";
import ParentSubscribeDialog from "@/components/ParentSubscribeDialog";
import { Bell } from "lucide-react";

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export default function PlayerProfile() {
  const { id } = useParams();
  const { data: player, isLoading } = usePlayer(id);
  const { data: allStats } = usePlayerAllStats(id);
  const updatePlayer = useUpdatePlayer();
  const updatePlayerConsent = useUpdatePlayerConsent();
  const { isAdmin, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);
  const [parentOpen, setParentOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formNumber, setFormNumber] = useState("");
  const [formPosition, setFormPosition] = useState("");
  const [consentStatus, setConsentStatus] = useState<TrackingConsentStatus>("unknown");
  const [consentNotes, setConsentNotes] = useState("");

  if (isLoading) return <AppLayout><div className="mx-auto max-w-5xl"><SkeletonCard count={3} /></div></AppLayout>;
  if (!player) return <AppLayout><div className="mx-auto max-w-5xl py-20 text-center text-muted-foreground">Spieler nicht gefunden</div></AppLayout>;

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
  const avgPassAcc = totalGames > 0 ? stats.filter((st) => st.pass_accuracy).reduce((sum, st) => sum + (st.pass_accuracy ?? 0), 0) / (stats.filter((st) => st.pass_accuracy).length || 1) : 0;
  const avgRating = totalGames > 0 ? stats.filter((st) => st.rating).reduce((sum, st) => sum + (st.rating ?? 0), 0) / (stats.filter((st) => st.rating).length || 1) : 0;
  const totalDuelsWon = stats.reduce((sum, st) => sum + (st.duels_won ?? 0), 0);
  const totalDuels = stats.reduce((sum, st) => sum + (st.duels_total ?? 0), 0);
  const avgDuelRate = totalDuels > 0 ? (totalDuelsWon / totalDuels) * 100 : 0;

  const heatmapGrids = stats.filter((s) => s.heatmap_grid).map((s) => s.heatmap_grid as number[][]);
  const avgHeatmap = heatmapGrids.length > 0 ? mergeHeatmaps(heatmapGrids) : null;
  const recentStats = stats.slice(0, 10);
  const canManageConsent = isAdmin || isSuperAdmin;

  const openEdit = () => {
    setFormName(player.name);
    setFormNumber(player.number?.toString() ?? "");
    setFormPosition(player.position ?? "");
    setEditOpen(true);
  };

  const openConsent = () => {
    setConsentStatus(player.tracking_consent_status ?? "unknown");
    setConsentNotes(player.tracking_consent_notes ?? "");
    setConsentOpen(true);
  };

  const handleEdit = async () => {
    await updatePlayer.mutateAsync({ id: player.id, name: formName.trim(), number: formNumber ? parseInt(formNumber) : null, position: formPosition || null });
    setEditOpen(false);
  };

  const handleConsentSave = async () => {
    await updatePlayerConsent.mutateAsync({
      playerId: player.id,
      tracking_consent_status: consentStatus,
      tracking_consent_notes: consentNotes.trim() || null,
    });
    setConsentOpen(false);
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
      <div className="mx-auto max-w-5xl space-y-6">
        <Link to="/players" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Zurück zum Kader</Link>

        <div className="glass-card relative overflow-hidden p-5 sm:p-6">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-primary/10 via-accent/10 to-transparent pointer-events-none" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-3xl font-bold font-display text-primary">{player.number ?? <User className="h-8 w-8" />}</div>
            <div className="min-w-0 flex-1 space-y-2 text-center lg:text-left">
              <div>
                <h1 className="break-words text-2xl font-bold font-display sm:text-3xl">{player.name}</h1>
                <p className="text-sm text-muted-foreground sm:text-base">{player.position ? (POSITION_LABELS[player.position] || player.position) : "Keine Position"} {player.number ? `· #${player.number}` : ""}</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${player.active ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground"}`}>{player.active ? "Aktiv" : "Inaktiv"}</span>
                <ConsentStatusBadge status={player.tracking_consent_status} />
                <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">{round(totalKm, 1)} km Saisonleistung</span>
                <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">{totalSprints} Sprints</span>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-3 text-left">
                <p className="text-xs font-medium text-foreground">Hinweis zur Einwilligung</p>
                <p className="mt-1 text-xs text-muted-foreground">{player.tracking_consent_notes?.trim() || getConsentHint(player.tracking_consent_status)}</p>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 lg:w-auto">
              <Button variant="heroOutline" size="sm" onClick={() => navigate(`/players/compare?p1=${player.id}`)} className="w-full lg:w-auto"><Users className="mr-1 h-4 w-4" /> Vergleichen</Button>
              <Button variant="heroOutline" size="sm" onClick={openEdit} className="w-full lg:w-auto"><Pencil className="mr-1 h-4 w-4" /> Bearbeiten</Button>
              {canManageConsent && <Button variant="heroOutline" size="sm" onClick={openConsent} className="w-full lg:w-auto">Einwilligung pflegen</Button>}
              <Button variant="heroOutline" size="sm" onClick={() => setPortalOpen(true)} className="w-full lg:w-auto"><Mail className="mr-1 h-4 w-4" /> Portal-Einladung</Button>
              <Button variant="heroOutline" size="sm" onClick={() => setParentOpen(true)} className="w-full lg:w-auto"><Bell className="mr-1 h-4 w-4" /> Eltern-Push</Button>
              {recentStats[0]?.matches?.id && <Button variant="heroOutline" size="sm" asChild><Link to={`/matches/${recentStats[0].matches.id}`}>Letztes Spiel <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>}
            </div>
          </div>
        </div>

        <div className="space-y-3"><div><h2 className="text-lg font-semibold font-display">Saisonübersicht</h2><p className="text-sm text-muted-foreground">Komprimiertes Leistungsprofil mit direkten Wegen zu Match- und Detailanalysen.</p></div><div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{seasonStats.map((item) => <div key={item.label} className="glass-card relative space-y-3 overflow-hidden p-4"><div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" /><div className="relative flex items-center justify-between"><span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Season</span><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><item.icon className="h-4 w-4" /></div></div><div className="relative"><p className="text-xs text-muted-foreground">{item.label}</p><p className="text-xl font-bold font-display leading-tight break-words">{item.value}</p></div></div>)}</div></div>

        <div><h2 className="mb-3 text-lg font-semibold font-display">Letzte Spiele</h2>{recentStats.length > 0 ? <div className="glass-card overflow-x-auto"><table className="min-w-[860px] w-full text-sm"><thead><tr className="border-b border-border"><th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">Datum</th><th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">Gegner</th><th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">km</th><th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">Top</th><th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">Pässe</th><th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">Pass%</th><th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">Zwk%</th><th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">Ballgew.</th><th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">Tore</th><th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">Ass.</th><th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">Rating</th></tr></thead><tbody>{recentStats.map((st: any) => { const duelRate = st.duels_total ? Math.round(((st.duels_won ?? 0) / st.duels_total) * 100) : null; return <tr key={st.id} className="border-b border-border/50 transition-colors hover:bg-muted/20"><td className="px-3 py-3"><Link to={`/matches/${st.match_id}`} className="transition-colors hover:text-primary">{st.matches?.date ? new Date(st.matches.date).toLocaleDateString("de-DE") : "—"}</Link></td><td className="px-3 py-3 text-muted-foreground">{st.matches?.away_club_name ?? "—"}</td><td className="px-3 py-3 font-semibold">{st.distance_km?.toFixed(1) ?? "—"}</td><td className="px-3 py-3">{st.top_speed_kmh?.toFixed(1) ?? "—"}</td><td className="px-3 py-3">{st.passes_total ?? 0}</td><td className="px-3 py-3">{st.pass_accuracy ? `${Math.round(st.pass_accuracy)}%` : "—"}</td><td className="px-3 py-3">{duelRate !== null ? `${duelRate}%` : "—"}</td><td className="px-3 py-3">{st.ball_recoveries ?? 0}</td><td className="px-3 py-3 font-semibold">{st.goals ?? 0}</td><td className="px-3 py-3">{st.assists ?? 0}</td><td className="px-3 py-3">{st.rating ? st.rating.toFixed(1) : "—"}</td></tr>; })}</tbody></table></div> : <div className="glass-card p-8 text-center"><Activity className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" /><p className="text-sm text-muted-foreground">Statistiken werden nach dem ersten Tracking sichtbar.</p></div>}</div>

        <PlayerFormCurve data={recentStats.map((st: any) => ({
          date: st.matches?.date ?? "",
          opponent: st.matches?.away_club_name ?? "?",
          rating: st.rating,
          distance_km: st.distance_km,
          sprint_count: st.sprint_count,
        }))} />
        <PlayerCharts stats={stats as any[]} />
        <PerformanceAnalysis type="player" playerId={id} playerName={player.name} />

        <div><h2 className="mb-3 text-lg font-semibold font-display">Durchschnitts-Heatmap</h2>{avgHeatmap ? <HeatmapField grid={avgHeatmap} /> : <div className="glass-card p-8 text-center"><Activity className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" /><p className="text-sm text-muted-foreground">Heatmap wird nach dem ersten Tracking verfügbar.</p></div>}</div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent className="border-border bg-card"><DialogHeader><DialogTitle className="font-display">Spieler bearbeiten</DialogTitle></DialogHeader><div className="mt-2 space-y-4"><div><label className="mb-1 block text-sm text-muted-foreground">Name</label><input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full rounded-lg border border-border bg-muted px-3 py-2.5 text-sm text-foreground" /></div><div className="grid grid-cols-2 gap-4"><div><label className="mb-1 block text-sm text-muted-foreground">Nummer</label><input type="number" value={formNumber} onChange={(e) => setFormNumber(e.target.value)} className="w-full rounded-lg border border-border bg-muted px-3 py-2.5 text-sm text-foreground" /></div><div><label className="mb-1 block text-sm text-muted-foreground">Position</label><select value={formPosition} onChange={(e) => setFormPosition(e.target.value)} className="w-full rounded-lg border border-border bg-muted px-3 py-2.5 text-sm text-foreground"><option value="">Keine</option>{POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}</select></div></div><Button variant="hero" className="w-full" onClick={handleEdit} disabled={!formName.trim()}>Speichern</Button></div></DialogContent></Dialog>
      <Dialog open={consentOpen} onOpenChange={setConsentOpen}><DialogContent className="border-border bg-card"><DialogHeader><DialogTitle className="font-display">Einwilligung pflegen</DialogTitle></DialogHeader><div className="space-y-4"><PlayerConsentFields status={consentStatus} notes={consentNotes} updatedAt={player.tracking_consent_updated_at} onStatusChange={setConsentStatus} onNotesChange={setConsentNotes} disabled={updatePlayerConsent.isPending} /><Button variant="hero" className="w-full" onClick={handleConsentSave} disabled={updatePlayerConsent.isPending}>Einwilligung speichern</Button></div></DialogContent></Dialog>
      <PlayerPortalInviteDialog playerId={player.id} playerName={player.name} open={portalOpen} onOpenChange={setPortalOpen} />
      <ParentSubscribeDialog playerId={player.id} clubId={player.club_id} playerName={player.name} open={parentOpen} onOpenChange={setParentOpen} />
    </AppLayout>
  );
}
