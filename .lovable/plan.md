
# FieldIQ Rebuild — Fortschritt

## ✅ Phase A — Aufräumen (erledigt)

Gelöschte Dateien:
- `src/lib/football-tracker.ts`
- `src/lib/live-stats-engine.ts`
- `src/lib/highlight-recorder.ts`
- `src/components/TrackingOverlay.tsx`
- `src/components/PitchVisualization.tsx`
- `src/pages/TrackingPage.tsx`
- `supabase/functions/analyze-frame/`
- `supabase/functions/stream-tracking/`

Angepasste Dateien:
- `App.tsx`: TrackingPage-Route entfernt, ProcessingPage-Route hinzugefügt
- `CameraTrackingPage.tsx`: radikal vereinfacht (nur Video aufnehmen + hochladen)
- `Assistant.tsx`: PitchVisualization-Import entfernt
- `PlayerRosterPanel.tsx`: getPlayerColor lokal implementiert
- `config.toml`: analyze-frame und stream-tracking entfernt

## ✅ Phase B — Neues Datenmodell (erledigt)

Neue Tabellen mit RLS:
- `match_videos` (Video-Uploads)
- `analysis_jobs` (Analyse-Jobs mit Status/Progress)
- `analysis_results` (strukturierte taktische Ergebnisse)
- `report_sections` (AI-generierte Report-Abschnitte)
- `training_recommendations` (Trainingsempfehlungen)

Storage Bucket:
- `match-videos` (privat)

Neue Seite:
- `ProcessingPage.tsx` (Premium-Wartescreen mit Analyse-Fortschritt)

## 🔲 Phase C — Upload & Analyse-Flow
- `analyze-match` Edge Function (Gemini Vision Frame-Sampling)
- `generate-insights` Edge Function (Coaching-Insights)
- NewMatch.tsx vereinfachen
- Upload-Flow im Dashboard

## 🔲 Phase D — Neuer Match Report
- MatchReport.tsx komplett neu (Coaching-Report statt Tracking-KPIs)

## 🔲 Phase E — Dashboard & B2B
- Dashboard neu (Willkommen, Quick Actions, Trends)
- Club Admin anpassen

## Produktregel
Never generate fake precision. Only show metrics that are robust enough to be trusted.
