// PlayerPortalInviteDialog — Trainer kann Spieler/Eltern per E-Mail einladen.
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Send, ShieldCheck, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface InviteRow { id: string; email: string; status: string; invited_at: string; accepted_at: string | null }

export default function PlayerPortalInviteDialog({
  playerId, playerName, open, onOpenChange,
}: { playerId: string; playerName: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [invites, setInvites] = useState<InviteRow[]>([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("player_portal_invites")
        .select("id, email, status, invited_at, accepted_at")
        .eq("player_id", playerId)
        .order("invited_at", { ascending: false });
      setInvites((data ?? []) as InviteRow[]);
    })();
  }, [open, playerId]);

  const send = async () => {
    if (!email.trim()) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("player-portal-invite", {
        body: { action: "create", player_id: playerId, email: email.trim() },
      });
      if (error) throw error;
      toast.success(`Einladung an ${email} gesendet (${data?.auth_method ?? "E-Mail"})`);
      if (data?.invite_warning) toast.warning(data.invite_warning);
      setEmail("");
      const { data: refreshed } = await supabase
        .from("player_portal_invites").select("id, email, status, invited_at, accepted_at")
        .eq("player_id", playerId).order("invited_at", { ascending: false });
      setInvites((refreshed ?? []) as InviteRow[]);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Einladen");
    } finally { setSending(false); }
  };

  const revoke = async (id: string) => {
    await supabase.from("player_portal_invites").update({ status: "revoked" }).eq("id", id);
    setInvites(prev => prev.map(i => i.id === id ? { ...i, status: "revoked" } : i));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> Spieler-Portal für {playerName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Lade Spieler oder Eltern ein. Sie erhalten eine E-Mail mit Magic-Link und können nur die persönlichen Stats von <span className="font-semibold">{playerName}</span> einsehen — kein Zugriff aufs Vereinssystem.
          </p>

          <div className="space-y-2">
            <Label htmlFor="invite-email">E-Mail-Adresse</Label>
            <div className="flex gap-2">
              <Input id="invite-email" type="email" placeholder="spieler@beispiel.de" value={email} onChange={e => setEmail(e.target.value)} />
              <Button onClick={send} disabled={sending || !email}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="mr-1 h-4 w-4" /> Einladen</>}
              </Button>
            </div>
          </div>

          {invites.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Bisherige Einladungen</p>
              <div className="space-y-1">
                {invites.map(inv => (
                  <div key={inv.id} className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5 text-xs">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1 truncate">{inv.email}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      inv.status === "accepted" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      : inv.status === "revoked" ? "bg-muted text-muted-foreground"
                      : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                    }`}>{inv.status}</span>
                    {inv.status !== "revoked" && (
                      <button onClick={() => revoke(inv.id)} className="rounded p-0.5 hover:bg-destructive/20" title="Widerrufen">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
