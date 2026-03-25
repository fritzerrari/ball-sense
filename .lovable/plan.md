

# Status-Analyse: Was funktioniert, was fehlt, wie geht es weiter

## Was funktioniert (architektonisch korrekt gebaut)

1. **Frame-Capture statt Video-Upload** — `frame-capture.ts` extrahiert alle 30s JPEG-Frames im Browser (~50KB/Frame). Kein 1.5GB-Video-Upload mehr.
2. **NewMatch Flow** — Match anlegen (30s), dann Video hochladen oder aufnehmen, Frames werden extrahiert und direkt an `analyze-match` gesendet.
3. **CameraTrackingPage** — Vereinfacht zu reinem Recorder mit Live-Frame-Capture + automatischem Analyse-Start.
4. **analyze-match Edge Function** — Empfängt Base64-Frames, sendet sie als Multi-Image-Prompt an Gemini 2.5 Flash Vision, bekommt strukturierte Analyse via Tool Calling zurück.
5. **generate-insights Edge Function** — Liest `analysis_results`, generiert Coaching-Insights + Trainingsempfehlungen via Gemini, speichert in `report_sections` + `training_recommendations`.
6. **ProcessingPage** — Pollt `analysis_jobs` alle 2s, zeigt Fortschritt, hat Retry-Button.
7. **MatchReport** — Zeigt Report-Sektionen, Insights, Danger Zones, Trainingsempfehlungen mit Confidence-Badges.
8. **Datenmodell** — `analysis_jobs`, `analysis_results`, `report_sections`, `training_recommendations`, `match_videos` Tabellen mit RLS.
9. **Auth, Navigation, i18n, Theme** — alles stabil.

## Was noch Probleme hat / fehlt

### Kritisch (Pipeline-Breaker)

1. **Retry auf ProcessingPage hat keine Frames** — Der Retry-Button setzt den Job nur auf `queued` zurück, ruft aber `analyze-match` NICHT erneut auf. Und selbst wenn: die Frames sind weg (nur im Browser-Memory). Retry ohne Frames = sofortiger Fehler.

2. **Reprocess im MatchReport hat keine Frames** — `handleReprocess()` ruft `analyze-match` ohne `frames`-Parameter auf → Edge Function gibt sofort `400 "No frames provided"` zurück.

3. **Edge Function Timeout-Risiko** — Bei 20 Base64-Frames (je ~50KB) sind das ~1MB im Request-Body. Das funktioniert. Aber die Gemini-Vision-Analyse + anschließender `generate-insights`-Aufruf könnte an das Edge Function Timeout (~60s) stoßen. `analyze-match` ruft `generate-insights` per fetch auf — wenn das zusammen >60s dauert, bricht alles ab.

4. **Keine Frames persistiert** — Frames leben nur im Browser-Memory während des Uploads. Kein Retry, kein Reprocess, keine spätere Nachanalyse möglich.

### Wichtig (UX/Produkt)

5. **Dashboard zeigt keine Trainingsempfehlungen** — `Dashboard.tsx` hat keinen Zugriff auf `training_recommendations`. Zeigt nur alte Season-Stats (die aus dem alten Tracking-System kommen und leer sein werden).

6. **Matches-Seite verlinkt nicht zur ProcessingPage** — Matches mit Status `processing` haben keinen Link zur Fortschrittsansicht.

7. **Legacy Edge Functions noch vorhanden** — `camera-ops`, `process-tracking`, `cleanup-highlights`, `detect-field-corners` etc. sind noch da, werden aber nie aufgerufen. Tote Codebasis.

8. **Legacy-Seiten noch in Navigation** — Fields, FieldCalibration, PlayerProfile noch in Routen, passen nicht zum neuen Produktmodell.

9. **`training_recommendations` RLS fehlt INSERT** — Die Tabelle erlaubt kein INSERT für authentifizierte User. `generate-insights` nutzt Service Role Key, also funktioniert es — aber das ist korrekt so. Gleiches gilt für `report_sections` und `analysis_results`.

### Nice-to-have

10. **Kein Match-Vergleich** — Keine Trend-Ansicht über mehrere Spiele.
11. **Keine Abo/Pricing-Logik** — Pricing-Seite existiert auf Landing Page, aber kein Checkout-Flow.
12. **Kein Onboarding** — Nach Registrierung kein geführter Einstieg.

## Umsetzungsplan (priorisiert)

### Schritt 1: Frames persistieren + Retry reparieren
- Nach Frame-Capture: Frames als JSON in Supabase Storage (`match-frames/{match_id}.json`) speichern
- `analyze-match` Edge Function: wenn keine Frames im Request → aus Storage laden
- Retry (ProcessingPage) und Reprocess (MatchReport) funktionieren dann automatisch
- Frames nach 7 Tagen automatisch löschen (oder nach erfolgreicher Analyse)

### Schritt 2: Timeout-Schutz
- `analyze-match` soll `generate-insights` NICHT synchron aufrufen sondern nur Status `interpreting` setzen
- Separater Client-seitiger Aufruf von `generate-insights` nach dem `analyze-match` fertig ist (ProcessingPage pollt und triggert)
- Oder: `analyze-match` ruft `generate-insights` per fire-and-forget auf (kein await auf Response)

### Schritt 3: Dashboard modernisieren
- Quick Action "Neues Spiel" prominent
- Letzte 3 Matches mit Analyse-Status (queued/analyzing/complete/failed)
- Aktuelle Trainingsempfehlungen aus `training_recommendations`
- Season-Stats aus altem System entfernen oder auf neue Daten umstellen

### Schritt 4: Aufräumen
- Legacy Edge Functions löschen: `camera-ops`, `process-tracking`, `cleanup-highlights`, `detect-field-corners`, `analyze-performance`
- Legacy-Routen/Seiten entfernen oder vereinfachen: `FieldCalibration`, `PlayerProfile` (optional beibehalten)
- Matches-Seite: Processing-Matches zur ProcessingPage verlinken

### Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `src/pages/NewMatch.tsx` | Frames in Storage persistieren nach Capture |
| `src/pages/ProcessingPage.tsx` | Retry: Frames aus Storage laden + analyze-match aufrufen; generate-insights triggern |
| `src/pages/MatchReport.tsx` | Reprocess: Frames aus Storage laden |
| `supabase/functions/analyze-match/index.ts` | Frames aus Storage fallback; generate-insights fire-and-forget |
| `src/pages/Dashboard.tsx` | Trainingsempfehlungen + neue Match-Status-Karten |
| `src/pages/Matches.tsx` | Processing-Link zur ProcessingPage |
| Legacy Functions | Löschen: camera-ops, process-tracking, cleanup-highlights, detect-field-corners, analyze-performance |

