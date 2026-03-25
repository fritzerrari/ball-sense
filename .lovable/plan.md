
Ziel: System von „funktioniert manchmal“ auf „robust und ehrlich“ bringen, ohne falsche KPI-Nullwerte und ohne Track-Explosionen.

Kurzantwort zu deiner Frage:
- YOLO „auf dem Handy installieren“ geht in diesem Web-Setup nicht sinnvoll als App-Installation.
- Gemini Embeddings helfen hier nicht (Embeddings sind für Suche/Ähnlichkeit, nicht für Objekterkennung).
- Der richtige Hebel ist: Tracking-Pipeline und Zuordnungslogik stabilisieren + harte Qualitäts-Gates + saubere Upload-Logik.

Was aktuell konkret kaputt ist (aus Logs/DB):
1) Doppelpfad aktiv: derselbe Lauf erzeugt `batch` + `live` Uploads.
2) Auto-Discovery eskaliert: dein letztes Match wurde mit 63 Auto-Spielern gespeichert (statt realistischer Kadergröße).
3) KPI-Qualität wird überschätzt: `data_quality_score` bleibt hoch trotz unplausibler Spieleranzahl.
4) UI zeigt daraus irreführende Werte („63 Spieler erkannt“, 0%-Karten etc.).

Umsetzungsplan (kompakt, aber vollständig)

1) Ingestion hart entkoppeln (Batch vs Live)
- `CameraTrackingPage`: Micro-Batch nur im Batch-Modus; Live-Modus nur Chunk-Stream.
- `camera-ops`: `upload_mode` korrekt aus Request übernehmen (nicht immer „batch“).
- `process-tracking`: nach Full-Run nicht verwendete Quelle auf `ignored` statt `streaming` lassen.

2) Auto-Discovery neu aufsetzen (keine DB-Vermüllung)
- `process-tracking`: keine dauerhafte Speicherung von Auto-Spielern in `match_lineups`.
- Auto-Discovery nur als temporäre Zuordnung für diesen Lauf.
- Harte Obergrenze für Kandidaten (z. B. 11–16 pro Team je nach Modus), sonst Team-Only-Auswertung.
- Migration: bestehende „Spieler X“-Auto-Lineups aus betroffenen Matches bereinigen (ohne echte Kaderdaten anzutasten).

3) Track-Qualitäts-Gates erzwingen
- Mindest-Tracklänge, Mindest-Framezahl, Mindest-Confidence für Spielerstatistik.
- Schlechte Tracks nur als „unassigned track“ intern führen, nicht als Spieler in Reports.
- `tracked_player_count` neu definieren: nur qualifizierte, nicht alle Tracks.

4) KPI-Wahrheit statt Scheinpräzision
- Taktikmetriken nur bei echtem Ballsignal + ausreichender Dichte; sonst `null`.
- Team-`data_quality_score` um Negative-Penalty erweitern:
  - unrealistische Spielerzahl
  - niedrige Assignment-Confidence
  - niedrige Ball-Proximity-Rate
- Ergebnis: Score fällt bei schlechten Daten sichtbar ab, statt fälschlich ~70 zu zeigen.

5) UI-Klarheit (Trust Mode)
- `AnalysisStatusBanner`: Spielerchip aus qualifiziertem Wert (nicht `playerStats.length`).
- `CoachSummary`/`MatchCharts`: wenn taktische Daten fehlen → „Nicht belastbar“ überall konsistent.
- Zusatzhinweis im Report: „Erfasste Tracks“ vs „zugeordnete Spieler“ klar trennen.

6) Doppelcodebasis reduzieren
- `/matches/:id/track` und `/camera/:id/track` auf gemeinsame Tracking-Core-Logik bringen.
- Ziel: ein Runtime-Verhalten für Mobile + Desktop, keine divergierenden Bugpfade.

7) Abnahmetests (Pflicht)
- 20s Test (Batch): keine Auto-Player-Explosion, kein 0%-Fake, saubere Statusanzeige.
- 10–15min Test (Live): kein paralleler Batch-Datensatz, keine „streaming“-Leichen.
- Reprocess-Test: nach Retry stabile, konsistente Spieleranzahl.
- Mobile Test: KI-Status steigt, Frames steigen, Report zeigt plausible Counts.
- DB-Checks:
  - `tracking_uploads`: pro `(match,camera,mode)` konsistent
  - `match_lineups`: keine Auto-Discovery-Massenzeilen
  - `player_match_stats`: nur qualifizierte Spielerzeilen

Technische Umsetzung (Dateien)
- `src/pages/CameraTrackingPage.tsx`: Modus-Trennung, Micro-Batch-Gating
- `src/pages/TrackingPage.tsx`: auf gleiche Core-Logik wie Kamera-Route ziehen
- `supabase/functions/camera-ops/index.ts`: korrektes `upload_mode`, Statuspflege
- `supabase/functions/process-tracking/index.ts`: Auto-Discovery ohne Persistenz, Caps, Quality-Gates, Score-Neugewichtung
- `src/pages/MatchReport.tsx`: Banner-Count auf qualifizierte Spieler
- `src/components/CoachSummary.tsx` + `src/components/MatchCharts.tsx`: harte „Nicht belastbar“-States
- `supabase/migrations/*`: Bereinigung bestehender Auto-Lineups + Statusnormalisierung

Erwartetes Ergebnis
- Keine 63-Spieler-Ausreißer mehr.
- Keine irreführenden 0%-KPIs mehr.
- Live/Batch sauber getrennt.
- Sichtbar robustere, nachvollziehbare Reports statt „gefühlt kaputt“.
