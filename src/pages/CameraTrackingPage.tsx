import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Flag,
  Loader2,
  LockKeyhole,
  Upload,
  Users,
  AlertTriangle,
  Wifi,
  WifiOff,
} from "lucide-react";
import { FootballTracker } from "@/lib/football-tracker";
import { toast } from "sonner";

const CAMERA_ACCESS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camera-access`;
const CAMERA_OPS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camera-ops`;
const PROCESS_TRACKING_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-tracking`;

type Phase = "auth" | "loading" | "camera" | "calibration" | "tracking" | "ended";
type MatchData = {
  id: string;
  date: string;
  away_club_name: string | null;
  status: string;
  field_id: string | null;
  fields?: { name?: string; width_m?: number; height_m?: number; calibration?: unknown } | null;
};

const SESSION_PREFIX = "camera_session";
const CODE_REGEX = /^\d{6}$/;

const WIZARD_STEPS: { key: Phase; label: string }[] = [
  { key: "auth", label: "Anmelden" },
  { key: "loading", label: "KI laden" },
  { key: "camera", label: "Kamera" },
  { key: "calibration", label: "Prüfung" },
  { key: "tracking", label: "Tracking" },
  { key: "ended", label: "Upload" },
];

export default function CameraTrackingPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const cam = Number.parseInt(searchParams.get("cam") ?? "0", 10);
  const sessionKey = useMemo(() => `${SESSION_PREFIX}_${id}_${cam}`, [id, cam]);

  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>("auth");
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [match, setMatch] = useState<MatchData | null>(null);
  const [progress, setProgress] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [detections, setDetections] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [detectionConfirmed, setDetectionConfirmed] = useState(false);
  const [peakDetections, setPeakDetections] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const trackerRef = useRef<FootballTracker | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackingVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const sessionToken = useMemo(() => localStorage.getItem(sessionKey), [sessionKey]);
  const isCalibrated = Boolean(match?.fields?.calibration);
  const currentStepIdx = WIZARD_STEPS.findIndex((s) => s.key === phase);

  const formatTime = (sec: number) =>
    `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

  // Online/offline tracking
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const fetchSession = async (token: string) => {
    const resp = await fetch(CAMERA_ACCESS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "session", matchId: id, cameraIndex: cam, sessionToken: token }),
    });
    if (!resp.ok) throw new Error((await resp.json().catch(() => ({ error: "Session ungültig" }))).error);
    const data = await resp.json();
    setMatch(data.match);
    setPhase("loading");
  };

  // Auto-restore session
  useEffect(() => {
    if (!id || Number.isNaN(cam) || cam < 0 || cam > 2) return;
    if (sessionToken) {
      void fetchSession(sessionToken).catch(() => {
        localStorage.removeItem(sessionKey);
        setPhase("auth");
      });
    }
  }, [cam, id, sessionKey, sessionToken]);

  // Timer
  useEffect(() => {
    if (phase === "tracking") {
      timerRef.current = window.setInterval(() => setElapsedSec((v) => v + 1), 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [phase]);

  // Auto-load model when phase becomes loading
  useEffect(() => {
    if (phase !== "loading") return;
    const tracker = new FootballTracker();
    trackerRef.current = tracker;
    void tracker
      .loadModel((pct) => setProgress(pct))
      .then(() => setPhase("camera"))
      .catch(() => toast.error("Modell konnte nicht geladen werden"));
  }, [phase]);

  // Attach stream to tracking video
  useEffect(() => {
    if (phase === "tracking" && trackingVideoRef.current && streamRef.current) {
      trackingVideoRef.current.srcObject = streamRef.current;
      trackingVideoRef.current.play().catch(() => {});
    }
  }, [phase]);

  const handleLogin = async () => {
    if (!id || !CODE_REGEX.test(code)) {
      toast.error("Bitte einen gültigen 6-stelligen Kamera-Code eingeben.");
      return;
    }
    setIsAuthorizing(true);
    try {
      const resp = await fetch(CAMERA_ACCESS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", matchId: id, cameraIndex: cam, code }),
      });
      const data = await resp.json().catch(() => ({ error: "Anmeldung fehlgeschlagen" }));
      if (!resp.ok) throw new Error(data.error || "Anmeldung fehlgeschlagen");
      localStorage.setItem(sessionKey, data.sessionToken);
      setCode("");
      await fetchSession(data.sessionToken);
      toast.success("Kamera angemeldet");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Anmeldung fehlgeschlagen");
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleStartCamera = async () => {
    if (!trackerRef.current || !videoRef.current) return;
    try {
      await trackerRef.current.startCamera(videoRef.current, cam);
      if (videoRef.current.srcObject) {
        streamRef.current = videoRef.current.srcObject as MediaStream;
      }
    } catch {
      // Camera unavailable — continue anyway
    }
    setPhase("calibration");
  };

  const handleStartTracking = async () => {
    if (!trackerRef.current || !id) return;
    const token = localStorage.getItem(sessionKey);
    if (token) {
      await fetch(CAMERA_OPS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_status", matchId: id, cameraIndex: cam, sessionToken: token, status: "live" }),
      }).catch(() => null);
    }
    trackerRef.current.startTracking(null, id, (frame) => {
      const count = frame.detections.length;
      setDetections(count);
      setPeakDetections((prev) => Math.max(prev, count));
      if (count >= 2 && !detectionConfirmed) {
        setDetectionConfirmed(true);
        toast.success(`Erkennung bestätigt: ${count} Spieler erkannt`);
      }
    });
    setPhase("tracking");
  };

  const handleEnd = () => {
    trackerRef.current?.stopTracking();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    setPhase("ended");
  };

  const handleUpload = async () => {
    const token = localStorage.getItem(sessionKey);
    if (!trackerRef.current || !id || !token) return;
    setUploading(true);
    try {
      const result = await trackerRef.current.uploadMatch(
        id,
        cam,
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      );
      const registerResp = await fetch(CAMERA_OPS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register_upload",
          matchId: id,
          cameraIndex: cam,
          sessionToken: token,
          filePath: result.filePath,
          framesCount: result.framesCount,
          durationSec: result.durationSec,
        }),
      });
      if (!registerResp.ok)
        throw new Error((await registerResp.json().catch(() => ({ error: "Upload konnte nicht registriert werden" }))).error);

      await fetch(CAMERA_OPS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_status", matchId: id, cameraIndex: cam, sessionToken: token, status: "processing" }),
      });

      await fetch(PROCESS_TRACKING_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-camera-session-token": token },
        body: JSON.stringify({ matchId: id }),
      });

      setUploadDone(true);
      toast.success("Upload erfolgreich!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  };

  const handleLiveSnapshot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      toast.error("Kamera noch nicht bereit");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const reader = new FileReader();
        reader.onload = () => {
          sessionStorage.setItem("calibration_snapshot", reader.result as string);
          const returnPath = `/camera/${id}/track?cam=${cam}`;
          window.location.href = `/fields/${match?.field_id}/calibrate?returnTo=${encodeURIComponent(returnPath)}&fromSnapshot=1`;
        };
        reader.readAsDataURL(blob);
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col landscape:min-h-[100dvh]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
        <div className="font-display font-bold text-sm">
          <span className="gradient-text">Field</span>IQ
        </div>
        <div className="flex items-center gap-2">
          {isOnline ? <Wifi className="h-3.5 w-3.5 text-primary" /> : <WifiOff className="h-3.5 w-3.5 text-destructive" />}
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            Kamera {cam + 1}
          </span>
          {match && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent-foreground border border-accent/20">
              {match.away_club_name || "Spiel"}
            </span>
          )}
        </div>
      </div>

      {/* Persistent hidden video */}
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
        autoPlay
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
      />

      {/* Wizard Stepper — always visible */}
      <div className="px-4 py-3 border-b border-border bg-card/30">
        <div className="flex items-center gap-1 max-w-lg mx-auto">
          {WIZARD_STEPS.map((step, i) => {
            const isDone = i < currentStepIdx;
            const isActive = i === currentStepIdx;
            return (
              <div key={step.key} className="flex items-center gap-1 flex-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                    isDone
                      ? "bg-primary text-primary-foreground"
                      : isActive
                        ? "bg-primary/20 text-primary border-2 border-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span
                  className={`text-[10px] font-medium hidden sm:inline truncate ${
                    isActive ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
                {i < WIZARD_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 rounded min-w-[8px] ${isDone ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Schritt {currentStepIdx + 1} von {WIZARD_STEPS.length} — {WIZARD_STEPS[currentStepIdx]?.label}
        </p>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
        {/* Phase: Auth */}
        {phase === "auth" && (
          <div className="w-full max-w-sm space-y-6 text-center">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
              <LockKeyhole className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display mb-2">Kamera anmelden</h2>
              <p className="text-sm text-muted-foreground">
                Gib den <strong>6-stelligen Kamera-Code</strong> ein, den du in den Einstellungen findest.
              </p>
            </div>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="000000"
              className="w-full rounded-xl border border-border bg-muted px-4 py-4 text-center text-3xl tracking-[0.4em] text-foreground placeholder:text-muted-foreground font-mono"
              autoFocus
            />
            <Button variant="hero" size="xl" className="w-full min-h-[56px]" onClick={handleLogin} disabled={isAuthorizing || !CODE_REGEX.test(code)}>
              {isAuthorizing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Wird geprüft…
                </>
              ) : (
                <>
                  Anmelden <ChevronRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Den Code findest du unter <strong>Einstellungen → Kamera-Codes</strong> im Hauptgerät.
            </p>
          </div>
        )}

        {/* Phase: Loading */}
        {phase === "loading" && (
          <div className="w-full max-w-sm space-y-6 text-center">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
              <Camera className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display mb-2">KI-Modell wird geladen…</h2>
              <p className="text-sm text-muted-foreground">Einmalig ~20 MB. Danach offline verfügbar.</p>
            </div>
            <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-sm text-muted-foreground">{progress}%</p>
          </div>
        )}

        {/* Phase: Camera */}
        {phase === "camera" && (
          <div className="w-full max-w-sm space-y-6 text-center">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
              <Camera className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display mb-2">Kamera aktivieren</h2>
              <p className="text-sm text-muted-foreground">Erlaube den Kamerazugriff, damit das Tracking funktioniert.</p>
            </div>
            <div className="w-full aspect-video rounded-xl bg-muted/30 border border-border overflow-hidden" />
            <Button variant="hero" size="xl" className="w-full min-h-[56px]" onClick={handleStartCamera}>
              Kamera starten <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        )}

        {/* Phase: Calibration */}
        {phase === "calibration" && (
          <div className="w-full max-w-sm space-y-6 text-center">
            {isCalibrated ? (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Check className="h-8 w-8 text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold font-display">Platz ist kalibriert ✓</h2>
                <p className="text-sm text-muted-foreground">
                  {match?.fields?.name || "Platz"}
                  {match?.fields?.width_m && match?.fields?.height_m ? ` — ${match.fields.width_m}×${match.fields.height_m}m` : ""}
                </p>
                <Button variant="hero" size="xl" className="w-full min-h-[56px]" onClick={handleStartTracking}>
                  Tracking starten <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
                <Button variant="outline" size="lg" className="w-full" onClick={handleLiveSnapshot}>
                  <Camera className="mr-2 h-4 w-4" /> Neu kalibrieren
                </Button>
              </>
            ) : (
              <>
                <AlertTriangle className="h-16 w-16 text-yellow-400 mx-auto" />
                <h2 className="text-xl font-bold font-display">Platz nicht kalibriert</h2>
                <p className="text-sm text-muted-foreground">
                  Kalibriere den Platz für genaue Tracking-Daten. Nutze den „Live-Foto"-Button — so wird garantiert derselbe
                  Kamera-Zoom verwendet.
                </p>
                {match?.field_id && (
                  <Button variant="hero" size="xl" className="w-full min-h-[56px]" onClick={handleLiveSnapshot}>
                    <Camera className="mr-2 h-5 w-5" /> Live-Foto & Kalibrieren
                  </Button>
                )}
                <Button variant="heroOutline" size="xl" className="w-full min-h-[56px]" onClick={handleStartTracking}>
                  Trotzdem starten <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </>
            )}
          </div>
        )}

        {/* Phase: Tracking */}
        {phase === "tracking" && (
          <div className="w-full max-w-lg space-y-4">
            {/* Timer */}
            <div className="text-center">
              <div className="text-5xl sm:text-6xl font-bold font-display tracking-tight gradient-text">{formatTime(elapsedSec)}</div>
            </div>

            {/* Camera preview */}
            <div className="aspect-video bg-muted/30 rounded-xl border border-border relative overflow-hidden">
              <video ref={trackingVideoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted autoPlay />
              {!streamRef.current && (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30">
                  <Camera className="h-12 w-12" />
                </div>
              )}
              <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/80 backdrop-blur-sm border border-border text-sm">
                <Users className="h-4 w-4 text-primary" />
                <span className="font-medium">{detections} erkannt</span>
              </div>
            </div>

            {/* Detection banner */}
            {detectionConfirmed ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-left">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                <div>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Erkennung bestätigt</p>
                  <p className="text-xs text-muted-foreground">
                    {detections} aktuell · {peakDetections} max. erkannt
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left">
                <Users className="h-5 w-5 shrink-0 animate-pulse text-amber-500" />
                <div>
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Suche Spieler…</p>
                  <p className="text-xs text-muted-foreground">{detections} erkannt — warte auf Bestätigung</p>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => {
                  trackerRef.current?.stopTracking();
                  setDetectionConfirmed(false);
                  setPeakDetections(0);
                  setDetections(0);
                  setElapsedSec(0);
                  setPhase("calibration");
                }}
              >
                <Camera className="mr-2 h-4 w-4" /> Neu kalibrieren
              </Button>
              <Button
                variant="destructive"
                size="lg"
                className="flex-1"
                onClick={handleEnd}
              >
                <Flag className="mr-2 h-4 w-4" /> Beenden
              </Button>
            </div>
          </div>
        )}

        {/* Phase: Ended */}
        {phase === "ended" && (
          <div className="w-full max-w-sm space-y-6 text-center">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
              <Flag className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display mb-2">Tracking beendet</h2>
              <p className="text-sm text-muted-foreground">
                {formatTime(elapsedSec)} · {trackerRef.current?.getFrameCount() ?? 0} Frames · {peakDetections} max. Spieler
              </p>
            </div>

            {uploadDone ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <Check className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                  <p className="font-semibold font-display">Upload erfolgreich!</p>
                  <p className="text-sm text-muted-foreground">Die Daten werden jetzt verarbeitet.</p>
                </div>
                <Button variant="hero" size="xl" className="w-full min-h-[56px]" asChild>
                  <Link to="/">Fertig</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Button variant="hero" size="xl" className="w-full min-h-[56px]" onClick={handleUpload} disabled={uploading}>
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Wird hochgeladen…
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-5 w-5" /> Daten hochladen
                    </>
                  )}
                </Button>
                <Button variant="ghost" size="sm" asChild className="w-full">
                  <Link to="/">Später hochladen</Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
