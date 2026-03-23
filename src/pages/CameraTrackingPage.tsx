import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Camera, Check, CheckCircle2, Flag, Loader2, LockKeyhole, Upload, Users, ShieldCheck } from "lucide-react";
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

  const trackerRef = useRef<FootballTracker | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<number | null>(null);

  const sessionToken = useMemo(() => localStorage.getItem(sessionKey), [sessionKey]);

  const isCalibrated = Boolean(match?.fields?.calibration);

  const formatTime = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

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

  useEffect(() => {
    if (!id || Number.isNaN(cam) || cam < 0 || cam > 2) return;
    if (sessionToken) {
      void fetchSession(sessionToken).catch(() => {
        localStorage.removeItem(sessionKey);
        setPhase("auth");
      });
    }
  }, [cam, id, sessionKey, sessionToken]);

  useEffect(() => {
    if (phase === "tracking") {
      timerRef.current = window.setInterval(() => setElapsedSec((value) => value + 1), 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== "loading") return;
    const tracker = new FootballTracker();
    trackerRef.current = tracker;
    void tracker.loadModel((pct) => setProgress(pct)).then(() => setPhase("camera")).catch(() => toast.error("Modell konnte nicht geladen werden"));
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
    await trackerRef.current.startCamera(videoRef.current, cam);
    setPhase("calibration");
  };

  const handleStartTracking = async () => {
    if (!trackerRef.current || !id) return;
    if (sessionToken) {
      await fetch(CAMERA_OPS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_status", matchId: id, cameraIndex: cam, sessionToken, status: "live" }),
      }).catch(() => null);
    }
    trackerRef.current.startTracking(null, id, (frame) => setDetections(frame.detections.length));
    setPhase("tracking");
  };

  const handleEnd = () => {
    trackerRef.current?.stopTracking();
    setPhase("ended");
  };

  const handleUpload = async () => {
    if (!trackerRef.current || !id || !sessionToken) return;
    setUploading(true);
    try {
      const result = await trackerRef.current.uploadMatch(id, cam, import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
      const registerResp = await fetch(CAMERA_OPS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register_upload", matchId: id, cameraIndex: cam, sessionToken, filePath: result.filePath, framesCount: result.framesCount, durationSec: result.durationSec }),
      });
      if (!registerResp.ok) throw new Error((await registerResp.json().catch(() => ({ error: "Upload konnte nicht registriert werden" }))).error);

      await fetch(CAMERA_OPS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_status", matchId: id, cameraIndex: cam, sessionToken, status: "processing" }),
      });

      await fetch(PROCESS_TRACKING_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-camera-session-token": sessionToken },
        body: JSON.stringify({ matchId: id }),
      });

      setUploadDone(true);
      toast.success("Upload erfolgreich gestartet");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <div className="flex items-center justify-between rounded-xl border border-border bg-card/60 px-4 py-3">
          <div>
            <p className="text-xs text-muted-foreground">PWA Kamera-Zugang</p>
            <h1 className="font-display text-lg font-bold">Kamera {cam + 1}</h1>
          </div>
          {match && <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-xs text-primary">{match.away_club_name || "Spiel"}</span>}
        </div>

        {phase === "auth" && (
          <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-4">
            <div className="space-y-1 text-center">
              <LockKeyhole className="mx-auto h-8 w-8 text-primary" />
              <h2 className="font-display text-xl font-bold">Kamera anmelden</h2>
              <p className="text-sm text-muted-foreground">Bitte den 6-stelligen Kamera-Code aus den Einstellungen eingeben.</p>
            </div>
            <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="000000" className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-center text-2xl tracking-[0.35em] text-foreground placeholder:text-muted-foreground" />
            <Button variant="hero" className="w-full" onClick={handleLogin} disabled={isAuthorizing || !CODE_REGEX.test(code)}>
              {isAuthorizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}Anmelden
            </Button>
          </div>
        )}

        {phase === "loading" && (
          <div className="rounded-2xl border border-border bg-card/60 p-5 text-center space-y-4">
            <Camera className="mx-auto h-10 w-10 text-primary" />
            <h2 className="font-display text-xl font-bold">KI-Modell wird geladen</h2>
            <div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
            <p className="text-sm text-muted-foreground">{progress}%</p>
          </div>
        )}

        {phase === "camera" && (
          <div className="rounded-2xl border border-border bg-card/60 p-5 text-center space-y-4">
            <Camera className="mx-auto h-10 w-10 text-primary" />
            <h2 className="font-display text-xl font-bold">Kamera freigeben</h2>
            <video ref={videoRef} className="aspect-video w-full rounded-xl bg-muted/40 object-cover" playsInline muted autoPlay />
            <Button variant="hero" className="w-full" onClick={handleStartCamera}>Kamera starten</Button>
          </div>
        )}

        {phase === "calibration" && (
          <div className="rounded-2xl border border-border bg-card/60 p-5 text-center space-y-4">
            <Check className="mx-auto h-10 w-10 text-primary" />
            <h2 className="font-display text-xl font-bold">{isCalibrated ? "Platz erkannt" : "Kalibrierung fehlt"}</h2>
            <p className="text-sm text-muted-foreground">{match?.fields?.name || "Platz"}{match?.fields?.width_m && match?.fields?.height_m ? ` · ${match.fields.width_m}×${match.fields.height_m}m` : ""}</p>
            <Button variant="hero" className="w-full" onClick={handleStartTracking}>{isCalibrated ? "Tracking starten" : "Trotzdem starten"}</Button>
          </div>
        )}

        {phase === "tracking" && (
          <div className="rounded-2xl border border-border bg-card/60 p-5 text-center space-y-4">
            <div className="font-display text-5xl font-bold text-primary">{formatTime(elapsedSec)}</div>
            <p className="text-sm text-muted-foreground">{detections} Spieler erkannt</p>
            <Button variant="destructive" className="w-full" onClick={handleEnd}><Flag className="mr-2 h-4 w-4" />Tracking beenden</Button>
          </div>
        )}

        {phase === "ended" && (
          <div className="rounded-2xl border border-border bg-card/60 p-5 text-center space-y-4">
            <Flag className="mx-auto h-10 w-10 text-primary" />
            <h2 className="font-display text-xl font-bold">Tracking beendet</h2>
            <p className="text-sm text-muted-foreground">{formatTime(elapsedSec)} · {trackerRef.current?.getFrameCount() ?? 0} Frames</p>
            <Button variant="hero" className="w-full" onClick={handleUpload} disabled={uploading || uploadDone}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {uploadDone ? "Upload gestartet" : "Upload starten"}
            </Button>
            <Button variant="ghost" asChild className="w-full"><Link to="/">Fertig</Link></Button>
          </div>
        )}
      </div>
    </div>
  );
}