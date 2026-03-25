import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft, Calendar, Upload, Video, Square, Loader2, Check,
  Swords, ArrowRight, Sparkles, FileVideo, ImageIcon, Clock,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useFields } from "@/hooks/use-fields";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { captureFramesFromFile, startLiveCapture, type FrameCaptureResult } from "@/lib/frame-capture";

type Step = "info" | "upload" | "processing";

export default function NewMatch() {
  const navigate = useNavigate();
  const { clubName, clubId, session } = useAuth();
  const { data: fields } = useFields();

  const [step, setStep] = useState<Step>("info");

  // Step 1: Match info
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [kickoff, setKickoff] = useState("");
  const [fieldId, setFieldId] = useState("");
  const [awayName, setAwayName] = useState("");
  
  const [creating, setCreating] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);

  // Step 2: Upload
  const [uploadMode, setUploadMode] = useState<"file" | "record">("file");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Record mode
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const liveCaptureRef = useRef<ReturnType<typeof startLiveCapture> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [halftimeSent, setHalftimeSent] = useState(false);
  const [halftimeSending, setHalftimeSending] = useState(false);

  useEffect(() => {
    if (fields?.length && !fieldId) setFieldId(fields[0].id);
  }, [fields, fieldId]);

  const handleCreateMatch = async () => {
    if (!fieldId || !clubId) {
      toast.error("Bitte wähle einen Platz");
      return;
    }
    setCreating(true);
    try {
      const { data: newMatch, error } = await supabase
        .from("matches")
        .insert({
          date,
          kickoff: kickoff || null,
          field_id: fieldId,
          away_club_name: awayName || null,
          home_club_id: clubId,
          match_type: "match",
          status: "setup",
          consent_players_confirmed: true,
          consent_minors_confirmed: true,
        })
        .select()
        .single();
      if (error) throw error;
      setMatchId(newMatch.id);
      setStep("upload");
      toast.success("Spiel angelegt!");
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Erstellen");
    } finally {
      setCreating(false);
    }
  };

  /** Persist frames to Storage, then send to analyze-match */
  const analyzeFrames = useCallback(async (captureResult: FrameCaptureResult) => {
    if (!matchId || !clubId) return;

    setStatusText("Frames werden gespeichert…");
    setUploadProgress(75);

    try {
      // Persist frames to Storage for retry/reprocess
      const framesJson = JSON.stringify({
        frames: captureResult.frames,
        duration_sec: captureResult.durationSec,
        captured_at: new Date().toISOString(),
      });
      const { error: storageError } = await supabase.storage
        .from("match-frames")
        .upload(`${matchId}.json`, new Blob([framesJson], { type: "application/json" }), {
          upsert: true,
        });
      if (storageError) console.error("Frame storage error:", storageError);

      setStatusText("Analyse wird gestartet…");
      setUploadProgress(85);

      // Create analysis job
      const { data: job, error: jobError } = await supabase.from("analysis_jobs").insert({
        match_id: matchId,
        status: "queued",
        progress: 0,
      }).select().single();
      if (jobError) throw jobError;

      // Update match status
      await supabase.from("matches").update({ status: "processing" }).eq("id", matchId);
      setUploadProgress(90);

      // Invoke analyze-match with frames
      const { error: fnError } = await supabase.functions.invoke("analyze-match", {
        body: {
          match_id: matchId,
          job_id: job.id,
          frames: captureResult.frames,
          duration_sec: captureResult.durationSec,
        },
      });
      if (fnError) {
        console.error("analyze-match error:", fnError);
      }

      setUploadProgress(100);
      setStep("processing");
      toast.success("Analyse gestartet!");
      setTimeout(() => navigate(`/matches/${matchId}/processing`), 1000);
    } catch (err: any) {
      toast.error(err.message ?? "Analyse konnte nicht gestartet werden");
      setUploading(false);
    }
  }, [matchId, clubId, navigate]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    setStatusText("Frames werden extrahiert…");

    try {
      const result = await captureFramesFromFile(file, (pct) => {
        setUploadProgress(Math.round(pct * 0.7)); // 0-70% for extraction
        setStatusText(`Frame ${Math.round(pct)}% extrahiert…`);
      });

      if (result.frames.length === 0) {
        throw new Error("Keine Frames konnten extrahiert werden");
      }

      setStatusText(`${result.frames.length} Frames extrahiert`);
      await analyzeFrames(result);
    } catch (err: any) {
      toast.error(err.message ?? "Frame-Extraktion fehlgeschlagen");
      setUploading(false);
    }
  };

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

      // Start live frame capture
      setTimeout(() => {
        if (videoRef.current) {
          liveCaptureRef.current = startLiveCapture(videoRef.current);
        }
      }, 500); // short delay for video element to render

      setIsRecording(true);
      if (navigator.vibrate) navigator.vibrate(50);

      // Update frame count periodically
      const countInterval = setInterval(() => {
        const count = liveCaptureRef.current?.getFrameCount() ?? 0;
        setFrameCount(count);
      }, 5000);

      // Store interval for cleanup
      (mediaRecorderRef as any)._countInterval = countInterval;
    } catch {
      toast.error("Kamera konnte nicht gestartet werden");
    }
  }, []);

  const stopAndAnalyze = useCallback(async () => {
    // Stop live capture
    const captureResult = liveCaptureRef.current?.stop();
    liveCaptureRef.current = null;

    // Stop camera stream
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsRecording(false);

    // Clear count interval
    if ((mediaRecorderRef as any)._countInterval) {
      clearInterval((mediaRecorderRef as any)._countInterval);
    }

    if (!captureResult || captureResult.frames.length === 0) {
      toast.error("Keine Frames aufgenommen. Bitte erneut versuchen.");
      return;
    }

    setUploading(true);
    setUploadProgress(70);
    setStatusText(`${captureResult.frames.length} Frames aufgenommen`);

    await analyzeFrames(captureResult);
  }, [analyzeFrames]);

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

      // Fire and forget
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

  const showHalftimeButton = isRecording && frameCount >= 3 && !halftimeSent;

  const canProceed = Boolean(date && fieldId);

  return (
    <AppLayout>
      <div className="mx-auto max-w-xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/matches" className="rounded-lg p-2 transition-colors hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold font-display">Neues Spiel</h1>
            <p className="text-xs text-muted-foreground">
              {step === "info" && "In 30 Sekunden startklar"}
              {step === "upload" && "Video hochladen oder aufnehmen"}
              {step === "processing" && "Analyse läuft automatisch"}
            </p>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex gap-2">
          {["info", "upload", "processing"].map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${
              s === step ? "bg-primary" :
              ["info", "upload", "processing"].indexOf(step) > i ? "bg-primary/40" : "bg-muted"
            }`} />
          ))}
        </div>

        {/* Step 1: Match Info */}
        {step === "info" && (
          <div className="glass-card space-y-5 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Swords className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold font-display">Matchdaten</h2>
                <p className="text-xs text-muted-foreground">Nur das Wichtigste</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Gegner</label>
                <input
                  type="text"
                  value={awayName}
                  onChange={(e) => setAwayName(e.target.value)}
                  placeholder="z.B. FC Musterstadt"
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Datum *</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2.5 text-sm text-foreground"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Anstoß</label>
                <input
                  type="time"
                  value={kickoff}
                  onChange={(e) => setKickoff(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2.5 text-sm text-foreground"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Platz *</label>
              <select
                value={fieldId}
                onChange={(e) => setFieldId(e.target.value)}
                className="w-full rounded-lg border border-border bg-muted px-3 py-2.5 text-sm text-foreground"
              >
                {!fields?.length && <option value="">Kein Platz</option>}
                {(fields ?? []).map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            <Button
              onClick={handleCreateMatch}
              disabled={!canProceed || creating}
              className="w-full gap-2 h-12 text-base"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Weiter zum Upload
            </Button>
          </div>
        )}

        {/* Step 2: Upload */}
        {step === "upload" && !uploading && (
          <div className="space-y-4">
            <div className="flex gap-2 p-1 bg-muted rounded-xl">
              <button
                onClick={() => setUploadMode("file")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-all ${
                  uploadMode === "file" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Upload className="h-4 w-4" /> Video hochladen
              </button>
              <button
                onClick={() => setUploadMode("record")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-all ${
                  uploadMode === "record" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Video className="h-4 w-4" /> Aufnehmen
              </button>
            </div>

            {uploadMode === "file" && (
              <div className="glass-card p-8 text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <FileVideo className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold font-display">Spielvideo hochladen</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    MP4, MOV oder WebM — es werden nur Schlüsselbilder extrahiert (~50 KB pro Frame)
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button onClick={() => fileInputRef.current?.click()} size="lg" className="w-full gap-2 h-14 text-base">
                  <Upload className="h-5 w-5" /> Datei auswählen
                </Button>
                <p className="text-xs text-muted-foreground">
                  <ImageIcon className="inline h-3 w-3 mr-1" />
                  Das Video wird nicht hochgeladen — nur Einzelbilder alle 30 Sek.
                </p>
              </div>
            )}

            {uploadMode === "record" && (
              <div className="glass-card overflow-hidden">
                <div className="relative aspect-video bg-black rounded-t-xl overflow-hidden">
                  <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted autoPlay />
                  {!isRecording && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 gap-2">
                      <Video className="h-12 w-12" />
                      <p className="text-sm">Kamera bereit</p>
                    </div>
                  )}
                  {isRecording && (
                    <>
                      <div className="absolute top-3 left-3 flex items-center gap-2 bg-destructive/90 rounded-full px-3 py-1.5">
                        <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                        <span className="text-xs text-white font-medium">REC</span>
                      </div>
                      <div className="absolute top-3 right-3 bg-black/60 rounded-full px-3 py-1.5">
                        <span className="text-xs text-white font-medium">{frameCount} Frames</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="p-4 space-y-2">
                  {!isRecording ? (
                    <Button onClick={startRecording} size="lg" className="w-full gap-2 h-14 text-base">
                      <Video className="h-5 w-5" /> Aufnahme starten
                    </Button>
                  ) : (
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
                      {halftimeSent && (
                        <div className="flex items-center justify-center gap-2 py-1 text-xs text-primary">
                          <Check className="h-3 w-3" />
                          <span>HZ-Analyse läuft im Hintergrund</span>
                        </div>
                      )}
                      <Button onClick={stopAndAnalyze} size="lg" variant="destructive" className="w-full gap-2 h-14 text-base">
                        <Square className="h-5 w-5" /> Stoppen & Endanalyse
                      </Button>
                    </>
                  )}
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    <ImageIcon className="inline h-3 w-3 mr-1" />
                    Alle 30 Sek. wird ein Standbild erfasst — kein Video-Upload
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Uploading/Extracting state */}
        {uploading && (
          <div className="glass-card p-8 space-y-4 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <div>
              <h3 className="font-semibold font-display">{statusText || "Verarbeitung…"}</h3>
              <p className="text-sm text-muted-foreground mt-1">Bitte nicht schließen.</p>
            </div>
            <Progress value={uploadProgress} />
          </div>
        )}

        {/* Step 3: Processing redirect */}
        {step === "processing" && (
          <div className="glass-card p-8 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Sparkles className="h-8 w-8 text-primary animate-pulse" />
            </div>
            <div>
              <h3 className="font-semibold font-display text-lg">Analyse gestartet!</h3>
              <p className="text-sm text-muted-foreground mt-1">Du wirst zum Fortschritt weitergeleitet…</p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
