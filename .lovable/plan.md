

## Problem
User testet im Lovable-Editor-Vorschau (1567x879, läuft im iframe). Edge & Chrome unterstützen `getDisplayMedia` grundsätzlich, aber:

**Hauptursache: iframe-Permission-Policy fehlt.** Der Lovable-Editor lädt die App in einem iframe ohne `allow="display-capture"`. Dadurch ist `navigator.mediaDevices.getDisplayMedia` zwar als Funktion verfügbar, schlägt aber beim Aufruf mit `NotAllowedError` fehl — oder wird je nach Browser-Version komplett blockiert.

Das ist eine **Plattform-Limitierung des Lovable-Editors**, die wir nicht im Code umgehen können. ABER: auf der **Live-URL** (`demo6.time2rise.de` oder `ball-sense.lovable.app`) läuft die App nicht im iframe und Display-Capture funktioniert.

## Lösung

### 1. `use-display-capture.ts` — Iframe-Erkennung verschärfen
Aktuell prüft der Hook nur `getDisplayMedia` Funktions-Existenz. Wenn die App im iframe läuft, soll der Hook den User **aktiv vor dem Start warnen**, nicht erst beim Fehlschlag. Neue Logik:
- Wenn `isInIframe()` → `supported = false` zurückgeben mit klarer Meldung "Editor-Vorschau blockiert Bildschirm-Capture — bitte Live-URL öffnen"
- Auf der Live-URL (kein iframe) → normal versuchen

### 2. `ExternalCameraSetup.tsx` — Prominenter Live-URL-Button
Wenn iframe erkannt: **Großer Call-to-Action-Button "FieldIQ in neuem Tab öffnen"** der direkt zu `https://demo6.time2rise.de` (oder published URL) springt. So kann der User mit einem Klick zur funktionierenden Umgebung wechseln, statt URL manuell einzutippen.

### 3. `MatchRecordingChoice.tsx` — Karte im Editor markieren
Wenn iframe erkannt, "Externe Kamera"-Karte mit Hinweis-Badge "Nur Live-URL" versehen, damit klar ist warum's im Editor nicht geht.

### 4. Fallback-Versuch trotzdem erlauben
Manche Browser-Versionen erlauben Display-Capture inzwischen auch im iframe. Daher: **"Trotzdem versuchen"-Option** anbieten, falls der User es probieren möchte. Schlägt es fehl → klare Erklärung + Live-URL-Button.

## Was unverändert bleibt
- ✅ Setup-Flow, Capture-Logik, Frame-Pipeline
- ✅ Funktionalität auf Live-URL (Desktop Edge/Chrome/Firefox & Android Chrome)

## Klare Antwort
Edge unterstützt Display-Capture sehr wohl — aber **nicht in einem iframe ohne Permission-Policy**, was beim Lovable-Editor der Fall ist. Lösung: Die App muss in einem eigenen Tab (Live-URL) laufen. Das bauen wir mit einem One-Click-Button direkt im Setup-Dialog ein.

