import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Plus, Users, Search, Pencil, Trash2, UserCheck, UserX } from "lucide-react";
import { useState } from "react";
import { usePlayers, useCreatePlayer, useUpdatePlayer, useDeletePlayer } from "@/hooks/use-players";
import { POSITIONS, POSITION_LABELS } from "@/lib/constants";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SkeletonTable } from "@/components/SkeletonCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Players() {
  const { data: players, isLoading } = usePlayers();
  const createPlayer = useCreatePlayer();
  const updatePlayer = useUpdatePlayer();
  const deletePlayer = useDeletePlayer();

  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
  const [filterPosition, setFilterPosition] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "number">("name");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formNumber, setFormNumber] = useState("");
  const [formPosition, setFormPosition] = useState("");

  const filtered = (players ?? [])
    .filter(p => {
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

  const openCreate = () => {
    setEditingPlayer(null);
    setFormName("");
    setFormNumber("");
    setFormPosition("");
    setDialogOpen(true);
  };

  const openEdit = (player: any) => {
    setEditingPlayer(player);
    setFormName(player.name);
    setFormNumber(player.number?.toString() ?? "");
    setFormPosition(player.position ?? "");
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const data = {
      name: formName.trim(),
      number: formNumber ? parseInt(formNumber) : null,
      position: formPosition || null,
    };
    if (!data.name) return;

    if (editingPlayer) {
      await updatePlayer.mutateAsync({ id: editingPlayer.id, ...data });
    } else {
      await createPlayer.mutateAsync(data);
    }
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deletePlayer.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const toggleActive = (player: any) => {
    updatePlayer.mutate({ id: player.id, active: !player.active });
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display">Kader</h1>
            <p className="text-sm text-muted-foreground mt-1">Verwalte deine Spieler und den Kader.</p>
          </div>
          <Button variant="hero" size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Spieler hinzufügen
          </Button>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Spieler suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground"
            />
          </div>
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value as any)}
            className="px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm"
          >
            <option value="all">Alle Status</option>
            <option value="active">Aktiv</option>
            <option value="inactive">Inaktiv</option>
          </select>
          <select
            value={filterPosition}
            onChange={(e) => setFilterPosition(e.target.value)}
            className="px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm"
          >
            <option value="all">Alle Positionen</option>
            {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm"
          >
            <option value="name">Nach Name</option>
            <option value="number">Nach Nummer</option>
          </select>
        </div>

        {isLoading ? (
          <SkeletonTable rows={5} cols={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Users className="h-10 w-10" />}
            title="Noch keine Spieler im Kader"
            description={search ? "Kein Spieler gefunden." : "Füge deinen ersten Spieler hinzu."}
            action={!search && <Button variant="heroOutline" onClick={openCreate}>Spieler hinzufügen</Button>}
          />
        ) : (
          <div className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Name</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">#</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs hidden sm:table-cell">Position</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Status</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium text-xs">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((player) => (
                  <tr key={player.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4">
                      <Link to={`/players/${player.id}`} className="font-medium hover:text-primary transition-colors">
                        {player.name}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{player.number ?? "—"}</td>
                    <td className="py-3 px-4 text-muted-foreground hidden sm:table-cell">
                      {player.position ? POSITION_LABELS[player.position] || player.position : "—"}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        player.active ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"
                      }`}>
                        {player.active ? "Aktiv" : "Inaktiv"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => toggleActive(player)} className="p-1.5 rounded hover:bg-muted transition-colors" title={player.active ? "Deaktivieren" : "Aktivieren"}>
                          {player.active ? <UserX className="h-4 w-4 text-muted-foreground" /> : <UserCheck className="h-4 w-4 text-primary" />}
                        </button>
                        <button onClick={() => openEdit(player)} className="p-1.5 rounded hover:bg-muted transition-colors">
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button onClick={() => setDeleteId(player.id)} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
                          <Trash2 className="h-4 w-4 text-destructive/70" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">{editingPlayer ? "Spieler bearbeiten" : "Spieler hinzufügen"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Name *</label>
              <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Max Müller" className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Nummer</label>
                <input type="number" value={formNumber} onChange={(e) => setFormNumber(e.target.value)} placeholder="10" className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Position</label>
                <select value={formPosition} onChange={(e) => setFormPosition(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm">
                  <option value="">Keine</option>
                  {POSITIONS.map(p => <option key={p} value={p}>{p} — {POSITION_LABELS[p]}</option>)}
                </select>
              </div>
            </div>
            <Button variant="hero" className="w-full" onClick={handleSubmit} disabled={!formName.trim() || createPlayer.isPending || updatePlayer.isPending}>
              {editingPlayer ? "Speichern" : "Hinzufügen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Spieler löschen"
        description="Möchtest du diesen Spieler wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
        confirmLabel="Löschen"
        onConfirm={handleDelete}
        destructive
      />
    </AppLayout>
  );
}
