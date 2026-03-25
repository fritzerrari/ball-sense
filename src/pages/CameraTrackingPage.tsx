import { useState, useRef, useCallback } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Video, Square, CheckCircle2, Loader2, Camera, ImageIcon, Clock, FileText, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { startLiveCapture } from "@/lib/frame-capture";

type Phase = "ready" | "recording" | "analyzing" | "done";

export default function CameraTrackingPage() {
  const { id: matchId } = useParams();
  const [searchParams] = useSearchParams();
  const sessionToken = searchParams.get("token") ?? "";

  const [phase, setPhase] = useState<Phase>("ready");
  const [progress, setProgress] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [halftimeSent, setHalftimeSent] = useState(false);
  const [halftimeSending, setHalftimeSending] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveCaptureRef = useRef<ReturnType<typeof startLiveCapture> | null>(null);

  const startRecording = useCallback(async () => {
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

      setTimeout(() => {
        if (videoRef.current) {
          liveCaptureRef.current = startLiveCapture(videoRef.current);
        }
      }, 500);

      setPhase("recording");
      setHalftimeSent(false);
      if (navigator.vibrate) navigator.vibrate(50);

      const countInterval = setInterval(() => {
        setFrameCount(liveCaptureRef.current?.getFrameCount() ?? 0);
      }, 5000);
      (streamRef as any)._countInterval = countInterval;
    } catch (err) {
      toast.error("Kamera konnte nicht gestartet werden");
      console.error(err);
    }
  }, []);

  /** Send frames captured so far for halftime analysis WITHOUT stopping recording */
  const triggerHalftimeAnalysis = useCallback(async () => {
    if (!matchId || !liveCaptureRef.current) return;

    const snapshot = liveCaptureRef.current.getSnapshot();
    if (snapshot.frames.length < 3) {
      toast.error("Noch zu wenige Frames für eine Analyse");
      return;
    }

    setHalftimeSending(true);
    try {
      // Persist halftime frames
      const framesJson = JSON.stringify({
        frames: snapshot.frames,
        duration_sec: snapshot.durationSec,
        phase: "halftime",
        captured_at: new Date().toISOString(),
      });
      await supabase.storage
        .from("match-frames")
        .upload(`${matchId}.json`, new Blob([framesJson], { type: "application/json" }), { upsert: true });

      // Create halftime analysis job
      const { data: job, error: jobError } = await supabase.from("analysis_jobs").insert({
        match_id: matchId,
        status: "queued",
        progress: 0,
      }).select().single();
      if (jobError) throw jobError;

      await supabase.from("matches").update({ status: "processing" }).eq("id", matchId);

      // Fire and forget - don't await the full analysis
      supabase.functions.invoke("analyze-match", {
        body: {
          match_id: matchId,
          job_id: job.id,
          frames: snapshot.frames,
          duration_sec: snapshot.durationSec,
          phase: "halftime",
        },
      });

      setHalftimeSent(true);
      if (navigator.vibrate) navigator.vibrate([50, 100, 50]);
      toast.success("Halbzeit-Analyse gestartet! Aufnahme läuft weiter.");
    } catch (err: any) {
      toast.error(err.message ?? "Halbzeit-Analyse fehlgeschlagen");
    } finally {
      setHalftimeSending(false);
    }
  }, [matchId]);

  const stopAndAnalyze = useCallback(async () => {
    if (!matchId) return;

    const captureResult = liveCaptureRef.current?.stop();
    liveCaptureRef.current = null;

    streamRef.current?.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    if ((streamRef as any)._countInterval) clearInterval((streamRef as any)._countInterval);

    if (!captureResult || captureResult.frames.length === 0) {
      toast.error("Keine Frames aufgenommen");
      setPhase("ready");
      return;
    }

    setPhase("analyzing");
    setProgress(20);

    try {
      // Persist full-match frames (overwrite halftime)
      const framesJson = JSON.stringify({
        frames: captureResult.frames,
        duration_sec: captureResult.durationSec,
        phase: "full",
        captured_at: new Date().toISOString(),
      });
      await supabase.storage
        .from("match-frames")
        .upload(`${matchId}.json`, new Blob([framesJson], { type: "application/json" }), { upsert: true });

      setProgress(40);

      const { data: job, error: jobError } = await supabase.from("analysis_jobs").insert({
        match_id: matchId,
        status: "queued",
        progress: 0,
      }).select().single();
      if (jobError) throw jobError;

      await supabase.from("matches").update({ status: "processing" }).eq("id", matchId);

      const { error: fnError } = await supabase.functions.invoke("analyze-match", {
        body: {
          match_id: matchId,
          job_id: job.id,
          frames: captureResult.frames,
          duration_sec: captureResult.durationSec,
          phase: "full",
        },
      });

      if (fnError) throw fnError;
      setProgress(100);
      setPhase("done");
      if (navigator.vibrate) navigator.vibrate([50, 100, 50]);
      toast.success("Endanalyse gestartet!");
    } catch (err: any) {
      toast.error(err.message ?? "Analyse fehlgeschlagen");
      setPhase("ready");
    }
  }, [matchId, sessionToken]);

  const showHalftimeButton = phase === "recording" && frameCount >= 3 && !halftimeSent;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <div className="relative flex-1 bg-black">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted autoPlay />
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
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-destructive/90 rounded-full px-3 py-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
              <span className="text-xs text-white font-medium">Aufnahme</span>
            </div>
            <div className="absolute top-4 right-4 bg-black/60 rounded-full px-3 py-1.5">
              <span className="text-xs text-white font-medium">{frameCount} Frames</span>
            </div>
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
          <Button onClick={startRecording} size="lg" className="w-full gap-2 h-14 text-base">
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
            <Button onClick={stopAndAnalyze} size="lg" variant="destructive" className="w-full gap-2 h-14 text-base">
              <Square className="h-5 w-5" /> Stoppen & Endanalyse
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
            <Button onClick={() => { setFrameCount(0); setHalftimeSent(false); setPhase("ready"); }} size="lg" variant="outline" className="w-full gap-2 h-12 text-sm">
              <Video className="h-4 w-4" /> Weitere Aufnahme
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
