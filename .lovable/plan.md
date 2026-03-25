

## Analyse: Kalibrierung, Verarbeitung & Gemini Embeddings

### Identifizierte Probleme

**1. Kalibrierung funktioniert schlecht auf Mobile**
- Dreifache Event-Handler (`onPointerDown` + `onClick` + `onTouchEnd`) feuern gleichzeitig auf Mobilgeraeten
- Die 350ms-Debounce filtert nicht zuverlaessig, weil verschiedene Event-Typen unterschiedliche Koordinaten liefern
- Auto-Erkennung ueber Gemini Vision liefert oft keine 4 Eckpunkte zurueck oder scheitert an Bildqualitaet
- Der `calibrationOverlayRef` wird zwischen Camera- und Tracking-Phase geteilt, was zu Referenz-Problemen fuehrt

**2. Analyse haengt / liefert keine Ergebnisse**
- `process-tracking` Edge Function fuehrt die komplette Verarbeitung (Download, Track-Building, Stats, DB-Inserts) synchron aus
- Edge Functions haben ein CPU-Zeitlimit von 2 Sekunden — die Verarbeitung ueberschreitet das bei realen Datenmengen
- `EdgeRuntime.waitUntil` wird genutzt, aber die Berechnung innerhalb ist trotzdem zu aufwendig
- 30-Sekunden Micro-Batch-Sync waehrend des Trackings erzeugt viele kleine Uploads, die einzeln verarbeitet werden muessen

**3. Gemini Embeddings**
- Embeddings koennten semantische Aehnlichkeitssuche fuer Spielszenen, Spielervergleiche und taktische Muster ermoeglichen
- Sind aber NICHT der primaere Engpass — die Kernprobleme sind UX (Kalibrierung) und Infrastruktur (Timeout)

---

### Loesung

#### Teil 1: Kalibrierung reparieren

**Event-Handling vereinfachen** (`CameraTrackingPage.tsx`):
- Entferne `onClick` und `onTouchEnd` komplett — nur `onPointerDown` verwenden (funktioniert auf allen Geraeten)
- Erhoehe Debounce auf 500ms mit groesserem Distanz-Threshold (0.03 statt 0.01)
- Eigenen `calibrationOverlayRef` fuer jede Phase verwenden

**Auto-Erkennung verbessern** (`detect-field-corners`):
- Prompt-Optimierung: expliziter anweisen, immer 4 Punkte zurueckzugeben (auch geschaetzt)
- Fallback-Logik: wenn nur 2-3 Ecken erkannt werden, fehlende Ecken aus bekannten Seitenverhaeltnissen berechnen
- Bei Fehlschlag: sofort in manuellen Modus wechseln mit klarer Anleitung

**UX-Verbesserungen**:
- Groessere Touch-Targets fuer Eckpunkte (40x40px statt 24x24px)
- Visuelle Verbindungslinien zwischen gesetzten Punkten zeichnen
- "Punkt loeschen" durch Tippen auf gesetzten Punkt
- Vibrationsfeedback bei jedem gesetzten Punkt (`navigator.vibrate`)

#### Teil 2: Analyse-Verarbeitung enthaengen

**Processing aufteilen** (`process-tracking`):
- Phase 1 (sofort, <1s CPU): Upload registrieren, Metadaten lesen, Job-Record in DB erstellen
- Phase 2 (via `EdgeRuntime.waitUntil`): Leichtgewichtige Stats berechnen (nur physische Metriken: Distanz, Speed, Sprints)
- Phase 3 (separater Aufruf): Taktische Stats (Ball-Proximity, Zweikampf-Heuristiken) als eigener Edge Function Call

**Konkrete Aenderungen**:
- `runProcessing` in 2 Phasen aufteilen: "quick-stats" (Track-Building + physische Metriken) und "deep-analysis" (taktische Zuordnung)
- Quick-Stats sollen in <1.5s CPU fertig sein (Sampling: nur jeden 5. Frame verarbeiten)
- Frame-Sampling erhoehen: statt alle Frames nur jeden 3.-5. Frame fuer Track-Building
- Progress-Updates in DB schreiben, damit Frontend den Status pollen kann

**Frontend-Polling verbessern** (`MatchReport.tsx`):
- Polling-Intervall von 2s statt 5s waehrend "processing"-Status
- Klare Fortschrittsanzeige mit Phasen-Beschreibung
- Automatischer Reload der Stats wenn sich `processing_progress` aendert

#### Teil 3: Gemini Embeddings (optional, spaeter)

Embeddings waeren nuetzlich fuer:
- Spielszenen-Clustering (aehnliche Spielsituationen finden)
- Spielervergleiche ueber mehrere Spiele hinweg
- Taktik-Muster-Erkennung in natuerlicher Sprache

Aber: aktuell generiert das System Simulations-Daten, keine echten Detections. Embeddings wuerden erst mit echtem Computer Vision (YOLO/ONNX) einen echten Mehrwert bringen. Empfehlung: erst Kalibrierung + Processing stabilisieren, dann Embeddings als naechsten Schritt.

---

### Technische Details

**Kalibrierung — einziger Event-Handler:**
```typescript
// NUR onPointerDown verwenden — funktioniert auf Touch UND Desktop
onPointerDown={(e) => {
  e.preventDefault();
  e.stopPropagation();
  // Deduplizierung ueber Timestamp + Position
  addCalibrationPoint(e.clientX, e.clientY);
}}
// onClick, onTouchEnd, onTouchStart entfernen
```

**Fehlende Ecken berechnen:**
```typescript
// Wenn nur 2-3 Ecken erkannt: Seitenverhaeltnis 105:68 nutzen
if (corners.length === 2) {
  // 2 Ecken = eine Seite bekannt → gegenueberliegende Seite schaetzen
  const dx = corners[1].x - corners[0].x;
  const dy = corners[1].y - corners[0].y;
  const perpX = -dy * (68/105);
  const perpY = dx * (68/105);
  corners.push({ x: corners[1].x + perpX, y: corners[1].y + perpY });
  corners.push({ x: corners[0].x + perpX, y: corners[0].y + perpY });
}
```

**Processing-Optimierung — Frame-Sampling:**
```typescript
// Statt alle Frames: nur jeden 5. Frame fuer Track-Building
const SAMPLE_RATE = 5;
const sampledFrames = mergedFrames.filter((_, i) => i % SAMPLE_RATE === 0);
const tracks = buildTracks(sampledFrames);
```

### Dateien

| Datei | Aenderung |
|-------|-----------|
| `src/pages/CameraTrackingPage.tsx` | Event-Handler vereinfachen, Touch-Targets vergroessern, Vibration |
| `supabase/functions/detect-field-corners/index.ts` | Prompt optimieren, Fallback-Logik fuer fehlende Ecken |
| `supabase/functions/process-tracking/index.ts` | Frame-Sampling, Processing in Phasen aufteilen |
| `src/pages/MatchReport.tsx` | Polling-Intervall verkuerzen, bessere Fortschrittsanzeige |

### Prioritaet

1. Kalibrierung Touch-Fix (sofortiger UX-Gewinn)
2. Processing Frame-Sampling (verhindert Timeout)
3. Auto-Detect Fallback-Logik
4. Polling-Verbesserung
5. Gemini Embeddings (spaeterer Schritt)

