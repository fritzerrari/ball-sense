import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Video, Square, CheckCircle2, Loader2, Camera, ImageIcon, Clock, FileText, Eye, Pause, Play, CloudUpload, Wifi, Maximize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { startLiveCapture } from "@/lib/frame-capture";
import { startVideoRecorder, type VideoRecorderHandle } from "@/lib/video-recorder";
import RecordingGuard, { canStopRecording, MIN_FRAMES_FOR_ANALYSIS, RECOMMENDED_FRAMES } from "@/components/RecordingGuard";
import CameraSetupOverlay from "@/components/CameraSetupOverlay";
import StopConfirmDialog from "@/components/StopConfirmDialog";
import SideSwapDialog from "@/components/SideSwapDialog";
import MatchEventQuickBar from "@/components/MatchEventQuickBar";
import { useModuleAccess } from "@/hooks/use-module-access";
import CameraCodeEntry from "@/components/CameraCodeEntry";
import WalkieTalkie from "@/components/WalkieTalkie";
import { useUltraWideCamera } from "@/hooks/use-ultra-wide-camera";

type Phase = "code" | "restoring" | "setup" | "ready" | "recording" | "halftime_pause" | "stopped" | "analyzing" | "done";

const SESSION_STORAGE_KEY = "fieldiq_camera_session";

interface StoredSession {
  matchId: string;
  sessionToken: string;
  cameraIndex: number;
  createdAt: string;
}

function saveSession(data: StoredSession) {
  try { localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data)); } catch {}
}

function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    // Expire after 14h client-side
    if (Date.now() - new Date(parsed.createdAt).getTime() > 14 * 60 * 60 * 1000) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

function clearSession() {
  try { localStorage.removeItem(SESSION_STORAGE_KEY); } catch {}
}

/** Check if user is authenticated */
function useIsAuthenticated() {
  const [isAuth, setIsAuth] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsAuth(!!data.session?.user);
    });
  }, []);
  return isAuth;
}

/** Format seconds into MM:SS */
function formatTimer(totalSeconds: number, isSecondHalf: boolean): string {
  const offset = isSecondHalf ? 45 * 60 : 0;
  const s = offset + totalSeconds;
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function CameraTrackingPage() {
  const { id: matchIdParam } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const [phase, setPhase] = useState<Phase>(matchIdParam ? "setup" : "code");
  const [matchId, setMatchId] = useState<string | null>(matchIdParam ?? null);
  const [matchType, setMatchType] = useState<string>("match");
  const [sessionToken, setSessionToken] = useState(searchParams.get("token") ?? "");
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [progress, setProgress] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [syncedFrames, setSyncedFrames] = useState(0);
  const [halfNumber, setHalfNumber] = useState(1);
  const [transferAuthorized, setTransferAuthorized] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [showSideSwapDialog, setShowSideSwapDialog] = useState(false);
  const [autoDetectedSwap, setAutoDetectedSwap] = useState<boolean | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const stoppedCaptureRef = useRef<{ frames: string[]; durationSec: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveCaptureRef = useRef<ReturnType<typeof startLiveCapture> | null>(null);
  const videoRecorderRef = useRef<VideoRecorderHandle | null>(null);
  const [recordingStartTime, setRecordingStartTime] = useState(0);
  const [uploading, setUploading] = useState(false);
  const { hasAccess: hasHighlights } = useModuleAccess("video_highlights");
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deltaUploadRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastUploadedIndexRef = useRef(0);
  const chunkIndexRef = useRef(0);
  const deltaRetryCountRef = useRef(0);

  const ultraWide = useUltraWideCamera(videoRef);

  const [homeTeamName, setHomeTeamName] = useState("Heim");
  const [awayTeamName, setAwayTeamName] = useState("Gegner");
  const [liveHomeGoals, setLiveHomeGoals] = useState(0);
  const [liveAwayGoals, setLiveAwayGoals] = useState(0);

  useIsAuthenticated();
  const isHelper = !!sessionToken?.trim();
  const isTraining = matchType === "training";

  // Fetch match_type and team names when matchId is set
  useEffect(() => {
    if (!matchId) return;
    (async () => {
      const { data: matchData } = await supabase
        .from("matches")
        .select("match_type, away_club_name, home_club_id")
        .eq("id", matchId)
        .maybeSingle();
      if (matchData?.match_type) setMatchType(matchData.match_type);
      if (matchData?.away_club_name) setAwayTeamName(matchData.away_club_name);
      if (matchData?.home_club_id) {
        const { data: club } = await supabase
          .from("clubs")
          .select("name")
          .eq("id", matchData.home_club_id)
          .maybeSingle();
        if (club?.name) setHomeTeamName(club.name);
      }

      // Load existing goal events to init live score
      const { data: events } = await supabase
        .from("match_events")
        .select("event_type, team")
        .eq("match_id", matchId)
        .eq("event_type", "goal");
      if (events) {
        setLiveHomeGoals(events.filter(e => e.team === "home").length);
        setLiveAwayGoals(events.filter(e => e.team === "away").length);
      }
    })();
  }, [matchId]);

  const handleCodeSuccess = useCallback((data: { matchId: string; cameraIndex: number; sessionToken: string }) => {
    setMatchId(data.matchId);
    setSessionToken(data.sessionToken);
    saveSession({
      matchId: data.matchId,
      sessionToken: data.sessionToken,
      cameraIndex: data.cameraIndex,
      createdAt: new Date().toISOString(),
    });
    setPhase("setup");
  }, []);

  // ── Session recovery on mount (handles page refresh) ──
  useEffect(() => {
    if (matchIdParam) return; // authenticated user with route param — no recovery needed
    const stored = loadSession();
    if (!stored) return;

    setPhase("restoring");
    const CAMERA_ACCESS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camera-access`;
    fetch(CAMERA_ACCESS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "validate",
        session_token: stored.sessionToken,
        match_id: stored.matchId,
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.valid) {
          setMatchId(stored.matchId);
          setSessionToken(stored.sessionToken);
          setPhase("setup");
          toast.info("Session wiederhergestellt");
        } else {
          clearSession();
          setPhase("code");
        }
      })
      .catch(() => {
        clearSession();
        setPhase("code");
      });
  }, [matchIdParam]);

  // ── Persist timing to DB ──
  const updateMatchTiming = useCallback(async (fields: Record<string, string>) => {
    if (!matchId) return;
    if (isHelper && sessionToken) {
      // Route through edge function for anonymous helpers
      try {
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camera-ops`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              action: "update-timing",
              session_token: sessionToken,
              match_id: matchId,
              timing: fields,
            }),
          },
        );
      } catch { /* non-critical */ }
    } else {
      await supabase.from("matches").update(fields as any).eq("id", matchId);
    }
  }, [matchId, isHelper, sessionToken]);

  // ── Live timer ──
  useEffect(() => {
    if (phase === "recording" && recordingStartTime > 0) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - recordingStartTime) / 1000));
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    } else {
      setElapsedSeconds(0);
    }
  }, [phase, recordingStartTime]);

  // ── Connectivity watcher ──
  useEffect(() => {
    if (phase !== "recording") return;
    const handleOffline = () => {
      toast.warning("Internet unterbrochen — Frames werden gepuffert.");
    };
    const handleOnline = () => {
      toast.success("Verbindung wiederhergestellt — Frames werden synchronisiert.");
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [phase]);


  // ── Capture a small thumbnail for heartbeat ──
  const captureThumbnail = useCallback((): string | null => {
    if (!videoRef.current || videoRef.current.videoWidth === 0) return null;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 90;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(videoRef.current, 0, 0, 160, 90);
      return canvas.toDataURL("image/jpeg", 0.3).split(",")[1];
    } catch {
      return null;
    }
  }, []);

  // ── Heartbeat for helpers (sends status + receives commands) ──
  const sendHeartbeat = useCallback(async (currentPhase: string, currentFrameCount: number) => {
    if (!isHelper || !matchId || !sessionToken) return;
    try {
      const thumbnail = (currentPhase === "recording" || currentPhase === "ready" || currentPhase === "halftime_pause")
        ? captureThumbnail()
        : null;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camera-ops`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            action: "heartbeat",
            session_token: sessionToken,
            match_id: matchId,
            phase: currentPhase,
            frame_count: currentFrameCount,
            ...(thumbnail ? { thumbnail } : {}),
          }),
        },
      );
      if (res.ok) {
        const data = await res.json();
        if (data.transfer_authorized !== undefined) {
          setTransferAuthorized(data.transfer_authorized);
        }
        return data.command as string | null;
      }
    } catch {
      // Heartbeat failure is non-critical
    }
    return null;
  }, [isHelper, matchId, sessionToken, captureThumbnail]);

  // ── Incremental delta upload during recording ──
  const uploadDelta = useCallback(async () => {
    if (!liveCaptureRef.current || !matchId || !isHelper || !sessionToken) return;
    const newFrames = liveCaptureRef.current.getNewFramesSince(lastUploadedIndexRef.current);
    if (newFrames.length === 0) return;

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camera-ops`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            action: "append-frames",
            session_token: sessionToken,
            match_id: matchId,
            frames: newFrames,
            chunk_index: chunkIndexRef.current,
          }),
        },
      );
      if (res.ok) {
        lastUploadedIndexRef.current += newFrames.length;
        chunkIndexRef.current += 1;
        deltaRetryCountRef.current = 0;
        setSyncedFrames(lastUploadedIndexRef.current);
      } else {
        deltaRetryCountRef.current += 1;
      }
    } catch {
      deltaRetryCountRef.current += 1;
    }
  }, [matchId, isHelper, sessionToken]);

  // ── Heartbeat interval ──
  useEffect(() => {
    if (!isHelper || (phase !== "recording" && phase !== "halftime_pause" && phase !== "ready")) return;
    
    const fc = liveCaptureRef.current?.getFrameCount() ?? frameCount;
    sendHeartbeat(phase, fc);

    const interval = setInterval(async () => {
      const currentFc = liveCaptureRef.current?.getFrameCount() ?? frameCount;
      const cmd = await sendHeartbeat(phase, currentFc);
      if (cmd === "stop") {
        setShowStopConfirm(true);
      } else if (cmd === "halftime" && phase === "recording") {
        triggerHalftime();
      } else if (cmd === "start" && (phase === "ready" || phase === "halftime_pause")) {
        if (phase === "ready") startRecording();
        else requestStartSecondHalf();
      }
    }, 10000);

    heartbeatRef.current = interval;
    return () => clearInterval(interval);
  }, [isHelper, phase, frameCount]);

  const initCamera = useCallback(async () => {
    // External mode: open setup dialog → screen capture
    if (isExternalMode) {
      setShowExternalSetup(true);
      return;
    }

    try {
      // Ensure camera detection completes before starting stream
      const detectedCams = await ultraWide.detectCameras();
      toast.info(`${detectedCams.length} Kamera(s) erkannt`, { duration: 3000 });

      const stream = await ultraWide.initStream();
      if (stream) {
        streamRef.current = stream;
        setPhase("ready");
      } else {
        // Fallback: try standard getUserMedia
        const fallback = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        streamRef.current = fallback;
        if (videoRef.current) {
          videoRef.current.srcObject = fallback;
          videoRef.current.play();
        }
        setPhase("ready");
      }
    } catch {
      toast.error("Kamera konnte nicht gestartet werden");
    }
  }, [ultraWide, isExternalMode]);

  // Start external (display) capture after user confirms in setup dialog.
  // CRITICAL: getDisplayMedia() must run synchronously from the user gesture
  // (no awaits before it) — otherwise Android Chrome/Edge lose transient
  // activation and the call fails as if the browser didn't support it.
  const startExternalCapture = useCallback(async () => {
    // 1) Fire capture IMMEDIATELY — preserves the user gesture chain
    const result = await displayCapture.start();

    if (result.status !== "success" || !result.stream) {
      if (result.message) toast.error(result.message);
      return;
    }

    // 2) Stream is live — close dialog and bind video
    setShowExternalSetup(false);
    streamRef.current = result.stream;
    if (videoRef.current) {
      videoRef.current.srcObject = result.stream;
      videoRef.current.play().catch(() => {});
    }
    setPhase("ready");
    toast.success("Externe Kamera verbunden — wechsle jetzt zur Kamera-App!");

    // 3) AFTER capture: connectivity hint (non-blocking)
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      toast.warning(
        "Kein Internet erkannt. Aktiviere mobile Daten — die WiFi-Kamera liefert kein Internet."
      );
      return;
    }
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 4000);
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health`, {
        method: "GET",
        signal: ctrl.signal,
        cache: "no-store",
      });
      clearTimeout(timeout);
    } catch {
      toast.warning(
        "FieldIQ-Server nicht erreichbar. Prüfe Mobilfunk-Empfang — WiFi-Kamera liefert kein Internet."
      );
    }
  }, [displayCapture]);

  const startRecording = useCallback(() => {
    if (videoRef.current) {
      setTimeout(() => {
        if (videoRef.current) {
          liveCaptureRef.current = startLiveCapture(videoRef.current);
        }
      }, 300);
    }

    if (hasHighlights && !isHelper && streamRef.current) {
      videoRecorderRef.current = startVideoRecorder(streamRef.current);
    }

    const now = new Date().toISOString();
    setPhase("recording");
    setRecordingStartTime(Date.now());
    setFrameCount(0);
    setSyncedFrames(0);
    setElapsedSeconds(0);
    lastUploadedIndexRef.current = 0;
    chunkIndexRef.current = 0;
    deltaRetryCountRef.current = 0;
    if (navigator.vibrate) navigator.vibrate(50);

    // Persist timing
    updateMatchTiming({
      recording_started_at: now,
      h1_started_at: now,
    });

    const countInterval = setInterval(() => {
      setFrameCount(liveCaptureRef.current?.getFrameCount() ?? 0);
    }, 5000);
    (streamRef as any)._countInterval = countInterval;

    // Delta upload every 45s
    if (isHelper) {
      deltaUploadRef.current = setInterval(() => {
        if (deltaRetryCountRef.current < 3) {
          uploadDelta();
        }
      }, 45000);
    }
  }, [hasHighlights, isHelper, uploadDelta, updateMatchTiming]);

  const handleSetupComplete = useCallback(async () => {
    await initCamera();
  }, [initCamera]);

  const handleReadyStart = useCallback(() => {
    startRecording();
  }, [startRecording]);

  // ── Upload frames via edge function (anonymous helper) ──
  const uploadViaEdgeFunction = useCallback(async (
    frames: string[],
    durationSec: number,
    phaseStr: string,
  ) => {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camera-ops`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          action: "upload-frames",
          session_token: sessionToken,
          match_id: matchId,
          frames,
          duration_sec: durationSec,
          phase: phaseStr,
        }),
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `Upload fehlgeschlagen (${res.status})`);
    }
    return res.json();
  }, [sessionToken, matchId]);

  // ── Upload frames directly (authenticated user) ──
  const uploadDirect = useCallback(async (
    frames: string[],
    durationSec: number,
    phaseStr: string,
  ) => {
    // 1. Upload phase-specific file (_h1, _h2, or canonical for full)
    const suffix = phaseStr !== "full" ? `_${phaseStr}` : "";
    const filePath = `${matchId}${suffix}.json`;

    const framesJson = JSON.stringify({
      frames,
      duration_sec: durationSec,
      phase: phaseStr,
      captured_at: new Date().toISOString(),
    });
    await supabase.storage
      .from("match-frames")
      .upload(filePath, new Blob([framesJson], { type: "application/json" }), { upsert: true });

    // 2. Update canonical file (merge H1+H2 or write full)
    const canonicalPath = `${matchId}.json`;
    if (phaseStr !== "full") {
      // Merge: load existing canonical frames (if any) and append new ones
      let existingFrames: string[] = [];
      try {
        const { data: existing } = await supabase.storage
          .from("match-frames")
          .download(canonicalPath);
        if (existing) {
          const parsed = JSON.parse(await existing.text());
          existingFrames = parsed.frames ?? [];
        }
      } catch { /* no existing canonical — first half */ }

      const mergedJson = JSON.stringify({
        frames: [...existingFrames, ...frames],
        duration_sec: durationSec,
        phase: "merged",
        captured_at: new Date().toISOString(),
      });
      await supabase.storage
        .from("match-frames")
        .upload(canonicalPath, new Blob([mergedJson], { type: "application/json" }), { upsert: true });
    }

    // 3. Determine job_kind: intermediate for H1, final for H2/full
    const jobKind = phaseStr === "h1" ? "h1_intermediate" : "final";

    const { data: job, error: jobError } = await supabase.from("analysis_jobs").insert({
      match_id: matchId!,
      status: "queued",
      progress: 0,
      job_kind: jobKind,
    }).select().single();
    if (jobError) throw jobError;

    await supabase.from("matches").update({ status: "processing" }).eq("id", matchId!);

    // 4. Invoke analyze-match WITHOUT inline frames — it loads from storage
    const { error: fnError } = await supabase.functions.invoke("analyze-match", {
      body: {
        match_id: matchId,
        job_id: job.id,
        duration_sec: durationSec,
        phase: phaseStr,
      },
    });
    if (fnError) throw fnError;

    return { job_id: job.id };
  }, [matchId]);

  // ── Halftime: upload first half, pause, keep camera stream alive ──
  const triggerHalftime = useCallback(async () => {
    if (!matchId || !liveCaptureRef.current || uploading) return;

    const captureResult = liveCaptureRef.current.stop();
    liveCaptureRef.current = null;
    if ((streamRef as any)._countInterval) clearInterval((streamRef as any)._countInterval);

    if (captureResult.frames.length === 0) {
      toast.error("Keine Frames für Halbzeit-Analyse");
      return;
    }

    // Persist h1_ended_at
    updateMatchTiming({ h1_ended_at: new Date().toISOString() });

    setUploading(true);
    try {
      if (isHelper) {
        await uploadViaEdgeFunction(captureResult.frames, captureResult.durationSec, "h1");
      } else {
        await uploadDirect(captureResult.frames, captureResult.durationSec, "h1");
      }

      setPhase("halftime_pause");
      setHalfNumber(2);
      setFrameCount(0);
      setSyncedFrames(0);
      if (navigator.vibrate) navigator.vibrate([50, 100, 50]);
      toast.success("1. Halbzeit hochgeladen — Analyse läuft!");
    } catch (err: any) {
      toast.error(err.message ?? "Halbzeit-Upload fehlgeschlagen");
      if (videoRef.current) {
        liveCaptureRef.current = startLiveCapture(videoRef.current);
      }
    } finally {
      setUploading(false);
    }
  }, [matchId, isHelper, uploadViaEdgeFunction, uploadDirect, uploading, updateMatchTiming]);

  // ── Auto-detect side swap by comparing average player x-positions ──
  // Heuristic: query latest frame_positions before pause; if home avg-x is now in opposite half, suggest swap.
  const detectSideSwap = useCallback(async (): Promise<boolean | null> => {
    if (!matchId) return null;
    try {
      const { data: results } = await supabase
        .from("analysis_results")
        .select("data")
        .eq("match_id", matchId)
        .eq("result_type", "frame_positions")
        .order("created_at", { ascending: false })
        .limit(1);
      const frames = (results?.[0]?.data as any)?.frames;
      if (!Array.isArray(frames) || frames.length === 0) return null;
      // Take the LAST analyzed frame (closest to halftime)
      const lastFrame = frames[frames.length - 1];
      const players = lastFrame?.players ?? [];
      const homePlayers = players.filter((p: any) => p.team === "home");
      if (homePlayers.length < 3) return null;
      const homeAvgX = homePlayers.reduce((sum: number, p: any) => sum + (p.x ?? 50), 0) / homePlayers.length;
      // Convention: home defends left half (x<50) in H1. If avg-x > 60 in H1's last frame → already on right → swap likely true for H2
      // Standard football: teams swap, so if H1 had home on left (avg<50), H2 expects home on right.
      // We can't measure H2 yet, so fall back to standard rule (swap=true) unless evidence of H1 home-on-right.
      // Return null = unknown — let UI default to "swap = true"
      return homeAvgX < 50 ? true : false;
    } catch {
      return null;
    }
  }, [matchId]);

  // ── Open the side-swap confirmation dialog before actually starting H2 ──
  const requestStartSecondHalf = useCallback(async () => {
    const detected = await detectSideSwap();
    setAutoDetectedSwap(detected);
    setShowSideSwapDialog(true);
  }, [detectSideSwap]);

  // ── Start second half (called after side-swap dialog confirms) ──
  const startSecondHalf = useCallback(async (sidesSwapped: boolean) => {
    if (videoRef.current) {
      liveCaptureRef.current = startLiveCapture(videoRef.current);
    }

    if (hasHighlights && !isHelper && streamRef.current) {
      videoRecorderRef.current = startVideoRecorder(streamRef.current);
    }

    const now = new Date().toISOString();
    setPhase("recording");
    setRecordingStartTime(Date.now());
    setFrameCount(0);
    setSyncedFrames(0);
    setElapsedSeconds(0);
    lastUploadedIndexRef.current = 0;
    chunkIndexRef.current = 0;
    if (navigator.vibrate) navigator.vibrate(50);

    // Persist h2_started_at AND swap flag
    updateMatchTiming({ h2_started_at: now });
    if (matchId && !isHelper) {
      await supabase.from("matches").update({ h2_sides_swapped: sidesSwapped } as any).eq("id", matchId);
    } else if (matchId && isHelper && sessionToken) {
      // Route through edge function so anonymous helpers can persist this flag too
      try {
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camera-ops`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              action: "update-timing",
              session_token: sessionToken,
              match_id: matchId,
              timing: { h2_sides_swapped: sidesSwapped },
            }),
          },
        );
      } catch { /* non-critical */ }
    }

    toast.success(sidesSwapped ? "2. Halbzeit gestartet — Seiten getauscht ↔" : "2. Halbzeit gestartet — gleiche Seiten");

    const countInterval = setInterval(() => {
      setFrameCount(liveCaptureRef.current?.getFrameCount() ?? 0);
    }, 5000);
    (streamRef as any)._countInterval = countInterval;
  }, [hasHighlights, isHelper, updateMatchTiming, matchId, sessionToken]);

  const requestStop = useCallback(() => {
    if (!canStopRecording(frameCount)) {
      toast.warning("Noch keine Frames erfasst");
      return;
    }
    setShowStopConfirm(true);
  }, [frameCount]);

  // Pause capture but keep camera stream alive for possible resume
  const confirmStop = useCallback(async () => {
    if (!matchId) return;
    setShowStopConfirm(false);

    // Stop frame capture but DON'T kill the camera stream yet
    const captureResult = liveCaptureRef.current?.stop();
    liveCaptureRef.current = null;

    if ((streamRef as any)._countInterval) clearInterval((streamRef as any)._countInterval);
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    if (deltaUploadRef.current) clearInterval(deltaUploadRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

    if (!captureResult || captureResult.frames.length === 0) {
      toast.error("Keine Frames aufgenommen");
      setPhase("setup");
      return;
    }

    // Store captured frames for later finalize or resume
    stoppedCaptureRef.current = { frames: captureResult.frames, durationSec: captureResult.durationSec };
    setPhase("stopped");
    if (navigator.vibrate) navigator.vibrate([30, 60, 30]);
  }, [matchId]);

  // Resume recording after accidental stop — re-start capture with existing stream
  const resumeRecording = useCallback(() => {
    if (videoRef.current) {
      liveCaptureRef.current = startLiveCapture(videoRef.current, stoppedCaptureRef.current?.frames);
    }

    if (hasHighlights && !isHelper && streamRef.current) {
      videoRecorderRef.current = startVideoRecorder(streamRef.current);
    }

    stoppedCaptureRef.current = null;
    setPhase("recording");
    setRecordingStartTime(Date.now());
    setElapsedSeconds(0);
    lastUploadedIndexRef.current = 0;
    chunkIndexRef.current = 0;
    if (navigator.vibrate) navigator.vibrate(50);

    const countInterval = setInterval(() => {
      setFrameCount(liveCaptureRef.current?.getFrameCount() ?? 0);
    }, 5000);
    (streamRef as any)._countInterval = countInterval;

    if (isHelper) {
      deltaUploadRef.current = setInterval(() => {
        if (deltaRetryCountRef.current < 3) uploadDelta();
      }, 45000);
    }

    toast.success("Aufnahme fortgesetzt!");
  }, [hasHighlights, isHelper, uploadDelta]);

  // Finalize: destroy stream, upload, start analysis
  const finalizeStop = useCallback(async () => {
    if (!matchId || !stoppedCaptureRef.current) return;

    const captureResult = stoppedCaptureRef.current;
    stoppedCaptureRef.current = null;

    // Now kill everything
    videoRecorderRef.current?.stop();
    videoRecorderRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;

    // Persist end timing
    const now = new Date().toISOString();
    const timingFields: Record<string, string> = { recording_ended_at: now };
    if (halfNumber === 2) {
      timingFields.h2_ended_at = now;
    } else {
      timingFields.h1_ended_at = now;
    }
    updateMatchTiming(timingFields);

    setPhase("analyzing");
    setProgress(20);

    const phaseStr = halfNumber === 2 ? "h2" : "full";

    try {
      setProgress(40);

      if (isHelper) {
        await uploadViaEdgeFunction(captureResult.frames, captureResult.durationSec, phaseStr);
      } else {
        await uploadDirect(captureResult.frames, captureResult.durationSec, phaseStr);
      }

      setProgress(100);
      setPhase("done");
      clearSession();
      if (navigator.vibrate) navigator.vibrate([50, 100, 50]);
      toast.success("Endanalyse gestartet!");
    } catch (err: any) {
      toast.error(err.message ?? "Analyse fehlgeschlagen");
      setPhase("setup");
    }
  }, [matchId, halfNumber, isHelper, uploadViaEdgeFunction, uploadDirect, updateMatchTiming]);

  // Code entry or restoring phase
  if (phase === "code" || phase === "restoring") {
    return phase === "restoring" ? (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Session wird wiederhergestellt…</p>
        </div>
      </div>
    ) : (
      <CameraCodeEntry onSuccess={handleCodeSuccess} />
    );
  }

  const progressPct = Math.min(100, Math.round((frameCount / RECOMMENDED_FRAMES) * 100));
  const timerDisplay = formatTimer(elapsedSeconds, halfNumber === 2);

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {matchId && (phase === "ready" || phase === "recording" || phase === "halftime_pause") && (
        <WalkieTalkie
          matchId={matchId}
          userId={isHelper ? (sessionId ?? `helper-${sessionToken.slice(0, 8)}`) : "trainer"}
          userName={isHelper ? `Kamera ${1}` : "Trainer"}
        />
      )}
      <RecordingGuard isRecording={phase === "recording"} frameCount={frameCount} />
      <StopConfirmDialog
        open={showStopConfirm}
        onOpenChange={setShowStopConfirm}
        onConfirm={confirmStop}
        frameCount={frameCount}
      />
      <SideSwapDialog
        open={showSideSwapDialog}
        onOpenChange={setShowSideSwapDialog}
        autoDetected={autoDetectedSwap}
        homeTeamName={homeTeamName}
        awayTeamName={awayTeamName}
        onConfirm={(swapped) => startSecondHalf(swapped)}
      />
      <ExternalCameraSetup
        open={showExternalSetup}
        onOpenChange={setShowExternalSetup}
        onConfirm={startExternalCapture}
        isIOS={displayCapture.isIOS}
        onPickAlternative={(mode) => {
          setShowExternalSetup(false);
          // Switch URL away from external mode and let the user pick again.
          const next = new URLSearchParams(searchParams);
          next.set("mode", mode);
          setSearchParams(next, { replace: true });
          // Trigger a soft reload of the camera init flow
          if (mode === "self") {
            // Re-run init for direct camera capture
            setTimeout(() => initCamera(), 50);
          } else if (mode === "helper") {
            toast.info("Wechsle zum Helfer-Flow: Code aus dem Match-Setup teilen.");
          } else if (mode === "upload") {
            toast.info("Wechsle in den Upload-Flow im Match-Setup.");
          }
        }}
      />

      <div className="relative flex-1 bg-black">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted autoPlay />

        {phase === "setup" && (
          <CameraSetupOverlay
            onDismiss={() => initCamera()}
            onStart={handleSetupComplete}
          />
        )}

        {phase === "ready" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 gap-4 px-6">
            <Camera className="h-14 w-14 md:h-16 md:w-16" />
            <p className="text-base md:text-lg font-medium text-center">Kamera bereit</p>
            <p className="text-xs md:text-sm text-white/40 text-center">
              <ImageIcon className="inline h-3 w-3 mr-1" />
              Alle 30 Sek. wird ein Standbild erfasst
            </p>
            {/* Landscape orientation hint */}
            <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 border border-white/20">
              <span className="text-lg">📱↔️</span>
              <span className="text-xs text-white/60">Querformat empfohlen</span>
            </div>
            {/* Camera lens toggle — always show for feedback */}
            <button
              onClick={async () => {
                if (ultraWide.hasMultipleCameras) {
                  await ultraWide.cycleCamera();
                  streamRef.current = ultraWide.getStream();
                }
              }}
              disabled={ultraWide.switching || !ultraWide.hasMultipleCameras}
              className={`flex items-center gap-2 rounded-full px-4 py-2 border transition-colors ${
                ultraWide.hasMultipleCameras
                  ? "bg-white/10 hover:bg-white/20 border-white/20"
                  : "bg-white/5 border-white/10 opacity-50"
              }`}
            >
              <Maximize2 className="h-4 w-4 text-white/70" />
              <span className="text-xs text-white/70 font-medium">
                {ultraWide.hasMultipleCameras
                  ? `${ultraWide.currentCameraLabel()} — tippen zum Wechseln`
                  : `${ultraWide.cameraCount} Kamera erkannt`}
              </span>
            </button>
            {isHelper && !transferAuthorized && (
              <div className="flex items-center gap-1.5 bg-destructive/20 rounded-full px-4 py-2 border border-destructive/30">
                <Loader2 className="h-3.5 w-3.5 text-destructive animate-spin" />
                <span className="text-xs text-destructive font-medium">Warte auf Freigabe vom Trainer…</span>
              </div>
            )}
            {isHelper && transferAuthorized && (
              <div className="flex items-center gap-1.5 bg-primary/20 rounded-full px-3 py-1">
                <Wifi className="h-3 w-3 text-primary" />
                <span className="text-xs text-primary">Live-Verbindung aktiv — Freigabe erteilt</span>
              </div>
            )}
          </div>
        )}

        {phase === "recording" && (
          <>
            {/* Recording indicator with pulsing ring and live timer */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <div className="flex items-center gap-2 bg-destructive/90 rounded-full px-3 py-2 shadow-lg shadow-destructive/20">
                <div className="relative">
                  <div className="h-3 w-3 rounded-full bg-white animate-pulse" />
                  <div className="absolute inset-0 h-3 w-3 rounded-full bg-white/30 animate-ping" />
                </div>
                <span className="text-xs text-white font-semibold">
                  {halfNumber === 2 ? "2. HZ" : "REC"}
                </span>
                <span className="text-xs text-white/80 font-mono">{timerDisplay}</span>
              </div>
              {/* Live score badge */}
              {!isTraining && (
                <div className="bg-black/70 rounded-full px-3 py-2 flex items-center gap-1.5 shadow-lg">
                  <span className="text-xs text-white font-bold">{homeTeamName.slice(0, 8)}</span>
                  <span className="text-sm text-white font-mono font-bold">{liveHomeGoals}</span>
                  <span className="text-xs text-white/60">:</span>
                  <span className="text-sm text-white font-mono font-bold">{liveAwayGoals}</span>
                  <span className="text-xs text-white font-bold">{awayTeamName.slice(0, 8)}</span>
                </div>
              )}
            </div>

            {/* Frame counter + ultra-wide toggle + sync status */}
            <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
              {ultraWide.hasMultipleCameras && (
                <button
                  onClick={async () => {
                    await ultraWide.cycleCamera();
                    streamRef.current = ultraWide.getStream();
                    toast.success(ultraWide.currentCameraLabel());
                  }}
                  disabled={ultraWide.switching}
                  className="bg-black/70 hover:bg-black/80 rounded-full px-3 py-1.5 flex items-center gap-1.5 transition-colors"
                >
                  <Maximize2 className="h-3 w-3 text-white" />
                  <span className="text-xs text-white font-bold font-mono">
                    {ultraWide.currentCameraLabel()}
                  </span>
                </button>
              )}
              <div className="bg-black/60 rounded-full px-3 py-1.5">
                <span className="text-xs text-white font-medium">{frameCount} Frames</span>
              </div>
              {isHelper && syncedFrames > 0 && (
                <div className="flex items-center gap-1 bg-primary/80 rounded-full px-2 py-0.5">
                  <CloudUpload className="h-2.5 w-2.5 text-white" />
                  <span className="text-[10px] text-white">{syncedFrames} sync</span>
                </div>
              )}
            </div>

            {/* Frame progress bar */}
            <div className="absolute top-14 left-4 right-4">
              <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${progressPct}%`,
                    backgroundColor: progressPct < 66 ? "rgb(245, 158, 11)" : "rgb(34, 197, 94)",
                  }}
                />
              </div>
            </div>

            {/* Event quick bar — bottom center on mobile for thumb access */}
            {matchId && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 md:left-auto md:right-4 md:translate-x-0">
                <MatchEventQuickBar
                  matchId={matchId}
                  recorderRef={videoRecorderRef}
                  recordingStartTime={recordingStartTime}
                  sessionToken={isHelper ? sessionToken : undefined}
                  highlightsEnabled={hasHighlights && !isHelper}
                  halfNumber={halfNumber}
                  isTraining={isTraining}
                  homeTeamName={homeTeamName}
                  awayTeamName={awayTeamName}
                  onGoalEvent={(team) => {
                    if (team === "home") setLiveHomeGoals(p => p + 1);
                    else setLiveAwayGoals(p => p + 1);
                  }}
                  onEventDeleted={(type, team) => {
                    if (type === "goal") {
                      if (team === "home") setLiveHomeGoals(p => Math.max(0, p - 1));
                      else setLiveAwayGoals(p => Math.max(0, p - 1));
                    }
                  }}
                />
              </div>
            )}
          </>
        )}

        {phase === "halftime_pause" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-4">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <p className="text-lg font-semibold text-white">Halbzeit-Pause</p>
            <p className="text-sm text-white/60 text-center px-8">
              1. Halbzeit wurde hochgeladen.<br />
              Analyse läuft im Hintergrund.
            </p>
            <Link to={`/matches/${matchId}/report`} className="flex items-center gap-2 bg-white/90 rounded-full px-4 py-2">
              <Eye className="h-4 w-4 text-primary" />
              <span className="text-sm text-primary font-medium">Ergebnisse ansehen</span>
            </Link>
          </div>
        )}

        {phase === "stopped" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-4 px-6">
            <Pause className="h-14 w-14 text-amber-400" />
            <p className="text-lg font-semibold text-white">Aufnahme pausiert</p>
            <p className="text-sm text-white/60 text-center">
              {frameCount} Frames aufgenommen. Fortsetzen oder Analyse starten?
            </p>
          </div>
        )}

        {phase === "done" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 gap-4">
            <CheckCircle2 className="h-16 w-16 text-primary" />
            <p className="text-lg font-semibold">Analyse gestartet!</p>
            <p className="text-sm text-muted-foreground">Die Analyse wird automatisch durchgeführt.</p>
          </div>
        )}
      </div>

      <div className="safe-area-pad border-t border-border bg-background p-3 space-y-1.5">
        {phase === "ready" && (
          <Button
            onClick={() => { if (navigator.vibrate) navigator.vibrate(50); handleReadyStart(); }}
            size="lg"
            className="w-full gap-2 h-12 text-base active:scale-[0.97] transition-transform"
            disabled={isHelper && !transferAuthorized}
          >
            <Video className="h-5 w-5" />
            {isHelper && !transferAuthorized ? "Warte auf Freigabe…" : "Aufnahme starten"}
          </Button>
        )}
        {phase === "recording" && (
          <div className="flex gap-1.5">
            {/* Halftime button — hidden for training sessions */}
            {!isTraining && (
              <Button
                onClick={triggerHalftime}
                disabled={uploading || frameCount < 1}
                variant="secondary"
                className="flex-1 gap-1.5 h-10 text-sm border border-primary/30 bg-primary/10 hover:bg-primary/20"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Pause className="h-4 w-4 text-primary" />
                )}
                Halbzeit
              </Button>
            )}

            {/* Stop button */}
            <Button
              onClick={requestStop}
              variant="destructive"
              className={`gap-1.5 h-10 text-sm ${isTraining ? "flex-1" : "flex-1"}`}
              disabled={!canStopRecording(frameCount)}
            >
              <Square className="h-4 w-4" />
              {frameCount < RECOMMENDED_FRAMES
                ? `Stopp (${frameCount})`
                : "Stopp & Analyse"}
            </Button>
          </div>
        )}

        {phase === "stopped" && (
          <div className="space-y-2">
            <Button
              onClick={resumeRecording}
              size="lg"
              className="w-full gap-2 h-14 text-base"
            >
              <Play className="h-5 w-5" /> Aufnahme fortsetzen
            </Button>
            <Button
              onClick={finalizeStop}
              size="lg"
              variant="destructive"
              className="w-full gap-2 h-12 text-base"
            >
              <Square className="h-4 w-4" /> Endgültig stoppen & Analyse starten
            </Button>
          </div>
        )}
        {phase === "halftime_pause" && (
          <div className="space-y-2">
            <Button
              onClick={requestStartSecondHalf}
              size="lg"
              className="w-full gap-2 h-14 text-base"
            >
              <Play className="h-5 w-5" /> 2. Halbzeit starten
            </Button>
            <Link to={`/matches/${matchId}/processing`}>
              <Button size="lg" variant="outline" className="w-full gap-2 h-12 text-sm">
                <FileText className="h-4 w-4" /> Zur Analyse (1. HZ)
              </Button>
            </Link>
          </div>
        )}

        {phase === "analyzing" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm font-medium">Frames werden hochgeladen…</span>
            </div>
            <Progress value={progress} />
          </div>
        )}
        {phase === "done" && (
          <div className="space-y-2">
            <Link to={`/matches/${matchId}/processing`}>
              <Button size="lg" className="w-full gap-2 h-14 text-base">
                <FileText className="h-5 w-5" /> Zur Analyse
              </Button>
            </Link>
            <Button onClick={() => { setFrameCount(0); setSyncedFrames(0); setHalfNumber(1); setPhase("setup"); }} size="lg" variant="outline" className="w-full gap-2 h-12 text-sm">
              <Video className="h-4 w-4" /> Weitere Aufnahme
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
