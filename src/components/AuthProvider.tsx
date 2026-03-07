import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  clubId: string | null;
  clubName: string | null;
  clubPlan: string | null;
  clubLogoUrl: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  clubId: null,
  clubName: null,
  clubPlan: null,
  clubLogoUrl: null,
  signOut: async () => {},
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

  const fetchClubData = async (userId: string) => {
    // Get profile with club_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("club_id")
      .eq("user_id", userId)
      .single();

    if (profile?.club_id) {
      setClubId(profile.club_id);
      const { data: club } = await supabase
        .from("clubs")
        .select("name, plan, logo_url")
        .eq("id", profile.club_id)
        .single();
      if (club) {
        setClubName(club.name);
        setClubPlan(club.plan);
        setClubLogoUrl((club as any).logo_url ?? null);
      }
    } else {
      setClubId(null);
      setClubName(null);
      setClubPlan(null);
      setClubLogoUrl(null);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Use setTimeout to avoid deadlock with Supabase client
          setTimeout(() => fetchClubData(newSession.user.id), 0);
        } else {
          setClubId(null);
          setClubName(null);
          setClubPlan(null);
          setClubLogoUrl(null);
        }
        setLoading(false);
      }
    );

    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      if (existingSession?.user) {
        fetchClubData(existingSession.user.id);
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
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, clubId, clubName, clubPlan, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
