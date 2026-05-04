import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, Clock, Coins, Send, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Health {
  crons?: Array<{ name: string; schedule: string; active: boolean }>;
  stuck_jobs?: number;
  ai_burn_24h?: { calls: number; tokens: number; avg_ms: number };
  parent_notif_24h?: { sent: number; failed: number; expired: number };
  matches_by_status?: Record<string, number>;
  generated_at?: string;
  error?: string;
}

export default function AdminHealth() {
  const [data, setData] = useState<Health | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: res } = await supabase.rpc("get_system_health" as any);
    setData(res as Health);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (data?.error) {
    return <div className="glass-card p-6 text-sm text-destructive">Zugriff verweigert (Superadmin erforderlich).</div>;
  }

  const stuck = data?.stuck_jobs ?? 0;
  const burn = data?.ai_burn_24h;
  const push = data?.parent_notif_24h;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">System-Gesundheit</h3>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Neu laden
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-2 text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" /> Hängende Jobs</CardTitle></CardHeader>
          <CardContent><div className={`text-2xl font-bold ${stuck > 0 ? "text-destructive" : "text-emerald-500"}`}>{stuck}</div><div className="text-[10px] text-muted-foreground">&gt;30 min stuck</div></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-2 text-muted-foreground"><Coins className="h-3.5 w-3.5" /> KI-Burn 24h</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{burn?.tokens?.toLocaleString("de-DE") ?? 0}</div><div className="text-[10px] text-muted-foreground">{burn?.calls ?? 0} Calls · ø {burn?.avg_ms ?? 0}ms</div></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-2 text-muted-foreground"><Send className="h-3.5 w-3.5" /> Eltern-Push 24h</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-emerald-500">{push?.sent ?? 0}</div><div className="text-[10px] text-muted-foreground">{push?.failed ?? 0} failed · {push?.expired ?? 0} expired</div></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-2 text-muted-foreground"><Activity className="h-3.5 w-3.5" /> Match-Status</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {Object.entries(data?.matches_by_status ?? {}).map(([k, v]) => (
                <Badge key={k} variant="secondary" className="text-[10px]">{k}: {v}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Geplante Cron-Jobs</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border"><th className="text-left py-2 text-muted-foreground">Name</th><th className="text-left text-muted-foreground">Schedule</th><th className="text-left text-muted-foreground">Status</th></tr></thead>
            <tbody>
              {data?.crons?.map((c) => (
                <tr key={c.name} className="border-b border-border/30">
                  <td className="py-2 font-mono">{c.name}</td>
                  <td className="font-mono text-muted-foreground">{c.schedule}</td>
                  <td><Badge variant={c.active ? "default" : "secondary"} className="text-[10px]">{c.active ? "aktiv" : "pausiert"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {data?.generated_at && <p className="text-[10px] text-muted-foreground text-right">Aktualisiert: {new Date(data.generated_at).toLocaleString("de-DE")}</p>}
    </div>
  );
}
