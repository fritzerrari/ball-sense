/**
 * Global IndexedDB recovery banner.
 *
 * Scans for ALL orphaned frame sessions across all matches (not bound to the
 * current matchId). This is critical because helpers often re-enter the camera
 * page with a *different* code/session after a crash — the new session has a
 * different matchId, so the original per-match recovery would never trigger.
 *
 * Behavior:
 *   - On mount, calls `listPendingSessions()` and filters to orphans (>5 min old).
 *   - For each orphan, shows match-id (last 6 chars), frame count, age.
 *   - "Hochladen" → uploads as `_cam{N}_chunk_9XX.json` to `match-frames` bucket
 *     (mirrors `recoverPendingFrames` logic in CameraTrackingPage). The original
 *     trainer's analyze-match pipeline will pick these up on next re-analysis.
 *   - "Verwerfen" → clears the IndexedDB record after explicit confirmation.
 *
 * Mount points:
 *   - CameraTrackingPage (visible BEFORE code entry, so helpers see it instantly)
 *   - MatchReport (so the trainer can recover frames from any device they used)
 */
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CloudUpload, Trash2, LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import {
  listPendingSessions,
  clearPendingFrames,
  isOrphaned,
  type PendingFrameSession,
} from "@/lib/frame-persistence";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  /** Optional className for outer wrapper. */
  className?: string;
  /** When true, banner is rendered with light-on-dark styling (over camera viewfinder). */
  variant?: "default" | "overlay";
}

function formatAge(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `vor ${min} Min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `vor ${hours} Std`;
  const days = Math.floor(hours / 24);
  return `vor ${days} Tag${days === 1 ? "" : "en"}`;
}

async function uploadSession(session: PendingFrameSession): Promise<void> {
  const camIdx = session.cameraIndex ?? 0;
  // High chunk number to avoid colliding with live chunks 0..N
  const chunkSuffix = 900 + (Math.floor(Date.now() / 1000) % 99);
  const filePath = `${session.matchId}_cam${camIdx}_chunk_${chunkSuffix}.json`;
  const body = JSON.stringify({
    frames: session.frames,
    timestamps: session.timestamps,
    camera_index: camIdx,
    captured_at: new Date(session.startedAt).toISOString(),
    recovered: true,
    half_number: session.halfNumber,
  });
  const { error } = await supabase.storage
    .from("match-frames")
    .upload(filePath, new Blob([body], { type: "application/json" }), { upsert: true });
  if (error) throw error;

  // Register a tracking_uploads row so the coverage UI sees this camera.
  // Best-effort — may fail if user isn't authenticated for this match (e.g. helper without trainer JWT).
  try {
    await supabase.from("tracking_uploads").insert({
      match_id: session.matchId,
      camera_index: camIdx,
      status: "uploaded",
      upload_mode: "recovery",
      chunks_received: 1,
      frames_count: session.frames.length,
      last_chunk_at: new Date().toISOString(),
    });
  } catch {
    // Ignored — RLS may block, but the frames themselves are safely uploaded.
  }
}

export default function PendingFramesRecoveryBanner({ className, variant = "default" }: Props) {
  const [sessions, setSessions] = useState<PendingFrameSession[]>([]);
  const [busyMatchId, setBusyMatchId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const all = await listPendingSessions();
    const orphans = all.filter((s) => isOrphaned(s) && s.frames.length > 0);
    setSessions(orphans);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleUpload = useCallback(async (session: PendingFrameSession) => {
    setBusyMatchId(session.matchId);
    try {
      await uploadSession(session);
      await clearPendingFrames(session.matchId);
      toast.success(`${session.frames.length} Frames hochgeladen — werden in nächste Analyse einbezogen`);
      await refresh();
    } catch (err: any) {
      toast.error(`Upload fehlgeschlagen: ${err?.message ?? "unbekannt"}`);
    } finally {
      setBusyMatchId(null);
    }
  }, [refresh]);

  const handleDiscard = useCallback(async (session: PendingFrameSession) => {
    const ok = window.confirm(
      `Wirklich ${session.frames.length} ungesicherte Frames endgültig verwerfen? Diese Daten sind dann verloren.`,
    );
    if (!ok) return;
    setBusyMatchId(session.matchId);
    try {
      await clearPendingFrames(session.matchId);
      toast.info("Lokale Frames verworfen");
      await refresh();
    } finally {
      setBusyMatchId(null);
    }
  }, [refresh]);

  if (!loaded || sessions.length === 0) return null;

  const isOverlay = variant === "overlay";
  const wrapperClass = isOverlay
    ? "rounded-lg border border-warning/60 bg-warning/15 backdrop-blur-md p-3 shadow-xl"
    : "";

  return (
    <div className={className}>
      {isOverlay ? (
        <div className={wrapperClass}>
          <div className="flex items-start gap-2 mb-2">
            <LifeBuoy className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-warning">
                {sessions.length === 1
                  ? "Ungesicherte Aufnahme gefunden"
                  : `${sessions.length} ungesicherte Aufnahmen gefunden`}
              </p>
              <p className="text-xs text-warning/80 leading-relaxed mt-0.5">
                Eine vorherige Aufnahme wurde unterbrochen (Crash, Akku, App geschlossen).
                Frames jetzt nachladen — sie werden zeitlich korrekt in die Analyse einsortiert.
              </p>
            </div>
          </div>
          <SessionList
            sessions={sessions}
            busyMatchId={busyMatchId}
            onUpload={handleUpload}
            onDiscard={handleDiscard}
            compact
          />
        </div>
      ) : (
        <Alert className="border-warning/60 bg-warning/10">
          <LifeBuoy className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">
            {sessions.length === 1
              ? "Ungesicherte Aufnahme auf diesem Gerät gefunden"
              : `${sessions.length} ungesicherte Aufnahmen auf diesem Gerät gefunden`}
          </AlertTitle>
          <AlertDescription className="space-y-3 mt-2">
            <p className="text-xs leading-relaxed">
              Eine vorherige Aufnahme wurde unterbrochen (Crash, Akku, App geschlossen).
              Die Frames liegen lokal im Browser-Speicher. Lade sie jetzt hoch, damit sie
              zeitlich korrekt in die nächste Analyse einsortiert werden.
            </p>
            <SessionList
              sessions={sessions}
              busyMatchId={busyMatchId}
              onUpload={handleUpload}
              onDiscard={handleDiscard}
            />
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

interface SessionListProps {
  sessions: PendingFrameSession[];
  busyMatchId: string | null;
  onUpload: (s: PendingFrameSession) => void;
  onDiscard: (s: PendingFrameSession) => void;
  compact?: boolean;
}

function SessionList({ sessions, busyMatchId, onUpload, onDiscard, compact }: SessionListProps) {
  return (
    <ul className="space-y-2">
      {sessions.map((s) => {
        const busy = busyMatchId === s.matchId;
        const ageMs = Date.now() - s.lastWrittenAt;
        return (
          <li
            key={s.matchId}
            className={`flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-2.5 py-1.5 ${compact ? "text-xs" : "text-sm"}`}
          >
            <div className="flex-1 min-w-0">
              <p className="font-mono font-semibold truncate">
                Match …{s.matchId.slice(-6)} · cam{s.cameraIndex} · HZ{s.halfNumber}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {s.frames.length} Frames · {formatAge(ageMs)}
              </p>
            </div>
            <Button
              size="sm"
              variant="default"
              onClick={() => onUpload(s)}
              disabled={busy}
              className="h-7 px-2"
            >
              {busy ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <CloudUpload className="h-3 w-3 mr-1" />
                  Hochladen
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDiscard(s)}
              disabled={busy}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              title="Verwerfen"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
