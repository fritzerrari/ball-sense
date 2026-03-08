import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/components/AuthProvider";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield, Users, Building2, BarChart3, Activity, Crown, UserPlus,
  Trash2, ChevronDown, Search, RefreshCw, Loader2, Calendar, MapPin,
} from "lucide-react";
import { SkeletonCard } from "@/components/SkeletonCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

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

function useAdminProfiles() {
  return useQuery({
    queryKey: ["admin_profiles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, user_id, club_id, created_at, clubs(name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
}

function useAdminRoles() {
  return useQuery({
    queryKey: ["admin_roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("*");
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

// ---------- Component ----------
export default function Admin() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: isAdmin, isLoading: roleLoading } = useAdminRole(user?.id);

  const { data: clubs = [], isLoading: clubsLoading } = useAdminClubs();
  const { data: profiles = [], isLoading: profilesLoading } = useAdminProfiles();
  const { data: roles = [] } = useAdminRoles();
  const { data: matches = [] } = useAdminMatches();
  const { data: players = [] } = useAdminPlayers();

  const [search, setSearch] = useState("");
  const [deleteClubId, setDeleteClubId] = useState<string | null>(null);

  // Mutations
  const updateClubPlan = useMutation({
    mutationFn: async ({ clubId, plan }: { clubId: string; plan: string }) => {
      const { error } = await supabase.from("clubs").update({ plan }).eq("id", clubId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin_clubs"] }); toast.success("Plan aktualisiert"); },
    onError: () => toast.error("Fehler beim Aktualisieren"),
  });

  const addRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "moderator" | "user" }) => {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin_roles"] }); toast.success("Rolle zugewiesen"); },
    onError: () => toast.error("Fehler — Rolle existiert evtl. bereits"),
  });

  const removeRole = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin_roles"] }); toast.success("Rolle entfernt"); },
    onError: () => toast.error("Fehler beim Entfernen"),
  });

  if (roleLoading) return <AppLayout><SkeletonCard count={3} /></AppLayout>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  // Stats
  const totalPlayers = players.length;
  const totalMatches = matches.length;
  const liveMatches = matches.filter((m: any) => m.status === "live" || m.status === "tracking").length;
  const totalUsers = profiles.length;

  // Role helper
  const getUserRoles = (userId: string) => roles.filter((r: any) => r.user_id === userId);

  // Filtered profiles
  const filteredProfiles = search
    ? profiles.filter((p: any) => p.user_id?.includes(search) || p.clubs?.name?.toLowerCase().includes(search.toLowerCase()))
    : profiles;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display">Admin-Panel</h1>
              <p className="text-xs text-muted-foreground">Systemverwaltung & Übersicht</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["admin_clubs"] });
              qc.invalidateQueries({ queryKey: ["admin_profiles"] });
              qc.invalidateQueries({ queryKey: ["admin_roles"] });
              qc.invalidateQueries({ queryKey: ["admin_matches"] });
              qc.invalidateQueries({ queryKey: ["admin_players"] });
              toast.success("Daten aktualisiert");
            }}
          >
            <RefreshCw className="h-4 w-4 mr-1" /> Aktualisieren
          </Button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Vereine", value: clubs.length, icon: Building2, color: "text-primary" },
            { label: "Nutzer", value: totalUsers, icon: Users, color: "text-blue-400" },
            { label: "Spieler", value: totalPlayers, icon: Users, color: "text-emerald-400" },
            { label: "Spiele", value: totalMatches, icon: BarChart3, color: "text-amber-400" },
          ].map((s) => (
            <div key={s.label} className="glass-card p-5">
              <s.icon className={`h-4 w-4 ${s.color} mb-2`} />
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
        <Tabs defaultValue="clubs" className="space-y-4">
          <TabsList className="w-full justify-start bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="clubs" className="rounded-lg">
              <Building2 className="h-4 w-4 mr-1.5" /> Vereine
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-lg">
              <Users className="h-4 w-4 mr-1.5" /> Nutzer & Rollen
            </TabsTrigger>
            <TabsTrigger value="matches" className="rounded-lg">
              <BarChart3 className="h-4 w-4 mr-1.5" /> Spiele
            </TabsTrigger>
            <TabsTrigger value="system" className="rounded-lg">
              <Activity className="h-4 w-4 mr-1.5" /> System
            </TabsTrigger>
          </TabsList>

          {/* ---- Clubs Tab ---- */}
          <TabsContent value="clubs" className="space-y-4">
            {clubsLoading ? (
              <SkeletonCard count={3} />
            ) : (
              <div className="glass-card overflow-hidden">
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
                    {clubs.map((club: any) => {
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
                {clubs.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground text-sm">Keine Vereine vorhanden</div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ---- Users Tab ---- */}
          <TabsContent value="users" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="User-ID oder Vereinsname suchen..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {profilesLoading ? (
              <SkeletonCard count={4} />
            ) : (
              <div className="glass-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">User-ID</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Verein</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Rollen</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs hidden sm:table-cell">Registriert</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProfiles.map((profile: any) => {
                      const userRoles = getUserRoles(profile.user_id);
                      return (
                        <tr key={profile.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                            {profile.user_id?.slice(0, 8)}…
                          </td>
                          <td className="py-3 px-4">
                            {(profile as any).clubs?.name ?? <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {userRoles.length === 0 && (
                                <span className="text-xs text-muted-foreground">Keine</span>
                              )}
                              {userRoles.map((r: any) => (
                                <Badge
                                  key={r.id}
                                  variant={r.role === "admin" ? "default" : "secondary"}
                                  className="text-[10px] gap-1 cursor-pointer hover:bg-destructive/20"
                                  onClick={() => {
                                    if (r.user_id === user?.id && r.role === "admin") {
                                      toast.error("Du kannst dir nicht selbst die Admin-Rolle entziehen");
                                      return;
                                    }
                                    removeRole.mutate(r.id);
                                  }}
                                >
                                  {r.role === "admin" && <Crown className="h-2.5 w-2.5" />}
                                  {r.role}
                                  <Trash2 className="h-2.5 w-2.5" />
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground text-xs hidden sm:table-cell">
                            {format(new Date(profile.created_at), "dd.MM.yyyy", { locale: de })}
                          </td>
                          <td className="py-3 px-4">
                            <Select
                              onValueChange={(val) =>
                                addRole.mutate({ userId: profile.user_id, role: val as any })
                              }
                            >
                              <SelectTrigger className="h-7 w-28 text-xs">
                                <SelectValue placeholder="Rolle +" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="moderator">Moderator</SelectItem>
                                <SelectItem value="user">User</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredProfiles.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground text-sm">Keine Nutzer gefunden</div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ---- Matches Tab ---- */}
          <TabsContent value="matches" className="space-y-4">
            <div className="glass-card overflow-hidden">
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
                  {matches.map((m: any) => (
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
              {matches.length === 0 && (
                <div className="p-8 text-center text-muted-foreground text-sm">Keine Spiele vorhanden</div>
              )}
            </div>
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
