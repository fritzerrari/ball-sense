import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
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
  Bell,
  X,
  Crosshair,
} from "lucide-react";
import { FootballTracker, type Detection, type UploadMode, type StabilityEvent } from "@/lib/football-tracker";
import type { HighlightClip } from "@/lib/highlight-recorder";
import { TrackingOverlay } from "@/components/TrackingOverlay";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CAMERA_ACCESS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camera-access`;
const CAMERA_OPS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camera-ops`;
const PROCESS_TRACKING_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-tracking`;

// Simplified 3-step wizard
type Phase = "auth" | "camera" | "tracking" | "ended";
type MatchData = {
  id: string;
  date: string;
  away_club_name: string | null;
  status: string;
  field_id: string | null;
  fields?: { name?: string; width_m?: number; height_m?: number; calibration?: unknown } | null;
};

interface MatchEvent {
  event_type: string;
  player_name: string | null;
  related_player_name: string | null;
  minute: number;
  team: string;
}

const SESSION_PREFIX = "camera_session";
const CODE_REGEX = /^\d{6}$/;

const WIZARD_STEPS: { key: Phase; label: string }[] = [
  { key: "auth", label: "Code" },
  { key: "camera", label: "Kamera" },
  { key: "tracking", label: "Tracking" },
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
  const [modelLoaded, setModelLoaded] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [currentDetections, setCurrentDetections] = useState<Detection[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [detectionConfirmed, setDetectionConfirmed] = useState(false);
  const [peakDetections, setPeakDetections] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [liveEvents, setLiveEvents] = useState<MatchEvent[]>([]);
  const [uploadMode, setUploadMode] = useState<UploadMode>("batch");
  const [chunkStats, setChunkStats] = useState({ sent: 0, ok: 0, pending: 0 });
  const [stabilityWarning, setStabilityWarning] = useState<string | null>(null);
  const [showInlineCalibration, setShowInlineCalibration] = useState(false);
  const [calibrationPoints, setCalibrationPoints] = useState<{ x: number; y: number }[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [highlightClipCount, setHighlightClipCount] = useState(0);
  const [highlightsEnabled, setHighlightsEnabled] = useState(false);

  const trackerRef = useRef<FootballTracker | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackingVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const confirmSoundPlayed = useRef(false);
  const calibrationOverlayRef = useRef<HTMLDivElement>(null);

  const sessionToken = useMemo(() => localStorage.getItem(sessionKey), [sessionKey]);
  const isCalibrated = Boolean(match?.fields?.calibration);
  const currentStepIdx = WIZARD_STEPS.findIndex((s) => s.key === (phase === "ended" ? "tracking" : phase));
  const playerCount = currentDetections.filter(d => d.label === "person").length;

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

  // Realtime match events subscription
  useEffect(() => {
    if (!id || phase !== "tracking") return;
    const channel = supabase
      .channel(`camera-events-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "match_events", filter: `match_id=eq.${id}` },
        (payload) => {
          const evt = payload.new as MatchEvent;
          setLiveEvents(prev => [evt, ...prev].slice(0, 10));

          if (evt.event_type === "substitution") {
            toast.info(`⚡ Wechsel: ${evt.player_name ?? "?"} raus, ${evt.related_player_name ?? "?"} rein (${evt.minute}')`, { duration: 8000 });
            playNotificationSound(520);
          } else if (evt.event_type === "red_card" || evt.event_type === "yellow_red_card") {
            toast.error(`🟥 Rote Karte: ${evt.player_name ?? "?"} (${evt.minute}')`, { duration: 8000 });
            playNotificationSound(780);
          } else if (evt.event_type === "goal") {
            toast.success(`⚽ Tor! ${evt.player_name ?? "?"} (${evt.minute}')`, { duration: 8000 });
            playNotificationSound(660);
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, phase]);

  const playNotificationSound = (freq: number) => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.value = 0.15;
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch { /* audio not available */ }
  };

  const fetchSession = async (token: string) => {
    const resp = await fetch(CAMERA_ACCESS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "session", matchId: id, cameraIndex: cam, sessionToken: token }),
    });
    if (!resp.ok) throw new Error((await resp.json().catch(() => ({ error: "Session ungültig" }))).error);
    const data = await resp.json();
    setMatch(data.match);
  };

  // Auto-restore session
  useEffect(() => {
    if (!id || Number.isNaN(cam) || cam < 0 || cam > 4) return;
    if (sessionToken) {
      void fetchSession(sessionToken).then(() => {
        // Session restored, go to camera phase and start loading model in parallel
        setPhase("camera");
      }).catch(() => {
        localStorage.removeItem(sessionKey);
        setPhase("auth");
      });
    }
  }, [cam, id, sessionKey, sessionToken]);

  // Timer
  useEffect(() => {
    if (phase === "tracking") {
      timerRef.current = window.setInterval(() => setElapsedSec((v) => v + 1), 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [phase]);

  // Incremental chunk upload every 5 minutes during tracking
  useEffect(() => {
    if (phase !== "tracking") return;
    const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
    const uploadIncrementalChunk = async () => {
      const token = localStorage.getItem(sessionKey);
      if (!trackerRef.current || !id || !token) return;
      try {
        const frames = trackerRef.current.getRecentFrames?.() ?? [];
        if (frames.length < 10) return; // Not enough data yet
        const durationSec = trackerRef.current.getElapsedSeconds();
        const trackingData = {
          matchId: id, cameraIndex: cam, frames, framesCount: frames.length,
          durationSec, createdAt: new Date().toISOString(),
        };
        // Upload chunk via camera-ops
        await fetch(CAMERA_OPS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "upload_tracking", matchId: id, cameraIndex: cam, sessionToken: token,
            trackingData, framesCount: frames.length, durationSec,
          }),
        });
        // Trigger incremental processing
        await fetch(PROCESS_TRACKING_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-camera-session-token": token },
          body: JSON.stringify({ matchId: id, action: "incremental" }),
        });
        console.log(`[Incremental] Uploaded ${frames.length} frames chunk`);
      } catch (err) {
        console.warn("[Incremental] Chunk upload failed:", err);
      }
    };
    const interval = setInterval(uploadIncrementalChunk, INTERVAL_MS);
    return () => clearInterval(interval);
  }, [phase, id, cam, sessionKey]);

  // Auto-load model when entering camera phase
  useEffect(() => {
    if (phase !== "camera" || modelLoaded) return;
    const tracker = new FootballTracker();
    trackerRef.current = tracker;
    void tracker
      .loadModel((pct) => setProgress(pct))
      .then(() => setModelLoaded(true))
      .catch(() => toast.error("Modell konnte nicht geladen werden"));
  }, [phase, modelLoaded]);

  // Auto-start camera when entering camera phase
  useEffect(() => {
    if (phase !== "camera" || !trackerRef.current) return;
    if (cameraReady) return; // Already started
    const startCam = async () => {
      if (!videoRef.current) return;
      try {
        await trackerRef.current!.startCamera(videoRef.current, cam);
        if (videoRef.current.srcObject) {
          streamRef.current = videoRef.current.srcObject as MediaStream;
        }
        setCameraReady(true);
      } catch {
        // Camera unavailable — still allow to proceed
        setCameraReady(true);
      }
    };
    // Small delay to ensure tracker is initialized
    const t = setTimeout(startCam, 300);
    return () => clearTimeout(t);
  }, [phase, cam, modelLoaded]);

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
      setPhase("camera");
      toast.success("Kamera angemeldet");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Anmeldung fehlgeschlagen");
    } finally {
      setIsAuthorizing(false);
    }
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

    // Check video highlights module access
    try {
      const { data: hasAccess } = await supabase.rpc("can_access_module", {
        _user_id: "00000000-0000-0000-0000-000000000000", // anon check via plan
        _club_id: "00000000-0000-0000-0000-000000000000",
        _plan: "club",
        _module_key: "video_highlights",
      } as any);
      if (hasAccess) {
        trackerRef.current.getHighlightRecorder().setEnabled(true);
        trackerRef.current.getHighlightRecorder().setOnClipReady(() => {
          setHighlightClipCount(trackerRef.current?.getHighlightRecorder().getClipCount() ?? 0);
        });
        setHighlightsEnabled(true);
      }
    } catch {
      // Module not available, highlights disabled
    }

    // Configure live streaming if selected
    if (uploadMode === "live" && token) {
      trackerRef.current.configureLiveStream({
        matchId: id,
        cameraIndex: cam,
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
        sessionToken: token,
        onChunkSent: () => {
          setChunkStats(trackerRef.current?.getChunkStats() ?? { sent: 0, ok: 0, pending: 0 });
        },
      });
    }

    // Setup stability monitoring
    trackerRef.current.setStabilityCallback((event: StabilityEvent, detail?: string) => {
      if (event === "bump") {
        setStabilityWarning(detail || "Kamera wurde bewegt");
        playNotificationSound(440);
      } else if (event === "drift") {
        setStabilityWarning("Kamera-Position hat sich verändert — neu kalibrieren empfohlen");
      } else if (event === "zoom_change") {
        setStabilityWarning("Zoom hat sich verändert — neu kalibrieren empfohlen");
      }
    });
    trackerRef.current.startStabilityMonitoring();

    // Setup zoom monitoring
    trackerRef.current.setZoomChangeCallback((current, calibrated) => {
      setStabilityWarning(`Zoom verändert (${current.toFixed(1)}x → kalibriert: ${calibrated.toFixed(1)}x)`);
    });
    trackerRef.current.startZoomMonitoring();

    trackerRef.current.startTracking(null, id, (frame) => {
      setCurrentDetections(frame.detections);
      const pCount = frame.detections.filter(d => d.label === "person").length;
      setPeakDetections((prev) => Math.max(prev, pCount));
      if (pCount >= 2 && !detectionConfirmed) {
        setDetectionConfirmed(true);
        if (!confirmSoundPlayed.current) {
          confirmSoundPlayed.current = true;
          playNotificationSound(520);
          setTimeout(() => playNotificationSound(780), 150);
        }
        toast.success(`✅ Erkennung bestätigt: ${pCount} Spieler erkannt`);
      }
    });
    setPhase("tracking");
  };

  const handleGoBack = () => {
    if (phase === "camera") {
      setPhase("auth");
    } else if (phase === "tracking") {
      // Pause instead of stop
      trackerRef.current?.pauseTracking();
      setPhase("camera");
    } else if (phase === "ended") {
      setPhase("tracking");
    }
  };

  const handleEnd = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    setPhase("ended");
    // Auto-start upload
    setTimeout(() => handleUpload(), 500);
  };

  const handleUpload = async () => {
    const token = localStorage.getItem(sessionKey);
    if (!trackerRef.current || !id || !token) return;
    setUploading(true);
    try {
      // Build session data from tracker frames
      const frames = trackerRef.current.stopTracking();
      const durationSec = trackerRef.current.getElapsedSeconds();
      const trackingData = {
        matchId: id,
        cameraIndex: cam,
        frames,
        framesCount: frames.length,
        durationSec,
        createdAt: new Date().toISOString(),
      };

      toast.info("Daten werden hochgeladen…");

      // Upload tracking data through camera-ops (service role bypasses storage RLS)
      const uploadResp = await fetch(CAMERA_OPS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upload_tracking",
          matchId: id, cameraIndex: cam, sessionToken: token,
          trackingData,
          framesCount: frames.length,
          durationSec,
        }),
      });
      const uploadData = await uploadResp.json().catch(() => ({ error: "Upload fehlgeschlagen" }));
      if (!uploadResp.ok) throw new Error(uploadData.error || "Upload fehlgeschlagen");

      // Set match status to processing
      await fetch(CAMERA_OPS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_status", matchId: id, cameraIndex: cam, sessionToken: token, status: "processing" }),
      });

      // Trigger processing
      await fetch(PROCESS_TRACKING_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-camera-session-token": token },
        body: JSON.stringify({ matchId: id }),
      });

      // Upload highlight clips if any
      const recorder = trackerRef.current.getHighlightRecorder();
      if (recorder.getClipCount() > 0) {
        await recorder.uploadClips(
          id, cam,
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        );
        toast.success(`${recorder.getClipCount()} Highlight-Clips hochgeladen`);
      }

      setUploadDone(true);
      toast.success("Upload erfolgreich! Analyse wird gestartet 🎉");
    } catch (error) {
      console.error("[Upload] Error:", error);
      toast.error(error instanceof Error ? error.message : "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  };

  // Inline calibration handlers
  const handleInlineCalibrationTap = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!showInlineCalibration) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    let clientX: number, clientY: number;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    setCalibrationPoints(prev => {
      const next = [...prev, { x, y }];
      if (next.length >= 4) {
        // Save calibration
        saveInlineCalibration(next.slice(0, 4));
        return [];
      }
      return next;
    });
  }, [showInlineCalibration]);

  const saveInlineCalibration = async (points: { x: number; y: number }[]) => {
    if (!match?.field_id) return;
    const calibrationData = {
      points,
      width_m: match.fields?.width_m ?? 105,
      height_m: match.fields?.height_m ?? 68,
      calibrated_at: new Date().toISOString(),
      coverage: "full" as const,
      field_rect: { x: 0, y: 0, w: 1, h: 1 },
    };

    try {
      await supabase
        .from("fields")
        .update({ calibration: calibrationData as any })
        .eq("id", match.field_id);

      // Update local state
      setMatch(prev => prev ? {
        ...prev,
        fields: { ...prev.fields, calibration: calibrationData },
      } : prev);

      // Reset stability after recalibration
      trackerRef.current?.updateCalibratedZoom();

      toast.success("Kalibrierung gespeichert ✓");

      // Auto-start tracking if we're in camera phase and calibration was required
      if (phase === "camera") {
        setTimeout(() => handleStartTracking(), 300);
      }
    } catch {
      toast.error("Kalibrierung konnte nicht gespeichert werden");
    }

    setShowInlineCalibration(false);
    setStabilityWarning(null);
  };

  const cornerLabels = ["Oben links", "Oben rechts", "Unten rechts", "Unten links"];

  return (
    <div className="min-h-screen bg-background flex flex-col landscape:min-h-[100dvh]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-3">
          {phase !== "auth" && (
            <button onClick={handleGoBack} className="rounded-lg p-1.5 transition-colors hover:bg-muted">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="font-display font-bold text-sm">
            <span className="gradient-text">Field</span>IQ
          </div>
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
          {highlightsEnabled && phase === "tracking" && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              🎬 {highlightClipCount}
            </span>
          )}
        </div>
      </div>

      {/* Persistent hidden video */}
      <video
        ref={videoRef}
        className="hidden"
        playsInline muted autoPlay
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
      />

      {/* Wizard Stepper - simplified 3 steps */}
      <div className="px-4 py-2 border-b border-border bg-card/30">
        <div className="flex items-center gap-1 max-w-lg mx-auto">
          {WIZARD_STEPS.map((step, i) => {
            const isDone = i < currentStepIdx;
            const isActive = i === currentStepIdx;
            return (
              <div key={step.key} className="flex items-center gap-1 flex-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                    isDone ? "bg-primary text-primary-foreground"
                      : isActive ? "bg-primary/20 text-primary border-2 border-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className={`text-[10px] font-medium truncate ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                  {step.label}
                </span>
                {i < WIZARD_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 rounded min-w-[8px] ${isDone ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
        {/* Phase: Auth — Code + auto model loading */}
        {phase === "auth" && (
          <div className="w-full max-w-sm space-y-6 text-center">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
              <LockKeyhole className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display mb-2">Kamera anmelden</h2>
              <p className="text-sm text-muted-foreground">
                Gib den <strong>6-stelligen Kamera-Code</strong> ein, den du vom Trainer erhalten hast.
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
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Wird geprüft…</>
              ) : (
                <>Anmelden <ChevronRight className="ml-2 h-5 w-5" /></>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Den Code findest du unter <strong>Einstellungen → Kamera-Codes</strong> im Hauptgerät.
            </p>
          </div>
        )}

        {/* Phase: Camera — combined camera + calibration + model loading */}
        {phase === "camera" && (
          <div className="w-full max-w-sm space-y-4 text-center">
            {/* Model loading indicator */}
            {!modelLoaded && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  KI-Modell wird geladen… {progress}%
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {/* Camera preview */}
            <div className="w-full aspect-video rounded-xl bg-muted/30 border border-border overflow-hidden relative">
              {cameraReady && streamRef.current ? (
                <video
                  ref={(el) => {
                    if (el && streamRef.current) {
                      el.srcObject = streamRef.current;
                      el.play().catch(() => {});
                    }
                  }}
                  className="absolute inset-0 w-full h-full object-cover"
                  playsInline muted autoPlay
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
                </div>
              )}
            </div>

            {/* Calibration status */}
            <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left ${
              isCalibrated ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"
            }`}>
              {isCalibrated ? (
                <>
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Platz kalibriert ✓</p>
                    <p className="text-xs text-muted-foreground">{match?.fields?.name ?? "Platz"}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setShowInlineCalibration(true); setCalibrationPoints([]); }}>
                    <Crosshair className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Nicht kalibriert</p>
                    <p className="text-xs text-muted-foreground">Tippe auf Kalibrieren für genaue Daten</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => { setShowInlineCalibration(true); setCalibrationPoints([]); }}>
                    <Crosshair className="mr-1 h-4 w-4" /> Kalibrieren
                  </Button>
                </>
              )}
            </div>

            {/* Upload mode toggle */}
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
              <Wifi className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">Live-Upload</p>
                <p className="text-xs text-muted-foreground">Daten während des Spiels übertragen</p>
              </div>
              <button
                onClick={() => setUploadMode(m => m === "batch" ? "live" : "batch")}
                className={`relative w-11 h-6 rounded-full transition-colors ${uploadMode === "live" ? "bg-primary" : "bg-muted-foreground/30"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-background rounded-full transition-transform ${uploadMode === "live" ? "translate-x-5" : ""}`} />
              </button>
            </div>

            {/* Start tracking button */}
            <Button
              variant="hero"
              size="xl"
              className="w-full min-h-[56px]"
              onClick={() => {
                if (!isCalibrated) {
                  setShowInlineCalibration(true);
                  setCalibrationPoints([]);
                  toast.info("Bitte zuerst den Platz kalibrieren — markiere die 4 Eckpunkte des Spielfelds.");
                  return;
                }
                handleStartTracking();
              }}
              disabled={!modelLoaded || !cameraReady}
            >
              {!modelLoaded ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Modell wird geladen…</>
              ) : !isCalibrated ? (
                <><Crosshair className="mr-2 h-5 w-5" /> Platz kalibrieren &amp; starten</>
              ) : (
                <>Tracking starten <ChevronRight className="ml-2 h-5 w-5" /></>
              )}
            </Button>

            {!isCalibrated && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ⚠️ Kalibrierung ist erforderlich für genaue Tracking-Daten.
              </p>
            )}

            <Button variant="ghost" size="sm" onClick={handleGoBack}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Zurück
            </Button>
          </div>
        )}

        {/* Phase: Tracking */}
        {phase === "tracking" && (
          <div className="w-full max-w-lg space-y-4">
            {/* Timer */}
            <div className="text-center">
              <div className="text-5xl sm:text-6xl font-bold font-display tracking-tight gradient-text">{formatTime(elapsedSec)}</div>
              {uploadMode === "live" && (
                <div className="flex items-center justify-center gap-2 mt-1">
                  <Wifi className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs text-muted-foreground">
                    Chunks: {chunkStats.ok}/{chunkStats.sent}
                    {chunkStats.pending > 0 && <span className="text-amber-500 ml-1">({chunkStats.pending} ausstehend)</span>}
                    {chunkStats.sent > 0 && chunkStats.ok === chunkStats.sent && " ✓"}
                  </span>
                </div>
              )}
            </div>

            <div
              className="aspect-video bg-muted/30 rounded-xl border border-border relative overflow-hidden"
              onClick={showInlineCalibration ? handleInlineCalibrationTap as any : undefined}
              onTouchStart={showInlineCalibration ? handleInlineCalibrationTap as any : undefined}
              ref={calibrationOverlayRef}
            >
              <video ref={trackingVideoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted autoPlay />
              {!showInlineCalibration && <TrackingOverlay detections={currentDetections} />}
              {!streamRef.current && (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30">
                  <Camera className="h-12 w-12" />
                </div>
              )}

              {/* Inline calibration overlay */}
              {showInlineCalibration && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                  {/* Show placed points */}
                  {calibrationPoints.map((pt, i) => (
                    <div
                      key={i}
                      className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-primary bg-primary/30 flex items-center justify-center"
                      style={{ left: `${pt.x * 100}%`, top: `${pt.y * 100}%` }}
                    >
                      <span className="text-[9px] font-bold text-primary-foreground">{i + 1}</span>
                    </div>
                  ))}
                  {/* Corner guide */}
                  <div className="absolute bottom-3 left-3 right-3 bg-card/90 rounded-lg p-2 text-center">
                    <p className="text-xs font-medium text-foreground">
                      {calibrationPoints.length < 4
                        ? `Tippe auf: ${cornerLabels[calibrationPoints.length]} (${calibrationPoints.length + 1}/4)`
                        : "Wird gespeichert…"}
                    </p>
                  </div>
                  <button
                    className="absolute top-2 right-2 bg-card/80 rounded-full p-1.5"
                    onClick={(e) => { e.stopPropagation(); setShowInlineCalibration(false); setCalibrationPoints([]); }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/80 backdrop-blur-sm border border-border text-sm">
                <Users className="h-4 w-4 text-primary" />
                <span className="font-medium">{playerCount} Spieler</span>
              </div>
            </div>

            {/* Detection banner */}
            {detectionConfirmed ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-left">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                <div>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">✅ Erkennung bestätigt</p>
                  <p className="text-xs text-muted-foreground">
                    {playerCount} aktuell · {peakDetections} max. erkannt
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left">
                <Users className="h-5 w-5 shrink-0 animate-pulse text-amber-500" />
                <div>
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Suche Spieler…</p>
                  <p className="text-xs text-muted-foreground">{playerCount} erkannt — warte auf Bestätigung</p>
                </div>
              </div>
            )}

            {/* Stability warning */}
            {stabilityWarning && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">📱 {stabilityWarning}</p>
                </div>
                <div className="flex gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => setStabilityWarning(null)}>OK</Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    setStabilityWarning(null);
                    setShowInlineCalibration(true);
                    setCalibrationPoints([]);
                  }}>
                    <Crosshair className="mr-1 h-3.5 w-3.5" /> Kalibrieren
                  </Button>
                </div>
              </div>
            )}

            {/* Live events from coach */}
            {liveEvents.length > 0 && (
              <div className="rounded-xl border border-border bg-card/50 p-3 max-h-24 overflow-y-auto space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                  <Bell className="h-3 w-3" /> Letzte Ereignisse
                </div>
                {liveEvents.slice(0, 3).map((evt, i) => (
                  <div key={i} className="text-xs text-foreground">
                    {evt.minute}' — {evt.event_type === "substitution"
                      ? `Wechsel: ${evt.player_name} ↔ ${evt.related_player_name}`
                      : `${evt.event_type}: ${evt.player_name ?? ""}`}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="lg" className="flex-1" onClick={() => {
                setShowInlineCalibration(true);
                setCalibrationPoints([]);
              }}>
                <Crosshair className="mr-2 h-4 w-4" /> Kalibrieren
              </Button>
              <Button variant="destructive" size="lg" className="flex-1" onClick={handleEnd}>
                <Flag className="mr-2 h-4 w-4" /> Beenden
              </Button>
            </div>
          </div>
        )}

        {/* Phase: Ended — auto-upload */}
        {phase === "ended" && (
          <div className="w-full max-w-sm space-y-6 text-center">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
              {uploadDone ? <Check className="h-10 w-10 text-emerald-400" /> : <Upload className="h-10 w-10 text-primary" />}
            </div>
            <div>
              <h2 className="text-xl font-bold font-display mb-2">
                {uploadDone ? "Upload erfolgreich! 🎉" : uploading ? "Wird hochgeladen…" : "Tracking beendet"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {formatTime(elapsedSec)} · {trackerRef.current?.getFrameCount() ?? 0} Frames · {peakDetections} max. Spieler
              </p>
            </div>

            {uploadDone ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <p className="text-sm text-muted-foreground">Die Daten werden jetzt verarbeitet.</p>
                </div>
                <Button variant="hero" size="xl" className="w-full min-h-[56px]" asChild>
                  <Link to="/">Fertig</Link>
                </Button>
              </div>
            ) : uploading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Upload läuft…</span>
              </div>
            ) : (
              <div className="space-y-3">
                <Button variant="hero" size="xl" className="w-full min-h-[56px]" onClick={handleUpload}>
                  <Upload className="mr-2 h-5 w-5" /> Nochmal versuchen
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
