import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { applyClubTheme } from "@/lib/club-theme";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  clubId: string | null;
  clubName: string | null;
  clubPlan: string | null;
  clubLogoUrl: string | null;
  clubPrimaryColor: string | null;
  clubSecondaryColor: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  signOut: () => Promise<void>;
  refreshClubData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  clubId: null,
  clubName: null,
  clubPlan: null,
  clubLogoUrl: null,
  clubPrimaryColor: null,
  clubSecondaryColor: null,
  isAdmin: false,
  isSuperAdmin: false,
  signOut: async () => {},
  refreshClubData: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [clubId, setClubId] = useState<string | null>(null);
  const [clubName, setClubName] = useState<string | null>(null);
  const [clubPlan, setClubPlan] = useState<string | null>(null);
  const [clubLogoUrl, setClubLogoUrl] = useState<string | null>(null);
  const [clubPrimaryColor, setClubPrimaryColor] = useState<string | null>(null);
  const [clubSecondaryColor, setClubSecondaryColor] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Apply / clear club brand theme whenever colors change
  useEffect(() => {
    applyClubTheme(clubPrimaryColor, clubSecondaryColor);
  }, [clubPrimaryColor, clubSecondaryColor]);

  const fetchClubData = async (userId: string) => {
    const [{ data: profile }, { data: adminRole }, { data: superAdminRole }] = await Promise.all([
      supabase.from("profiles").select("club_id").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
      supabase.from("super_admins").select("id").eq("user_id", userId).eq("active", true).maybeSingle(),
    ]);

    setIsAdmin(!!adminRole);
    setIsSuperAdmin(!!superAdminRole);

    if (profile?.club_id) {
      setClubId(profile.club_id);
      const { data: club } = await supabase
        .from("clubs")
        .select("name, plan, logo_url, primary_color, secondary_color")
        .eq("id", profile.club_id)
        .single();
      if (club) {
        setClubName(club.name);
        setClubPlan(club.plan);
        setClubLogoUrl((club as any).logo_url ?? null);
        setClubPrimaryColor((club as any).primary_color ?? null);
        setClubSecondaryColor((club as any).secondary_color ?? null);
      }
    } else {
      setClubId(null);
      setClubName(null);
      setClubPlan(null);
      setClubLogoUrl(null);
      setClubPrimaryColor(null);
      setClubSecondaryColor(null);
    }
  };

  useEffect(() => {
    let initialLoad = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          setTimeout(async () => {
            await fetchClubData(newSession.user.id);
            if (!initialLoad) return;
            setLoading(false);
          }, 0);
        } else {
          setClubId(null);
          setClubName(null);
          setClubPlan(null);
          setClubLogoUrl(null);
          setClubPrimaryColor(null);
          setClubSecondaryColor(null);
          setIsAdmin(false);
          setIsSuperAdmin(false);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      initialLoad = false;
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      if (existingSession?.user) {
        await fetchClubData(existingSession.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setClubId(null);
    setClubName(null);
    setClubPlan(null);
    setClubLogoUrl(null);
    setIsAdmin(false);
    setIsSuperAdmin(false);
  };

  const refreshClubData = async () => {
    if (user) await fetchClubData(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, clubId, clubName, clubPlan, clubLogoUrl, isAdmin, isSuperAdmin, signOut, refreshClubData }}>
      {children}
    </AuthContext.Provider>
  );
}
