

## Kamera-Flow Optimierung: Kalibrierung, Session-Wiederaufnahme & UX

### Identifizierte Probleme

1. **Keine automatische Kalibrierung nach Code-Eingabe**: Nach Login wird der User zur Camera-Phase geleitet, sieht den Kalibrierungs-Hinweis aber nur passiv. Es wird weder automatisch erkannt noch aktiv die Kalibrierung gestartet.

2. **Kameras werden nach Analyse nicht freigegeben**: Camera-Sessions laufen 12h, aber nach Spielende/Upload gibt es keine Freigabe. Neue Codes koennen nicht generiert werden wenn das Limit (3 aktive Codes) erreicht ist.

3. **Keine Wiederaufnahme bei Unterbrechung**: Wenn der User versehentlich die App verlässt oder das Tracking pausiert, gibt es keinen einfachen Weg zurueck ins laufende Tracking. Die Session geht verloren.

4. **UX insgesamt zu komplex**: Zu viele Schritte, zu wenig Orientierung fuer den Kamera-Operator am Spielfeldrand.

---

### Loesung

#### Teil 1: Auto-Kalibrierung nach Code-Eingabe

Wenn der User in die Camera-Phase kommt und der Platz NICHT kalibriert ist:
- Sobald die Kamera bereit ist, automatisch `handleAutoDetectInline()` ausfuehren (KI-Erkennung)
- Falls KI erfolgreich: Punkte setzen, automatisch speichern, Toast zeigen
- Falls KI fehlschlaegt: `showInlineCalibration` automatisch aktivieren mit klarer Anweisung "Tippe die 4 Eckpunkte des Spielfelds an"
- Kein manueller Klick auf "Kalibrieren" noetig

**Datei**: `src/pages/CameraTrackingPage.tsx` — neuer `useEffect` der bei `cameraReady && !isCalibrated` auto-detect triggert

#### Teil 2: Kamera-Freigabe nach Analyse

Nach Upload + Processing-Trigger:
- Camera-Session als "completed" markieren (neuer `action: "release"` in `camera-ops`)
- Backend deaktiviert die Session (setzt `expires_at` auf jetzt)
- Frontend zeigt im "ended"-Screen: "Kamera freigegeben — kann fuer das naechste Spiel verwendet werden"

**Dateien**: `supabase/functions/camera-ops/index.ts` (neuer `release` action), `src/pages/CameraTrackingPage.tsx` (Release nach Upload)

#### Teil 3: Session-Wiederaufnahme

- `localStorage` speichert zusaetzlich: `camera_tracking_state_{matchId}_{cam}` mit `{ phase, elapsedSec, isTracking }`
- Beim Laden der Seite: wenn Session-Token gueltig UND gespeicherter State vorhanden, direkt in die richtige Phase springen
- Neuer "Fortsetzen"-Button wenn Match-Status "live" ist und eine gueltige Session existiert
- `handleGoBack` aus Tracking-Phase pausiert nur (bereits implementiert), aber speichert den State

**Datei**: `src/pages/CameraTrackingPage.tsx`

#### Teil 4: UX-Vereinfachung

- **Auth-Phase**: Groesserer Code-Input, automatischer Submit bei 6 Ziffern (kein Button-Klick noetig)
- **Camera-Phase**: Fortschritts-Anzeige vereinfachen — "Kamera bereit ✓ → Platz wird erkannt... → Tracking bereit!"
- **Tracking-Phase**: "Pause/Fortsetzen"-Button statt nur "Beenden"
- **Ended-Phase**: "Neues Tracking starten" Button fuer dasselbe Spiel (zurueck zur Camera-Phase)
- Wizard-Stepper-Labels uebersetzen: "Code → Kamera → Aufnahme"

---

### Technische Details

**Auto-Kalibrierung Trigger:**
```typescript
useEffect(() => {
  if (phase !== "camera" || !cameraReady || isCalibrated) return;
  if (detectingCalibration || showInlineCalibration) return;
  // Warte kurz bis Kamerabild stabil ist
  const t = setTimeout(() => {
    setShowInlineCalibration(true);
    handleAutoDetectInline(); // KI versucht automatisch
  }, 1500);
  return () => clearTimeout(t);
}, [phase, cameraReady, isCalibrated]);
```

**Session-Release (camera-ops):**
```typescript
if (action === "release") {
  await supabase.from("camera_access_sessions")
    .update({ expires_at: new Date().toISOString() })
    .eq("match_id", matchId)
    .eq("camera_index", cameraIndex)
    .eq("session_token_hash", sessionHash);
  return jsonResp({ success: true });
}
```

**Auto-Submit bei 6 Ziffern:**
```typescript
useEffect(() => {
  if (CODE_REGEX.test(code) && !isAuthorizing) {
    handleLogin();
  }
}, [code]);
```

**Tracking-State Persistenz:**
```typescript
// Beim Start: State speichern
localStorage.setItem(stateKey, JSON.stringify({ phase: "tracking", elapsedSec }));
// Bei Wiederherstellung: direkt in Tracking springen
```

### Dateien

| Datei | Aenderung |
|-------|-----------|
| `src/pages/CameraTrackingPage.tsx` | Auto-Kalibrierung, Session-Resume, Auto-Submit, Pause-Button, UX |
| `supabase/functions/camera-ops/index.ts` | Neuer `release` Action |
| `src/pages/CameraTrackingPage.tsx` | "Neues Tracking starten" in Ended-Phase |

### Prioritaet

1. Auto-Kalibrierung nach Kamera-Start (groesster UX-Gewinn)
2. Auto-Submit bei 6 Ziffern
3. Session-Wiederaufnahme bei Unterbrechung
4. Kamera-Freigabe nach Analyse
5. Pause/Fortsetzen-Button

