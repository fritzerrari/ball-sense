import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Building2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import { Navigate } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Login() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [clubName, setClubName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!email.trim() || !password.trim()) {
      toast.error("Bitte E-Mail und Passwort eingeben.");
      return;
    }

    if (!isLogin && !clubName.trim()) {
      toast.error("Bitte Vereinsnamen eingeben.");
      return;
    }

    if (password.length < 6) {
      toast.error("Passwort muss mindestens 6 Zeichen lang sein.");
      return;
    }

    setSubmitting(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.includes("Invalid login")) {
            toast.error("Ungültige E-Mail oder Passwort.");
          } else if (error.message.includes("Email not confirmed")) {
            toast.error("Bitte bestätige zuerst deine E-Mail-Adresse.");
          } else {
            toast.error(error.message);
          }
          return;
        }
        toast.success("Erfolgreich angemeldet!");
        navigate("/dashboard");
      } else {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });

        if (signUpError) {
          toast.error(signUpError.message);
          return;
        }

        if (!signUpData.user) {
          toast.error("Registrierung fehlgeschlagen.");
          return;
        }

        if (signUpData.session) {
          await createClubForUser(signUpData.user.id);
          toast.success("Konto erstellt! Willkommen bei FieldIQ.");
          navigate("/onboarding");
        } else {
          toast.success("Registrierung erfolgreich! Bitte bestätige deine E-Mail-Adresse.");
        }
      }
    } catch (err) {
      toast.error("Ein unerwarteter Fehler ist aufgetreten.");
    } finally {
      setSubmitting(false);
    }
  };

  const createClubForUser = async (userId: string) => {
    const { data: club, error: clubError } = await supabase
      .from("clubs")
      .insert({ name: clubName.trim() })
      .select("id")
      .single();

    if (clubError || !club) {
      console.error("Club creation failed:", clubError);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ club_id: club.id })
      .eq("user_id", userId);

    if (profileError) {
      console.error("Profile update failed:", profileError);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 field-grid opacity-20" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px]" />

      {/* Theme toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm relative z-10 space-y-6">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Link>

        <div>
          <Link to="/" className="font-display text-2xl font-bold flex items-center gap-1.5">
            <span className="w-7 h-7 rounded bg-primary flex items-center justify-center text-primary-foreground text-sm font-black">F</span>
            <span className="text-foreground">Field</span>
            <span className="gradient-text">IQ</span>
          </Link>
          <h1 className="text-xl font-semibold font-display mt-4">
            {isLogin ? "Willkommen zurück" : "Konto erstellen"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLogin ? "Melde dich an, um fortzufahren." : "Starte jetzt mit FieldIQ."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
          {!isLogin && (
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Vereinsname</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  placeholder="FC Musterstadt"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground"
                />
              </div>
            </div>
          )}
          <div>
            <label className="text-sm text-muted-foreground block mb-1">E-Mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="trainer@verein.de"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Passwort</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button variant="hero" className="w-full" type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLogin ? "Anmelden" : "Konto erstellen"}
          </Button>
        </form>

        <p className="text-sm text-center text-muted-foreground">
          {isLogin ? "Noch kein Konto?" : "Schon ein Konto?"}{" "}
          <button onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline">
            {isLogin ? "Jetzt registrieren" : "Anmelden"}
          </button>
        </p>
      </div>
    </div>
  );
}
