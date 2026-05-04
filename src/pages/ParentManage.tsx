import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { subscribeForPush, unsubscribePush } from "@/lib/web-push-client";
import { toast } from "sonner";
import { Bell, BellOff, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface Sub {
  id: string;
  player_id: string;
  parent_email: string;
  parent_name: string | null;
  notify_on: { matches?: boolean; goals?: boolean; achievements?: boolean };
  active: boolean;
  has_push: boolean;
  player_name: string;
  club_name: string;
}

export default function ParentManage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [sub, setSub] = useState<Sub | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    (async () => {
      if (!token) { setLoading(false); return; }
      const { data, error } = await supabase.rpc("get_parent_subscription_by_token", { _token: token });
      if (!error && data && data.length > 0) {
        const s = data[0] as Sub;
        setSub(s);
        setName(s.parent_name ?? "");
      }
      setLoading(false);
    })();
  }, [token]);

  const update = async (patch: Partial<{ notify_on: any; active: boolean; parent_name: string; push_endpoint: string | null; push_p256dh: string | null; push_auth: string | null }>) => {
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("update_parent_subscription_by_token", {
        _token: token,
        _push_endpoint: (patch as any).push_endpoint ?? null,
        _push_p256dh: (patch as any).push_p256dh ?? null,
        _push_auth: (patch as any).push_auth ?? null,
        _notify_on: patch.notify_on ?? null,
        _active: patch.active ?? null,
        _parent_name: patch.parent_name ?? null,
      });
      if (error || data === false) throw error ?? new Error("Token ungültig");
      const { data: fresh } = await supabase.rpc("get_parent_subscription_by_token", { _token: token });
      if (fresh && fresh.length > 0) setSub(fresh[0] as Sub);
      toast.success("Gespeichert");
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler");
    } finally {
      setSaving(false);
    }
  };

  const enablePush = async () => {
    setSaving(true);
    try {
      const keys = await subscribeForPush();
      await update({ push_endpoint: keys.endpoint, push_p256dh: keys.p256dh, push_auth: keys.auth, active: true });
    } catch (e: any) {
      toast.error(e?.message ?? "Push-Aktivierung fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const disablePush = async () => {
    await unsubscribePush();
    await update({ push_endpoint: null as any, push_p256dh: null as any, push_auth: null as any });
  };

  const unsubscribe = async () => {
    if (!confirm("Wirklich alle Benachrichtigungen abbestellen?")) return;
    await unsubscribePush();
    await update({ active: false });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!sub) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md p-8 text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-destructive" />
          <h1 className="font-display text-xl font-bold">Link ungültig</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Dieser Verwaltungs-Link ist nicht (mehr) gültig. Bitte über den Verein eine neue Anmeldung anfordern.
          </p>
        </Card>
      </div>
    );
  }

  const notify = sub.notify_on || {};

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-xl space-y-5">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold">Eltern-Benachrichtigungen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Spieler: <strong>{sub.player_name}</strong> · {sub.club_name}
          </p>
          <Badge className="mt-2" variant={sub.active ? "default" : "secondary"}>
            {sub.active ? "Aktiv" : "Pausiert"}
          </Badge>
        </div>

        <Card className="p-5 space-y-4">
          <div>
            <Label htmlFor="name">Dein Name (optional)</Label>
            <div className="flex gap-2 mt-1">
              <Input id="name" value={name} onChange={e => setName(e.target.value)} />
              <Button variant="outline" onClick={() => update({ parent_name: name })} disabled={saving}>Speichern</Button>
            </div>
          </div>
          <div>
            <Label>E-Mail</Label>
            <p className="mt-1 text-sm text-muted-foreground">{sub.parent_email}</p>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4" /> Push-Benachrichtigungen
          </h2>
          {sub.has_push ? (
            <>
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> Auf diesem Gerät aktiviert
              </div>
              <Button variant="outline" onClick={disablePush} disabled={saving}>
                <BellOff className="mr-2 h-4 w-4" /> Push deaktivieren
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Aktiviere Push, um sofort nach dem Spiel eine Benachrichtigung mit Endstand und Toren zu erhalten.
              </p>
              <Button onClick={enablePush} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
                Push aktivieren
              </Button>
            </>
          )}
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">Was du erhalten möchtest</h2>
          <div className="flex items-center justify-between">
            <Label htmlFor="n-matches">Spiel-Endstände</Label>
            <Switch id="n-matches" checked={notify.matches !== false}
              onCheckedChange={(v) => update({ notify_on: { ...notify, matches: v } })} disabled={saving} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="n-goals">Tor-Benachrichtigungen</Label>
            <Switch id="n-goals" checked={notify.goals !== false}
              onCheckedChange={(v) => update({ notify_on: { ...notify, goals: v } })} disabled={saving} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="n-ach">Auszeichnungen & Bestleistungen</Label>
            <Switch id="n-ach" checked={notify.achievements !== false}
              onCheckedChange={(v) => update({ notify_on: { ...notify, achievements: v } })} disabled={saving} />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-destructive mb-2">Komplett abbestellen</h2>
          <p className="text-xs text-muted-foreground mb-3">Du erhältst keine Nachrichten mehr. Eine erneute Anmeldung ist nur über den Verein möglich.</p>
          <Button variant="destructive" onClick={unsubscribe} disabled={saving}>Abbestellen</Button>
        </Card>
      </div>
    </div>
  );
}
