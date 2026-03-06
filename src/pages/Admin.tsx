import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/components/AuthProvider";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Shield, Users, Building2, BarChart3, Activity } from "lucide-react";
import { SkeletonCard } from "@/components/SkeletonCard";

export default function Admin() {
  const { user } = useAuth();

  // Check if user has admin role
  const { data: isAdmin, isLoading: roleLoading } = useQuery({
    queryKey: ["user_role", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  const { data: clubsData, isLoading: clubsLoading } = useQuery({
    queryKey: ["admin_clubs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clubs").select("*").order("created_at", { ascending: false });
      if (error) return [];
      return data;
    },
    enabled: !!isAdmin,
  });

  const { data: matchCount } = useQuery({
    queryKey: ["admin_match_count"],
    queryFn: async () => {
      const { count } = await supabase.from("matches").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
    enabled: !!isAdmin,
  });

  if (roleLoading) return <AppLayout><SkeletonCard count={3} /></AppLayout>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold font-display">Admin</h1>
        </div>

        {/* Stats overview */}
        <div className="grid sm:grid-cols-4 gap-4">
          {[
            { label: "Vereine", value: String(clubsData?.length ?? 0), icon: Building2 },
            { label: "Nutzer", value: "—", icon: Users },
            { label: "Spiele gesamt", value: String(matchCount ?? 0), icon: BarChart3 },
            { label: "System", value: "Online", icon: Activity },
          ].map(s => (
            <div key={s.label} className="glass-card p-5">
              <s.icon className="h-4 w-4 text-primary mb-2" />
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="text-xl font-bold font-display">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Clubs table */}
        <div>
          <h2 className="text-lg font-semibold font-display mb-3">Vereine</h2>
          {clubsLoading ? (
            <SkeletonCard count={3} />
          ) : (
            <div className="glass-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Name</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Stadt</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Liga</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Plan</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Erstellt</th>
                  </tr>
                </thead>
                <tbody>
                  {(clubsData ?? []).map((club: any) => (
                    <tr key={club.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-medium">{club.name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{club.city ?? "—"}</td>
                      <td className="py-3 px-4 text-muted-foreground">{club.league ?? "—"}</td>
                      <td className="py-3 px-4">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{club.plan}</span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{new Date(club.created_at).toLocaleDateString("de-DE")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Placeholder sections */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold font-display mb-2 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Nutzerübersicht
          </h2>
          <p className="text-sm text-muted-foreground">Wird in einer zukünftigen Version erweitert.</p>
        </div>

        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold font-display mb-2 flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" /> Systemstatus
          </h2>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-sm text-muted-foreground">Alle Dienste laufen normal</span>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
