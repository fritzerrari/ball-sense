import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft, Calendar, Upload, Video, Square, Loader2, Check,
  Swords, ArrowRight, Sparkles, FileVideo,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useFields } from "@/hooks/use-fields";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";

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
  const [ageGroup, setAgeGroup] = useState("");
  const [creating, setCreating] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);

  // Step 2: Upload
  const [uploadMode, setUploadMode] = useState<"file" | "record">("file");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Record mode
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);

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

  const uploadVideoBlob = useCallback(async (blob: Blob, fileName: string) => {
    if (!matchId || !clubId) return;
    setUploading(true);
    setUploadProgress(10);
    try {
      const filePath = `matches/${matchId}/${fileName}`;
      setUploadProgress(20);

      const { error: storageError } = await supabase.storage
        .from("match-videos")
        .upload(filePath, blob, { contentType: blob.type, upsert: true });
      if (storageError) throw storageError;
      setUploadProgress(60);

      // Create match_videos entry
      const { error: dbError } = await supabase.from("match_videos").insert({
        match_id: matchId,
        club_id: clubId,
        file_path: filePath,
        file_size_bytes: blob.size,
        status: "uploaded",
      });
      if (dbError) throw dbError;
      setUploadProgress(80);

      // Create analysis job
      const { error: jobError } = await supabase.from("analysis_jobs").insert({
        match_id: matchId,
        status: "queued",
        progress: 0,
      });
      if (jobError) throw jobError;

      // Update match status
      await supabase.from("matches").update({ status: "processing" }).eq("id", matchId);
      setUploadProgress(100);

      toast.success("Video hochgeladen! Analyse startet…");
      setStep("processing");

      // Navigate to processing page
      setTimeout(() => navigate(`/matches/${matchId}/processing`), 1500);
    } catch (err: any) {
      toast.error(err.message ?? "Upload fehlgeschlagen");
      setUploading(false);
    }
  }, [matchId, clubId, navigate]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadVideoBlob(file, `upload-${Date.now()}.${file.name.split('.').pop()}`);
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => stream.getTracks().forEach(t => t.stop());
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      toast.error("Kamera konnte nicht gestartet werden");
    }
  }, []);

  const stopAndUpload = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsRecording(false);
    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    await uploadVideoBlob(blob, `recording-${Date.now()}.webm`);
  }, [uploadVideoBlob]);

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
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Altersklasse</label>
                <select
                  value={ageGroup}
                  onChange={(e) => setAgeGroup(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2.5 text-sm text-foreground"
                >
                  <option value="">Optional</option>
                  <option value="U19">U19</option>
                  <option value="U17">U17</option>
                  <option value="U15">U15</option>
                  <option value="U13">U13</option>
                  <option value="Herren">Herren</option>
                  <option value="Frauen">Frauen</option>
                </select>
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
            {/* Mode toggle */}
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
                  <p className="text-sm text-muted-foreground mt-1">MP4, MOV oder WebM — max. 2 GB</p>
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
                    <div className="absolute top-3 left-3 flex items-center gap-2 bg-destructive/90 rounded-full px-3 py-1.5">
                      <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                      <span className="text-xs text-white font-medium">REC</span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  {!isRecording ? (
                    <Button onClick={startRecording} size="lg" className="w-full gap-2 h-14 text-base">
                      <Video className="h-5 w-5" /> Aufnahme starten
                    </Button>
                  ) : (
                    <Button onClick={stopAndUpload} size="lg" variant="destructive" className="w-full gap-2 h-14 text-base">
                      <Square className="h-5 w-5" /> Stoppen & Hochladen
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Uploading state */}
        {uploading && (
          <div className="glass-card p-8 space-y-4 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <div>
              <h3 className="font-semibold font-display">Video wird hochgeladen…</h3>
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
