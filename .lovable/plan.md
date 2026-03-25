
Ziel: Den echten Hauptfehler beheben (nicht nur Symptome), damit Reports nicht mehr mit „—/0“ hängen bleiben und Tore/KPIs nachvollziehbar entstehen.

Do I know what the issue is? Ja.

## 1) Echte Ursachen (aus Code + DB + Logs)

1. **Tor-Erkennung fehlt nicht wegen Bug, sondern wegen Logik**
   - In `process-tracking` werden `goals` bewusst **nur** aus `match_events` übernommen.
   - Für das betroffene Match gibt es `match_events = 0`.
   - Ergebnis: Tore bleiben 0, selbst wenn im Video ein Tor sichtbar war.

2. **Taktische KPIs bleiben 0, obwohl physische Werte da sind**
   - `passes/duels/shots` hängen an Ball-Proximity-Heuristiken.
   - Bei den aktuellen Daten sind Ballkontakte extrem niedrig → deshalb fast alles 0.
   - UI zeigt dann „—“/0 und wirkt wie „keine Analyse“.

3. **Strukturelles Architekturproblem: zwei Tracking-Pipelines parallel**
   - `TrackingPage.tsx` (Coach-Route `/matches/:id/track`) nutzt Legacy-Flow (direkte Upload/Insert-Logik).
   - `CameraTrackingPage.tsx` nutzt neuen Flow (`camera-ops`, Session, etc.).
   - Dadurch entstehen inkonsistente Datenpfade, unterschiedliche Upload-/Status-Verhalten und schwer reproduzierbare Fehler.

4. **Upload-Dedupe ist nur code-basiert, nicht DB-seitig abgesichert**
   - `tracking_uploads` hat nur PK auf `id`, **keinen** Unique-Key für `(match_id, camera_index, upload_mode)`.
   - Rennen/Mehrfachläufe können doppelte Kandidaten erzeugen.

5. **`full`-Processing verarbeitet aktuell batch+live zusammen**
   - Wenn beides für dieselbe Kamera vorhanden ist, wird nicht klar priorisiert (zwar dedupe pro mode, aber nicht pro Kamera auf „beste Quelle“).
   - Das verschlechtert Datenkonsistenz.

## 2) Umsetzungsplan (konkret)

### A. Pipeline vereinheitlichen (höchste Priorität)
- **Eine** ingest-Route für alle Clients:
  - Coach-Tracking (`TrackingPage`) und Kamera-Tracking (`CameraTrackingPage`) sollen denselben Backend-Weg nutzen.
- `TrackingPage.tsx` umbauen:
  - keine direkten `tracking_uploads.insert` mehr,
  - Upload/Status nur über `camera-ops` bzw. ein gemeinsames ingest-API mit gleicher Logik.
- Ergebnis: einheitliche Datenqualität, gleiche Status-Transitions, keine divergierenden Zustände.

### B. DB-seitige Entdoppelung hart machen
- Migration:
  - Unique-Index auf `tracking_uploads(match_id, camera_index, upload_mode)`.
- `camera-ops` auf echtes Upsert gegen diesen Schlüssel.
- Ergebnis: keine Duplikate mehr durch Retry/Parallelität.

### C. `process-tracking` Quellenpriorisierung fixen
- Bei vorhandenen Uploads pro Kamera:
  - **batch priorisieren**, live nur als Fallback.
- So wird dieselbe Aufnahme nicht doppelt als getrennte Quelle verarbeitet.
- Zusätzlich: klarere Progress-Details (`source=batch|live`, `frames_used`, `reason_fallback`).

### D. Tore/Kernereignisse robust lösen
- Kurzfristig (zuverlässig):
  - `LiveEventTicker` auch in `CameraTrackingPage` integrieren (nicht nur in `TrackingPage`).
  - Im Match-Report klarer Hinweis: „Tore/Karten/Fouls kommen aus Events; ohne Events bleiben diese Werte leer.“
- Mittelfristig:
  - optionale „AI Event Suggestions“ (nur Vorschläge, nicht auto-commit), damit Tore nicht still verloren gehen.

### E. KPI-Transparenz statt Schein-Nullen
- Wenn Ball-/Event-Basis unzureichend:
  - kein stilles 0 als scheinbarer Fakt,
  - stattdessen Zustand „nicht belastbar“ pro KPI-Block.
- `CoachSummary`/KPI-Karten anpassen: fehlende Datengrundlage explizit anzeigen.

### F. Reprocess sichtbar und vertrauenswürdig machen
- Reprocess startet bereits, aber Nutzerfeedback ist unklar.
- Ergänzen:
  - letzte Run-Zeit,
  - verwendete Quelle (batch/live),
  - konkreter Grund bei „keine taktischen KPIs generiert“.

### G. Deployment-Fehler `UnsetActiveDeploymentID`
- Das ist sehr wahrscheinlich ein Deploy-Transaktionsproblem, kein Fachlogik-Fehler.
- Fix-Plan:
  - betroffene Functions einzeln neu deployen (nicht als großer Sammeldeploy),
  - danach Funktionsaufrufe mit Edge-Logs validieren.

## 3) Betroffene Dateien

- `src/pages/TrackingPage.tsx` (Legacy-Ingest entfernen/angleichen)
- `src/pages/CameraTrackingPage.tsx` (Event-Erfassung + gleiche Pipeline)
- `supabase/functions/camera-ops/index.ts` (auth + robustes upsert)
- `supabase/functions/process-tracking/index.ts` (batch-vs-live Priorisierung, bessere Diagnostik)
- `src/pages/MatchReport.tsx` (KPI-Verfügbarkeitsstatus + bessere Reprocess-Transparenz)
- `src/components/CoachSummary.tsx` (keine „plausibel“-Aussage bei fehlender Event-/Ballbasis)
- DB Migration für Unique-Index auf `tracking_uploads`

## 4) Abnahme (muss erfüllt sein)

1. Ein Tor wird nach Event-Erfassung im Report zuverlässig als Tor angezeigt.
2. Bei fehlender Event-/Ballbasis werden KPIs als „nicht belastbar“ markiert, nicht irreführend als scheinbar normale 0.
3. Für ein Match mit batch+live derselben Kamera wird nur eine priorisierte Quelle verarbeitet.
4. „Neu verarbeiten“ zeigt sichtbar Fortschritt + Quelle + Ergebnisgrund.
5. Keine neuen doppelten `tracking_uploads` pro `(match_id, camera_index, upload_mode)`.

