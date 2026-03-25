import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Video, Square, CheckCircle2, Loader2, Camera, ImageIcon, Clock, FileText, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { startLiveCapture } from "@/lib/frame-capture";
import { startVideoRecorder, type VideoRecorderHandle } from "@/lib/video-recorder";
import RecordingGuard, { canStopRecording, MIN_FRAMES_FOR_ANALYSIS, RECOMMENDED_FRAMES } from "@/components/RecordingGuard";
import CameraSetupOverlay from "@/components/CameraSetupOverlay";
import StopConfirmDialog from "@/components/StopConfirmDialog";
import MatchEventQuickBar from "@/components/MatchEventQuickBar";
import { useModuleAccess } from "@/hooks/use-module-access";
import CameraCodeEntry from "@/components/CameraCodeEntry";

type Phase = "code" | "setup" | "ready" | "recording" | "analyzing" | "done";

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

export default function CameraTrackingPage() {
  const { id: matchIdParam } = useParams();
  const [searchParams] = useSearchParams();

  const [phase, setPhase] = useState<Phase>(matchIdParam ? "setup" : "code");
  const [matchId, setMatchId] = useState<string | null>(matchIdParam ?? null);
  const [sessionToken, setSessionToken] = useState(searchParams.get("token") ?? "");

  const [progress, setProgress] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [halftimeSent, setHalftimeSent] = useState(false);
  const [halftimeSending, setHalftimeSending] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveCaptureRef = useRef<ReturnType<typeof startLiveCapture> | null>(null);
  const videoRecorderRef = useRef<VideoRecorderHandle | null>(null);
  const [recordingStartTime, setRecordingStartTime] = useState(0);
  const { hasAccess: hasHighlights } = useModuleAccess("video_highlights");

  useIsAuthenticated();
  const isHelper = !!sessionToken?.trim();

  const handleCodeSuccess = useCallback((data: { matchId: string; cameraIndex: number; sessionToken: string }) => {
    setMatchId(data.matchId);
    setSessionToken(data.sessionToken);
    setPhase("setup");
  }, []);

  const initCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setPhase("ready");
    } catch {
      toast.error("Kamera konnte nicht gestartet werden");
    }
  }, []);

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

    setPhase("recording");
    setRecordingStartTime(Date.now());
    setHalftimeSent(false);
    if (navigator.vibrate) navigator.vibrate(50);

    const countInterval = setInterval(() => {
      setFrameCount(liveCaptureRef.current?.getFrameCount() ?? 0);
    }, 5000);
    (streamRef as any)._countInterval = countInterval;
  }, [hasHighlights, isHelper]);

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
    phase: string,
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
          phase,
        }),
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? "Upload fehlgeschlagen");
    }
    return res.json();
  }, [sessionToken, matchId]);

  // ── Upload frames directly (authenticated user) ──
  const uploadDirect = useCallback(async (
    frames: string[],
    durationSec: number,
    phaseStr: string,
  ) => {
    const framesJson = JSON.stringify({
      frames,
      duration_sec: durationSec,
      phase: phaseStr,
      captured_at: new Date().toISOString(),
    });
    await supabase.storage
      .from("match-frames")
      .upload(`${matchId}.json`, new Blob([framesJson], { type: "application/json" }), { upsert: true });

    const { data: job, error: jobError } = await supabase.from("analysis_jobs").insert({
      match_id: matchId!,
      status: "queued",
      progress: 0,
    }).select().single();
    if (jobError) throw jobError;

    await supabase.from("matches").update({ status: "processing" }).eq("id", matchId!);

    const { error: fnError } = await supabase.functions.invoke("analyze-match", {
      body: {
        match_id: matchId,
        job_id: job.id,
        frames,
        duration_sec: durationSec,
        phase: phaseStr,
      },
    });
    if (fnError) throw fnError;

    return { job_id: job.id };
  }, [matchId]);

  const triggerHalftimeAnalysis = useCallback(async () => {
    if (!matchId || !liveCaptureRef.current) return;

    const snapshot = liveCaptureRef.current.getSnapshot();
    if (snapshot.frames.length < 3) {
      toast.error("Noch zu wenige Frames für eine Analyse");
      return;
    }

    setHalftimeSending(true);
    try {
      if (isHelper) {
        await uploadViaEdgeFunction(snapshot.frames, snapshot.durationSec, "halftime");
      } else {
        await uploadDirect(snapshot.frames, snapshot.durationSec, "halftime");
      }

      setHalftimeSent(true);
      if (navigator.vibrate) navigator.vibrate([50, 100, 50]);
      toast.success("Halbzeit-Analyse gestartet!");
    } catch (err: any) {
      toast.error(err.message ?? "Halbzeit-Analyse fehlgeschlagen");
    } finally {
      setHalftimeSending(false);
    }
  }, [matchId, isHelper, uploadViaEdgeFunction, uploadDirect]);

  const requestStop = useCallback(() => {
    if (!canStopRecording(frameCount)) {
      toast.warning(`Mindestens ${MIN_FRAMES_FOR_ANALYSIS} Frames nötig (aktuell: ${frameCount})`);
      return;
    }
    setShowStopConfirm(true);
  }, [frameCount]);

  const confirmStop = useCallback(async () => {
    if (!matchId) return;
    setShowStopConfirm(false);

    const captureResult = liveCaptureRef.current?.stop();
    liveCaptureRef.current = null;
    videoRecorderRef.current?.stop();
    videoRecorderRef.current = null;

    streamRef.current?.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    if ((streamRef as any)._countInterval) clearInterval((streamRef as any)._countInterval);

    if (!captureResult || captureResult.frames.length === 0) {
      toast.error("Keine Frames aufgenommen");
      setPhase("setup");
      return;
    }

    setPhase("analyzing");
    setProgress(20);

    try {
      setProgress(40);

      if (isHelper) {
        await uploadViaEdgeFunction(captureResult.frames, captureResult.durationSec, "full");
      } else {
        await uploadDirect(captureResult.frames, captureResult.durationSec, "full");
      }

      setProgress(100);
      setPhase("done");
      if (navigator.vibrate) navigator.vibrate([50, 100, 50]);
      toast.success("Endanalyse gestartet!");
    } catch (err: any) {
      toast.error(err.message ?? "Analyse fehlgeschlagen");
      setPhase("setup");
    }
  }, [matchId, isHelper, uploadViaEdgeFunction, uploadDirect]);

  // Code entry phase
  if (phase === "code") {
    return <CameraCodeEntry onSuccess={handleCodeSuccess} />;
  }

  const showHalftimeButton = phase === "recording" && frameCount >= 3 && !halftimeSent;
  const progressPct = Math.min(100, Math.round((frameCount / RECOMMENDED_FRAMES) * 100));
  const elapsedMin = recordingStartTime ? Math.floor((Date.now() - recordingStartTime) / 60000) : 0;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <RecordingGuard isRecording={phase === "recording"} frameCount={frameCount} />
      <StopConfirmDialog
        open={showStopConfirm}
        onOpenChange={setShowStopConfirm}
        onConfirm={confirmStop}
        frameCount={frameCount}
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
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 gap-4">
            <Camera className="h-16 w-16" />
            <p className="text-lg font-medium">Kamera bereit</p>
            <p className="text-sm text-white/40">
              <ImageIcon className="inline h-3 w-3 mr-1" />
              Alle 30 Sek. wird ein Standbild erfasst
            </p>
          </div>
        )}

        {phase === "recording" && (
          <>
            {/* Recording indicator */}
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-destructive/90 rounded-full px-3 py-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
              <span className="text-xs text-white font-medium">Aufnahme</span>
            </div>

            {/* Frame counter + progress */}
            <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
              <div className="bg-black/60 rounded-full px-3 py-1.5">
                <span className="text-xs text-white font-medium">{frameCount} / {RECOMMENDED_FRAMES} Frames</span>
              </div>
              {elapsedMin > 0 && (
                <div className="bg-black/40 rounded-full px-2 py-0.5">
                  <span className="text-[10px] text-white/60">{elapsedMin} Min.</span>
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

            {/* Halftime info */}
            {halftimeSent && (
              <div className="absolute bottom-4 left-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 bg-primary/90 rounded-full px-3 py-1.5">
                  <CheckCircle2 className="h-3 w-3 text-white" />
                  <span className="text-xs text-white font-medium">HZ-Analyse läuft</span>
                </div>
                <Link to={`/matches/${matchId}/report`} className="flex items-center gap-2 bg-white/90 rounded-full px-3 py-1.5">
                  <Eye className="h-3 w-3 text-primary" />
                  <span className="text-xs text-primary font-medium">Ergebnisse ansehen</span>
                </Link>
              </div>
            )}

            {/* Event quick bar — ALWAYS shown during recording */}
            {matchId && (
              <div className="absolute bottom-4 right-4">
                <MatchEventQuickBar
                  matchId={matchId}
                  recorderRef={videoRecorderRef}
                  recordingStartTime={recordingStartTime}
                  sessionToken={isHelper ? sessionToken : undefined}
                  highlightsEnabled={hasHighlights && !isHelper}
                />
              </div>
            )}
          </>
        )}

        {phase === "done" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 gap-4">
            <CheckCircle2 className="h-16 w-16 text-primary" />
            <p className="text-lg font-semibold">Analyse gestartet!</p>
            <p className="text-sm text-muted-foreground">Die Analyse wird automatisch durchgeführt.</p>
          </div>
        )}
      </div>

      <div className="safe-area-pad border-t border-border bg-background p-4 space-y-2">
        {phase === "ready" && (
          <Button onClick={handleReadyStart} size="lg" className="w-full gap-2 h-14 text-base">
            <Video className="h-5 w-5" /> Aufnahme starten
          </Button>
        )}
        {phase === "recording" && (
          <>
            {showHalftimeButton && (
              <Button
                onClick={triggerHalftimeAnalysis}
                disabled={halftimeSending}
                size="lg"
                variant="secondary"
                className="w-full gap-2 h-12 text-base border border-primary/30 bg-primary/10 hover:bg-primary/20"
              >
                {halftimeSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Clock className="h-5 w-5 text-primary" />
                )}
                ⚽ Halbzeit-Analyse starten
              </Button>
            )}
            <Button
              onClick={requestStop}
              size="lg"
              variant="destructive"
              className="w-full gap-2 h-14 text-base"
              disabled={!canStopRecording(frameCount)}
            >
              <Square className="h-5 w-5" />
              {canStopRecording(frameCount)
                ? frameCount < RECOMMENDED_FRAMES
                  ? `Früh stoppen (${frameCount}/${RECOMMENDED_FRAMES})`
                  : "Stoppen & Endanalyse"
                : `Noch ${MIN_FRAMES_FOR_ANALYSIS - frameCount} Frames…`}
            </Button>
          </>
        )}
        {phase === "analyzing" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm font-medium">Frames werden analysiert…</span>
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
            <Button onClick={() => { setFrameCount(0); setHalftimeSent(false); setPhase("setup"); }} size="lg" variant="outline" className="w-full gap-2 h-12 text-sm">
              <Video className="h-4 w-4" /> Weitere Aufnahme
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
