/**
 * Frame encoder Web Worker (Quick Win #3).
 * Receives an ImageBitmap, encodes it to JPEG using OffscreenCanvas, returns base64.
 *
 * Falls back gracefully — caller (frame-encoder-client) handles non-supported
 * environments (older iOS Safari) by skipping the worker entirely.
 */

interface EncodeRequest {
  id: number;
  bitmap: ImageBitmap;
  quality: number;
}

interface EncodeResponse {
  id: number;
  base64?: string;
  error?: string;
}

self.onmessage = async (ev: MessageEvent<EncodeRequest>) => {
  const { id, bitmap, quality } = ev.data;
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("OffscreenCanvas 2d context unavailable");
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
    const buf = await blob.arrayBuffer();
    // Base64 encode (chunked to avoid call-stack limits)
    const bytes = new Uint8Array(buf);
    const chunkSize = 0x8000;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);
    const resp: EncodeResponse = { id, base64 };
    (self as unknown as Worker).postMessage(resp);
  } catch (err) {
    const resp: EncodeResponse = { id, error: err instanceof Error ? err.message : String(err) };
    (self as unknown as Worker).postMessage(resp);
  }
};
