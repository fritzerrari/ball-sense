

## Tiefenanalyse

Die wahrscheinlichste Hauptursache ist **nicht fehlender Browser-Support**, sondern der aktuelle Ablauf in `CameraTrackingPage.tsx`:

- Der Button im Dialog ruft `startExternalCapture()` auf.
- Dort läuft **zuerst** ein async Connectivity-Check (`fetch` auf `/auth/v1/health`).
- **Erst danach** wird `displayCapture.start()` und damit `navigator.mediaDevices.getDisplayMedia()` aufgerufen.

Auf Android Chrome/Edge geht dabei oft die nötige **User-Gesture / transient activation** verloren. Dann verhält sich `getDisplayMedia()` so, als wäre es nicht unterstützt oder abgelehnt, obwohl der Browser es grundsätzlich kann.

Zusätzlich gibt es noch den zweiten bekannten Sonderfall:
- Im **Lovable-Preview-iframe** ist Display-Capture separat blockiert.

Damit gibt es aktuell zwei verschiedene Ursachen, die in der UX zu ähnlich aussehen:
1. **Gesture-Kette verloren** auf echter Live-URL
2. **Iframe-Permission blockiert** im Editor-Preview

## Lösung

### 1. `CameraTrackingPage.tsx` – Capture direkt im Klick starten
Ich würde den Flow so umbauen, dass beim Klick auf **„Bildschirm freigeben“** `getDisplayMedia()` **sofort und direkt** gestartet wird.

Geplante Änderung:
- `startExternalCapture()` beginnt direkt mit `displayCapture.start()`
- **keine `await fetch(...)` mehr vor dem Capture**
- Netzwerk-/Health-Checks erst **nach erfolgreichem Stream-Start**

Das ist der wichtigste Fix.

### 2. `use-display-capture.ts` – Fehler sauber klassifizieren
Der Hook sollte nicht nur `error` in React-State setzen, sondern einen **klaren Rückgabestatus** liefern, z. B.:

```text
success
iframe_blocked
ios_unsupported
api_missing
permission_denied
selection_cancelled
unknown_error
```

So kann die Seite präzise reagieren, statt generisch „Browser unterstützt nicht“ anzuzeigen.

### 3. `CameraTrackingPage.tsx` – Connectivity-Check nachgelagert
Den bestehenden Internet-/Health-Check behalten, aber erst **nachdem** der Screen-Share-Dialog erfolgreich war.

Neuer Ablauf:
```text
Button-Klick
→ getDisplayMedia() sofort
→ Stream erfolgreich?
  → ja: Video binden, Phase = ready
  → danach: Connectivity prüfen
      → bei fehlendem Internet: klarer Toast „Kamera-WLAN aktiv, aber mobile Daten fehlen“
```

So bleibt der Browser-Dialog zuverlässig, und der Nutzer bekommt trotzdem den Hinweis zum Mobilfunk.

### 4. `ExternalCameraSetup.tsx` – Copy an echten Ursachen ausrichten
Dialogtext anpassen:
- nicht mehr primär „Browser unterstützt nicht“
- stattdessen:
  - im Preview: „Editor blockiert Bildschirmfreigabe, bitte Live-URL öffnen“
  - auf Android Live-URL: „Tippe hier und wähle Gesamten Bildschirm“
  - bei Fehlschlag: „Bitte direkt erneut aus diesem Dialog starten“

Optional würde ich den CTA klarer machen:
- „Jetzt Bildschirmfreigabe starten“
- darunter kleiner Hinweis: „Der Systemdialog muss direkt nach dem Tippen erscheinen“

### 5. Fehleranzeige robuster machen
Aktuell wird nach `await displayCapture.start()` direkt `displayCapture.error` gelesen. Das kann wegen asynchronem State veraltet sein.

Ich würde die Fehler-Info **direkt aus `start()` zurückgeben** statt mich auf nachträglich gesetzten State zu verlassen.

### 6. Keine Backend-Änderungen
Für diesen Fix sind **keine Datenbank- oder Backend-Anpassungen** nötig. Es ist ein reines Frontend-/Browser-Flow-Problem.

## Ergebnis nach Umsetzung

Auf der **Live-URL** sollte die externe Kamera wieder korrekt funktionieren, weil:
- Android Chrome/Edge den Screen-Share-Dialog direkt nach dem Klick öffnen
- das Kamera-WLAN/Mobilfunk-Thema weiterhin geprüft wird, aber erst **nach** dem Capture
- der Nutzer präzisere Fehler statt „nicht unterstützt“ bekommt

Im **Lovable-Preview** bleibt es weiterhin blockiert, aber dann mit klarer, richtiger Erklärung.

## Betroffene Dateien

- `src/pages/CameraTrackingPage.tsx`
- `src/hooks/use-display-capture.ts`
- `src/components/ExternalCameraSetup.tsx`

## Validierung nach Implementierung

Ich würde danach gezielt prüfen:
1. Klick auf „Externe Kamera“ auf der **Live-URL**
2. Klick auf „Bildschirm freigeben“
3. Öffnet sich **sofort** der native Screen-Share-Dialog auf Android Chrome/Edge?
4. Wird nach erfolgreicher Freigabe erst danach der Connectivity-Hinweis angezeigt?
5. Zeigt der Preview-iframe weiterhin korrekt „nur Live-URL“ statt „Browser nicht unterstützt“?

