import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SkeletonCard } from "@/components/SkeletonCard";
import { ConsentStatusBadge, getConsentHint } from "@/components/ConsentStatusBadge";
import { PlayerConsentFields } from "@/components/PlayerConsentFields";
import { useUpdatePlayerConsent } from "@/hooks/use-players";
import type { TrackingConsentStatus } from "@/lib/types";

interface AdminPlayerConsentRow {
  id: string;
  name: string;
  number: number | null;
  position: string | null;
  active: boolean;
  club_id: string;
  tracking_consent_status: TrackingConsentStatus;
  tracking_consent_notes: string | null;
  tracking_consent_updated_at: string | null;
  clubs?: { name: string } | null;
}

export default function AdminPlayerConsents() {
  const { isSuperAdmin } = useAuth();
  const updateConsent = useUpdatePlayerConsent();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TrackingConsentStatus | "all">("all");
  const [editingPlayer, setEditingPlayer] = useState<AdminPlayerConsentRow | null>(null);
  const [formStatus, setFormStatus] = useState<TrackingConsentStatus>("unknown");
  const [formNotes, setFormNotes] = useState("");

  const { data: players = [], isLoading } = useQuery({
    queryKey: ["admin_player_consents"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("player-consent-admin", {
        body: { action: "list" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data?.players ?? []) as AdminPlayerConsentRow[];
    },
  });

  const filteredPlayers = useMemo(() => players.filter((player) => {
    const term = search.toLowerCase();
    const matchesSearch = !search
      || player.name.toLowerCase().includes(term)
      || player.clubs?.name?.toLowerCase().includes(term)
      || player.tracking_consent_notes?.toLowerCase().includes(term);
    const matchesStatus = statusFilter === "all" || player.tracking_consent_status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [players, search, statusFilter]);

  const openEditor = (player: AdminPlayerConsentRow) => {
    setEditingPlayer(player);
    setFormStatus(player.tracking_consent_status ?? "unknown");
    setFormNotes(player.tracking_consent_notes ?? "");
  };

  const handleSave = async () => {
    if (!editingPlayer) return;
    await updateConsent.mutateAsync({
      playerId: editingPlayer.id,
      tracking_consent_status: formStatus,
      tracking_consent_notes: formNotes.trim() || null,
    });
    setEditingPlayer(null);
  };

  if (isLoading) return <SkeletonCard count={3} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold font-display">Spieler-Einwilligungen</h3>
          <p className="text-xs text-muted-foreground">Status, Hinweisfeld und offene Fälle zentral verwalten.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Spieler oder Verein suchen" className="pl-9 sm:w-64" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TrackingConsentStatus | "all")} className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground">
            <option value="all">Alle Status</option>
            <option value="unknown">Offen</option>
            <option value="granted">Liegt vor</option>
            <option value="denied">Abgelehnt</option>
          </select>
        </div>
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Spieler</th>
              {isSuperAdmin && <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Verein</th>}
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Einwilligung</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Hinweis</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Aktualisiert</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {filteredPlayers.map((player) => (
              <tr key={player.id} className="border-b border-border/50 align-top transition-colors hover:bg-muted/20">
                <td className="px-4 py-3">
                  <div className="font-medium">{player.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {player.number ? `#${player.number}` : "Ohne Nummer"}
                    {player.position ? ` · ${player.position}` : ""}
                    {!player.active ? " · inaktiv" : ""}
                  </div>
                </td>
                {isSuperAdmin && <td className="px-4 py-3 text-muted-foreground">{player.clubs?.name ?? "—"}</td>}
                <td className="px-4 py-3"><ConsentStatusBadge status={player.tracking_consent_status} compact /></td>
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-[320px]">{player.tracking_consent_notes?.trim() || getConsentHint(player.tracking_consent_status)}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{player.tracking_consent_updated_at ? new Date(player.tracking_consent_updated_at).toLocaleDateString("de-DE") : "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="outline" size="sm" onClick={() => openEditor(player)}>
                    <ShieldCheck className="mr-1 h-4 w-4" /> Verwalten
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredPlayers.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Keine passenden Spieler gefunden.</div>}
      </div>

      <Dialog open={!!editingPlayer} onOpenChange={(open) => !open && setEditingPlayer(null)}>
        <DialogContent className="border-border bg-card">
          <DialogHeader>
            <DialogTitle className="font-display">Einwilligung verwalten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editingPlayer && (
              <div>
                <p className="text-sm font-medium">{editingPlayer.name}</p>
                <p className="text-xs text-muted-foreground">{editingPlayer.clubs?.name ?? "Aktueller Verein"}</p>
              </div>
            )}
            <PlayerConsentFields status={formStatus} notes={formNotes} updatedAt={editingPlayer?.tracking_consent_updated_at} onStatusChange={setFormStatus} onNotesChange={setFormNotes} disabled={updateConsent.isPending} />
            <Button variant="hero" className="w-full" onClick={handleSave} disabled={updateConsent.isPending}>Einwilligung speichern</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
