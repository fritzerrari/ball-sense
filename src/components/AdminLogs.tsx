import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SkeletonCard } from "@/components/SkeletonCard";
import { Search, Trash2, Eraser, Filter, Clock, User, Zap } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  role_assigned: { label: "Rolle zugewiesen", color: "bg-blue-500/20 text-blue-400" },
  role_removed: { label: "Rolle entfernt", color: "bg-yellow-500/20 text-yellow-400" },
  user_banned: { label: "Nutzer gesperrt", color: "bg-destructive/20 text-destructive" },
  user_unbanned: { label: "Nutzer entsperrt", color: "bg-emerald-500/20 text-emerald-400" },
  user_deleted: { label: "Nutzer gelöscht", color: "bg-destructive/20 text-destructive" },
  plan_changed: { label: "Plan geändert", color: "bg-purple-500/20 text-purple-400" },
  legal_doc_created: { label: "Dokument erstellt", color: "bg-emerald-500/20 text-emerald-400" },
  legal_doc_updated: { label: "Dokument bearbeitet", color: "bg-blue-500/20 text-blue-400" },
  legal_doc_deleted: { label: "Dokument gelöscht", color: "bg-destructive/20 text-destructive" },
  upload_status_changed: { label: "Upload-Status geändert", color: "bg-blue-500/20 text-blue-400" },
};

export default function AdminLogs() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [clearAll, setClearAll] = useState(false);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["admin_audit_logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      return data ?? [];
    },
  });

  const deleteLog = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("audit_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_audit_logs"] });
      setDeleteId(null);
      toast.success("Eintrag gelöscht");
    },
  });

  const clearLogs = useMutation({
    mutationFn: async () => {
      // Delete all logs by fetching IDs and deleting
      const ids = logs.map((l: any) => l.id);
      if (ids.length === 0) return;
      const { error } = await supabase.from("audit_logs").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_audit_logs"] });
      setClearAll(false);
      toast.success("Alle Protokolle gelöscht");
    },
  });

  let filtered = logs as any[];
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter((l) =>
      l.user_email?.toLowerCase().includes(s) ||
      l.action?.toLowerCase().includes(s) ||
      l.entity_id?.toLowerCase().includes(s)
    );
  }
  if (actionFilter !== "all") {
    filtered = filtered.filter((l) => l.action === actionFilter);
  }

  const uniqueActions = [...new Set(logs.map((l: any) => l.action))];

  if (isLoading) return <SkeletonCard count={4} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1">
          <div className="relative flex-1 w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="E-Mail, Aktion oder ID suchen..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="h-9 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Aktionen</SelectItem>
                {uniqueActions.map((a) => (
                  <SelectItem key={a} value={a}>{ACTION_LABELS[a]?.label ?? a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button variant="outline" size="sm" className="text-destructive" onClick={() => setClearAll(true)} disabled={logs.length === 0}>
          <Eraser className="h-4 w-4 mr-1" /> Alle löschen
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">{filtered.length} Einträge</div>

      <div className="space-y-2">
        {filtered.map((log: any) => {
          const meta = ACTION_LABELS[log.action] ?? { label: log.action, color: "bg-muted text-muted-foreground" };
          return (
            <div key={log.id} className="glass-card p-3 flex items-start gap-3 group">
              <div className="mt-0.5">
                <Zap className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-[10px] ${meta.color} border-0`}>{meta.label}</Badge>
                  {log.entity_type && (
                    <span className="text-[10px] text-muted-foreground font-mono">{log.entity_type}/{log.entity_id?.slice(0, 8)}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" /> {log.user_email ?? "System"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {format(new Date(log.created_at), "dd.MM.yy HH:mm:ss", { locale: de })}
                  </span>
                </div>
                {log.details && Object.keys(log.details).length > 0 && (
                  <div className="text-[10px] font-mono text-muted-foreground bg-muted/50 rounded px-2 py-1 mt-1">
                    {JSON.stringify(log.details)}
                  </div>
                )}
              </div>
              <Button
                variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                onClick={() => setDeleteId(log.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="glass-card p-8 text-center text-muted-foreground text-sm">Keine Protokolleinträge vorhanden</div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Eintrag löschen"
        description="Dieser Protokolleintrag wird unwiderruflich gelöscht."
        onConfirm={() => deleteId && deleteLog.mutate(deleteId)}
        variant="destructive"
      />
      <ConfirmDialog
        open={clearAll}
        onOpenChange={() => setClearAll(false)}
        title="Alle Protokolle löschen"
        description={`${logs.length} Einträge werden unwiderruflich gelöscht. Bist du sicher?`}
        onConfirm={() => clearLogs.mutate()}
        variant="destructive"
      />
    </div>
  );
}
