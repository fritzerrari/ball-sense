

## Analyse & Umfassender Verbesserungsplan

Nach Durchsicht des gesamten Codes habe ich die Kernprobleme identifiziert und einen Plan erstellt, der alle Punkte adressiert.

---

### Problem-Analyse

**1. Performance der KI-Analyse**: Die `process-tracking` Edge Function läuft synchron — bei großen Datenmengen oder 100 Spielen kommt es zu Timeouts. Die Funktion verarbeitet alles in einem einzigen Request (Download, Track-Building, Stats, DB-Writes).

**2. Kamera 2 Upload-Fehler**: Der Upload in `football-tracker.ts` nutzt `XMLHttpRequest` mit einem festen 60s-Timeout. Kamera 2 (Index 2) hat keinen speziellen Bug — aber der `camera-ops` Edge Function validiert `cameraIndex` nur bis `2`, und die Session-Validierung könnte fehlschlagen, wenn für Kamera 2 kein Session-Token existiert.

**3. Mock-Tracking zeigt zu viele Spieler**: `FootballTracker.startTracking()` generiert `10 + Math.floor(Math.random() * 12)` = 10-22 zufällige Detections pro Frame. Das ist unrealistisch und führt zu falscher Anzeige.

**4. Kein visuelles Tracking-Overlay**: Die erkannten Spieler werden nur als Zahl angezeigt, nicht als Marker auf dem Videobild.

---

### Plan

#### Teil 1: Performance — Asynchrone Verarbeitung

- `process-tracking` Edge Function aufteilen in schnellen Acknowledge-Response + Background-Worker-Pattern
- Sofort `{ status: "queued" }` zurückgeben, dann asynchron verarbeiten
- Match-Status auf `"processing"` setzen mit Fortschritts-Tracking in einer neuen `processing_status`-Spalte (JSON mit Phase + Progress)
- Frontend pollt diesen Status und aktualisiert die ProcessingRoadmap automatisch
- Batch-Verarbeitung: Große Tracking-Sessions in Chunks aufteilen

**Dateien**: `supabase/functions/process-tracking/index.ts`, `src/components/ProcessingRoadmap.tsx`, DB-Migration für `matches.processing_progress`

#### Teil 2: Kamera-Upload-Fix

- Timeout von 60s auf 120s erhöhen
- Bessere Fehlerbehandlung mit spezifischen Fehlermeldungen pro Kamera
- Session-Token-Validierung in `camera-ops` debuggen — sicherstellen dass alle 3 Kameras korrekt Sessions erhalten
- Upload-Retry mit exponential backoff verbessern (aktuell max 3 Versuche, auf 5 erhöhen)

**Dateien**: `src/lib/football-tracker.ts`, `supabase/functions/camera-ops/index.ts`

#### Teil 3: Kamera-Wizard Vereinfachung

Kompletter Redesign des `CameraTrackingPage.tsx` Wizards:

```text
┌─────────────────────────────────────┐
│  Schritt 1: Code eingeben           │
│  ┌──────────────────────────┐       │
│  │  [ 0  0  0  0  0  0 ]   │       │
│  └──────────────────────────┘       │
│  [  Anmelden  →  ]                  │
├─────────────────────────────────────┤
│  Schritt 2: Kamera & Kalibrierung   │
│  Live-Vorschau + Kalibrierungsstatus│
│  ✓ Kalibriert  /  ⚠ Nicht kalibriert│
│  [ Neu kalibrieren ]                │
│  [ Weiter → ]  [ ← Zurück ]        │
├─────────────────────────────────────┤
│  Schritt 3: Tracking läuft          │
│  Timer + Spieler-Overlay            │
│  [ Pause ] [ Neu kalibrieren ]      │
│  [ ← Zurück ] [ Beenden → ]        │
├─────────────────────────────────────┤
│  Schritt 4: Upload                  │
│  Fortschrittsbalken + Status        │
│  [ Hochladen ] [ ← Nochmal tracken]│
└─────────────────────────────────────┘
```

- **Zurück-Button** in jedem Schritt
- **Kalibrierungspflicht**: Vor Tracking-Start wird geprüft, ob kalibriert. Falls nicht → Pflicht-Kalibrierung mit klarer Anleitung
- **Neukalibrierung** jederzeit möglich (auch während Tracking)
- Vereinfachte Texte für nicht-technische User

**Dateien**: `src/pages/CameraTrackingPage.tsx`

#### Teil 4: Spiel-Anlegen Wizard Vereinfachung

Redesign von `NewMatch.tsx` mit idiotensicherem Flow:

- Schritt 0: Spiel oder Training (bleibt)
- Schritt 1: Datum, Platz, Gegner — **mit Defaults** (heute, erster Platz, leerer Gegner = "Unbekannt")
- Schritt 2: Spieler — **Schnellauswahl "Alle auswählen"** + Squad-Size-Buttons prominent
- Schritt 3: Kameras — vereinfacht mit klarer Anleitung
- **Zurück-Button** in jedem Schritt
- **Validierung** mit klaren Fehlermeldungen
- Einwilligungen als Pflicht-Step mit Erklärtext
- "KI erkennt Spieler automatisch" als prominente Option

**Dateien**: `src/pages/NewMatch.tsx`

#### Teil 5: Realistisches Mock-Tracking

- Anzahl der Mock-Detections auf Squad-Size begrenzen (default 11 Heim + 11 Gast + 1 Ball = 23)
- Stabile Track-IDs statt komplett zufälliger Positionen pro Frame
- Spieler bewegen sich realistisch (kleine Positionsänderungen statt Random)
- Ball als separater Track mit Label "ball"

**Dateien**: `src/lib/football-tracker.ts`

#### Teil 6: Visuelles Tracking-Overlay

- Canvas-Overlay über dem Video-Element
- Spieler werden als **farbige Kreise mit Fadenkreuz** angezeigt (Heim: blau, Gast: rot)
- Ball wird als **gelber Punkt** angezeigt
- Spieler-Anzahl und Peak weiterhin als Badge
- Optional: Trikotnummern neben den Markern

**Dateien**: `src/pages/CameraTrackingPage.tsx`, `src/pages/TrackingPage.tsx`

#### Teil 7: Auswechslungs-Benachrichtigung für Kameramann

- Neuer Realtime-Channel: Kamera-App abonniert `match_events` für das aktive Match
- Bei Auswechslung → **Push-Banner** am oberen Bildschirmrand: "⚡ Wechsel: Müller raus, Schmidt rein (65')"
- Bei Roter Karte → **Rotes Banner**: "🟥 Rote Karte: Weber (72')"
- Akustisches Signal (kurzer Ton) bei jedem Event
- Event-Log am unteren Rand scrollbar

**Dateien**: `src/pages/CameraTrackingPage.tsx`

---

### Technische Details

**DB-Migration**:
- `ALTER TABLE matches ADD COLUMN processing_progress jsonb DEFAULT NULL` — speichert `{ phase: "detection", progress: 45, started_at: "..." }`
- Realtime für `match_events` aktivieren: `ALTER PUBLICATION supabase_realtime ADD TABLE public.match_events`

**Edge Function Änderungen**:
- `process-tracking`: Respond sofort, nutze `EdgeRuntime.waitUntil()` für async Verarbeitung (Deno-Pattern). Fortschritt wird per DB-Update kommuniziert.

**Frontend-Änderungen**:
- Canvas-Overlay-Komponente (`TrackingOverlay.tsx`) für Fadenkreuz-Rendering
- Realtime-Subscription in CameraTrackingPage für Events
- ProcessingRoadmap pollt `matches.processing_progress` statt nur Zeit-basiert zu schätzen

---

### Prioritätsreihenfolge

1. Mock-Tracking realistischer machen (Basis für alles weitere)
2. Kamera-Wizard vereinfachen mit Zurück-Buttons
3. Spiel-Anlegen vereinfachen
4. Visuelles Tracking-Overlay mit Fadenkreuz
5. Auswechslungs-Benachrichtigung für Kameramann
6. Upload-Fixes (Timeout, Retry)
7. Asynchrone Verarbeitung für Performance

