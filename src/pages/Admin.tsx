import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/components/AuthProvider";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Shield, Users, Building2, BarChart3, Activity, Crown,
  Search, RefreshCw, Loader2, Calendar, FileText, ScrollText, Upload, BookOpen, Globe,
} from "lucide-react";
import { SkeletonCard } from "@/components/SkeletonCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import AdminUsers from "@/components/AdminUsers";
import AdminLegal from "@/components/AdminLegal";
import AdminLogs from "@/components/AdminLogs";
import AdminUploads from "@/components/AdminUploads";
import AdminGuides from "@/components/AdminGuides";
import AdminApiFootball from "@/components/AdminApiFootball";

// ---------- hooks ----------
function useAdminRole(userId: string | undefined) {
  return useQuery({
    queryKey: ["user_role", userId],
    queryFn: async () => {
      if (!userId) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!userId,
  });
}

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

function useAdminProfiles() {
  return useQuery({
    queryKey: ["admin_profiles_count"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id");
      return data?.length ?? 0;
    },
  });
}

// ---------- Component ----------
export default function Admin() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: isAdmin, isLoading: roleLoading } = useAdminRole(user?.id);

  const { data: clubs = [], isLoading: clubsLoading } = useAdminClubs();
  const { data: matches = [] } = useAdminMatches();
  const { data: players = [] } = useAdminPlayers();
  const { data: totalUsers = 0 } = useAdminProfiles();

  const [globalSearch, setGlobalSearch] = useState("");

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

  if (roleLoading) return <AppLayout><SkeletonCard count={3} /></AppLayout>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const liveMatches = matches.filter((m: any) => m.status === "live" || m.status === "tracking").length;

  const refreshAll = () => {
    ["admin_clubs", "admin_matches", "admin_players", "admin_profiles_count", "admin_auth_users", "admin_roles", "admin_legal_docs", "admin_audit_logs", "admin_uploads"].forEach(k =>
      qc.invalidateQueries({ queryKey: [k] })
    );
    toast.success("Daten aktualisiert");
  };

  // Filter clubs by global search
  const filteredClubs = globalSearch
    ? clubs.filter((c: any) => c.name?.toLowerCase().includes(globalSearch.toLowerCase()) || c.city?.toLowerCase().includes(globalSearch.toLowerCase()))
    : clubs;

  const filteredMatches = globalSearch
    ? matches.filter((m: any) => (m as any).clubs?.name?.toLowerCase().includes(globalSearch.toLowerCase()) || m.away_club_name?.toLowerCase().includes(globalSearch.toLowerCase()))
    : matches;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display">Admin-Panel</h1>
              <p className="text-xs text-muted-foreground">Systemverwaltung, Nutzer, Dokumente & Protokolle</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Global suchen..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="pl-9 w-56"
              />
            </div>
            <Button variant="outline" size="sm" onClick={refreshAll}>
              <RefreshCw className="h-4 w-4 mr-1" /> Aktualisieren
            </Button>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: "Vereine", value: clubs.length, icon: Building2, color: "text-primary" },
            { label: "Nutzer", value: totalUsers, icon: Users, color: "text-blue-400" },
            { label: "Spieler", value: players.length, icon: Users, color: "text-emerald-400" },
            { label: "Spiele", value: matches.length, icon: BarChart3, color: "text-amber-400" },
            { label: "Live", value: liveMatches, icon: Activity, color: "text-primary" },
          ].map((s) => (
            <div key={s.label} className="glass-card p-4">
              <s.icon className={`h-4 w-4 ${s.color} mb-1.5`} />
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="text-2xl font-bold font-display">{s.value}</div>
            </div>
          ))}
        </div>

        {liveMatches > 0 && (
          <div className="glass-card p-4 glow-border flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-medium">{liveMatches} Live-Spiel{liveMatches > 1 ? "e" : ""} aktiv</span>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="w-full justify-start bg-muted/50 p-1 rounded-xl flex-wrap h-auto gap-1">
            <TabsTrigger value="users" className="rounded-lg text-xs">
              <Users className="h-4 w-4 mr-1.5" /> Nutzer
            </TabsTrigger>
            <TabsTrigger value="clubs" className="rounded-lg text-xs">
              <Building2 className="h-4 w-4 mr-1.5" /> Vereine
            </TabsTrigger>
            <TabsTrigger value="matches" className="rounded-lg text-xs">
              <BarChart3 className="h-4 w-4 mr-1.5" /> Spiele
            </TabsTrigger>
            <TabsTrigger value="uploads" className="rounded-lg text-xs">
              <Upload className="h-4 w-4 mr-1.5" /> Uploads
            </TabsTrigger>
            <TabsTrigger value="legal" className="rounded-lg text-xs">
              <FileText className="h-4 w-4 mr-1.5" /> Dokumente
            </TabsTrigger>
            <TabsTrigger value="logs" className="rounded-lg text-xs">
              <ScrollText className="h-4 w-4 mr-1.5" /> Protokolle
            </TabsTrigger>
            <TabsTrigger value="guides" className="rounded-lg text-xs">
              <BookOpen className="h-4 w-4 mr-1.5" /> Anleitungen
            </TabsTrigger>
            <TabsTrigger value="api-football" className="rounded-lg text-xs">
              <Globe className="h-4 w-4 mr-1.5" /> API-Football
            </TabsTrigger>
            <TabsTrigger value="system" className="rounded-lg text-xs">
              <Activity className="h-4 w-4 mr-1.5" /> System
            </TabsTrigger>
          </TabsList>

          {/* ---- Users Tab ---- */}
          <TabsContent value="users">
            <AdminUsers />
          </TabsContent>

          {/* ---- Clubs Tab ---- */}
          <TabsContent value="clubs" className="space-y-4">
            {clubsLoading ? (
              <SkeletonCard count={3} />
            ) : (
              <div className="glass-card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Name</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs hidden sm:table-cell">Stadt</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs hidden sm:table-cell">Liga</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Plan</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs hidden md:table-cell">Spieler</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs hidden md:table-cell">Erstellt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClubs.map((club: any) => {
                      const clubPlayers = players.filter((p: any) => p.club_id === club.id);
                      return (
                        <tr key={club.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {club.logo_url ? (
                                <img src={club.logo_url} alt="" className="w-6 h-6 rounded object-cover" />
                              ) : (
                                <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                  {club.name?.[0]}
                                </div>
                              )}
                              <span className="font-medium">{club.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground hidden sm:table-cell">{club.city ?? "—"}</td>
                          <td className="py-3 px-4 text-muted-foreground hidden sm:table-cell">{club.league ?? "—"}</td>
                          <td className="py-3 px-4">
                            <Select
                              defaultValue={club.plan}
                              onValueChange={(val) => updateClubPlan.mutate({ clubId: club.id, plan: val })}
                            >
                              <SelectTrigger className="h-7 w-24 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="trial">Trial</SelectItem>
                                <SelectItem value="starter">Starter</SelectItem>
                                <SelectItem value="club">Club</SelectItem>
                                <SelectItem value="pro">Pro</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{clubPlayers.length}</td>
                          <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">
                            {format(new Date(club.created_at), "dd.MM.yyyy", { locale: de })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredClubs.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground text-sm">Keine Vereine gefunden</div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ---- Matches Tab ---- */}
          <TabsContent value="matches" className="space-y-4">
            <div className="glass-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Datum</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Heim</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Auswärts</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs hidden sm:table-cell">Formation</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMatches.map((m: any) => (
                    <tr key={m.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {format(new Date(m.date), "dd.MM.yy", { locale: de })}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium">{(m as any).clubs?.name ?? "—"}</td>
                      <td className="py-3 px-4 text-muted-foreground">{m.away_club_name ?? "—"}</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs hidden sm:table-cell">{m.home_formation ?? "—"}</td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={m.status === "live" || m.status === "tracking" ? "default" : "secondary"}
                          className={`text-[10px] ${m.status === "live" || m.status === "tracking" ? "animate-pulse" : ""}`}
                        >
                          {m.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredMatches.length === 0 && (
                <div className="p-8 text-center text-muted-foreground text-sm">Keine Spiele gefunden</div>
              )}
            </div>
          </TabsContent>

          {/* ---- Uploads Tab ---- */}
          <TabsContent value="uploads">
            <AdminUploads />
          </TabsContent>

          {/* ---- Legal Tab ---- */}
          <TabsContent value="legal">
            <AdminLegal />
          </TabsContent>

          {/* ---- Logs Tab ---- */}
          <TabsContent value="logs">
            <AdminLogs />
          </TabsContent>

          {/* ---- Guides Tab ---- */}
          <TabsContent value="guides">
            <AdminGuides />
          </TabsContent>

          {/* ---- API-Football Tab ---- */}
          <TabsContent value="api-football">
            <AdminApiFootball />
          </TabsContent>

          {/* ---- System Tab ---- */}
          <TabsContent value="system" className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="glass-card p-5 space-y-3">
                <h3 className="text-sm font-semibold font-display flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Systemstatus
                </h3>
                <div className="space-y-2">
                  {[
                    { label: "Datenbank", ok: true },
                    { label: "Authentifizierung", ok: true },
                    { label: "Speicher", ok: true },
                    { label: "KI-Assistent", ok: true },
                    { label: "Admin-API", ok: true },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{s.label}</span>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${s.ok ? "bg-emerald-400" : "bg-destructive"}`} />
                        <span className="text-xs">{s.ok ? "Online" : "Fehler"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card p-5 space-y-3">
                <h3 className="text-sm font-semibold font-display flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" /> Übersicht
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vereine gesamt</span>
                    <span className="font-medium">{clubs.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Aktive Spieler</span>
                    <span className="font-medium">{players.filter((p: any) => p.active).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Trial-Vereine</span>
                    <span className="font-medium">{clubs.filter((c: any) => c.plan === "trial").length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pro-Vereine</span>
                    <span className="font-medium">{clubs.filter((c: any) => c.plan === "pro").length}</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
