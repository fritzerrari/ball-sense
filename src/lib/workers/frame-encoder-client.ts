/**
 * Client-side helper to talk to the frame encoder worker.
 * Lazy-instantiates a single worker, multiplexes requests by id.
 *
 * Returns base64 JPEG (no data: prefix). On any failure caller falls back
 * to the synchronous canvas.toDataURL path.
 */

let workerPromise: Promise<Worker | null> | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (v: string) => void; reject: (e: Error) => void }>();

export function isWorkerEncodingSupported(): boolean {
  if (typeof window === "undefined") return false;
  // Required APIs: Worker, ImageBitmap (createImageBitmap), OffscreenCanvas
  if (typeof Worker === "undefined") return false;
  if (typeof createImageBitmap !== "function") return false;
  if (typeof (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas === "undefined") return false;
  return true;
}

function getWorker(): Promise<Worker | null> {
  if (workerPromise) return workerPromise;
  workerPromise = (async () => {
    if (!isWorkerEncodingSupported()) return null;
    try {
      const worker = new Worker(new URL("./frame-encoder.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (ev: MessageEvent<{ id: number; base64?: string; error?: string }>) => {
        const handler = pending.get(ev.data.id);
        if (!handler) return;
        pending.delete(ev.data.id);
        if (ev.data.error) handler.reject(new Error(ev.data.error));
        else if (ev.data.base64) handler.resolve(ev.data.base64);
        else handler.reject(new Error("worker returned no data"));
      };
      worker.onerror = (ev) => {
        // Fail all in-flight on hard worker error
        for (const [id, handler] of pending) {
          handler.reject(new Error(ev.message || "worker error"));
          pending.delete(id);
        }
      };
      return worker;
    } catch (err) {
      console.warn("[frame-encoder] worker init failed:", err);
      return null;
    }
  })();
  return workerPromise;
}

export async function encodeFrameInWorker(bitmap: ImageBitmap, quality: number): Promise<string> {
  const worker = await getWorker();
  if (!worker) throw new Error("worker unavailable");
  const id = nextId++;
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    // Transfer the bitmap to the worker for zero-copy
    worker.postMessage({ id, bitmap, quality }, [bitmap]);
    // Safety timeout
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error("worker encode timeout"));
      }
    }, 5000);
  });
}
