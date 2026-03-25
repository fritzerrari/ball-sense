import { useState, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Video, Square, CheckCircle2, Loader2, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Phase = "ready" | "recording" | "uploading" | "done";

export default function CameraTrackingPage() {
  const { id: matchId } = useParams();
  const [searchParams] = useSearchParams();
  const sessionToken = searchParams.get("token") ?? "";

  const [phase, setPhase] = useState<Phase>("ready");
  const [uploadProgress, setUploadProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

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

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setPhase("recording");
      if (navigator.vibrate) navigator.vibrate(50);
    } catch (err) {
      toast.error("Kamera konnte nicht gestartet werden");
      console.error(err);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    return new Promise<void>((resolve) => {
      const origStop = recorder.onstop;
      recorder.onstop = (e) => {
        if (typeof origStop === "function") origStop.call(recorder, e);
        resolve();
      };
      recorder.stop();
    });
  }, []);

  const uploadVideo = useCallback(async () => {
    if (!matchId) return;
    setPhase("uploading");
    setUploadProgress(10);

    try {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const filePath = `matches/${matchId}/camera-${Date.now()}.webm`;

      setUploadProgress(30);
      const { error: storageError } = await supabase.storage
        .from("match-videos")
        .upload(filePath, blob, { contentType: "video/webm", upsert: true });

      if (storageError) throw storageError;
      setUploadProgress(70);

      const { error: fnError } = await supabase.functions.invoke("camera-ops", {
        body: {
          action: "upload_video",
          match_id: matchId,
          file_path: filePath,
          duration_sec: Math.round(blob.size / 312_500),
          file_size_bytes: blob.size,
          session_token: sessionToken,
        },
      });

      if (fnError) throw fnError;
      setUploadProgress(100);
      setPhase("done");
      if (navigator.vibrate) navigator.vibrate([50, 100, 50]);
      toast.success("Video hochgeladen! Analyse wird gestartet.");
    } catch (err: any) {
      toast.error(err.message ?? "Upload fehlgeschlagen");
      setPhase("recording");
    }
  }, [matchId, sessionToken]);

  const handleStopAndUpload = useCallback(async () => {
    await stopRecording();
    await uploadVideo();
  }, [stopRecording, uploadVideo]);

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <div className="relative flex-1 bg-black">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted autoPlay />
        {phase === "ready" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 gap-4">
            <Camera className="h-16 w-16" />
            <p className="text-lg font-medium">Kamera bereit</p>
          </div>
        )}
        {phase === "recording" && (
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-destructive/90 rounded-full px-3 py-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
            <span className="text-xs text-white font-medium">Aufnahme</span>
          </div>
        )}
        {phase === "done" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 gap-4">
            <CheckCircle2 className="h-16 w-16 text-primary" />
            <p className="text-lg font-semibold">Upload abgeschlossen!</p>
            <p className="text-sm text-muted-foreground">Die Analyse wird automatisch gestartet.</p>
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
          <Button onClick={handleStopAndUpload} size="lg" variant="destructive" className="w-full gap-2 h-14 text-base">
            <Square className="h-5 w-5" /> Stoppen & Hochladen
          </Button>
        )}
        {phase === "uploading" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm font-medium">Video wird hochgeladen…</span>
            </div>
            <Progress value={uploadProgress} />
          </div>
        )}
        {phase === "done" && (
          <Button onClick={() => { chunksRef.current = []; setPhase("ready"); }} size="lg" variant="outline" className="w-full gap-2 h-14 text-base">
            <Video className="h-5 w-5" /> Weitere Aufnahme
          </Button>
        )}
      </div>
    </div>
  );
}
