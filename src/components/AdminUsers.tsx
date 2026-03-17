import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SkeletonCard } from "@/components/SkeletonCard";
import {
  Search, Crown, Trash2, Lock, Unlock, KeyRound, Loader2, ChevronLeft, ChevronRight,
  Filter, UserX, ShieldCheck, ShieldAlert, Building2, Pencil, X, Check, UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

interface AuthUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  banned: boolean;
  confirmed: boolean;
}

export default function AdminUsers() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [banUserId, setBanUserId] = useState<{ id: string; ban: boolean } | null>(null);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Fetch auth users via edge function
  const { data: authData, isLoading: usersLoading } = useQuery({
    queryKey: ["admin_auth_users", page],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "list", page, perPage: 50 },
      });
      if (error) throw error;
      return data as { users: AuthUser[]; total: number };
    },
  });

  // Fetch profiles and roles
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin_profiles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, club_id, created_at, clubs(name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["admin_roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("*");
      return data ?? [];
    },
  });

  const { data: allClubs = [] } = useQuery({
    queryKey: ["admin_all_clubs"],
    queryFn: async () => {
      const { data } = await supabase.from("clubs").select("id, name").order("name");
      return data ?? [];
    },
  });

  // Mutations
  const addRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        user_id: user?.id, user_email: user?.email,
        action: "role_assigned", entity_type: "user", entity_id: userId,
        details: { role },
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin_roles"] }); toast.success("Rolle zugewiesen"); },
    onError: () => toast.error("Fehler — Rolle existiert evtl. bereits"),
  });

  const removeRole = useMutation({
    mutationFn: async ({ roleId, userId, role }: { roleId: string; userId: string; role: string }) => {
      const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        user_id: user?.id, user_email: user?.email,
        action: "role_removed", entity_type: "user", entity_id: userId,
        details: { role },
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin_roles"] }); toast.success("Rolle entfernt"); },
    onError: () => toast.error("Fehler beim Entfernen"),
  });

  const assignClub = useMutation({
    mutationFn: async ({ userId, clubId }: { userId: string; clubId: string | null }) => {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "assignClub", userId, clubId },
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        user_id: user?.id, user_email: user?.email,
        action: "club_assigned", entity_type: "user", entity_id: userId,
        details: { club_id: clubId },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_profiles"] });
      toast.success("Verein zugeordnet");
      setEditingUser(null);
    },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  const banUser = useMutation({
    mutationFn: async ({ userId, ban }: { userId: string; ban: boolean }) => {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "ban", userId, ban },
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        user_id: user?.id, user_email: user?.email,
        action: ban ? "user_banned" : "user_unbanned", entity_type: "user", entity_id: userId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_auth_users"] });
      toast.success("Nutzerstatus aktualisiert");
    },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.functions.invoke("admin-users", {
        body: { action: "delete", userId },
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        user_id: user?.id, user_email: user?.email,
        action: "user_deleted", entity_type: "user", entity_id: userId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_auth_users"] });
      qc.invalidateQueries({ queryKey: ["admin_profiles"] });
      toast.success("Nutzer gelöscht");
      setDeleteUserId(null);
    },
    onError: (e: any) => toast.error(e.message || "Fehler beim Löschen"),
  });

  const resetPassword = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.functions.invoke("admin-users", {
        body: { action: "resetPassword", email },
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Passwort-Reset-Link generiert"),
    onError: () => toast.error("Fehler"),
  });

  const createUser = useMutation({
    mutationFn: async (params: { email: string; password: string; clubId?: string; role?: string }) => {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "createUser", ...params },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await supabase.from("audit_logs").insert({
        user_id: user?.id, user_email: user?.email,
        action: "user_created", entity_type: "user", entity_id: data.userId,
        details: { email: params.email, role: params.role },
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_auth_users"] });
      qc.invalidateQueries({ queryKey: ["admin_profiles"] });
      qc.invalidateQueries({ queryKey: ["admin_roles"] });
      toast.success("Nutzer erstellt");
      setCreateOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Fehler beim Erstellen"),
  });

  const getUserRoles = (userId: string) => roles.filter((r: any) => r.user_id === userId);
  const getProfile = (userId: string) => profiles.find((p: any) => p.user_id === userId);

  const authUsers = authData?.users ?? [];
  const totalUsers = authData?.total ?? 0;

  // Filter
  let filtered = authUsers;
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter((u) => u.email?.toLowerCase().includes(s) || u.id.includes(s));
  }
  if (roleFilter !== "all") {
    const usersWithRole = roles.filter((r: any) => r.role === roleFilter).map((r: any) => r.user_id);
    if (roleFilter === "none") {
      const usersWithAnyRole = roles.map((r: any) => r.user_id);
      filtered = filtered.filter((u) => !usersWithAnyRole.includes(u.id));
    } else {
      filtered = filtered.filter((u) => usersWithRole.includes(u.id));
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="E-Mail oder User-ID suchen..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-9 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
              <SelectItem value="moderator">Moderatoren</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="none">Ohne Rolle</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground">{totalUsers} Nutzer gesamt</div>
        <Button size="sm" className="ml-auto" onClick={() => setCreateOpen(true)}>
          <UserPlus className="h-4 w-4 mr-1" /> Nutzer anlegen
        </Button>
      </div>

      {usersLoading ? (
        <SkeletonCard count={5} />
      ) : (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">E-Mail</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs hidden md:table-cell">Verein</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Rollen</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs hidden sm:table-cell">Status</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs hidden lg:table-cell">Letzter Login</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const userRoles = getUserRoles(u.id);
                const profile = getProfile(u.id);
                const isSelf = u.id === user?.id;
                return (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${u.banned ? "bg-destructive" : u.confirmed ? "bg-emerald-400" : "bg-yellow-400"}`} />
                        <span className="font-medium text-xs sm:text-sm truncate max-w-[180px]">{u.email}</span>
                        {isSelf && <Badge variant="outline" className="text-[9px] px-1">Du</Badge>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs hidden md:table-cell">
                      <div className="flex items-center gap-1.5">
                        <span>{(profile as any)?.clubs?.name ?? "—"}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {userRoles.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                        {userRoles.map((r: any) => (
                          <Badge
                            key={r.id}
                            variant={r.role === "admin" ? "default" : "secondary"}
                            className="text-[10px] gap-0.5 cursor-pointer hover:bg-destructive/20"
                            onClick={() => {
                              if (isSelf && r.role === "admin") {
                                toast.error("Du kannst dir nicht selbst die Admin-Rolle entziehen");
                                return;
                              }
                              removeRole.mutate({ roleId: r.id, userId: u.id, role: r.role });
                            }}
                          >
                            {r.role === "admin" && <Crown className="h-2.5 w-2.5" />}
                            {r.role}
                            <Trash2 className="h-2 w-2" />
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell">
                      {u.banned ? (
                        <Badge variant="destructive" className="text-[10px]"><ShieldAlert className="h-2.5 w-2.5 mr-0.5" />Gesperrt</Badge>
                      ) : u.confirmed ? (
                        <Badge variant="secondary" className="text-[10px]"><ShieldCheck className="h-2.5 w-2.5 mr-0.5" />Aktiv</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Unbestätigt</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs hidden lg:table-cell">
                      {u.last_sign_in_at ? format(new Date(u.last_sign_in_at), "dd.MM.yy HH:mm", { locale: de }) : "—"}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => setEditingUser(u)}
                          title="Bearbeiten"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Select onValueChange={(val) => addRole.mutate({ userId: u.id, role: val })}>
                          <SelectTrigger className="h-7 w-24 text-[10px]">
                            <SelectValue placeholder="Rolle +" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="moderator">Moderator</SelectItem>
                            <SelectItem value="user">User</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => setBanUserId({ id: u.id, ban: !u.banned })}
                          disabled={isSelf}
                          title={u.banned ? "Entsperren" : "Sperren"}
                        >
                          {u.banned ? <Unlock className="h-3.5 w-3.5 text-emerald-400" /> : <Lock className="h-3.5 w-3.5 text-yellow-400" />}
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => resetPassword.mutate(u.email)}
                          title="Passwort zurücksetzen"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteUserId(u.id)}
                          disabled={isSelf}
                          title="Löschen"
                        >
                          <UserX className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">Keine Nutzer gefunden</div>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalUsers > 50 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Seite {page} von {Math.ceil(totalUsers / 50)}</span>
          <Button variant="outline" size="sm" disabled={page >= Math.ceil(totalUsers / 50)} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" /> Nutzer bearbeiten
            </DialogTitle>
            <DialogDescription>{editingUser?.email}</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <UserEditForm
              userId={editingUser.id}
              currentClubId={(getProfile(editingUser.id) as any)?.club_id ?? null}
              clubs={allClubs}
              onAssignClub={(clubId) => assignClub.mutate({ userId: editingUser.id, clubId })}
              isLoading={assignClub.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={!!deleteUserId}
        onOpenChange={() => setDeleteUserId(null)}
        title="Nutzer löschen"
        description="Dieser Nutzer und alle zugehörigen Daten werden unwiderruflich gelöscht. Bist du sicher?"
        onConfirm={() => deleteUserId && deleteUser.mutate(deleteUserId)}
        destructive
      />
      <ConfirmDialog
        open={!!banUserId}
        onOpenChange={() => setBanUserId(null)}
        title={banUserId?.ban ? "Nutzer sperren" : "Nutzer entsperren"}
        description={banUserId?.ban ? "Der Nutzer wird gesperrt und kann sich nicht mehr anmelden." : "Der Nutzer wird entsperrt."}
        onConfirm={() => banUserId && banUser.mutate({ userId: banUserId.id, ban: banUserId.ban })}
        destructive={banUserId?.ban}
      />

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Nutzer manuell anlegen
            </DialogTitle>
            <DialogDescription>E-Mail wird automatisch bestätigt.</DialogDescription>
          </DialogHeader>
          <CreateUserForm
            clubs={allClubs}
            onSubmit={(data) => createUser.mutate(data)}
            isLoading={createUser.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserEditForm({
  userId,
  currentClubId,
  clubs,
  onAssignClub,
  isLoading,
}: {
  userId: string;
  currentClubId: string | null;
  clubs: { id: string; name: string }[];
  onAssignClub: (clubId: string | null) => void;
  isLoading: boolean;
}) {
  const [selectedClub, setSelectedClub] = useState<string>(currentClubId ?? "none");

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-muted-foreground block mb-1.5">Verein zuordnen</label>
        <Select value={selectedClub} onValueChange={setSelectedClub}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Verein wählen..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Kein Verein —</SelectItem>
            {clubs.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <div className="flex items-center gap-2">
                  <Building2 className="h-3 w-3 text-primary" />
                  {c.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          onClick={() => onAssignClub(selectedClub === "none" ? null : selectedClub)}
          disabled={isLoading || selectedClub === (currentClubId ?? "none")}
          size="sm"
        >
          {isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
          Speichern
        </Button>
      </div>
    </div>
  );
}

function CreateUserForm({
  clubs,
  onSubmit,
  isLoading,
}: {
  clubs: { id: string; name: string }[];
  onSubmit: (data: { email: string; password: string; clubId?: string; role?: string }) => void;
  isLoading: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [clubId, setClubId] = useState("none");
  const [role, setRole] = useState("none");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    onSubmit({
      email,
      password,
      clubId: clubId !== "none" ? clubId : undefined,
      role: role !== "none" ? role : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs text-muted-foreground block mb-1.5">E-Mail *</label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nutzer@example.com" required />
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1.5">Passwort *</label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 Zeichen" minLength={6} required />
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1.5">Verein (optional)</label>
        <Select value={clubId} onValueChange={setClubId}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Kein Verein —</SelectItem>
            {clubs.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <div className="flex items-center gap-2">
                  <Building2 className="h-3 w-3 text-primary" />
                  {c.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1.5">Rolle (optional)</label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Keine Rolle —</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="moderator">Moderator</SelectItem>
            <SelectItem value="user">User</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading || !email || !password} size="sm">
          {isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <UserPlus className="h-3 w-3 mr-1" />}
          Nutzer erstellen
        </Button>
      </div>
    </form>
  );
}
