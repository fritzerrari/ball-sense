import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft, Calendar, Upload, Video, Loader2,
  Swords, ArrowRight, Sparkles, FileVideo, ImageIcon,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useFields } from "@/hooks/use-fields";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { captureFramesFromFile, type FrameCaptureResult } from "@/lib/frame-capture";
import MatchRecordingChoice from "@/components/MatchRecordingChoice";
import CameraCodeShare from "@/components/CameraCodeShare";

type Step = "info" | "choice" | "code" | "upload" | "processing";

export default function NewMatch() {
  const navigate = useNavigate();
  const { clubId } = useAuth();
  const { data: fields } = useFields();

  const [step, setStep] = useState<Step>("info");

  // Step 1: Match info
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [fieldId, setFieldId] = useState("");
  const [awayName, setAwayName] = useState("");

  const [creating, setCreating] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setStep("choice");
      toast.success("Spiel angelegt! Die Feldkalibrierung läuft automatisch beim Aufnahmestart.");
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Erstellen");
    } finally {
      setCreating(false);
    }
  };

  const analyzeFrames = useCallback(async (captureResult: FrameCaptureResult) => {
    if (!matchId || !clubId) return;

    setStatusText("Frames werden gespeichert…");
    setUploadProgress(75);

    try {
      const framesJson = JSON.stringify({
        frames: captureResult.frames,
        duration_sec: captureResult.durationSec,
        captured_at: new Date().toISOString(),
      });
      await supabase.storage
        .from("match-frames")
        .upload(`${matchId}.json`, new Blob([framesJson], { type: "application/json" }), { upsert: true });

      setStatusText("Analyse wird gestartet…");
      setUploadProgress(85);

      const { data: job, error: jobError } = await supabase.from("analysis_jobs").insert({
        match_id: matchId,
        status: "queued",
        progress: 0,
      }).select().single();
      if (jobError) throw jobError;

      await supabase.from("matches").update({ status: "processing" }).eq("id", matchId);
      setUploadProgress(90);

      // Invoke analyze-match WITHOUT inline frames — it loads from storage
      const { error: fnError } = await supabase.functions.invoke("analyze-match", {
        body: {
          match_id: matchId,
          job_id: job.id,
          duration_sec: captureResult.durationSec,
        },
      });
      if (fnError) console.error("analyze-match error:", fnError);

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
        setUploadProgress(Math.round(pct * 0.7));
        setStatusText(`Frame ${Math.round(pct)}% extrahiert…`);
      });

      if (result.frames.length === 0) throw new Error("Keine Frames konnten extrahiert werden");

      setStatusText(`${result.frames.length} Frames extrahiert`);
      await analyzeFrames(result);
    } catch (err: any) {
      toast.error(err.message ?? "Frame-Extraktion fehlgeschlagen");
      setUploading(false);
    }
  };

  const handleRecordingChoice = (mode: "self" | "helper" | "upload") => {
    if (mode === "self" && matchId) {
      navigate(`/camera/${matchId}/track`);
    } else if (mode === "helper") {
      setStep("code");
    } else {
      setStep("upload");
    }
  };

  const steps: Step[] = ["info", "choice", step === "code" ? "code" : "upload", "processing"];
  const currentIndex = steps.indexOf(step);
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
              {step === "choice" && "Wähle die Aufnahme-Methode"}
              {step === "code" && "Code an deinen Helfer senden"}
              {step === "upload" && "Video hochladen"}
              {step === "processing" && "Analyse läuft automatisch"}
            </p>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${
              i === currentIndex ? "bg-primary" :
              i < currentIndex ? "bg-primary/40" : "bg-muted"
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
                <label className="mb-1 block text-sm text-muted-foreground">Gegner (optional)</label>
                <input
                  type="text"
                  value={awayName}
                  onChange={(e) => setAwayName(e.target.value)}
                  placeholder="z.B. FC Musterstadt"
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2.5 h-12 text-sm text-foreground placeholder:text-muted-foreground/50"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Datum *</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2.5 h-12 text-sm text-foreground"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Platz *</label>
              <select
                value={fieldId}
                onChange={(e) => setFieldId(e.target.value)}
                className="w-full rounded-lg border border-border bg-muted px-3 py-2.5 h-12 text-sm text-foreground"
              >
                {!fields?.length && <option value="">Kein Platz</option>}
                {(fields ?? []).map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            <Button
              onClick={() => { if (navigator.vibrate) navigator.vibrate(20); handleCreateMatch(); }}
              disabled={!canProceed || creating}
              className="w-full gap-2 h-12 md:h-14 text-base sticky bottom-20 md:static z-10 shadow-lg md:shadow-none active:scale-[0.98] transition-transform"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Weiter
            </Button>
          </div>
        )}

        {/* Step 2: Recording Choice */}
        {step === "choice" && (
          <MatchRecordingChoice onSelect={handleRecordingChoice} />
        )}

        {/* Step 3: Camera Code Share */}
        {step === "code" && matchId && (
          <CameraCodeShare
            matchId={matchId}
            onDone={() => navigate(`/matches/${matchId}`)}
          />
        )}

        {/* Step 3 alt: File Upload */}
        {step === "upload" && !uploading && (
          <div className="glass-card p-8 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <FileVideo className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold font-display">Spielvideo hochladen</h3>
              <p className="text-sm text-muted-foreground mt-1">
                MP4, MOV oder WebM — es werden nur Standbilder extrahiert
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

        {/* Uploading state */}
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

        {/* Step 4: Processing redirect */}
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
