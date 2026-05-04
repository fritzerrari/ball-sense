import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";
import { Inbox, CheckCircle2, X, RefreshCw, AlertTriangle, ThumbsUp, Brain, Activity, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

type InboxItem = {
  id: string;
  category: string;
  title: string;
  body: string;
  priority: number;
  status: string;
  action_url: string | null;
  match_id: string | null;
  player_id: string | null;
  created_at: string;
};

const categoryIcon: Record<string, any> = {
  praise: ThumbsUp,
  warning: AlertTriangle,
  tactic: Brain,
  fitness: Activity,
  development: Sparkles,
  admin: Inbox,
};

const categoryColor: Record<string, string> = {
  praise: "text-emerald-500",
  warning: "text-amber-500",
  tactic: "text-blue-500",
  fitness: "text-rose-500",
  development: "text-purple-500",
  admin: "text-muted-foreground",
};

export default function CoachInbox() {
  const { user } = useAuth();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState<"new" | "all" | "done">("new");

  const load = async () => {
    setLoading(true);
    let q = supabase.from("coach_inbox_items").select("*").order("priority").order("created_at", { ascending: false }).limit(100);
    if (filter === "new") q = q.in("status", ["new", "read"]);
    if (filter === "done") q = q.eq("status", "done");
    const { data } = await q;
    setItems((data as InboxItem[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("coach_inbox_items").update({ status }).eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id || filter === "all"));
    toast.success(status === "done" ? "Erledigt" : status === "dismissed" ? "Verworfen" : "Aktualisiert");
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke("coach-inbox-generate", { body: {} });
      if (error) throw error;
      toast.success("Neue Empfehlungen generiert");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler bei der Generierung");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto max-w-4xl space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">Coach-KI-Inbox</h1>
            <p className="text-sm text-muted-foreground">Personalisierte Empfehlungen aus deinen Spielanalysen</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="mr-2 h-4 w-4" /> Neu laden
            </Button>
            <Button size="sm" onClick={generate} disabled={generating}>
              <Sparkles className="mr-2 h-4 w-4" />
              {generating ? "Analysiere..." : "Neue Insights"}
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          {(["new", "all", "done"] as const).map(f => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
              {f === "new" ? "Offen" : f === "all" ? "Alle" : "Erledigt"}
            </Button>
          ))}
        </div>

        {loading ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">Lade...</Card>
        ) : items.length === 0 ? (
          <Card className="p-8 text-center">
            <Inbox className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Keine Items. Klicke auf "Neue Insights", um KI-Empfehlungen zu generieren.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map(item => {
              const Icon = categoryIcon[item.category] ?? Inbox;
              return (
                <Card key={item.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`rounded-lg bg-muted p-2 ${categoryColor[item.category]}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold">{item.title}</h3>
                        {item.priority === 1 && <Badge variant="destructive" className="text-xs">Hoch</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{item.body}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {item.action_url && (
                          <Button variant="outline" size="sm" asChild>
                            <Link to={item.action_url}>Öffnen</Link>
                          </Button>
                        )}
                        {item.status !== "done" && (
                          <Button variant="ghost" size="sm" onClick={() => updateStatus(item.id, "done")}>
                            <CheckCircle2 className="mr-1 h-4 w-4" /> Erledigt
                          </Button>
                        )}
                        {item.status !== "dismissed" && (
                          <Button variant="ghost" size="sm" onClick={() => updateStatus(item.id, "dismissed")}>
                            <X className="mr-1 h-4 w-4" /> Verwerfen
                          </Button>
                        )}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString("de-DE")}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
