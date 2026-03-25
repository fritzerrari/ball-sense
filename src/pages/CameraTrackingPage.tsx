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
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import { FootballTracker, type Detection, type UploadMode, type StabilityEvent } from "@/lib/football-tracker";
import { LiveStatsEngine, type LiveSnapshot } from "@/lib/live-stats-engine";
import type { HighlightClip } from "@/lib/highlight-recorder";
import { TrackingOverlay } from "@/components/TrackingOverlay";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CAMERA_ACCESS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camera-access`;
const CAMERA_OPS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camera-ops`;
const PROCESS_TRACKING_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-tracking`;
const DETECT_FIELD_CORNERS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/detect-field-corners`;

// Simplified 3-step wizard
type Phase = "auth" | "camera" | "tracking" | "ended";
type MatchData = {
  id: string;
  date: string;
  away_club_name: string | null;
  status: string;
  field_id: string | null;
  match_type?: string;
  fields?: { name?: string; width_m?: number; height_m?: number; calibration?: unknown } | null;
};

type LineupCounts = { home: number; away: number };

interface MatchEvent {
  event_type: string;
  player_name: string | null;
  related_player_name: string | null;
  minute: number;
  team: string;
}

const SESSION_PREFIX = "camera_session";
const STATE_PREFIX = "camera_tracking_state";
const CODE_REGEX = /^\d{6}$/;

const WIZARD_STEPS: { key: Phase; label: string }[] = [
  { key: "auth", label: "Code" },
  { key: "camera", label: "Kamera" },
  { key: "tracking", label: "Aufnahme" },
];

export default function CameraTrackingPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const cam = Number.parseInt(searchParams.get("cam") ?? "0", 10);
  const sessionKey = useMemo(() => `${SESSION_PREFIX}_${id}_${cam}`, [id, cam]);
  const stateKey = useMemo(() => `${STATE_PREFIX}_${id}_${cam}`, [id, cam]);

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
  const [savingCalibration, setSavingCalibration] = useState(false);
  const [detectingCalibration, setDetectingCalibration] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [highlightClipCount, setHighlightClipCount] = useState(0);
  const [highlightsEnabled, setHighlightsEnabled] = useState(false);
  const [liveStats, setLiveStats] = useState<LiveSnapshot | null>(null);
  const [lineupCounts, setLineupCounts] = useState<LineupCounts>({ home: 0, away: 0 });
  const [isPaused, setIsPaused] = useState(false);
  const [autoCalibAttempted, setAutoCalibAttempted] = useState(false);

  const trackerRef = useRef<FootballTracker | null>(null);
  const liveEngineRef = useRef<LiveStatsEngine | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackingVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const confirmSoundPlayed = useRef(false);
  const calibrationOverlayRef = useRef<HTMLDivElement>(null);
  const lastCalibrationInputRef = useRef<{ x: number; y: number; ts: number } | null>(null);

  const sessionToken = useMemo(() => localStorage.getItem(sessionKey), [sessionKey]);
  const isCalibrated = Boolean(match?.fields?.calibration);
  const currentStepIdx = WIZARD_STEPS.findIndex((s) => s.key === (phase === "ended" ? "tracking" : phase));
  const personDetections = currentDetections.filter(d => d.label === "person");
  const playerCount = personDetections.length;
  const homePlayerCount = personDetections.filter(d => d.team === "home").length;
  const awayPlayerCount = personDetections.filter(d => d.team === "away").length;

  const formatTime = (sec: number) =>
    `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (CODE_REGEX.test(code) && !isAuthorizing && phase === "auth") {
      handleLogin();
    }
  }, [code]);

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
    if (data.lineupCounts) {
      setLineupCounts(data.lineupCounts);
    }
  };

  // Auto-restore session with state recovery
  useEffect(() => {
    if (!id || Number.isNaN(cam) || cam < 0 || cam > 4) return;
    if (sessionToken) {
      void fetchSession(sessionToken).then(() => {
        // Check for saved tracking state
        try {
          const savedState = localStorage.getItem(stateKey);
          if (savedState) {
            const parsed = JSON.parse(savedState);
            if (parsed.phase === "tracking" && parsed.elapsedSec > 0) {
              setElapsedSec(parsed.elapsedSec);
              // Go to camera first, user can resume tracking
              setPhase("camera");
              toast.info("Letzte Session wiederhergestellt — tippe 'Tracking fortsetzen' um weiterzumachen");
              return;
            }
          }
        } catch { /* ignore parse errors */ }
        setPhase("camera");
      }).catch(() => {
        localStorage.removeItem(sessionKey);
        localStorage.removeItem(stateKey);
        setPhase("auth");
      });
    }
  }, [cam, id, sessionKey, sessionToken]);

  // Timer — respects pause
  useEffect(() => {
    if (phase === "tracking" && !isPaused) {
      timerRef.current = window.setInterval(() => setElapsedSec((v) => v + 1), 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [phase, isPaused]);

  // Save tracking state periodically
  useEffect(() => {
    if (phase !== "tracking") return;
    const interval = setInterval(() => {
      localStorage.setItem(stateKey, JSON.stringify({ phase: "tracking", elapsedSec, isTracking: !isPaused }));
    }, 5000);
    return () => clearInterval(interval);
  }, [phase, elapsedSec, isPaused, stateKey]);

  // Periodic micro-batch sync during tracking — only sends NEW frames since last sync
  const lastSyncFrameCount = useRef(0);
  useEffect(() => {
    if (phase !== "tracking" || isPaused) return;
    const SYNC_INTERVAL_MS = 30_000; // 30s instead of 10s
    const syncMicroBatch = async () => {
      const token = localStorage.getItem(sessionKey);
      if (!liveEngineRef.current || !trackerRef.current || !id || !token) return;
      try {
        const allFrames = trackerRef.current.getRecentFrames?.() ?? [];
        const newFrames = allFrames.slice(lastSyncFrameCount.current);
        if (newFrames.length < 5) return;
        lastSyncFrameCount.current = allFrames.length;

        const durationSec = trackerRef.current.getElapsedSeconds();
        const trackingData = {
          matchId: id, cameraIndex: cam, frames: newFrames, framesCount: newFrames.length,
          durationSec, createdAt: new Date().toISOString(),
        };
        await fetch(CAMERA_OPS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "upload_tracking", matchId: id, cameraIndex: cam, sessionToken: token,
            trackingData, framesCount: allFrames.length, durationSec,
          }),
        });
        console.log(`[MicroBatch] Synced ${newFrames.length} new frames (total: ${allFrames.length})`);
      } catch (err) {
        console.warn("[MicroBatch] Sync failed:", err);
      }
    };
    const interval = setInterval(syncMicroBatch, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [phase, isPaused, id, cam, sessionKey]);

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
    if (cameraReady) return;
    const startCam = async () => {
      if (!videoRef.current) return;
      try {
        await trackerRef.current!.startCamera(videoRef.current, cam);
        if (videoRef.current.srcObject) {
          streamRef.current = videoRef.current.srcObject as MediaStream;
        }
        setCameraReady(true);
      } catch {
        setCameraReady(true);
      }
    };
    const t = setTimeout(startCam, 300);
    return () => clearTimeout(t);
  }, [phase, cam, modelLoaded]);

  // AUTO-CALIBRATION: trigger auto-detect when camera is ready and not calibrated
  useEffect(() => {
    if (phase !== "camera" || !cameraReady || isCalibrated || autoCalibAttempted) return;
    if (detectingCalibration || showInlineCalibration) return;

    const t = setTimeout(() => {
      setAutoCalibAttempted(true);
      setShowInlineCalibration(true);
      toast.info("Platz wird automatisch erkannt…");
      // Auto-detect will run via handleAutoDetectInline
      handleAutoDetectInline();
    }, 1500);
    return () => clearTimeout(t);
  }, [phase, cameraReady, isCalibrated, autoCalibAttempted, detectingCalibration, showInlineCalibration]);

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
      toast.success("Kamera angemeldet ✓");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Anmeldung fehlgeschlagen");
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleStartTracking = async () => {
    if (!trackerRef.current || !id) return;

    trackerRef.current.setSquadSizes(lineupCounts.home, lineupCounts.away);

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
        _user_id: "00000000-0000-0000-0000-000000000000",
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
    } catch { /* Module not available */ }

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
    trackerRef.current.setZoomChangeCallback((current, calibrated) => {
      setStabilityWarning(`Zoom verändert (${current.toFixed(1)}x → kalibriert: ${calibrated.toFixed(1)}x)`);
    });
    trackerRef.current.startZoomMonitoring();

    const fieldW = match?.fields?.width_m ?? 105;
    const fieldH = match?.fields?.height_m ?? 68;
    const engine = new LiveStatsEngine(fieldW, fieldH);
    engine.setOnUpdate((snapshot) => setLiveStats(snapshot));
    liveEngineRef.current = engine;

    trackerRef.current.startTracking(null, id, (frame) => {
      setCurrentDetections(frame.detections);
      engine.processFrame(frame);
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
    setIsPaused(false);
    setPhase("tracking");
    // Save state
    localStorage.setItem(stateKey, JSON.stringify({ phase: "tracking", elapsedSec, isTracking: true }));
  };

  const handleTogglePause = () => {
    if (isPaused) {
      trackerRef.current?.resumeTracking?.();
      setIsPaused(false);
      toast.success("Tracking fortgesetzt ▶️");
    } else {
      trackerRef.current?.pauseTracking();
      setIsPaused(true);
      toast.info("Tracking pausiert ⏸️");
    }
  };

  const handleGoBack = () => {
    if (phase === "camera") {
      setPhase("auth");
    } else if (phase === "tracking") {
      trackerRef.current?.pauseTracking();
      setIsPaused(true);
      setPhase("camera");
      localStorage.setItem(stateKey, JSON.stringify({ phase: "tracking", elapsedSec, isTracking: false }));
    } else if (phase === "ended") {
      setPhase("tracking");
    }
  };

  const handleEnd = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    setPhase("ended");
    localStorage.removeItem(stateKey);
    setTimeout(() => handleUpload(), 500);
  };

  const handleUpload = async () => {
    const token = localStorage.getItem(sessionKey);
    if (!trackerRef.current || !id || !token) return;
    setUploading(true);
    try {
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
      const processResp = await fetch(PROCESS_TRACKING_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-camera-session-token": token },
        body: JSON.stringify({ matchId: id }),
      });
      if (!processResp.ok) {
        console.warn("[Upload] Process-tracking trigger failed, retrying…");
        await fetch(PROCESS_TRACKING_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-camera-session-token": token,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ matchId: id }),
        }).catch(e => console.error("[Upload] Retry also failed:", e));
      }

      // Release camera session
      await fetch(CAMERA_OPS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "release", matchId: id, cameraIndex: cam, sessionToken: token }),
      }).catch(() => console.warn("[Upload] Camera release failed"));

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

  const handleNewTracking = () => {
    // Reset state for a new tracking session on the same match
    setElapsedSec(0);
    setCurrentDetections([]);
    setDetectionConfirmed(false);
    setPeakDetections(0);
    setUploadDone(false);
    setUploading(false);
    setIsPaused(false);
    setLiveStats(null);
    setLiveEvents([]);
    confirmSoundPlayed.current = false;
    setCameraReady(false);
    setAutoCalibAttempted(false);
    setPhase("camera");
  };

  // Inline calibration handlers
  const addInlineCalibrationPoint = useCallback((clientX: number, clientY: number) => {
    if (!showInlineCalibration || savingCalibration) return;

    const rect = calibrationOverlayRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;

    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    const now = Date.now();
    const last = lastCalibrationInputRef.current;
    if (last && now - last.ts < 500 && Math.abs(last.x - x) < 0.03 && Math.abs(last.y - y) < 0.03) {
      return;
    }
    lastCalibrationInputRef.current = { x, y, ts: now };

    setCalibrationPoints((prev) => {
      const hitIdx = prev.findIndex(pt => Math.abs(pt.x - x) < 0.05 && Math.abs(pt.y - y) < 0.05);
      if (hitIdx >= 0) {
        const next = [...prev];
        next.splice(hitIdx, 1);
        try { navigator.vibrate?.(50); } catch {}
        return next;
      }
      if (prev.length >= 4) return prev;
      try { navigator.vibrate?.(30); } catch {}
      return [...prev, { x, y }];
    });
  }, [savingCalibration, showInlineCalibration]);

  const handleInlineCalibrationTap = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    addInlineCalibrationPoint(e.clientX, e.clientY);
  }, [addInlineCalibrationPoint]);

  const handleAutoDetectInline = useCallback(async () => {
    // Allow auto-detect even if showInlineCalibration is being set simultaneously
    if (savingCalibration) return;

    const video = trackingVideoRef.current ?? videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      toast.error("Kein Kamerabild verfügbar — bitte kurz warten");
      return;
    }

    setDetectingCalibration(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas-Kontext nicht verfügbar");

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL("image/jpeg", 0.9).split(",")[1];

      const { data, error } = await supabase.functions.invoke("detect-field-corners", {
        body: { image, mimeType: "image/jpeg" },
      });
      if (error) {
        throw new Error(error.message || "Automatische Erkennung fehlgeschlagen");
      }

      if (data?.isRealPitch === false) {
        const reason = typeof data.pitchRejectionReason === "string"
          ? data.pitchRejectionReason
          : "Kein echter Fußballplatz erkannt";
        toast.error(reason);
        toast.info("Bitte manuell die 4 Eckpunkte des sichtbaren Spielfelds antippen.");
        return;
      }

      const detectedFieldRect = data?.fieldRect ?? { x: 0, y: 0, w: 1, h: 1 };
      const coveragePercent = data?.coveragePercent ?? 100;
      const isPartial = data?.isPartialView === true || coveragePercent < 90;

      if (isPartial) {
        toast.info(`Teilausschnitt erkannt: ~${coveragePercent}% des Feldes sichtbar. Daten werden automatisch hochgerechnet.`);
      }

      if (Array.isArray(data?.corners) && data.corners.length >= 2) {
        const points = data.corners
          .map((corner: unknown) => {
            if (!corner || typeof corner !== "object") return null;
            const candidate = corner as { x?: number; y?: number };
            const x = Number(candidate.x);
            const y = Number(candidate.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
            return {
              x: Math.max(0, Math.min(1, x / 100)),
              y: Math.max(0, Math.min(1, y / 100)),
            };
          })
          .filter((point: unknown): point is { x: number; y: number } => !!point);

        if (points.length >= 2) {
          let finalPoints = points;
          if (points.length === 2) {
            const dx = points[1].x - points[0].x;
            const dy = points[1].y - points[0].y;
            const ratio = 68 / 105;
            const perpX = -dy * ratio;
            const perpY = dx * ratio;
            finalPoints = [
              points[0], points[1],
              { x: Math.max(0, Math.min(1, points[1].x + perpX)), y: Math.max(0, Math.min(1, points[1].y + perpY)) },
              { x: Math.max(0, Math.min(1, points[0].x + perpX)), y: Math.max(0, Math.min(1, points[0].y + perpY)) },
            ];
          } else if (points.length === 3) {
            const p4x = points[0].x + (points[2].x - points[1].x);
            const p4y = points[0].y + (points[2].y - points[1].y);
            finalPoints = [...points, { x: Math.max(0, Math.min(1, p4x)), y: Math.max(0, Math.min(1, p4y)) }];
          }

          if (finalPoints.length === 4) {
            (window as any).__detectedFieldRect = detectedFieldRect;
            (window as any).__detectedCoverage = coveragePercent;
            (window as any).__detectedFeatures = data?.detectedFeatures ?? [];
            setCalibrationPoints(finalPoints);
            const msg = points.length < 4
              ? `${points.length} Ecken erkannt, ${4 - points.length} ergänzt`
              : "4 Eckpunkte erkannt";
            toast.success(`${msg}${isPartial ? ` · ${coveragePercent}% Abdeckung` : ""} — Kalibrierung wird gespeichert…`);
            return;
          }
        }
      }

      toast.error("Ecken konnten nicht automatisch erkannt werden");
      toast.info("Bitte tippe die 4 Eckpunkte des sichtbaren Spielfelds an.");
    } catch (error) {
      console.error("[Calibration] Auto-detect failed", error);
      toast.error("Automatische Erkennung fehlgeschlagen — bitte manuell kalibrieren");
    } finally {
      setDetectingCalibration(false);
    }
  }, [savingCalibration]);

  const saveInlineCalibration = useCallback(async (points: { x: number; y: number }[]) => {
    if (!id || Number.isNaN(cam) || cam < 0 || cam > 4) return;

    const token = sessionToken ?? localStorage.getItem(sessionKey);
    if (!token) {
      toast.error("Session abgelaufen — bitte Kamera-Code erneut eingeben");
      return;
    }

    const detectedRect = (window as any).__detectedFieldRect ?? { x: 0, y: 0, w: 1, h: 1 };
    const detectedCoverage = (window as any).__detectedCoverage ?? 100;
    const detectedFeatures = (window as any).__detectedFeatures ?? [];
    const isPartial = detectedCoverage < 90;

    const baseCalibration = {
      points,
      width_m: match?.fields?.width_m ?? 105,
      height_m: match?.fields?.height_m ?? 68,
      calibrated_at: new Date().toISOString(),
      coverage: isPartial ? "custom" as const : "full" as const,
      field_rect: detectedRect,
      coverage_percent: detectedCoverage,
      detected_features: detectedFeatures,
    };

    delete (window as any).__detectedFieldRect;
    delete (window as any).__detectedCoverage;
    delete (window as any).__detectedFeatures;

    setSavingCalibration(true);
    try {
      const response = await fetch(CAMERA_OPS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "x-camera-session-token": token,
        },
        body: JSON.stringify({
          action: "save_calibration",
          matchId: id,
          cameraIndex: cam,
          sessionToken: token,
          points,
          coverage: baseCalibration.coverage,
          field_rect: baseCalibration.field_rect,
          coverage_percent: baseCalibration.coverage_percent,
          detected_features: baseCalibration.detected_features,
        }),
      });

      const payload = await response.json().catch(() => ({} as { error?: string; calibration?: unknown }));
      if (!response.ok) {
        throw new Error(payload.error || "Kalibrierung konnte nicht gespeichert werden");
      }

      const calibrationData = payload.calibration ?? baseCalibration;

      setMatch((prev) => prev ? {
        ...prev,
        fields: {
          ...(prev.fields ?? {}),
          calibration: calibrationData,
        },
      } : prev);

      trackerRef.current?.updateCalibratedZoom();
      setShowInlineCalibration(false);
      setCalibrationPoints([]);
      setStabilityWarning(null);
      toast.success("Kalibrierung gespeichert ✓");

      if (phase === "camera") {
        setTimeout(() => handleStartTracking(), 300);
      }
    } catch (error) {
      console.error("[Calibration] Save failed", error);
      toast.error(error instanceof Error ? error.message : "Kalibrierung konnte nicht gespeichert werden");
    } finally {
      setSavingCalibration(false);
    }
  }, [cam, handleStartTracking, id, match?.fields?.height_m, match?.fields?.width_m, phase, sessionKey, sessionToken]);

  useEffect(() => {
    if (!showInlineCalibration || calibrationPoints.length !== 4 || savingCalibration) return;
    void saveInlineCalibration(calibrationPoints);
  }, [calibrationPoints, saveInlineCalibration, savingCalibration, showInlineCalibration]);

  const cornerLabels = ["Oben links", "Oben rechts", "Unten rechts", "Unten links"];

  const inlineCalibrationOverlay = showInlineCalibration ? (
    <div className="absolute inset-0 bg-black/40 z-10">
      <div
        role="button"
        tabIndex={0}
        aria-label="Kalibrierungspunkt setzen"
        className="absolute inset-0 z-10 cursor-crosshair touch-none bg-transparent"
        style={{ touchAction: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
        onPointerDown={handleInlineCalibrationTap}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Connection lines between points */}
      {calibrationPoints.length >= 2 && (
        <svg className="pointer-events-none absolute inset-0 z-15 w-full h-full">
          {calibrationPoints.map((pt, i) => {
            const next = calibrationPoints[(i + 1) % calibrationPoints.length];
            if (i >= calibrationPoints.length - 1 && calibrationPoints.length < 4) return null;
            return (
              <line
                key={`line-${i}`}
                x1={`${pt.x * 100}%`} y1={`${pt.y * 100}%`}
                x2={`${next.x * 100}%`} y2={`${next.y * 100}%`}
                stroke="hsl(var(--primary))" strokeWidth="2" strokeDasharray="6 3" opacity="0.7"
              />
            );
          })}
        </svg>
      )}

      {calibrationPoints.map((pt, i) => (
        <div
          key={i}
          className="pointer-events-none absolute z-20 flex items-center justify-center rounded-full border-2 border-primary bg-primary/30"
          style={{ left: `${pt.x * 100}%`, top: `${pt.y * 100}%`, width: 40, height: 40, marginLeft: -20, marginTop: -20 }}
        >
          <span className="text-xs font-bold text-primary-foreground">{i + 1}</span>
        </div>
      ))}

      <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-20 rounded-lg bg-card/90 p-2 text-center">
        <p className="text-xs font-medium text-foreground">
          {detectingCalibration
            ? "🔍 Platz wird automatisch erkannt…"
            : savingCalibration
              ? "Kalibrierung wird gespeichert…"
              : calibrationPoints.length < 4
                ? `Tippe auf: ${cornerLabels[calibrationPoints.length]} (${calibrationPoints.length + 1}/4)`
                : "Kalibrierung wird vorbereitet…"}
        </p>
      </div>

      <div className="absolute left-2 top-2 z-30 flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={detectingCalibration || savingCalibration}
          onClick={(e) => {
            e.stopPropagation();
            void handleAutoDetectInline();
          }}
        >
          {detectingCalibration ? (
            <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Erkenne…</>
          ) : (
            <><Crosshair className="mr-1 h-3.5 w-3.5" /> Auto erkennen</>
          )}
        </Button>
      </div>

      <button
        type="button"
        className="absolute right-2 top-2 z-30 rounded-full bg-card/80 p-1.5"
        onClick={(e) => {
          e.stopPropagation();
          if (savingCalibration) return;
          setShowInlineCalibration(false);
          setCalibrationPoints([]);
        }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  ) : null;

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

      {/* Persistent capture video — NOT display:none, must decode on mobile */}
      <video
        ref={videoRef}
        playsInline muted autoPlay
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none", zIndex: -1 }}
      />

      {/* Wizard Stepper */}
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
      <div className={`flex-1 flex flex-col items-center p-4 sm:p-6 ${phase === "tracking" ? "" : "justify-center"}`}>
        {/* Phase: Auth — Code + auto model loading */}
        {phase === "auth" && (
          <div className="w-full max-w-sm space-y-6 text-center">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
              <LockKeyhole className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display mb-2">Kamera anmelden</h2>
              <p className="text-sm text-muted-foreground">
                Gib den <strong>6-stelligen Kamera-Code</strong> ein — die Anmeldung startet automatisch.
              </p>
            </div>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="000000"
              className="w-full rounded-xl border border-border bg-muted px-4 py-5 text-center text-4xl tracking-[0.5em] text-foreground placeholder:text-muted-foreground font-mono"
              autoFocus
            />
            {isAuthorizing && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Wird geprüft…
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Den Code findest du unter <strong>Einstellungen → Kamera-Codes</strong> im Hauptgerät.
            </p>
          </div>
        )}

        {/* Phase: Camera — combined camera + calibration + model loading */}
        {phase === "camera" && (
          <div className="w-full max-w-sm space-y-4 text-center">
            {/* Progress steps */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 justify-center">
                {modelLoaded ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                <span className={modelLoaded ? "text-primary font-medium" : "text-muted-foreground"}>
                  {modelLoaded ? "KI-Modell bereit ✓" : `KI-Modell wird geladen… ${progress}%`}
                </span>
              </div>
              <div className="flex items-center gap-2 justify-center">
                {cameraReady ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <span className={cameraReady ? "text-primary font-medium" : "text-muted-foreground"}>
                  {cameraReady ? "Kamera bereit ✓" : "Kamera wird gestartet…"}
                </span>
              </div>
              <div className="flex items-center gap-2 justify-center">
                {isCalibrated ? <CheckCircle2 className="h-4 w-4 text-primary" /> : detectingCalibration ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Crosshair className="h-4 w-4 text-muted-foreground" />}
                <span className={isCalibrated ? "text-primary font-medium" : detectingCalibration ? "text-primary" : "text-muted-foreground"}>
                  {isCalibrated ? "Platz kalibriert ✓" : detectingCalibration ? "Platz wird erkannt…" : "Platz noch nicht kalibriert"}
                </span>
              </div>
            </div>

            {/* Model loading bar */}
            {!modelLoaded && (
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            )}

            {/* Camera preview */}
            <div className="w-full aspect-video rounded-xl bg-muted/30 border border-border overflow-hidden relative" ref={calibrationOverlayRef}>
              {cameraReady && streamRef.current ? (
                <video
                  ref={(el) => {
                    trackingVideoRef.current = el;
                    if (el && streamRef.current) {
                      el.srcObject = streamRef.current;
                      el.play().catch(() => {});
                    }
                  }}
                  className="absolute inset-0 w-full h-full object-cover"
                  data-tracking-video="true"
                  playsInline muted autoPlay
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
                </div>
              )}
              {inlineCalibrationOverlay}
            </div>

            {/* Calibration manual trigger (only if not auto-calibrating) */}
            {!isCalibrated && !showInlineCalibration && !detectingCalibration && (
              <Button variant="outline" className="w-full" onClick={() => { setShowInlineCalibration(true); setCalibrationPoints([]); }}>
                <Crosshair className="mr-2 h-4 w-4" /> Manuell kalibrieren
              </Button>
            )}

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

            {/* Start / Resume tracking button */}
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
              ) : elapsedSec > 0 ? (
                <><Play className="mr-2 h-5 w-5" /> Tracking fortsetzen ({formatTime(elapsedSec)})</>
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
          <div className="w-full max-w-lg flex flex-col" style={{ maxHeight: "calc(100dvh - 7rem)" }}>
            <div className="flex-1 overflow-y-auto space-y-4 pb-2">
            {/* Timer */}
            <div className="text-center">
              <div className={`text-5xl sm:text-6xl font-bold font-display tracking-tight ${isPaused ? "text-muted-foreground" : "gradient-text"}`}>
                {formatTime(elapsedSec)}
              </div>
              {isPaused && (
                <p className="text-sm text-amber-500 font-medium mt-1">⏸️ Pausiert</p>
              )}
              {uploadMode === "live" && !isPaused && (
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
              ref={calibrationOverlayRef}
            >
              <video
                ref={trackingVideoRef}
                className={`absolute inset-0 w-full h-full object-cover ${showInlineCalibration ? "pointer-events-none" : ""}`}
                data-tracking-video="true"
                playsInline
                muted
                autoPlay
              />
              {!streamRef.current && (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30">
                  <Camera className="h-12 w-12" />
                </div>
              )}

              {inlineCalibrationOverlay}

              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card/80 backdrop-blur-sm border border-border text-xs">
                <span className={`h-2 w-2 rounded-full ${isPaused ? "bg-amber-500" : "bg-red-500 animate-pulse"}`} />
                <span className="font-medium text-muted-foreground">{isPaused ? "PAUSE" : "REC"}</span>
              </div>
              {/* AI status indicator */}
              {(() => {
                const aiStats = trackerRef.current?.getAIStats();
                const hasAI = aiStats && aiStats.successful > 0;
                const aiActive = aiStats && aiStats.total > 0;
                return (
                  <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-sm border text-xs ${
                    hasAI
                      ? "bg-primary/20 border-primary/30 text-primary"
                      : aiActive
                        ? "bg-amber-500/20 border-amber-500/30 text-amber-400"
                        : "bg-muted/60 border-border text-muted-foreground"
                  }`}>
                    <span className={`h-2 w-2 rounded-full ${hasAI ? "bg-primary animate-pulse" : aiActive ? "bg-amber-500" : "bg-muted-foreground"}`} />
                    <span>{hasAI ? `KI ${aiStats.successful}/${aiStats.total}` : aiActive ? "KI wartet…" : "Aufnahme"}</span>
                  </div>
                );
              })()}
            </div>

            {/* AI detection status */}
            {(() => {
              const aiStats = trackerRef.current?.getAIStats();
              const hasAI = aiStats && aiStats.successful > 0;
              const aiErrors = aiStats ? aiStats.errors : 0;
              if (!aiStats || aiStats.total === 0) return null;
              return (
                <div className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-left ${
                  hasAI
                    ? "border-primary/30 bg-primary/10"
                    : "border-amber-500/30 bg-amber-500/10"
                }`}>
                  {hasAI ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />}
                  <div>
                    <p className="text-xs font-medium text-foreground">
                      {hasAI ? "KI-Erkennung aktiv" : "KI-Erkennung wird aufgebaut…"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {hasAI
                        ? `${aiStats.successful} von ${aiStats.total} Frames erfolgreich analysiert · ${playerCount} Spieler erkannt`
                        : aiErrors > 3
                          ? "Bildanalyse fehlgeschlagen — Daten werden trotzdem aufgezeichnet"
                          : "Warte auf erste KI-Analyse…"
                      }
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Live Stats Dashboard */}
            {liveStats && liveStats.teams.length > 0 && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-primary">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  Live-Statistiken
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {liveStats.teams.map(team => (
                    <div key={team.team} className="rounded-lg bg-card/60 border border-border p-2 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {team.team === "home" ? "Heim" : "Gast"} ({team.playerCount})
                      </p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                        <span className="text-muted-foreground">Distanz</span>
                        <span className="font-mono font-semibold text-right">{team.totalDistanceKm} km</span>
                        <span className="text-muted-foreground">Top Speed</span>
                        <span className="font-mono font-semibold text-right">{team.topSpeedKmh} km/h</span>
                        <span className="text-muted-foreground">Sprints</span>
                        <span className="font-mono font-semibold text-right">{team.totalSprints}</span>
                        <span className="text-muted-foreground">Ø Distanz</span>
                        <span className="font-mono font-semibold text-right">{team.avgDistanceKm} km</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground text-center">
                  {liveStats.totalFrames} Frames · Sync alle 30s
                </p>
              </div>
            )}

            {/* Stability warning */}
            {stabilityWarning && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-left">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                <p className="text-xs flex-1">{stabilityWarning}</p>
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setStabilityWarning(null)}>OK</Button>
                <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => {
                  setStabilityWarning(null);
                  setShowInlineCalibration(true);
                  setCalibrationPoints([]);
                }}>
                  <Crosshair className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Live events from coach */}
            {liveEvents.length > 0 && (
              <div className="rounded-xl border border-border bg-card/50 p-3 max-h-20 overflow-y-auto space-y-1">
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
            </div>

            {/* Sticky bottom buttons — always visible */}
            <div className="flex gap-2 pt-3 pb-2 bg-background sticky bottom-0 border-t border-border mt-auto">
              <Button variant="outline" size="lg" className="flex-1" onClick={handleTogglePause}>
                {isPaused ? (
                  <><Play className="mr-2 h-4 w-4" /> Fortsetzen</>
                ) : (
                  <><Pause className="mr-2 h-4 w-4" /> Pausieren</>
                )}
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
                {formatTime(elapsedSec)} · {trackerRef.current?.getFrameCount() ?? 0} Frames aufgezeichnet
              </p>
            </div>

            {uploadDone ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
                  <p className="text-sm font-medium text-foreground">Die Daten werden jetzt verarbeitet.</p>
                  <p className="text-xs text-muted-foreground">Kamera wurde freigegeben und kann für das nächste Spiel verwendet werden.</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="hero" size="xl" className="flex-1 min-h-[56px]" asChild>
                    <Link to="/">Fertig</Link>
                  </Button>
                  <Button variant="outline" size="xl" className="min-h-[56px]" onClick={handleNewTracking}>
                    <RotateCcw className="mr-2 h-5 w-5" /> Neues Tracking
                  </Button>
                </div>
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
