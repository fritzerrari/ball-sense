import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  playerId: string;
  clubId: string;
  playerName: string;
};

export default function ParentSubscribeDialog({ open, onOpenChange, playerId, clubId, playerName }: Props) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !email.includes("@")) {
      toast.error("Bitte gültige E-Mail eingeben");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("parent_subscriptions").insert({
        player_id: playerId,
        club_id: clubId,
        parent_email: email.toLowerCase().trim(),
        parent_name: name.trim() || null,
      });
      if (error) {
        if (error.code === "23505") {
          toast.info("Diese E-Mail ist bereits angemeldet");
        } else {
          throw error;
        }
      } else {
        toast.success("Eltern-Benachrichtigung aktiviert");
      }
      setEmail("");
      setName("");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler beim Anmelden");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" /> Eltern-Benachrichtigung
          </DialogTitle>
          <DialogDescription>
            Eltern von <strong>{playerName}</strong> erhalten nach jedem Spiel eine Benachrichtigung mit Endstand, Toren und Highlights.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="p-name">Name (optional)</Label>
            <Input id="p-name" value={name} onChange={e => setName(e.target.value)} placeholder="Vorname Elternteil" />
          </div>
          <div>
            <Label htmlFor="p-email">E-Mail *</Label>
            <Input id="p-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="eltern@email.de" />
          </div>
          <p className="text-xs text-muted-foreground">
            Verwaltung & Abmeldung jederzeit über Link in der ersten Nachricht.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Abbrechen</Button>
            <Button onClick={handleSubmit} disabled={loading || !email}>
              {loading ? "Speichere..." : "Anmelden"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
