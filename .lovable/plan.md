

# Systemanalyse: 3 kritische Fehler im Recording-Flow

## Identifizierte Probleme

### 1. "System hört nach 5 Frames auf"
`MIN_FRAMES_FOR_ANALYSIS = 5` in `RecordingGuard.tsx`. Bei 30-Sekunden-Intervall = 2,5 Minuten. Das System stoppt NICHT automatisch, aber der Stop-Button wird nach 5 Frames aktiv und zeigt "Stoppen & Endanalyse" — das suggeriert dem User, dass genug Daten da sind. 5 Frames sind viel zu wenig fuer eine sinnvolle Analyse.

**Fix**: MIN_FRAMES auf 20 erhoehen (~10 Minuten). Fortschrittsanzeige mit klarer Empfehlung ("Optimal: ganze Halbzeit"). Stop-Button bleibt rot/deaktiviert bis Minimum erreicht, danach gelb mit "Frueh stoppen" Warnung.

### 2. "Event-Buttons (Tor etc.) nicht klickbar am Handy"
Die `MatchEventQuickBar` wird NUR angezeigt wenn `hasHighlights` true ist. Das prueft `useModuleAccess("video_highlights")`, welches `session?.user?.id` braucht. **Der Kamera-Helfer ist NICHT eingeloggt** → `auth.uid()` ist null → `hasAccess` ist immer false → Buttons werden nie gerendert.

Zusaetzlich: Selbst fuer eingeloggte Trainer kann das Modul `video_highlights` deaktiviert sein.

**Fix**: Event-Buttons (Tor, Karte, Ecke) IMMER anzeigen waehrend der Aufnahme — die sind Kern-Funktionalitaet, kein Premium-Feature. Nur den Highlight-Clip-Teil (Video-Extraktion) an Modul-Zugriff koppeln. Buttons groesser machen (min 48px Touch-Target).

### 3. "Video wird nicht hochgeladen / keine Analyse"
**DAS ist der Hauptfehler.** Die gesamte Post-Recording-Logik in `CameraTrackingPage.tsx` nutzt den authentifizierten Supabase-Client:

```
supabase.storage.from("match-frames").upload(...)     // RLS: auth required
supabase.from("analysis_jobs").insert(...)            // RLS: club member required  
supabase.from("matches").update(...)                  // RLS: club member required
supabase.functions.invoke("analyze-match", ...)       // Sends anon token
```

Der Kamera-Helfer ist NICHT eingeloggt. `auth.uid()` = null. ALLE diese Operationen schlagen durch RLS fehl. Die Frames gehen verloren, kein Job wird erstellt, keine Analyse wird gestartet.

**Fix**: Neue Edge Function `camera-ops` die als Gateway fuer anonyme Kamera-Helfer dient. Nutzt Service-Role-Key intern. Validiert den Session-Token statt JWT.

---

## Plan

### A. Edge Function `camera-ops` erstellen
Neues Gateway fuer alle Kamera-Helfer-Operationen (kein Login noetig):

- `action: "upload-frames"` — Nimmt `session_token`, `match_id`, `frames[]`, `duration_sec` entgegen. Validiert Session-Token via Hash-Lookup in `camera_access_sessions`. Laed Frames in `match-frames` Bucket hoch (Service Role). Erstellt `analysis_job`. Updated Match-Status. Ruft `analyze-match` auf.
- `action: "log-event"` — Nimmt `session_token`, `match_id`, `event_type`, `minute` entgegen. Fuegt `match_events` Eintrag ein (Service Role).

### B. `CameraTrackingPage.tsx` ueberarbeiten
- Erkennen ob User eingeloggt oder Kamera-Helfer (via `sessionToken` State)
- Eingeloggte User: Direkte Supabase-Calls (wie bisher)
- Kamera-Helfer: Alle Operationen ueber `camera-ops` Edge Function routen
- Frame-Upload und Analyse-Trigger ueber Edge Function statt direktem Client

### C. `MatchEventQuickBar.tsx` fixen
- Event-Buttons IMMER anzeigen (nicht an `hasHighlights` koppeln)
- Nur Highlight-Video-Extraktion an Modul-Check koppeln
- Fuer Kamera-Helfer: Events ueber `camera-ops` Edge Function loggen
- Touch-Targets vergroessern (h-12 statt h-9)

### D. `RecordingGuard.tsx` + Recording-UX verbessern
- `MIN_FRAMES_FOR_ANALYSIS` auf 20 erhoehen
- Fortschrittsanzeige: "X von ~30 Frames (Empfohlen: ganze Halbzeit)"
- Stop-Button zeigt klare Warnung wenn < 20 Frames
- Frame-Counter prominenter anzeigen mit Zeitschaetzung

### E. `StopConfirmDialog.tsx` verbessern
- Klarere Warnstufen: < 10 Frames = "Sehr wenig", 10-20 = "Ausreichend", > 20 = "Gut"
- Empfehlung wie lange noch aufnehmen

---

## Betroffene Dateien

| Datei | Aktion |
|---|---|
| `supabase/functions/camera-ops/index.ts` | NEU — Gateway fuer anonyme Kamera-Operationen |
| `src/pages/CameraTrackingPage.tsx` | Ueberarbeiten: Auth-Erkennung, Edge-Function-Routing |
| `src/components/MatchEventQuickBar.tsx` | Fix: Immer anzeigen, groessere Buttons, Edge-Function-Support |
| `src/components/RecordingGuard.tsx` | MIN_FRAMES erhoehen, bessere UX |
| `src/components/StopConfirmDialog.tsx` | Klarere Warnstufen |
| `supabase/config.toml` | camera-ops Function registrieren |

Keine DB-Schema-Aenderungen noetig — alle Tabellen existieren bereits.

