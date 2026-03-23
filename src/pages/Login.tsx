import { Button } from "@/components/ui/button";
import { Link, useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { useState, useRef, useMemo } from "react";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Building2, Loader2, ShieldCheck, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
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

const CAMERA_ACCESS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camera-access`;

type LoginMode = "login" | "register" | "camera";

export default function Login() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const redirectTarget = searchParams.get("redirect") || "/dashboard";

  const initialMode = useMemo(() => {
    const paramMode = searchParams.get("mode");
    if (paramMode === "camera") return "camera" as LoginMode;
    if (paramMode === "login" || paramMode === "register") return paramMode as LoginMode;
    // On mobile or PWA standalone → default to camera code entry
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isMobile || isStandalone) return "camera" as LoginMode;
    return "login" as LoginMode;
  }, []);

  const [mode, setMode] = useState<LoginMode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [clubName, setClubName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [acceptedTos, setAcceptedTos] = useState(false);

  // Camera code state
  const [cameraCode, setCameraCode] = useState("");
  const [cameraSubmitting, setCameraSubmitting] = useState(false);

  const failCountRef = useRef(0);
  const lockedUntilRef = useRef<number>(0);

  if (!loading && user && mode !== "camera") {
    return <Navigate to={redirectTarget} replace />;
  }

  const pwStrength = getPasswordStrength(password);
  const isLogin = mode === "login";
  const isRegister = mode === "register";
  const isCamera = mode === "camera";

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

  const handleCameraLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = cameraCode.replace(/\s/g, "");
    if (!/^\d{6}$/.test(trimmed)) {
      toast.error("Bitte einen gültigen 6-stelligen Code eingeben.");
      return;
    }

    setCameraSubmitting(true);
    try {
      const resp = await fetch(CAMERA_ACCESS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lookup", code: trimmed }),
      });
      const data = await resp.json().catch(() => ({ error: "Verbindung fehlgeschlagen" }));
      if (!resp.ok) throw new Error(data.error || "Code ungültig");

      // Store session token for the camera tracking page
      const sessionKey = `camera_session_${data.matchId}_${data.cameraIndex}`;
      localStorage.setItem(sessionKey, data.sessionToken);

      toast.success("Kamera verbunden! Tracking wird gestartet...");
      navigate(`/camera/${data.matchId}/track?cam=${data.cameraIndex}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Code ungültig");
    } finally {
      setCameraSubmitting(false);
    }
  };

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

          {/* Mode toggle tabs */}
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
            <button
              onClick={() => setMode("camera")}
              className={`flex-1 text-sm font-medium py-2 px-3 rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                isCamera ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Camera className="h-3.5 w-3.5" />
              Kamera
            </button>
          </div>
        </div>

        {/* ── Camera Code Entry ── */}
        {isCamera && (
          <>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold font-display">Kamera starten</h1>
              <p className="text-sm text-muted-foreground">
                Gib den 6-stelligen Code ein, den du vom Trainer erhalten hast.
              </p>
            </div>

            <form onSubmit={handleCameraLogin} className="glass-card p-6 space-y-4">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Kamera-Code</label>
                <div className="relative">
                  <Camera className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={cameraCode}
                    onChange={(e) => setCameraCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-muted border border-border text-foreground text-center text-2xl font-mono tracking-[0.5em] placeholder:text-muted-foreground placeholder:tracking-[0.5em]"
                    autoFocus
                  />
                </div>
              </div>

              <Button variant="hero" className="w-full" type="submit" disabled={cameraSubmitting || cameraCode.length !== 6}>
                {cameraSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Tracking starten
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Kein Code? Frage deinen Trainer oder Admin nach dem Kamera-Zugangscode.
              </p>
            </form>
          </>
        )}

        {/* ── Login / Register Form ── */}
        {!isCamera && (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
