
Ziel: Das System auf “echte, nachvollziehbare Daten” umstellen, Hänger eliminieren und den Prozess für 20s bis 90min robust machen.

1) Harte Ursachen (aus Code + Logs)
- Der Kamera-Screen zeigt weiterhin “Simulationsmodus aktiv” (`src/pages/CameraTrackingPage.tsx`), obwohl echte Erkennung erwartet wird → Vertrauensbruch.
- `analyze-frame` hat für reale Läufe keine Logs; damit kommen Live-Detections nicht zuverlässig an.
- Upload-Pipeline dupliziert Sessions: `camera-ops` schreibt pro Sync immer neue `tracking_uploads`-Rows, `process-tracking` verarbeitet alle Rows und zählt dieselbe Kamera mehrfach (z. B. “3 Kameras” bei nur Cam 0).
- Kalibrierungs-Metadaten gehen verloren: `camera-ops save_calibration` speichert immer `coverage: full` + `field_rect: {0,0,1,1}` und ignoriert Teilausschnitt.
- KPI/Status wirken “gleich”: Datenqualität wird aus einer UI-Formel berechnet (oft ~50%), nicht aus echten Pipeline-Kennzahlen; `frames_analyzed` wird nicht konsistent geschrieben.
- Auto-Discovery erzeugt Platzhalter-Spieler und damit formal “Daten”, obwohl Qualität zu niedrig ist.

2) Umsetzungsplan (Hotfix + Umbau)
A. Wahrheitsmodus (sofort)
- Entferne Simulation-Badge/Banner in Tracking-UI.
- Zeige stattdessen: “Echt-Erkennung aktiv” / “Keine Echt-Erkennung (Fallback: nur Aufnahme)”.
- Wenn innerhalb von 8–10s kein erfolgreicher Frame-Call: klarer Fehlerzustand mit Handlung (“Kamera neu starten”, “Licht/Zoom prüfen”), kein stilles Weiterlaufen.

B. Analyze-Frame Aufruf stabilisieren
- `FootballTracker` Request robust machen: vollständige Header (`apikey` + `Authorization`), explizite Fehlercodes 402/429/500 nach UI durchreichen.
- Detektions-Telemetrie je Lauf sammeln: `ai_total`, `ai_success`, `ai_fail`, `first_success_at_ms`.
- Frontend-Guard: Tracking darf nur als “Echtdaten” gelten, wenn success-rate Mindestwert erreicht.

C. Upload-/Processing-Entdoppelung
- `camera-ops upload_tracking`: pro `match_id + camera_index + upload_mode` upsert/update statt immer insert.
- `process-tracking`: Uploads vor Verarbeitung deduplizieren (neuester Datensatz je Kamera + Modus), Batch priorisieren gegenüber älteren Zwischenständen.
- `cameras_used` aus eindeutigen `camera_index` berechnen, nicht aus `sessions.length`.

D. Kalibrierung korrekt persistieren
- Frontend sendet bei `save_calibration` zusätzlich `field_rect`, `coverage_percent`, `coverage`, `detected_features`.
- `camera-ops` speichert genau diese Werte (statt hardcoded full-field).
- `tracking_uploads` erhält Kalibrierungs-Snapshot pro Upload; `process-tracking` nutzt diesen statt heuristischem Dauer-Override.

E. KPI-Qualitätsgates statt Scheinwerte
- In `process-tracking` Mindestqualitätsprüfung:
  - zu wenige person-detections / zu wenig valide Frames / extrem niedrige assignment confidence → “insufficient_data” statt Fake-KPI.
- Auto-Discovery nur bei ausreichender Evidenz; sonst keine Platzhalter-Stats.
- Fouls/Karten/Tore weiterhin ausschließlich aus Match-Events (bereits korrekt), plus deutlicher Hinweis im Report.

F. Progress/Status korrekt trennen
- `processing_progress` = technischer Pipeline-Fortschritt.
- `data_quality` = separater, backend-berechneter Score (Coverage, Detection-Success-Rate, Assignment-Confidence, Frame-Dichte).
- `MatchReport` und `AnalysisStatusBanner` nur noch backend-gelieferte Werte anzeigen, keine konstante Client-Schätzung.

G. 20s- und 90min-Robustheit
- 20s: keine Mindestminute als K.O.-Kriterium, stattdessen framebasiert.
- 90min: inkrementelle Verarbeitung in stabilen Blöcken, finaler Run nur auf neuen Daten; keine Mehrfachverarbeitung gleicher Chunks.

3) Betroffene Dateien
- `src/pages/CameraTrackingPage.tsx`
- `src/lib/football-tracker.ts`
- `src/pages/MatchReport.tsx`
- `src/components/AnalysisStatusBanner.tsx`
- `supabase/functions/camera-ops/index.ts`
- `supabase/functions/process-tracking/index.ts`
- optional: `supabase/functions/stream-tracking/index.ts` (Chunk-Zähler/Konsistenz)

4) Technische Details (konkret)
- Dedupe-Key Uploads: `(match_id, camera_index, upload_mode)`; immer neueste Nutzlast.
- Quality-Gates im Backend:
  - `valid_frames >= N`
  - `avg_assignment_confidence >= X`
  - `ai_success_rate >= Y`
  - sonst `processing_progress.phase = "quality_warning"` + UI-Hinweis.
- Team/Player-Stats nur schreiben, wenn Gate erfüllt; sonst Report-Block “Nicht genug verlässliche Daten”.
- `raw_metrics` standardisieren: `frames_analyzed`, `ai_success_rate`, `coverage_ratio`, `assignment_confidence_avg`, `data_quality_score`.

5) Abnahme (muss erfüllt sein)
- Kameraansicht zeigt nirgends “Simulation”.
- `analyze-frame` Logs sind bei Tracking-Lauf sichtbar (mehrere Calls pro Minute).
- Ein 20s-Clip liefert entweder belastbare Basis-KPIs oder klaren “insufficient_data”-Status (kein 0%-Fake-Dashboard).
- Ein 90min-Lauf bleibt verarbeitbar ohne Hänger; Progress bewegt sich match-spezifisch.
- `cameras_used` stimmt mit real verbundenen Kameras überein.
- Heatmap stimmt räumlich mit sichtbarem Spielfeldausschnitt und Kalibrierung überein.
