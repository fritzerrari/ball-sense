
Ziel: Den echten Systemfehler beheben (nicht kosmetisch), damit Verarbeitung sichtbar läuft, KPIs nicht mehr als falsche 0 erscheinen und 20s bis 90min stabil funktionieren.

1) Verifizierte Hauptursachen (aus aktuellem Code + Logs + DB)
- Upload-Doppelpfad aktiv: In `CameraTrackingPage` läuft immer Micro-Batch `upload_tracking` (batch), optional zusätzlich `stream-tracking` (live). Ergebnis: 2 Uploads für dieselbe Kamera (batch + live), Status-Mix („done“ + „streaming“), Verwirrung im Report.
- KPIs bleiben 0 trotz Daten, weil Logik „Daten vorhanden“ zu früh annimmt:
  - `ball_detections_available` wird global auf `ballPositions.length >= 10` gesetzt.
  - Taktik-KPIs brauchen aber Ball-Nähe pro Spieler; wenn diese fehlt, bleiben Pässe/Zweikämpfe 0.
  - UI zeigt dann 0 statt „nicht belastbar“.
- Spielerzuordnung ist qualitativ schwach:
  - `buildTracks()` trackt aktuell alle Detections (inkl. Ball), nicht nur Personen.
  - Dadurch Track-Sprünge, `assignment_confidence` oft 0.1, unrealistische Top-Speed >45 km/h.
- Tore fehlen logisch korrekt, aber UX-seitig problematisch:
  - Tore/Karten kommen nur aus `match_events`.
  - In `CameraTrackingPage` fehlt aktive Event-Erfassung (nur Anzeige eingehender Events), daher bleiben Tore 0.
- 90-Minuten-Risiko:
  - Micro-Batch lädt alle bisherigen Frames (`getRecentFrames()`) alle 10s erneut hoch → Payload wächst ständig, ineffizient und fehleranfällig bei langen Spielen.

2) Umsetzungsplan (Priorität)
A. Pipeline entkoppeln und vereinheitlichen
- In `CameraTrackingPage`: klarer Modus
  - `batch`: nur finaler Upload
  - `live`: nur Chunk-Upload (kein paralleles batch-Micro-Batch)
- In `TrackingPage`: Legacy-DB-Insert entfernen, nur noch über `camera-ops` Gateway.
- Nicht-priorisierte Uploads nach Full-Run auf `ignored` setzen (kein „streaming“-Leichenzustand im Report).

B. Tracking/Statistik-Kernlogik korrigieren
- `process-tracking/buildTracks`: nur `label === "person"` tracken.
- Sanity-Layer ausrollen:
  - Speed-Cap (z. B. 45 km/h) + Outlier-Filter bei großen Sprüngen.
  - Min-Track-Length / Min-Frame-Count pro Spieler.
  - Mindest-`assignment_confidence` für taktische KPIs.
- Taktik-Verfügbarkeit als eigenes Signal speichern (`raw_metrics.tactical_data_available` + Grundcode).

C. KPI-Anzeige ehrlich machen (keine Schein-Nullen)
- In `MatchCharts`/`CoachSummary`:
  - Wenn `tactical_data_available=false` → „— / Nicht belastbar“ statt 0%.
  - Battle-Pulse Karten mit „Nicht genügend Ballereignisse“ Zustand.
- `data_quality_score` neu gewichten: Coverage + Assignment-Confidence + Ball-Proximity-Rate + Outlier-Penalty.

D. Ereignis-/Tor-Problem robust lösen
- `LiveEventTicker` direkt in `CameraTrackingPage` integrieren (Erfassung, nicht nur Anzeige).
- Report-Hinweis präzisieren: „Offizielle Tore/Karten aus Event-Ticker“.
- Optional später: AI-Ereignisvorschläge als Vorschlagssystem (nicht automatische Torbuchung).

E. Reprocessing sichtbar und nachvollziehbar
- `ProcessingRoadmap` strikt an `matches.processing_progress.updated_at` + `phase` hängen.
- Bei Retry: sofort sichtbarer Laufstatus + verwendete Quelle (`batch|live`) + Grund bei fehlender KPI-Bildung.

F. DB-Härtung
- Dedupe-Migration korrigieren: erst Duplikate löschen, dann Unique-Index.
- Upload-Konsistenz sicherstellen auf `(match_id, camera_index, upload_mode)`.

3) Technische Details (konkret umzusetzen)
- `supabase/functions/process-tracking/index.ts`
  - Person-only Track-Build
  - KPI-Gates + `tactical_data_available`
  - Source-Finalisierung (`ignored` für Nebenquelle)
  - Outlier-Filter + Speed-Cap
- `src/pages/CameraTrackingPage.tsx`
  - Upload-Modus strikt trennen
  - EventTicker integrieren
- `src/pages/TrackingPage.tsx`
  - Kamera-ops statt direkter `tracking_uploads`-Schreibpfad
- `src/components/CoachSummary.tsx` + `src/components/MatchCharts.tsx`
  - „Nicht belastbar“-Darstellung statt 0
- `supabase/migrations/*`
  - sichere Dedupe/Unique-Reihenfolge

4) Abnahme (harte Kriterien)
- Keine Doppel-Upload-Karten mehr für dieselbe Kamera in einem Lauf.
- Bei fehlender taktischer Datengrundlage: keine 0%-Scheinwerte, sondern klar „nicht belastbar“.
- Tore erscheinen zuverlässig, sobald sie im Event-Ticker erfasst werden (auch über Kamera-Ansicht).
- 20s-Clip: entweder belastbare Basiswerte oder sauberer „insufficient data“-Status.
- 90min-Run: keine exponentiell wachsenden Re-Uploads; Verarbeitung bleibt stabil und sichtbar.
- Keine unrealistischen Top-Speed-Ausreißer >45 km/h ohne Qualitätswarnung/Filter.
