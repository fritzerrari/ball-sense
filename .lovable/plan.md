

## Ziel
Externe WiFi-Kamera (z.B. SafetyCam-Rückfahrkamera) als **zusätzliche Aufnahme-Option** neben der Handy-Kamera anbieten. User entscheidet pro Match frei: Handy-Linse ODER externe Cam via Bildschirm-Capture.

## Umsetzung

### 1. `MatchRecordingChoice.tsx` — Neue 4. Option
Zusätzliche Karte **"Externe Kamera (Beta)"** mit `MonitorSmartphone`-Icon. Untertitel: "WiFi-/Rückfahrkamera via App-Bild · Nur Android". Mode-Type erweitern auf `"self" | "helper" | "upload" | "external"`.

### 2. Neuer Hook `src/hooks/use-display-capture.ts`
- Wrapper um `navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })`
- iOS-Detection mit klarer Fehlermeldung
- Lifecycle: `start()`, `stop()`, `stream`, `error`-States
- Listener auf Track-`ended`-Event (User stoppt Bildschirm-Freigabe)

### 3. Neuer Setup-Dialog `src/components/ExternalCameraSetup.tsx`
3-Schritt-Onboarding bevor `getDisplayMedia` aufgerufen wird:
1. "Öffne die Kamera-App (z.B. SafetyCam) und starte die Live-Vorschau"
2. "Tippe gleich auf 'Bildschirm teilen' → 'Gesamten Bildschirm'"
3. "Wechsle zurück zur Kamera-App im Vollbild"

Plus Hinweise: ~1-3s Latenz, Akku/Hitze, App im Vordergrund halten, iOS nicht unterstützt.

### 4. `CameraTrackingPage.tsx` — Mode-Integration
- Neuer Recording-Mode `"external"` neben den bestehenden
- Bei Auswahl: Setup-Dialog → `useDisplayCapture().start()` statt `useUltraWideCamera().initStream()`
- Stream wird genauso ans `<video>`-Element gebunden
- **Frame-Capture, Event-Tracking, Halbzeit-Logik, Side-Swap, RecordingGuard bleiben unverändert** — Stream ist transparent austauschbar
- Track-`ended` → sauberes Stop + Toast "Bildschirm-Freigabe beendet"

### 5. `NewMatch.tsx` — Routing
`handleRecordingChoice` erweitern: `mode === "external"` → navigate mit Query-Param `?mode=external`, der in `CameraTrackingPage` ausgewertet wird.

### 6. Memory-Update
Neue Datei `mem://features/external-camera-mode.md`: Beta, Android-only, Bildschirm-Capture-Ansatz, Kompatibilität mit allen WiFi-Cams (SafetyCam, V380, etc.) deren App ein Live-Bild zeigt.

## Was unverändert bleibt
- ✅ Komplette KI-Pipeline, Edge Functions, DB-Schema
- ✅ Halbzeit-Side-Swap, Highlights, Notifications
- ✅ Helfer-Code-Flow, Upload-Flow, Self-Recording-Flow

## Klare Einschränkungen (transparent kommuniziert in UI)
- ⚠️ Nur Android Chrome (iOS Safari unterstützt `getDisplayMedia` nicht)
- ⚠️ Latenz ~1-3s je nach WiFi-Cam
- ⚠️ Bildqualität abhängig von Cam-Modell
- ⚠️ Smartphone muss Kamera-App im Vordergrund halten

## Was bewusst NICHT gebaut wird
- ❌ iOS-Workaround (technisch unmöglich ohne Native-App)
- ❌ Direkte RTSP-Anbindung (proprietäre Hersteller-Protokolle)
- ❌ Auto-Start des Capture (Browser-Sicherheit erfordert User-Bestätigung)

## Antwort auf deine Frage
**Ja, exakt so wird es gebaut:** Du wählst pro Match in der Aufnahme-Auswahl frei zwischen "Ich filme selbst (Handy)", "Helfer filmt", "Video hochladen" oder neu "Externe Kamera". Die externe Cam ist eine **zusätzliche Option**, kein Ersatz — der bisherige Handy-Workflow bleibt 1:1 erhalten.

