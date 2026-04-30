## Wichtige Klarstellung vorab

Die in der Diskussion erwähnte `lib/footballTracker.js` mit Roboflow/YOLO **existiert in diesem Codebase nicht**. Das aktuelle System macht **keine Browser-seitige Object-Detection**, sondern:

```
Kamera → Frame-Capture (alle 30s, JPEG 640px) → Storage Upload → Gemini Vision (Server) → Events/Stats
```

Phase 1 wird daher an die **tatsächliche** Architektur angepasst — die Quick Wins zielen auf die Frame-Capture-Schicht und die Server-Analyse, nicht auf eine Browser-YOLO-Pipeline (die es nicht gibt).

## Ziel
Vier risikoarme Verbesserungen, die **Frame-Qualität, Effizienz und Tracking-Genauigkeit** sofort spürbar erhöhen, ohne die hart erkämpfte Recording-Stabilität (Wake Lock, iOS Safari, Battery, Frame-Persistence) zu gefährden.

---

## Quick Win #1 — Adaptive Frame-Rate

**Was:** Statt starrer 30s Intervall — dynamisch zwischen 15s und 60s wechseln je nach Spielphase.

**Wie:**
- Bewegungs-Detektor: Pixel-Diff zwischen aufeinanderfolgenden Capture-Versuchen (Mini-Snapshot alle 5s, kein Upload).
- **Hohe Bewegung** (Konter, Strafraumszene) → Intervall auf 15s reduzieren.
- **Niedrige Bewegung** (Pause, Standardsituation) → 60s.
- Default bleibt 30s.

**Datei:** `src/lib/frame-capture.ts` (`startLiveCapture`)

**Risiko:** Niedrig — bei Fehler Fallback auf festen 30s-Intervall.

**Nutzen:** ~30 % mehr relevante Frames bei intensiven Phasen, weniger Upload-Volumen in Pausen.

---

## Quick Win #2 — Erweiterte Frame-Qualitäts-Checks

**Was:** Aktuell nur Helligkeit + Varianz. Ergänzen um **Schärfe-Erkennung** und **Duplicate-Detection**.

**Wie:**
- **Laplacian-Approximation** (vereinfacht via Sobel-X+Y auf Subsample) → Blur-Score. Frames unter Schwelle skippen.
- **Perceptual Hash (dHash 8x8)** des aktuellen Frames mit dem letzten vergleichen → wenn identisch (Kamera steht still, gleiche Szene), skippen.
- Counter `skippedReasons: { dark, uniform, blurry, duplicate }` für Telemetrie.

**Datei:** `src/lib/frame-capture.ts` (`isFrameUsable` erweitern → `assessFrameQuality`)

**Risiko:** Niedrig — Schwellwerte konservativ, im Zweifel Frame durchlassen.

**Nutzen:** Weniger Garbage-Frames an Gemini → präzisere Events, weniger AI-Kosten.

---

## Quick Win #3 — Web Worker für Frame-Encoding

**Was:** JPEG-Encoding (`canvas.toDataURL`) und Quality-Checks aus dem Main-Thread auslagern.

**Wie:**
- Neuer Worker `src/lib/workers/frame-encoder.worker.ts` mit `OffscreenCanvas`.
- Main-Thread liefert `ImageBitmap` (via `createImageBitmap(video)`) an Worker → Worker macht Resize, Quality-Check, JPEG-Encode → liefert Base64 zurück.
- **iOS Safari Fallback:** `OffscreenCanvas` ist auf älteren iOS-Versionen limitiert → Feature-Detection, bei Fehler Sync-Pfad nutzen (= aktueller Code, unverändert).

**Datei:** neu `src/lib/workers/frame-encoder.worker.ts`, edit `src/lib/frame-capture.ts`

**Risiko:** Niedrig dank Fallback. Vite hat native Worker-Support (`new Worker(new URL(...), { type: 'module' })`).

**Nutzen:** UI bleibt während Capture flüssig (kein Frame-Drop bei Animationen, smoother Recording-Overlay).

---

## Quick Win #4 — Smart Frame Selection vor Upload

**Was:** Vor dem Storage-Upload eine **letzte Auswahl-Schicht** — pro 90s-Fenster nur die N besten Frames hochladen.

**Wie:**
- Quality-Score pro Frame: `brightness_score * 0.3 + variance_score * 0.3 + sharpness_score * 0.4` (aus #2).
- Im 90s-Fenster: behalte Top-3 nach Score, verwerfe Rest.
- Aktuell werden ~3 Frames/90s ohnehin captured → wir verwerfen jetzt nur, wenn **mehr** da sind (z.B. dank #1 bei hoher Bewegung).
- Komplementär zu #1: wir capturen mehr, uploaden aber selektiv das Beste.

**Datei:** `src/lib/frame-capture.ts` (Pre-Upload-Selektion in `getNewFramesSince`).

**Risiko:** Niedrig — bei wenigen Frames bleibt alles wie heute.

**Nutzen:** Konstante Upload-Rate auch bei adaptiver Capture, bessere Frame-Qualität pro AI-Call.

---

## Was wir NICHT ändern (bewusst)

- ❌ Server-Pipeline (`analyze-match`, Gemini-Modelle) — Backend bleibt unangetastet
- ❌ `frame-persistence.ts` (IndexedDB) — Recovery-Logik ist robust, nicht anfassen
- ❌ Wake Lock / Orientation Lock / `opacity: 0` iOS-Hack — Stabilität bleibt
- ❌ Halbzeit-Logik, Camera-Streams, Heartbeats
- ❌ Kein neues ML-Modell im Browser, kein Roboflow, keine WebGPU
- ❌ Bestehende Konstanten (`FRAME_INTERVAL_SEC`, `CAPTURE_WIDTH`, `JPEG_QUALITY`) als Defaults erhalten

## Telemetrie & Validierung

- Skip-Counter (`skippedReasons`) wird optional an `match-frames`-Manifest angehängt → wir sehen im Backend ob die Filter zu aggressiv sind.
- Rollback-Möglichkeit: Feature-Flag `ENABLE_ADAPTIVE_CAPTURE = true` oben in `frame-capture.ts` → bei Problem auf `false` setzen, alter Code läuft.

## Geänderte Dateien (insgesamt 2 + 1 neu)

- `src/lib/frame-capture.ts` (erweitert)
- `src/lib/workers/frame-encoder.worker.ts` (neu, mit Sync-Fallback)
- (optional) Telemetrie-Feld im Frame-Upload-Manifest in `CameraTrackingPage.tsx`

## Reihenfolge der Umsetzung

1. #2 Quality-Checks erweitern (reine Funktion, keine Architektur-Änderung)
2. #1 Adaptive Frame-Rate (baut auf Bewegungs-Diff aus #2 auf)
3. #4 Smart Selection (nutzt Scores aus #2)
4. #3 Web Worker (zum Schluss, weil größte strukturelle Änderung)

Jeder Schritt einzeln testbar — falls einer Probleme macht, bleibt der Rest stabil.
