import { Button } from "@/components/ui/button";
import { Link, useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { useState, useRef, useMemo } from "react";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Building2, Loader2, ShieldCheck, Camera, Download, Share, Smartphone, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Checkbox } from "@/components/ui/checkbox";

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score: 20, label: "Sehr schwach", color: "bg-destructive" };
  if (score === 2) return { score: 40, label: "Schwach", color: "bg-destructive/70" };
  if (score === 3) return { score: 60, label: "Mittel", color: "bg-warning" };
  if (score === 4) return { score: 80, label: "Stark", color: "bg-primary/70" };
  return { score: 100, label: "Sehr stark", color: "bg-primary" };
}

type LoginMode = "login" | "register";

export default function Login() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const { isStandalone, isIos, install, deferredPrompt } = usePwaInstall();
  const redirectTarget = searchParams.get("redirect") || "/dashboard";

  const [installSkipped, setInstallSkipped] = useState(() => {
    return sessionStorage.getItem("pwa-install-skipped") === "true";
  });

  const showInstallScreen = isMobile && !isStandalone && !installSkipped;

  const handleSkipInstall = () => {
    setInstallSkipped(true);
    sessionStorage.setItem("pwa-install-skipped", "true");
  };

  const handleInstallClick = async () => {
    const result = await install();
    if (result === "accepted") {
      // PWA installed
    }
  };

  const initialMode = useMemo(() => {
    const paramMode = searchParams.get("mode");
    if (paramMode === "login" || paramMode === "register") return paramMode as LoginMode;
    return "login" as LoginMode;
  }, []);

  const [mode, setMode] = useState<LoginMode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [clubName, setClubName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [acceptedTos, setAcceptedTos] = useState(false);

  const failCountRef = useRef(0);
  const lockedUntilRef = useRef<number>(0);

  if (!loading && user) {
    return <Navigate to={redirectTarget} replace />;
  }

  const pwStrength = getPasswordStrength(password);
  const isLogin = mode === "login";
  const isRegister = mode === "register";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (Date.now() < lockedUntilRef.current) {
      const secs = Math.ceil((lockedUntilRef.current - Date.now()) / 1000);
      toast.error(`Zu viele Versuche. Bitte warte ${secs} Sekunden.`);
      return;
    }

    if (!email.trim() || !password.trim()) {
      toast.error("Bitte E-Mail und Passwort eingeben.");
      return;
    }

    if (isRegister && !clubName.trim()) {
      toast.error("Bitte Vereinsnamen eingeben.");
      return;
    }

    if (password.length < 6) {
      toast.error("Passwort muss mindestens 6 Zeichen lang sein.");
      return;
    }

    if (isRegister && !acceptedTos) {
      toast.error("Bitte akzeptiere die AGB und Datenschutzrichtlinie.");
      return;
    }

    setSubmitting(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          failCountRef.current++;
          if (failCountRef.current >= 5) {
            lockedUntilRef.current = Date.now() + 60000;
            failCountRef.current = 0;
            toast.error("Zu viele fehlgeschlagene Versuche. 60 Sekunden Sperre.");
            return;
          }
          if (error.message.includes("Invalid login")) {
            toast.error("Ungültige E-Mail oder Passwort.");
          } else if (error.message.includes("Email not confirmed")) {
            toast.error("Bitte bestätige zuerst deine E-Mail-Adresse.");
          } else {
            toast.error(error.message);
          }
          return;
        }
        failCountRef.current = 0;
        toast.success("Erfolgreich angemeldet!");
        navigate(redirectTarget);
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
    } catch {
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

  if (showInstallScreen) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="absolute inset-0 field-grid opacity-20" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px]" />

        <div className="w-full max-w-sm relative z-10 space-y-8 text-center">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground text-2xl font-black font-display shadow-lg">
              F
            </div>
            <div className="font-display text-2xl font-bold flex items-center gap-1.5">
              <span className="text-foreground">Field</span>
              <span className="gradient-text">IQ</span>
            </div>
          </div>

          {/* Install card */}
          <div className="glass-card glow-border p-6 space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-center">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Download className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h1 className="text-xl font-semibold font-display">App installieren</h1>
              <p className="text-sm text-muted-foreground">
                Installiere FieldIQ für das beste Erlebnis — schneller Start, Vollbild und Offline-Zugriff.
              </p>
            </div>

            {isIos ? (
              <div className="space-y-3 text-left">
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Share className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">1. Teilen-Button tippen</p>
                    <p className="text-xs text-muted-foreground">Unten in der Safari-Leiste</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Smartphone className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">2. „Zum Home-Bildschirm"</p>
                    <p className="text-xs text-muted-foreground">Im Menü nach unten scrollen</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Download className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">3. „Hinzufügen" bestätigen</p>
                    <p className="text-xs text-muted-foreground">Die App erscheint auf deinem Homescreen</p>
                  </div>
                </div>
              </div>
            ) : deferredPrompt ? (
              <Button
                variant="hero"
                size="lg"
                className="w-full text-base"
                onClick={handleInstallClick}
              >
                <Download className="mr-2 h-5 w-5" />
                App jetzt installieren
              </Button>
            ) : (
              <div className="space-y-3 text-left">
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">⋮</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">1. Browser-Menü öffnen</p>
                    <p className="text-xs text-muted-foreground">Tippe oben rechts auf die drei Punkte (⋮)</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Download className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">2. „App installieren" wählen</p>
                    <p className="text-xs text-muted-foreground">Oder „Zum Startbildschirm hinzufügen"</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Smartphone className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">3. „Installieren" bestätigen</p>
                    <p className="text-xs text-muted-foreground">Die App erscheint auf deinem Startbildschirm</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Skip link */}
          <button
            onClick={handleSkipInstall}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Ohne App weiter
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 field-grid opacity-20" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px]" />

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

          {/* Mode toggle tabs — Login / Register only */}
          <div className="flex mt-4 rounded-lg bg-muted p-1 gap-1">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 text-sm font-medium py-2 px-3 rounded-md transition-colors ${
                isLogin ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Anmelden
            </button>
            <button
              onClick={() => setMode("register")}
              className={`flex-1 text-sm font-medium py-2 px-3 rounded-md transition-colors ${
                isRegister ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Registrieren
            </button>
          </div>
        </div>

        {/* ── Login / Register Form ── */}
        <div className="space-y-1">
          <h1 className="text-xl font-semibold font-display">
            {isLogin ? "Willkommen zurück" : "Konto erstellen"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isLogin ? "Melde dich an, um fortzufahren." : "Starte jetzt mit FieldIQ."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
          {isRegister && (
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
            {isRegister && password.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${pwStrength.color}`}
                    style={{ width: `${pwStrength.score}%` }}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">{pwStrength.label}</span>
                </div>
              </div>
            )}
          </div>

          {isRegister && (
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="tos"
                checked={acceptedTos}
                onCheckedChange={(v) => setAcceptedTos(v === true)}
                className="mt-0.5"
              />
              <label htmlFor="tos" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                Ich akzeptiere die <Link to="/legal/agb" target="_blank" className="text-primary hover:underline">AGB</Link> und die <Link to="/legal/datenschutz" target="_blank" className="text-primary hover:underline">Datenschutzrichtlinie</Link>.
              </label>
            </div>
          )}

          <Button variant="hero" className="w-full" type="submit" disabled={submitting || (isRegister && !acceptedTos)}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLogin ? "Anmelden" : "Konto erstellen"}
          </Button>
        </form>

        {/* Camera helper link */}
        <Link
          to="/camera"
          className="flex items-center justify-center gap-2 rounded-xl border border-border/50 bg-muted/30 p-3.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
        >
          <Camera className="h-4 w-4 text-primary" />
          <span>Kamera-Helfer? <span className="font-medium text-foreground">Code eingeben</span></span>
        </Link>
      </div>
    </div>
  );
}
