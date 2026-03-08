import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SkeletonCard } from "@/components/SkeletonCard";
import { Camera, Clock, Layers, HardDrive, AlertCircle, CheckCircle, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  uploaded: { label: "Hochgeladen", icon: Clock, color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  processing: { label: "Verarbeitung", icon: Loader2, color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  done: { label: "Fertig", icon: CheckCircle, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  error: { label: "Fehler", icon: AlertCircle, color: "bg-destructive/20 text-destructive border-destructive/30" },
};

export default function AdminUploads() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: uploads = [], isLoading } = useQuery({
    queryKey: ["admin_uploads"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tracking_uploads")
        .select("*, matches(date, away_club_name, clubs!matches_home_club_id_fkey(name))")
        .order("uploaded_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("tracking_uploads").update({ status }).eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        user_id: user?.id, user_email: user?.email,
        action: "upload_status_changed", entity_type: "tracking_upload", entity_id: id,
        details: { new_status: status },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_uploads"] });
      toast.success("Status aktualisiert");
    },
  });

  if (isLoading) return <SkeletonCard count={4} />;

  // Stats
  const byStatus = uploads.reduce((acc: Record<string, number>, u: any) => {
    acc[u.status] = (acc[u.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Status overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <div key={key} className="glass-card p-4 text-center">
              <Icon className={`h-5 w-5 mx-auto mb-1 ${cfg.color.split(" ")[1]}`} />
              <div className="text-2xl font-bold font-display">{byStatus[key] ?? 0}</div>
              <div className="text-xs text-muted-foreground">{cfg.label}</div>
            </div>
          );
        })}
      </div>

      {/* Uploads list */}
      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Spiel</th>
              <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Kamera</th>
              <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs hidden sm:table-cell">Frames</th>
              <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs hidden sm:table-cell">Dauer</th>
              <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Status</th>
              <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs hidden md:table-cell">Hochgeladen</th>
              <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {uploads.map((u: any) => {
              const cfg = STATUS_CONFIG[u.status] ?? STATUS_CONFIG.uploaded;
              const Icon = cfg.icon;
              const match = u.matches;
              return (
                <tr key={u.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4">
                    <div className="text-xs">
                      <span className="font-medium">{match?.clubs?.name ?? "—"}</span>
                      <span className="text-muted-foreground"> vs {match?.away_club_name ?? "—"}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {match?.date ? format(new Date(match.date), "dd.MM.yy", { locale: de }) : "—"}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 text-xs">
                      <Camera className="h-3 w-3 text-muted-foreground" /> {u.camera_index + 1}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground hidden sm:table-cell">
                    <div className="flex items-center gap-1">
                      <Layers className="h-3 w-3" /> {u.frames_count ?? "—"}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground hidden sm:table-cell">
                    {u.duration_sec ? `${Math.floor(u.duration_sec / 60)}:${String(u.duration_sec % 60).padStart(2, "0")}` : "—"}
                  </td>
                  <td className="py-3 px-4">
                    <Badge className={`text-[10px] border ${cfg.color}`}>
                      <Icon className={`h-2.5 w-2.5 mr-0.5 ${u.status === "processing" ? "animate-spin" : ""}`} />
                      {cfg.label}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground hidden md:table-cell">
                    {format(new Date(u.uploaded_at), "dd.MM.yy HH:mm", { locale: de })}
                  </td>
                  <td className="py-3 px-4">
                    <Select
                      value={u.status}
                      onValueChange={(val) => updateStatus.mutate({ id: u.id, status: val })}
                    >
                      <SelectTrigger className="h-7 w-28 text-[10px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="uploaded">Hochgeladen</SelectItem>
                        <SelectItem value="processing">Verarbeitung</SelectItem>
                        <SelectItem value="done">Fertig</SelectItem>
                        <SelectItem value="error">Fehler</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {uploads.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">Keine Uploads vorhanden</div>
        )}
      </div>
    </div>
  );
}
