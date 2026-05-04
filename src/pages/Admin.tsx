import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/components/AuthProvider";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Shield, Users, Building2, BarChart3, Activity,
  Search, RefreshCw, Calendar, FileText, ScrollText, Upload, BookOpen, Globe, Trash2, MapPin, ShieldCheck, Coins,
} from "lucide-react";
import { SkeletonCard } from "@/components/SkeletonCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import AdminUsers from "@/components/AdminUsers";
import AdminLegal from "@/components/AdminLegal";
import AdminLogs from "@/components/AdminLogs";
import AdminUploads from "@/components/AdminUploads";
import AdminGuides from "@/components/AdminGuides";
import AdminApiFootball from "@/components/AdminApiFootball";
import AdminPlayerConsents from "@/components/AdminPlayerConsents";
import { AdminTrackingQuality } from "@/components/AdminTrackingQuality";

function useAdminClubs() {
  return useQuery({
    queryKey: ["admin_clubs"],
    queryFn: async () => {
      const { data } = await supabase.from("clubs").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });
}

function useAdminMatches() {
  return useQuery({
    queryKey: ["admin_matches"],
    queryFn: async () => {
      const { data } = await supabase
        .from("matches")
        .select("id, date, status, away_club_name, home_formation, home_club_id, clubs!matches_home_club_id_fkey(name)")
        .order("date", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });
}

function useAdminPlayers() {
  return useQuery({
    queryKey: ["admin_players"],
    queryFn: async () => {
      const { data } = await supabase
        .from("players")
        .select("id, name, number, position, active, club_id, clubs(name)")
        .order("name");
      return data ?? [];
    },
  });
}

function useAdminFields() {
  return useQuery({
    queryKey: ["admin_fields"],
    queryFn: async () => {
      const { data } = await supabase
        .from("fields")
        .select("id, name, width_m, height_m, calibration, created_at, club_id, clubs(name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
}

function useAdminProfiles() {
  return useQuery({
    queryKey: ["admin_profiles_count"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id");
      return data?.length ?? 0;
    },
  });
}

export default function Admin() {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const { data: clubs = [], isLoading: clubsLoading } = useAdminClubs();
  const { data: matches = [] } = useAdminMatches();
  const { data: players = [] } = useAdminPlayers();
  const { data: fields = [] } = useAdminFields();
  const { data: totalUsers = 0 } = useAdminProfiles();

  const [globalSearch, setGlobalSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; label: string } | null>(null);

  const updateClubPlan = useMutation({
    mutationFn: async ({ clubId, plan }: { clubId: string; plan: string }) => {
      const { error } = await supabase.from("clubs").update({ plan }).eq("id", clubId);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        user_id: user?.id, user_email: user?.email,
        action: "plan_changed", entity_type: "club", entity_id: clubId,
        details: { new_plan: plan },
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin_clubs"] }); toast.success("Plan aktualisiert"); },
    onError: () => toast.error("Fehler beim Aktualisieren"),
  });

  const deleteEntity = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) => {
      if (type === "match") {
        const { error } = await supabase.from("matches").delete().eq("id", id);
        if (error) throw error;
      } else if (type === "field") {
        const { error } = await supabase.from("fields").delete().eq("id", id);
        if (error) throw error;
      }
      await supabase.from("audit_logs").insert({
        user_id: user?.id, user_email: user?.email,
        action: `${type}_deleted`, entity_type: type, entity_id: id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_matches"] });
      qc.invalidateQueries({ queryKey: ["admin_fields"] });
      toast.success("Erfolgreich gelöscht");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Fehler beim Löschen"),
  });

  if (!isAdmin && !isSuperAdmin) return <Navigate to="/dashboard" replace />;

  const liveMatches = matches.filter((m: any) => m.status === "live" || m.status === "tracking").length;

  const refreshAll = () => {
    ["admin_clubs", "admin_matches", "admin_players", "admin_profiles_count", "admin_auth_users", "admin_roles", "admin_legal_docs", "admin_audit_logs", "admin_uploads", "admin_fields", "admin_player_consents"].forEach((k) =>
      qc.invalidateQueries({ queryKey: [k] })
    );
    toast.success("Daten aktualisiert");
  };

  const filteredClubs = globalSearch
    ? clubs.filter((c: any) => c.name?.toLowerCase().includes(globalSearch.toLowerCase()) || c.city?.toLowerCase().includes(globalSearch.toLowerCase()))
    : clubs;

  const filteredMatches = globalSearch
    ? matches.filter((m: any) => (m as any).clubs?.name?.toLowerCase().includes(globalSearch.toLowerCase()) || m.away_club_name?.toLowerCase().includes(globalSearch.toLowerCase()))
    : matches;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display">Admin-Panel</h1>
              <p className="text-xs text-muted-foreground">Systemverwaltung, Nutzer, Dokumente & Einwilligungen</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Global suchen..." value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} className="pl-9 w-56" />
            </div>
            <Button variant="outline" size="sm" onClick={refreshAll}>
              <RefreshCw className="h-4 w-4 mr-1" /> Aktualisieren
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: "Vereine", value: clubs.length, icon: Building2, color: "text-primary" },
            { label: "Nutzer", value: totalUsers, icon: Users, color: "text-primary" },
            { label: "Spieler", value: players.length, icon: Users, color: "text-primary" },
            { label: "Spiele", value: matches.length, icon: BarChart3, color: "text-primary" },
            { label: "Live", value: liveMatches, icon: Activity, color: "text-primary" },
          ].map((s) => (
            <div key={s.label} className="glass-card p-4">
              <s.icon className={`h-4 w-4 ${s.color} mb-1.5`} />
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="text-2xl font-bold font-display">{s.value}</div>
            </div>
          ))}
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="w-full justify-start bg-muted/50 p-1 rounded-xl h-auto gap-1 overflow-x-auto flex-nowrap md:flex-wrap scrollbar-none">
            <TabsTrigger value="users" className="rounded-lg text-xs"><Users className="h-4 w-4 mr-1.5" /> Nutzer</TabsTrigger>
            <TabsTrigger value="clubs" className="rounded-lg text-xs"><Building2 className="h-4 w-4 mr-1.5" /> Vereine</TabsTrigger>
            <TabsTrigger value="matches" className="rounded-lg text-xs"><BarChart3 className="h-4 w-4 mr-1.5" /> Spiele</TabsTrigger>
            <TabsTrigger value="player-consents" className="rounded-lg text-xs"><ShieldCheck className="h-4 w-4 mr-1.5" /> Einwilligungen</TabsTrigger>
            <TabsTrigger value="fields" className="rounded-lg text-xs"><MapPin className="h-4 w-4 mr-1.5" /> Felder</TabsTrigger>
            <TabsTrigger value="uploads" className="rounded-lg text-xs"><Upload className="h-4 w-4 mr-1.5" /> Uploads</TabsTrigger>
            <TabsTrigger value="legal" className="rounded-lg text-xs"><FileText className="h-4 w-4 mr-1.5" /> Dokumente</TabsTrigger>
            <TabsTrigger value="logs" className="rounded-lg text-xs"><ScrollText className="h-4 w-4 mr-1.5" /> Protokolle</TabsTrigger>
            <TabsTrigger value="guides" className="rounded-lg text-xs"><BookOpen className="h-4 w-4 mr-1.5" /> Anleitungen</TabsTrigger>
            <TabsTrigger value="api-football" className="rounded-lg text-xs"><Globe className="h-4 w-4 mr-1.5" /> API-Football</TabsTrigger>
            <TabsTrigger value="tracking-quality" className="rounded-lg text-xs"><Activity className="h-4 w-4 mr-1.5" /> Tracking-Qualität</TabsTrigger>
          </TabsList>

          <TabsContent value="users"><AdminUsers /></TabsContent>
          <TabsContent value="clubs" className="space-y-4">
            {clubsLoading ? <SkeletonCard count={3} /> : (
              <div className="glass-card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border"><th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Name</th><th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs hidden sm:table-cell">Stadt</th><th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs hidden sm:table-cell">Liga</th><th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Plan</th><th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs hidden md:table-cell">Spieler</th><th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs hidden md:table-cell">Erstellt</th></tr></thead>
                  <tbody>
                    {filteredClubs.map((club: any) => {
                      const clubPlayers = players.filter((p: any) => p.club_id === club.id);
                      return <tr key={club.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors"><td className="py-3 px-4"><span className="font-medium">{club.name}</span></td><td className="py-3 px-4 text-muted-foreground hidden sm:table-cell">{club.city ?? "—"}</td><td className="py-3 px-4 text-muted-foreground hidden sm:table-cell">{club.league ?? "—"}</td><td className="py-3 px-4"><Select defaultValue={club.plan} onValueChange={(val) => updateClubPlan.mutate({ clubId: club.id, plan: val })}><SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="trial">Trial</SelectItem><SelectItem value="starter">Starter</SelectItem><SelectItem value="club">Club</SelectItem><SelectItem value="pro">Pro</SelectItem></SelectContent></Select></td><td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{clubPlayers.length}</td><td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{format(new Date(club.created_at), "dd.MM.yyyy", { locale: de })}</td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
          <TabsContent value="matches" className="space-y-4"><div className="glass-card overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border"><th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Datum</th><th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Heim</th><th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Auswärts</th><th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs hidden sm:table-cell">Formation</th><th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Status</th><th className="w-10" /></tr></thead><tbody>{filteredMatches.map((m: any) => <tr key={m.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors"><td className="py-3 px-4 text-xs">{format(new Date(m.date), "dd.MM.yy", { locale: de })}</td><td className="py-3 px-4 font-medium">{(m as any).clubs?.name ?? "—"}</td><td className="py-3 px-4 text-muted-foreground">{m.away_club_name ?? "—"}</td><td className="py-3 px-4 text-muted-foreground text-xs hidden sm:table-cell">{m.home_formation ?? "—"}</td><td className="py-3 px-4"><Badge variant={m.status === "live" || m.status === "tracking" ? "default" : "secondary"} className="text-[10px]">{m.status}</Badge></td><td className="py-2 px-2"><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget({ type: "match", id: m.id, label: `${(m as any).clubs?.name ?? "?"} vs ${m.away_club_name ?? "?"}` })}><Trash2 className="h-4 w-4" /></Button></td></tr>)}</tbody></table></div></TabsContent>
          <TabsContent value="player-consents"><AdminPlayerConsents /></TabsContent>
          <TabsContent value="fields" className="space-y-4"><div className="glass-card overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border"><th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Name</th><th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Verein</th><th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs hidden sm:table-cell">Maße</th><th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs hidden sm:table-cell">Kalibriert</th><th className="w-10" /></tr></thead><tbody>{fields.map((f: any) => <tr key={f.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors"><td className="py-3 px-4 font-medium">{f.name}</td><td className="py-3 px-4 text-muted-foreground">{f.clubs?.name ?? "—"}</td><td className="py-3 px-4 text-muted-foreground text-xs hidden sm:table-cell">{f.width_m}×{f.height_m}m</td><td className="py-3 px-4 hidden sm:table-cell"><Badge variant={f.calibration ? "default" : "secondary"} className="text-[10px]">{f.calibration ? "Ja" : "Nein"}</Badge></td><td className="py-2 px-2"><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget({ type: "field", id: f.id, label: f.name })}><Trash2 className="h-4 w-4" /></Button></td></tr>)}</tbody></table></div></TabsContent>
          <TabsContent value="uploads"><AdminUploads /></TabsContent>
          <TabsContent value="legal"><AdminLegal /></TabsContent>
          <TabsContent value="logs"><AdminLogs /></TabsContent>
          <TabsContent value="guides"><AdminGuides /></TabsContent>
          <TabsContent value="api-football"><AdminApiFootball /></TabsContent>
          <TabsContent value="tracking-quality"><AdminTrackingQuality /></TabsContent>
        </Tabs>

        <ConfirmDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }} title={`${deleteTarget?.type === "match" ? "Spiel" : "Feld"} löschen?`} description={`„${deleteTarget?.label}" wird unwiderruflich gelöscht.`} onConfirm={() => { if (deleteTarget) deleteEntity.mutate({ type: deleteTarget.type, id: deleteTarget.id }); }} />
      </div>
    </AppLayout>
  );
}
