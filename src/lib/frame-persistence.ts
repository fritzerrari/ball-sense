/**
 * IndexedDB-based persistence for live-captured frames.
 *
 * Why: Frames live only in RAM during a recording. If the browser tab is closed,
 * crashes, or the phone runs out of battery, ALL captured frames are lost — even
 * those that were successfully captured but not yet uploaded as a chunk. This
 * module mirrors the in-memory ring buffer to IndexedDB so frames survive
 * tab/process death and can be recovered + uploaded next time the user opens
 * the camera page.
 *
 * Storage layout:
 *   DB: "fieldiq-frames"
 *   Store: "sessions"  (keyPath: "matchId")
 *   Records: { matchId, sessionToken?, cameraIndex, halfNumber, frames[], timestamps[],
 *              startedAt, lastWrittenAt }
 *
 * One record per match — overwritten on each flush. Recovery checks for any
 * record older than 5 minutes (assumed orphan) and offers re-upload.
 */

const DB_NAME = "fieldiq-frames";
const STORE = "sessions";
const DB_VERSION = 1;

export interface PendingFrameSession {
  matchId: string;
  sessionToken?: string;
  cameraIndex: number;
  halfNumber: number;
  frames: string[];
  timestamps: number[];
  startedAt: number;
  lastWrittenAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "matchId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

/** Persist (or overwrite) the current frame buffer for a match. Idempotent. */
export async function persistFrames(record: Omit<PendingFrameSession, "lastWrittenAt">): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ ...record, lastWrittenAt: Date.now() } satisfies PendingFrameSession);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    // Don't throw — persistence is best-effort and must never break recording.
    console.warn("[frame-persistence] persist failed:", err);
  }
}

/** Read a stored session for a match, or null if absent. */
export async function readPendingFrames(matchId: string): Promise<PendingFrameSession | null> {
  try {
    const db = await openDb();
    const result = await new Promise<PendingFrameSession | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(matchId);
      req.onsuccess = () => resolve((req.result as PendingFrameSession | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch (err) {
    console.warn("[frame-persistence] read failed:", err);
    return null;
  }
}

/** List all pending sessions across all matches (used for recovery banner). */
export async function listPendingSessions(): Promise<PendingFrameSession[]> {
  try {
    const db = await openDb();
    const result = await new Promise<PendingFrameSession[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as PendingFrameSession[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch {
    return [];
  }
}

/** Delete a stored session after successful upload. */
export async function clearPendingFrames(matchId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(matchId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn("[frame-persistence] clear failed:", err);
  }
}

/** A session is "orphaned" if it hasn't been written to in N minutes — likely a crash. */
export function isOrphaned(session: PendingFrameSession, staleMinutes = 5): boolean {
  return Date.now() - session.lastWrittenAt > staleMinutes * 60 * 1000;
}
