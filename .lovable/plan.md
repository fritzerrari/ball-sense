
# Plan: Chance-Button Fix + Multi-Kamera-Harmonisierung

## Analyse

### 1. "Chance"-Button (shot_on_target)
Der Button funktioniert **technisch korrekt** — `shot_on_target` ist ein gültiger Enum-Wert in der DB. Das Problem liegt wahrscheinlich daran, dass der Nutzer den Button klickt, aber kein visuelles Feedback bekommt, weil:
- Der Toast zeigt "Chance (Heim) ✓" — das funktioniert
- **Mögliches Problem**: Wenn `saving` noch auf einen vorherigen Event-Typ gesetzt ist (Race Condition bei schnellem Klicken), wird der Klick ignoriert (`if (saving) return;`)
- **Bestätigung nötig**: Wir prüfen die DB auf tatsächlich gespeicherte `shot_on_target`-Events

### 2. Multi-Kamera-Harmonisierung — **Kritisches Problem**
Mehrere Kameras überschreiben sich gegenseitig:
- Jede Kamera speichert Frames unter `{match_id}.json` (canonical), `{match_id}_chunk_X.json` etc.
- Kamera 2 überschreibt die Frames von Kamera 1 mit `upsert: true`
- `updateCanonicalFrameFile` in `camera-ops` merged zwar, aber die Chunks überschreiben sich trotzdem
- `analyze-match` lädt nur `{match_id}.json` — sieht nur die Frames der letzten Kamera

Die Storage-Pfade müssen den `camera_index` enthalten, und die Analyse muss Frames aller Kameras zusammenführen.

---

## Änderungen

### A. Chance-Button absichern
**Datei: `src/components/MatchEventQuickBar.tsx`**
- `saving`-State von `string | null` auf Set-basierte Logik umstellen, damit schnelles Klicken verschiedener Buttons parallel funktioniert
- Visuelles Feedback verbessern: Button kurz grün aufleuchten lassen nach erfolgreichem Speichern

### B. Multi-Kamera Frame-Storage (Kern-Fix)
**Datei: `supabase/functions/camera-ops/index.ts`**
- `camera_index` aus der `camera_access_sessions`-Tabelle im `validateSession` mitlesen
- Storage-Pfade um `camera_index` erweitern:
  - Chunks: `{match_id}_cam{camera_index}_chunk_{i}.json`
  - Canonical pro Kamera: `{match_id}_cam{camera_index}.json`
- `updateCanonicalFrameFile` anpassen: schreibt kamera-spezifische canonical files
- Neuer Merge-Schritt bei `upload-frames`: alle Kamera-Canonical-Files zu einem globalen `{match_id}.json` zusammenführen

### C. Analyse-Pipeline für Multi-Kamera
**Datei: `supabase/functions/analyze-match/index.ts`**
- `loadFramesFromStorage` erweitern: zusätzlich `{match_id}_cam{0-3}.json` Dateien suchen und mergen
- Frames nach Zeitstempel sortieren (interleave statt concatenate), damit die Analyse ein kohärentes Bild bekommt
- Cleanup-Pfade um kamera-spezifische Dateien erweitern

### D. Event-Feedback & Parallel-Klick (MatchEventQuickBar)
**Datei: `src/components/MatchEventQuickBar.tsx`**
- Statt `saving: string | null` → `savingSet: Set<string>` — mehrere Events können parallel gespeichert werden
- Nach erfolgreichem Speichern: kurzer Erfolgs-Indikator (grüner Checkmark-Flash) auf dem Button
- Debounce pro Event-Typ (500ms), um Doppelklicks auf denselben Button zu verhindern

### E. Cleanup erweitern
**Datei: `supabase/functions/generate-insights/index.ts`**
- Cleanup-Pfade um `_cam{0-3}` Varianten erweitern

---

## Dateien-Übersicht

| Datei | Änderung |
|---|---|
| `src/components/MatchEventQuickBar.tsx` | Parallel-Klick-Schutz, Debounce, visuelles Feedback |
| `supabase/functions/camera-ops/index.ts` | camera_index in Storage-Pfade, kamera-spezifische Canonicals |
| `supabase/functions/analyze-match/index.ts` | Multi-Kamera Frame-Merge in loadFramesFromStorage |
| `supabase/functions/generate-insights/index.ts` | Cleanup-Pfade erweitern |
