/**
 * Backfill workflow: upload an MP4/MOV file *after* the match has been recorded
 * (or partially recorded). Frames are extracted browser-side via
 * `captureFramesFromFile` and uploaded as `_cam{N}_chunk_{i}.json` files into
 * the `match-frames` bucket — exactly the same shape as live frames, so the
 * existing `analyze-match` pipeline picks them up without changes.
 *
 * Cam index assignment:
 *   - Looks at which `_cam{N}_*.json` files already exist in the bucket and
 *     picks the next free index (typically 1, 2 or 3 — trainer is always 0).
 *
 * After upload, the user can hit "Re-Analyse starten" to fire a fresh
 * `analyze-match` job which now has both the original H1 frames and the
 * backfilled H2 frames at its disposal.
 */
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Upload, Video, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { captureFramesFromFile } from "@/lib/frame-capture";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  matchId: string;
  /** Called after a successful backfill + re-analysis trigger. */
  onComplete?: () => void;
}

const FRAMES_PER_CHUNK = 50;

type Stage =
  | { kind: "idle" }
  | { kind: "extracting"; pct: number; frameCount: number }
  | { kind: "uploading"; pct: number; chunk: number; totalChunks: number }
  | { kind: "analyzing" }
  | { kind: "done"; framesUploaded: number; cameraIndex: number; jobId: string }
  | { kind: "error"; message: string };

/** Pick the lowest unused cam index (0..3) by scanning existing storage files. */
async function pickFreeCameraIndex(matchId: string): Promise<number> {
  const { data, error } = await supabase.storage
    .from("match-frames")
    .list("", { search: matchId, limit: 200 });
  if (error || !data) return 1; // safe default — trainer is 0

  const usedCams = new Set<number>();
  const re = new RegExp(`^${matchId}_cam(\\d+)`);
  for (const obj of data) {
    const m = obj.name.match(re);
    if (m) usedCams.add(parseInt(m[1], 10));
  }
  for (let i = 1; i < 4; i++) {
    if (!usedCams.has(i)) return i;
  }
  // All slots used — overwrite slot 3 (better than failing).
  return 3;
}

async function uploadChunk(
  matchId: string,
  cameraIndex: number,
  chunkIndex: number,
  frames: string[],
  timestamps: number[],
): Promise<void> {
  const filePath = `${matchId}_cam${cameraIndex}_chunk_${chunkIndex}.json`;
  const body = JSON.stringify({
    frames,
    timestamps,
    chunk_index: chunkIndex,
    camera_index: cameraIndex,
    captured_at: new Date().toISOString(),
    backfill: true,
  });
  const { error } = await supabase.storage
    .from("match-frames")
    .upload(filePath, new Blob([body], { type: "application/json" }), { upsert: true });
  if (error) throw new Error(`Chunk ${chunkIndex}: ${error.message}`);
}

export default function VideoBackfillUpload({ matchId, onComplete }: Props) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });

  const reset = useCallback(() => setStage({ kind: "idle" }), []);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("video/")) {
      toast.error("Bitte ein Video (MP4, MOV) auswählen");
      return;
    }
    // Soft warning above 2 GB — browser may struggle.
    if (file.size > 2 * 1024 * 1024 * 1024) {
      toast.warning("Sehr großes Video (>2 GB) — Verarbeitung kann mehrere Minuten dauern");
    }

    try {
      // 1) Extract frames in the browser.
      setStage({ kind: "extracting", pct: 0, frameCount: 0 });
      const result = await captureFramesFromFile(file, (pct) => {
        setStage({ kind: "extracting", pct, frameCount: 0 });
      });

      if (result.frames.length === 0) {
        setStage({ kind: "error", message: "Keine verwertbaren Frames im Video gefunden (zu dunkel oder einheitlich?)" });
        return;
      }

      // 2) Pick a free cam index.
      const cameraIndex = await pickFreeCameraIndex(matchId);

      // 3) Upload in chunks of 50 frames.
      const totalChunks = Math.ceil(result.frames.length / FRAMES_PER_CHUNK);
      for (let i = 0; i < totalChunks; i++) {
        const start = i * FRAMES_PER_CHUNK;
        const end = Math.min(start + FRAMES_PER_CHUNK, result.frames.length);
        const chunkFrames = result.frames.slice(start, end);
        const chunkTimestamps = result.timestamps.slice(start, end);
        setStage({ kind: "uploading", pct: Math.round((i / totalChunks) * 100), chunk: i + 1, totalChunks });
        await uploadChunk(matchId, cameraIndex, i, chunkFrames, chunkTimestamps);
      }

      // 4) Register a tracking_uploads row so coverage UI sees this camera.
      await supabase.from("tracking_uploads").insert({
        match_id: matchId,
        camera_index: cameraIndex,
        status: "uploaded",
        upload_mode: "backfill",
        chunks_received: totalChunks,
        frames_count: result.frames.length,
        duration_sec: result.durationSec,
        last_chunk_at: new Date().toISOString(),
      });

      // 5) Kick off a fresh final analysis.
      setStage({ kind: "analyzing" });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStage({ kind: "error", message: "Nicht eingeloggt" });
        return;
      }

      const { data: job, error: jobErr } = await supabase
        .from("analysis_jobs")
        .insert({ match_id: matchId, status: "queued", progress: 0, job_kind: "final" })
        .select()
        .single();
      if (jobErr || !job) {
        setStage({ kind: "error", message: jobErr?.message ?? "Job konnte nicht erstellt werden" });
        return;
      }

      await supabase.from("matches").update({ status: "processing" } as any).eq("id", matchId);

      // Trigger analyze-match (auth header passes through user JWT)
      const { data: { session } } = await supabase.auth.getSession();
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-match`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          match_id: matchId,
          job_id: job.id,
          duration_sec: result.durationSec,
          phase: "full",
        }),
      }).catch((err) => console.error("analyze-match invoke failed:", err));

      setStage({ kind: "done", framesUploaded: result.frames.length, cameraIndex, jobId: job.id });
      toast.success(`${result.frames.length} Frames hochgeladen — Re-Analyse läuft`);
      onComplete?.();
    } catch (err: any) {
      console.error("[VideoBackfillUpload] failed:", err);
      setStage({ kind: "error", message: err?.message ?? "Unbekannter Fehler" });
    }
  }, [matchId, onComplete]);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Video className="h-3.5 w-3.5" />
          Video nachladen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Video aus Galerie nachladen</DialogTitle>
          <DialogDescription>
            Lade eine MP4/MOV-Aufnahme einer Helfer-Cam hoch. Das Video wird im Browser
            in Frames zerlegt (alle 30s) und der Analyse-Pipeline zugeführt.
          </DialogDescription>
        </DialogHeader>

        {stage.kind === "idle" && (
          <div className="space-y-3">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>So funktioniert's</AlertTitle>
              <AlertDescription className="text-xs leading-relaxed">
                Wähle das lokal gespeicherte Video deines Helfer-Handys. Die Verarbeitung
                läuft komplett im Browser — bitte das Fenster offen halten, bis es fertig ist.
                Bei einem 45-Minuten-Video dauert die Frame-Extraktion etwa 2-5 Minuten.
              </AlertDescription>
            </Alert>
            <label className="block">
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Video auswählen</p>
                <p className="text-xs text-muted-foreground mt-1">MP4, MOV, WebM</p>
              </div>
            </label>
          </div>
        )}

        {stage.kind === "extracting" && (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Frames werden extrahiert… {stage.pct}%</span>
            </div>
            <Progress value={stage.pct} />
            <p className="text-xs text-muted-foreground">Bitte Fenster offen halten.</p>
          </div>
        )}

        {stage.kind === "uploading" && (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Upload Chunk {stage.chunk}/{stage.totalChunks}…</span>
            </div>
            <Progress value={stage.pct} />
          </div>
        )}

        {stage.kind === "analyzing" && (
          <div className="space-y-3 py-4 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
            <p className="text-sm">Re-Analyse wird gestartet…</p>
          </div>
        )}

        {stage.kind === "done" && (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Erfolgreich nachgeladen!</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {stage.framesUploaded} Frames als <span className="font-mono">cam{stage.cameraIndex}</span> hochgeladen.
              Die Re-Analyse läuft jetzt im Hintergrund — der Bericht aktualisiert sich
              automatisch, sobald sie fertig ist (~2-3 Min).
            </p>
            <Button size="sm" className="w-full" onClick={() => { setOpen(false); reset(); }}>
              Schließen
            </Button>
          </div>
        )}

        {stage.kind === "error" && (
          <div className="space-y-3 py-2">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{stage.message}</AlertDescription>
            </Alert>
            <Button size="sm" variant="outline" className="w-full" onClick={reset}>
              Erneut versuchen
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
