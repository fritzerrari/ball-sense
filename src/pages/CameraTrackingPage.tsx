import { useState, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Video, Square, CheckCircle2, Loader2, Camera, ImageIcon } from "lucide-react";
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

      // Start frame capture after short delay for video to render
      setTimeout(() => {
        if (videoRef.current) {
          liveCaptureRef.current = startLiveCapture(videoRef.current);
        }
      }, 500);

      setPhase("recording");
      if (navigator.vibrate) navigator.vibrate(50);

      // Update frame count periodically
      const countInterval = setInterval(() => {
        setFrameCount(liveCaptureRef.current?.getFrameCount() ?? 0);
      }, 5000);
      (streamRef as any)._countInterval = countInterval;
    } catch (err) {
      toast.error("Kamera konnte nicht gestartet werden");
      console.error(err);
    }
  }, []);

  const stopAndAnalyze = useCallback(async () => {
    if (!matchId) return;

    // Stop capture
    const captureResult = liveCaptureRef.current?.stop();
    liveCaptureRef.current = null;

    // Stop camera
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
      // Create analysis job
      const { data: job, error: jobError } = await supabase.from("analysis_jobs").insert({
        match_id: matchId,
        status: "queued",
        progress: 0,
      }).select().single();
      if (jobError) throw jobError;

      setProgress(40);

      // Update match status
      await supabase.from("matches").update({ status: "processing" }).eq("id", matchId);

      // Send frames to analyze-match
      const { error: fnError } = await supabase.functions.invoke("analyze-match", {
        body: {
          match_id: matchId,
          job_id: job.id,
          frames: captureResult.frames,
          duration_sec: captureResult.durationSec,
          session_token: sessionToken,
        },
      });

      if (fnError) throw fnError;
      setProgress(100);
      setPhase("done");
      if (navigator.vibrate) navigator.vibrate([50, 100, 50]);
      toast.success("Analyse gestartet!");
    } catch (err: any) {
      toast.error(err.message ?? "Analyse fehlgeschlagen");
      setPhase("ready");
    }
  }, [matchId, sessionToken]);

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

      <div className="safe-area-pad border-t border-border bg-background p-4">
        {phase === "ready" && (
          <Button onClick={startRecording} size="lg" className="w-full gap-2 h-14 text-base">
            <Video className="h-5 w-5" /> Aufnahme starten
          </Button>
        )}
        {phase === "recording" && (
          <Button onClick={stopAndAnalyze} size="lg" variant="destructive" className="w-full gap-2 h-14 text-base">
            <Square className="h-5 w-5" /> Stoppen & Analysieren
          </Button>
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
          <Button onClick={() => { setFrameCount(0); setPhase("ready"); }} size="lg" variant="outline" className="w-full gap-2 h-14 text-base">
            <Video className="h-5 w-5" /> Weitere Aufnahme
          </Button>
        )}
      </div>
    </div>
  );
}
