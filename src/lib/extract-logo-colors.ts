/**
 * Extract dominant colors from an image (logo) using a lightweight
 * histogram + perceptual filtering approach. Runs fully client-side.
 *
 * Returns up to `count` distinct, vibrant hex colors sorted by dominance.
 */

const toHex = (n: number) => n.toString(16).padStart(2, "0");
const rgbToHex = (r: number, g: number, b: number) =>
  `#${toHex(r)}${toHex(g)}${toHex(b)}`;

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s, l];
}

function colorDistance(a: [number, number, number], b: [number, number, number]) {
  // Hue-weighted distance in HSL — keeps visually distinct picks
  const dh = Math.min(Math.abs(a[0] - b[0]), 360 - Math.abs(a[0] - b[0])) / 180;
  const ds = a[1] - b[1];
  const dl = a[2] - b[2];
  return Math.sqrt(dh * dh * 2 + ds * ds + dl * dl);
}

export async function extractLogoColors(
  imageSrc: string,
  count = 4,
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 64; // downsample for speed
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve([]);
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        // Quantize to a 5-bit-per-channel histogram
        const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 200) continue; // ignore transparent
          const r = data[i], g = data[i + 1], b = data[i + 2];

          // Skip near-white / near-black backgrounds
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          if (max > 245 && min > 235) continue;
          if (max < 25) continue;
          // Skip greys (low saturation)
          if (max - min < 18) continue;

          const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
          const existing = buckets.get(key);
          if (existing) {
            existing.count++;
            existing.r += r; existing.g += g; existing.b += b;
          } else {
            buckets.set(key, { count: 1, r, g, b });
          }
        }

        const sorted = [...buckets.values()]
          .map((b) => ({
            count: b.count,
            r: Math.round(b.r / b.count),
            g: Math.round(b.g / b.count),
            b: Math.round(b.b / b.count),
          }))
          .sort((a, b) => b.count - a.count);

        const picked: { rgb: [number, number, number]; hsl: [number, number, number]; hex: string }[] = [];
        for (const c of sorted) {
          const hsl = rgbToHsl(c.r, c.g, c.b);
          // Prefer reasonably saturated colors
          if (hsl[1] < 0.18) continue;
          // Distinct from already picked
          if (picked.some((p) => colorDistance(p.hsl, hsl) < 0.25)) continue;
          picked.push({ rgb: [c.r, c.g, c.b], hsl, hex: rgbToHex(c.r, c.g, c.b) });
          if (picked.length >= count) break;
        }

        // Fallback if we filtered too aggressively
        if (picked.length === 0 && sorted.length > 0) {
          picked.push({
            rgb: [sorted[0].r, sorted[0].g, sorted[0].b],
            hsl: rgbToHsl(sorted[0].r, sorted[0].g, sorted[0].b),
            hex: rgbToHex(sorted[0].r, sorted[0].g, sorted[0].b),
          });
        }

        resolve(picked.map((p) => p.hex));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
}
