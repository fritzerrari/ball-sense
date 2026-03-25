

# Fix: Upload-Fehler + Aufnahme stoppt nach wenigen Frames

## Identifizierte Probleme

### 1. Frame-Capture stoppt still bei 180 Frames (aber auch bei wenigen)
`MAX_FRAMES = 180` in `frame-capture.ts` (Zeile 8). Wenn `frames.length >= MAX_FRAMES` ist, wird `return` aufgerufen und keine neuen Frames mehr erfasst — ohne Warnung. Fuer den Halbzeit-Workflow muss das viel hoeher sein oder ganz entfallen.

Zusaetzlich: `MIN_FRAMES_FOR_ANALYSIS = 20` blockiert den Stop-Button komplett. Der User MUSS 20 Frames (~10 Min.) abwarten.

### 2. Upload schlaegt fehl (Fehlermeldung im Screenshot)
Zwei Ursachen:
- **Helfer (anonym)**: Die `camera-ops` Edge Function existiert zwar, aber der `match-frames` Storage-Bucket hat keine Anon-Policy fuer Uploads. Die Edge Function nutzt `SUPABASE_SERVICE_ROLE_KEY` — das sollte funktionieren. **Aber**: Der Bucket koennte eine Dateigroessenbegrenzung haben, oder die Frames-Payload ist zu gross fuer eine einzelne Edge-Function-Anfrage (max ~6MB Body).
- **Trainer (auth)**: `analysis_jobs` INSERT-Policy prueft `EXISTS(SELECT 1 FROM matches WHERE id = match_id AND home_club_id = get_user_club_id(auth.uid()))`. Wenn der User keinem Club zugeordnet ist oder `get_user_club_id` null liefert, schlaegt der Insert fehl.

### 3. Halbzeit-Workflow fehlt komplett
Kein Pause/Resume-Zyklus. Kein Neustart fuer 2. Halbzeit.

## Plan

### A. `frame-capture.ts` — Unbegrenztes Capturing
- `MAX_FRAMES` von 180 auf 9999 erhoehen
- Frame-Capture laeuft bis `stop()` aufgerufen wird

### B. `RecordingGuard.tsx` — Stop immer erlauben
- `MIN_FRAMES_FOR_ANALYSIS` auf 1 setzen
- `canStopRecording()` gibt immer true zurueck ab 1 Frame
- Warnung erfolgt im StopConfirmDialog, nicht durch Blockierung

### C. `StopConfirmDialog.tsx` — Warnstufen beibehalten
- Bereits korrekt implementiert mit Warnstufen
- Keine Aenderung noetig

### D. `CameraTrackingPage.tsx` — Halbzeit-Workflow + Upload-Fix
- Neue Phase `"halftime_pause"` einfuegen
- Halbzeit-Button: Frames hochladen, Capture stoppen, Stream aktiv lassen
- "2. Halbzeit starten" Button in Pause-Phase
- State `halfNumber` (1/2) tracken
- Frame-Pfade: `{matchId}_h1.json` / `{matchId}_h2.json`
- Upload-Fehlerbehandlung verbessern: Frames in Chunks aufteilen wenn > 4MB

### E. `camera-ops/index.ts` — Upload robuster machen
- Frames-Upload: Pruefen ob Payload-Groesse ok, ggf. Fehlermeldung verbessern
- `phase`-Parameter in Dateiname einbauen (`{matchId}_{phase}.json`)
- Bessere Error-Logs fuer Debugging

### F. Fernsteuerung (CameraRemotePanel)
- DB-Migration: `camera_access_sessions` um `command` (text) und `status_data` (jsonb) erweitern
- Realtime aktivieren fuer `camera_access_sessions`
- Neue Komponente `CameraRemotePanel.tsx`: Zeigt aktive Sessions, Buttons fuer Start/Stop/Halbzeit
- `camera-ops` Edge Function: Neue Actions `heartbeat` und `send-command`
- Helfer-Kamera: Realtime-Listener fuer Command-Aenderungen
- Panel in Match-Detail-Seite einbinden

## Betroffene Dateien

| Datei | Aktion |
|---|---|
| `src/lib/frame-capture.ts` | MAX_FRAMES auf 9999 |
| `src/components/RecordingGuard.tsx` | MIN_FRAMES auf 1 |
| `src/pages/CameraTrackingPage.tsx` | Halbzeit-Pause-Phase, Upload-Fix, Realtime-Listener, Heartbeat |
| `supabase/functions/camera-ops/index.ts` | Dateiname mit Phase, heartbeat/send-command Actions |
| `src/components/CameraRemotePanel.tsx` | NEU — Fernsteuerungs-UI |
| `src/pages/MatchReport.tsx` oder Matches-Detail | CameraRemotePanel einbinden |

**DB-Migration**: `camera_access_sessions` um `command` und `status_data` erweitern + Realtime aktivieren.

