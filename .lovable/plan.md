## Phase 2 — A + B + C, robust mit Fallback

Drei serverseitige Verbesserungen in `supabase/functions/analyze-match/index.ts`. **Keine** DB-Schemaänderung, **keine** Frontend-Änderung nötig. Jeder Schritt ist in `try/catch` mit Fallback auf Original-Daten.

---

### A — Persistente Homographie / Coverage-Korrektur

**Was:** Bisher nutzt `analyze-match` die `fields.calibration` nur als **Prompt-Hinweis** ("normalisiere selbst"). Das ist unzuverlässig. Wir wenden die Korrektur **deterministisch nach** der Gemini-Antwort an.

**Wie:**
- Lese `fields.calibration` (existiert bereits, JSONB).
- Wenn `coverage = "left_half"` → alle x-Koordinaten von `frame_positions[*].players[*].x`, `ball.x`, `pressing_data[*].pressing_line_*` (falls x-relevant) und `danger_zones[*].x` mit `x_new = x * 0.5` skalieren (von 0–100 lokal auf 0–50 global).
- Bei `right_half` analog `x_new = 50 + x * 0.5`.
- Bei `custom` mit `rect: {x, y, w, h}` → `x_new = rect.x*100 + x * rect.w`, `y_new = rect.y*100 + y * rect.h`.
- Bei optionaler 4-Punkt-Homographie (`calibration.homography_matrix`, 3×3): falls vorhanden, wende perspektivische Transformation pro Punkt an. Falls nicht vorhanden → Coverage-Pfad nutzen.
- **Fallback:** Bei jedem Fehler im Transform → Original-Werte beibehalten + Warning ins Log.

**Datei:** `supabase/functions/analyze-match/index.ts` (neue Funktion `applyFieldCalibration(analysis, calibration)`, aufgerufen vor dem Insert in `analysis_results`).

---

### B — Trajectory Smoothing (Kalman 1D)

**Was:** Gemini liefert pro Frame Spielerpositionen, aber zwischen 30s-Frames "springen" Spieler — kleine Schätzfehler werden zu großen Sprüngen. Ein 1D-Kalman-Filter pro Spieler-ID glättet die Trajektorien.

**Wie:**
- Nach `applyFieldCalibration` und vor dem DB-Insert: Gruppiere `frame_positions[*].players` nach `player.id` oder `player.shirt_number + team` (Stable Key).
- Pro Spieler-Sequenz: 1D-Kalman auf x und y getrennt (Process Noise Q=2.0, Measurement Noise R=8.0 — bewusst konservativ, glättet aber überfährt nicht).
- Ball: separater Kalman mit höherer Process Noise (Q=10) weil der Ball schneller springt.
- **Skip-Bedingung:** Spieler mit `estimated: true` werden **nicht** geglättet (würde KI-Schätzung zementieren).
- **Min-Sample:** Kalman braucht ≥3 Beobachtungen; bei weniger → Original-Werte.
- **Fallback:** Bei Fehler in Kalman → Original-Werte beibehalten.

**Datei:** Neue Funktion `smoothTrajectories(analysis)` direkt nach `applyFieldCalibration`.

---

### C — Frame-Quality-Hints im Gemini-Prompt

**Was:** Phase 1 sammelt `skipped_reasons` und `adaptive_interval_sec` pro Upload. Die liegen aktuell ungenutzt. Wir aggregieren sie aus allen Frame-Chunks und geben Gemini einen expliziten Quality-Hint.

**Wie:**
- `loadFramesFromStorage` erweitern: aus jedem geladenen JSON-Blob die `telemetry`-Property auslesen und in einem `FrameTelemetry`-Objekt aggregieren (total skipped, sum per reason, gesehene adaptive Intervals).
- Im Prompt einen neuen Block einfügen wenn `total_skipped > 0`:
  ```
  Frame-Qualitäts-Hinweis: X Frames wurden vor Upload als unbrauchbar gefiltert
  (dunkel: A, einheitlich: B, unscharf: C, Duplikat: D). Adaptive Capture-Intervalle
  zwischen 15s und 60s je nach Spielintensität. Berücksichtige bei niedriger
  Konfidenz, ob das Bild scharf und vollständig ist.
  ```
- **Fallback:** Wenn keine Telemetrie vorhanden (alte Recordings ohne Phase 1) → kein Block, alter Prompt unverändert.

**Datei:** Erweiterung von `loadFramesFromStorage` (return-Type) und Prompt-Builder bei Zeile ~300.

---

### Robustheits-Garantien (für alle drei)

1. **Try/Catch um jeden neuen Block** — ein Fehler bricht nicht die Analyse ab, sondern fällt auf Original-Daten zurück.
2. **Console-Warnings** statt Errors → Logs zeigen Probleme ohne den Job zu killen.
3. **Idempotent** — wiederholtes Aufrufen produziert identische Ergebnisse.
4. **Backwards-kompatibel** — Alte Matches ohne Telemetrie/Calibration laufen unverändert.
5. **Schema unverändert** — keine Migration nötig.
6. **Frontend unverändert** — bestehende UI rendert die gleichen Felder, nur mit besseren Werten.

### Reihenfolge (in einer Datei, sequenziell ausgeführt)

```
loadFramesFromStorage        → liefert frames + telemetry (C-Vorbereitung)
buildPrompt(telemetry)       → Quality-Hint im Prompt (C)
[Gemini-Call unverändert]
applyFieldCalibration()      → Coverage-/Homographie-Korrektur (A)
smoothTrajectories()         → Kalman 1D pro Spieler (B)
[h2_sides_swapped Mirror unverändert]
[Insert in analysis_results unverändert]
```

### Geänderte Datei
- `supabase/functions/analyze-match/index.ts` — eine Datei, ~120 Zeilen Erweiterung, keine bestehenden Zeilen werden in ihrer Logik verändert (nur ergänzt).

### NICHT geändert
- DB-Schema, RLS, Storage-Buckets
- Frontend-Komponenten (`HeatmapField`, `FormationTimeline`, `TacticalReplay`)
- Andere Edge Functions (`generate-insights`, `decision-cockpit`, etc.)
- Phase-1-Code (Frame-Capture)
