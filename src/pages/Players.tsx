import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Plus, Users, Search, Pencil, Trash2, UserCheck, UserX, Camera, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { usePlayers, useCreatePlayer, useUpdatePlayer, useDeletePlayer, useUpdatePlayerConsent } from "@/hooks/use-players";
import { POSITIONS, POSITION_LABELS } from "@/lib/constants";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SkeletonTable } from "@/components/SkeletonCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RosterImportDialog } from "@/components/RosterImportDialog";
import { useTranslation } from "@/lib/i18n";
import { toast } from "sonner";
import { ConsentStatusBadge, getConsentHint } from "@/components/ConsentStatusBadge";
import { PlayerConsentFields } from "@/components/PlayerConsentFields";
import { useAuth } from "@/components/AuthProvider";
import type { TrackingConsentStatus } from "@/lib/types";

export default function Players() {
  const { data: players, isLoading } = usePlayers();
  const createPlayer = useCreatePlayer();
  const updatePlayer = useUpdatePlayer();
  const updatePlayerConsent = useUpdatePlayerConsent();
  const deletePlayer = useDeletePlayer();
  const { t } = useTranslation();
  const { isAdmin, isSuperAdmin } = useAuth();

  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
  const [filterPosition, setFilterPosition] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "number">("name");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentPlayer, setConsentPlayer] = useState<any>(null);

  const [formName, setFormName] = useState("");
  const [formNumber, setFormNumber] = useState("");
  const [formPosition, setFormPosition] = useState("");
  const [consentStatus, setConsentStatus] = useState<TrackingConsentStatus>("unknown");
  const [consentNotes, setConsentNotes] = useState("");

  const canManageConsent = isAdmin || isSuperAdmin;

  const filtered = (players ?? [])
    .filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterActive === "active" && !p.active) return false;
      if (filterActive === "inactive" && p.active) return false;
      if (filterPosition !== "all" && p.position !== filterPosition) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "number") return (a.number ?? 999) - (b.number ?? 999);
      return a.name.localeCompare(b.name);
    });

  const openCreate = () => { setEditingPlayer(null); setFormName(""); setFormNumber(""); setFormPosition(""); setDialogOpen(true); };
  const openEdit = (player: any) => { setEditingPlayer(player); setFormName(player.name); setFormNumber(player.number?.toString() ?? ""); setFormPosition(player.position ?? ""); setDialogOpen(true); };
  const openConsentDialog = (player: any) => {
    setConsentPlayer(player);
    setConsentStatus(player.tracking_consent_status ?? "unknown");
    setConsentNotes(player.tracking_consent_notes ?? "");
    setConsentOpen(true);
  };

  const handleSubmit = async () => {
    const data = { name: formName.trim(), number: formNumber ? parseInt(formNumber) : null, position: formPosition || null };
    if (!data.name) return;
    if (editingPlayer) { await updatePlayer.mutateAsync({ id: editingPlayer.id, ...data }); } else { await createPlayer.mutateAsync(data); }
    setDialogOpen(false);
  };

  const handleConsentSubmit = async () => {
    if (!consentPlayer) return;
    await updatePlayerConsent.mutateAsync({
      playerId: consentPlayer.id,
      tracking_consent_status: consentStatus,
      tracking_consent_notes: consentNotes.trim() || null,
    });
    setConsentOpen(false);
  };

  const handleDelete = async () => { if (deleteId) { await deletePlayer.mutateAsync(deleteId); setDeleteId(null); } };
  const toggleActive = (player: any) => { updatePlayer.mutate({ id: player.id, active: !player.active }); };

  const handleBulkImport = async (importPlayers: { name: string; number: number | null; position: string | null }[]) => {
    let success = 0;
    let failed = 0;
    for (const p of importPlayers) {
      try {
        await createPlayer.mutateAsync(p);
        success++;
      } catch {
        failed++;
      }
    }
    if (failed > 0) {
      toast.warning(`${success} von ${success + failed} Spielern importiert — ${failed} fehlgeschlagen`);
    } else {
      toast.success(`${success} Spieler importiert`);
    }
  };

  const existingNumbers = (players ?? []).map((p) => p.number).filter((n): n is number => n !== null);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold font-display">{t("players.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("players.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="heroOutline" size="sm" onClick={() => setImportOpen(true)}><Camera className="h-4 w-4 mr-1" /> Foto-Import</Button>
            <Button variant="hero" size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> {t("players.add")}</Button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder={t("players.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select value={filterActive} onChange={(e) => setFilterActive(e.target.value as any)} className="px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm truncate"><option value="all">{t("players.allStatus")}</option><option value="active">{t("common.active")}</option><option value="inactive">{t("common.inactive")}</option></select>
            <select value={filterPosition} onChange={(e) => setFilterPosition(e.target.value)} className="px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm truncate"><option value="all">{t("players.allPositions")}</option>{POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}</select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm truncate"><option value="name">{t("players.byName")}</option><option value="number">{t("players.byNumber")}</option></select>
          </div>
        </div>

        {isLoading ? <SkeletonTable rows={5} cols={6} /> : filtered.length === 0 && !search ? (
          <div className="glass-card p-8 space-y-6">
            <div className="text-center space-y-2">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <h2 className="text-xl font-bold font-display">Wie möchtest du starten?</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Du kannst deinen Kader jetzt anlegen — oder die KI erkennt Spieler automatisch beim Tracking.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {/* Option 1: Manual */}
              <button
                onClick={openCreate}
                className="group relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border bg-card hover:border-primary hover:shadow-lg transition-all text-center"
              >
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Manuell anlegen</p>
                  <p className="text-xs text-muted-foreground mt-1">Spieler einzeln mit Name, Nummer & Position hinzufügen</p>
                </div>
              </button>

              {/* Option 2: Photo Import */}
              <button
                onClick={() => setImportOpen(true)}
                className="group relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border bg-card hover:border-primary hover:shadow-lg transition-all text-center"
              >
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Camera className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Foto-Import</p>
                  <p className="text-xs text-muted-foreground mt-1">Spielerliste fotografieren — KI liest Namen & Nummern aus</p>
                </div>
              </button>

              {/* Option 3: AI Auto-Detect */}
              <Link
                to="/matches/new"
                className="group relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:border-primary hover:shadow-lg transition-all text-center"
              >
                <span className="absolute -top-2.5 right-3 text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">EMPFOHLEN</span>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Überspringen</p>
                  <p className="text-xs text-muted-foreground mt-1">Direkt Spiel anlegen — KI erkennt Spieler & Teams automatisch</p>
                </div>
              </Link>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              💡 Du kannst Spieler jederzeit nachträglich anlegen oder KI-erkannte Spieler deinem Kader zuordnen.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Users className="h-10 w-10" />} title={t("players.noPlayers")} description={t("players.noResults")} />
        ) : (
          <div className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">{t("common.name")}</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">#</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs hidden sm:table-cell">{t("players.position")}</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Einwilligung</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs hidden lg:table-cell">Hinweis</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium text-xs">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((player) => (
                  <tr key={player.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4"><Link to={`/players/${player.id}`} className="font-medium hover:text-primary transition-colors">{player.name}</Link></td>
                    <td className="py-3 px-4 text-muted-foreground">{player.number ?? "—"}</td>
                    <td className="py-3 px-4 text-muted-foreground hidden sm:table-cell">{player.position ? POSITION_LABELS[player.position] || player.position : "—"}</td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <ConsentStatusBadge status={player.tracking_consent_status} compact />
                        <p className="text-[11px] text-muted-foreground">{getConsentHint(player.tracking_consent_status)}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground hidden lg:table-cell max-w-[260px]">{player.tracking_consent_notes?.trim() || "—"}</td>
                    <td className="py-3 px-4 text-right"><div className="flex items-center justify-end gap-1"><button onClick={() => toggleActive(player)} className="p-1.5 rounded hover:bg-muted transition-colors" title={player.active ? t("players.deactivate") : t("players.activate")}>{player.active ? <UserX className="h-4 w-4 text-muted-foreground" /> : <UserCheck className="h-4 w-4 text-primary" />}</button>{canManageConsent && <button onClick={() => openConsentDialog(player)} className="p-1.5 rounded hover:bg-muted transition-colors" title="Einwilligung verwalten"><ShieldCheck className="h-4 w-4 text-primary" /></button>}<button onClick={() => openEdit(player)} className="p-1.5 rounded hover:bg-muted transition-colors"><Pencil className="h-4 w-4 text-muted-foreground" /></button><button onClick={() => setDeleteId(player.id)} className="p-1.5 rounded hover:bg-destructive/10 transition-colors"><Trash2 className="h-4 w-4 text-destructive/70" /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="bg-card border-border"><DialogHeader><DialogTitle className="font-display">{editingPlayer ? t("players.editPlayer") : t("players.addPlayer")}</DialogTitle></DialogHeader><div className="space-y-4 mt-2"><div><label className="text-sm text-muted-foreground block mb-1">{t("common.name")} *</label><input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Max Müller" className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground" /></div><div className="grid grid-cols-2 gap-4"><div><label className="text-sm text-muted-foreground block mb-1">{t("players.number")}</label><input type="number" value={formNumber} onChange={(e) => setFormNumber(e.target.value)} placeholder="10" className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground" /></div><div><label className="text-sm text-muted-foreground block mb-1">{t("players.position")}</label><select value={formPosition} onChange={(e) => setFormPosition(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm"><option value="">{t("common.none")}</option>{POSITIONS.map((p) => <option key={p} value={p}>{p} — {POSITION_LABELS[p]}</option>)}</select></div></div><Button variant="hero" className="w-full" onClick={handleSubmit} disabled={!formName.trim() || createPlayer.isPending || updatePlayer.isPending}>{editingPlayer ? t("common.save") : t("common.add")}</Button></div></DialogContent></Dialog>

      <Dialog open={consentOpen} onOpenChange={setConsentOpen}><DialogContent className="bg-card border-border"><DialogHeader><DialogTitle className="font-display">Einwilligung verwalten</DialogTitle></DialogHeader><div className="space-y-4">{consentPlayer && <div><p className="text-sm font-medium">{consentPlayer.name}</p><p className="text-xs text-muted-foreground">{consentPlayer.number ? `#${consentPlayer.number}` : "Ohne Nummer"}</p></div>}<PlayerConsentFields status={consentStatus} notes={consentNotes} updatedAt={consentPlayer?.tracking_consent_updated_at} onStatusChange={setConsentStatus} onNotesChange={setConsentNotes} disabled={updatePlayerConsent.isPending} /><Button variant="hero" className="w-full" onClick={handleConsentSubmit} disabled={updatePlayerConsent.isPending}>Einwilligung speichern</Button></div></DialogContent></Dialog>

      <ConfirmDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)} title={t("players.deleteTitle")} description={t("players.deleteDesc")} confirmLabel={t("common.delete")} onConfirm={handleDelete} destructive />
      <RosterImportDialog open={importOpen} onOpenChange={setImportOpen} existingNumbers={existingNumbers} onImport={handleBulkImport} />
    </AppLayout>
  );
}
