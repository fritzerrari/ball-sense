

## Aufgabe

Zwei Dinge:
1. **„Externe Kamera"-Feature komplett ausbauen** — Bildschirm-Capture funktioniert mobil nicht und liefert auch am Desktop keinen Mehrwert für dich am Spielfeld.
2. **Weitwinkel-Erkennung auf Pixel 8a fixen** — `useUltraWideCamera` erkennt die 0.5x-Kamera dort nicht.

## Teil 1: Externe Kamera ausbauen

### Was entfernt wird
- `src/components/ExternalCameraSetup.tsx` — Datei löschen
- `src/components/CameraRemotePanel.tsx` — falls nur für External genutzt: prüfen, sonst behalten
- `src/hooks/use-display-capture.ts` — Datei löschen
- `src/components/MatchRecordingChoice.tsx` — Eintrag `"external"` aus `choices` entfernen, Type `RecordingMode` reduzieren auf `"self" | "helper" | "upload"`
- `src/pages/CameraTrackingPage.tsx` — alle `mode === "external"` Pfade, `startExternalCapture`, Display-Capture-Imports, Setup-Dialog-Branch entfernen
- `mem://features/external-camera-mode.md` — Memory-Datei löschen
- `mem://index.md` — Eintrag „External Camera Mode" aus Memories entfernen

### Was bleibt
Self-Recording, Helfer-Flow, Upload-Flow — alle drei laufen unverändert weiter.

## Teil 2: Weitwinkel auf Pixel 8a fixen

### Diagnose
Pixel 8a hat physisch **eine** Hauptkamera (64 MP) + **eine** Ultraweit (13 MP). Aktuell scheitert die Erkennung wahrscheinlich an einem von zwei Punkten:

1. **Android Chrome listet auf Pixel-Geräten oft nur die „logische" Kamera** statt aller physischen Sensoren — `enumerateDevices()` zeigt dann nur ein Rear-Device.
2. **Selbst wenn beide gelistet werden**, hat Chrome auf Pixel 8a Labels wie `"camera2 0, facing back"` und `"camera2 2, facing back"` — das aktuelle Filter-Heuristik in `use-ultra-wide-camera.ts` lässt beide durch (gut), aber das **Cycling per `deviceId`** schlägt fehl, weil Chrome auf Pixel die zweite Rear-Kamera nicht als separaten `getUserMedia`-Stream öffnen will.

### Lösung: zoom-basierter Weitwinkel statt Device-Switching
Statt zwischen physischen Devices zu wechseln, nutzen wir die **MediaStreamTrack `zoom` Capability** (Pixel 8a unterstützt `zoom: { min: 1, max: 7 }`). Für „Weitwinkel" setzen wir `zoom = min`, was auf Pixel automatisch auf den Ultra-Wide-Sensor umschaltet.

**Geänderte Datei: `src/hooks/use-ultra-wide-camera.ts`**

Neuer Ablauf:
1. Beim ersten `initStream` Standard-Stream mit `facingMode: "environment"` öffnen.
2. `track.getCapabilities()` prüfen auf `zoom`-Support.
3. Falls `zoom` verfügbar → „Weitwinkel" = `applyConstraints({ advanced: [{ zoom: capabilities.zoom.min }] })`. Kein Device-Switch, kein Stream-Restart.
4. Falls `zoom` nicht verfügbar → Fallback auf bestehendes Device-Cycling.
5. UI-Label anpassen: bei `zoom == min` → „0.5x Weitwinkel", bei `zoom == 1` → „1x", bei höher → „Xx Zoom".

Vorteile:
- Funktioniert auf Pixel 8a (und allen anderen Pixel/Samsung-Geräten mit `zoom`-Capability).
- Kein Stream-Restart → kein Flackern, schneller Wechsel.
- Behält Fallback für Geräte ohne `zoom`-API.

**Geänderte Datei: Aufrufer (z. B. `src/pages/CameraTrackingPage.tsx`)**
Der Toggle-Button bleibt, ruft aber statt `cycleCamera()` jetzt `toggleWideAngle()` auf. Bei Geräten ohne Zoom-Support fällt es transparent auf Cycling zurück.

### Zusätzlich: Debug-Hinweis im UI
Ein dezentes Info-Toast beim ersten Start: „Weitwinkel nicht verfügbar — diese Kamera unterstützt keinen optischen Zoom-Wechsel" wenn weder `zoom` noch zweite Rear-Cam erkannt wird. So weißt du sofort, woran es liegt, statt im Dunkeln zu rätseln.

## Betroffene Dateien (Übersicht)

**Löschen:**
- `src/components/ExternalCameraSetup.tsx`
- `src/hooks/use-display-capture.ts`
- `mem://features/external-camera-mode.md`

**Ändern:**
- `src/components/MatchRecordingChoice.tsx` — External-Option entfernen
- `src/pages/CameraTrackingPage.tsx` — External-Branches entfernen, Weitwinkel-Toggle anpassen
- `src/hooks/use-ultra-wide-camera.ts` — Zoom-Capability-API ergänzen, Cycling als Fallback
- `mem://index.md` — External-Eintrag entfernen

**Unverändert:**
- Self/Helfer/Upload-Flows, Frame-Pipeline, Storage, Analyse

## Validierung nach Umsetzung

1. „Externe Kamera"-Karte erscheint nicht mehr in `MatchRecordingChoice`.
2. Direktaufruf `?mode=external` führt sauber auf Self-Flow oder zeigt 404, kein toter Code.
3. Auf Pixel 8a: Weitwinkel-Button schaltet hörbar/sichtbar in Ultraweit-Bildausschnitt (~0.5x). Zurückschalten auf 1x funktioniert.
4. Auf Geräten ohne Zoom-Capability (älteres Android): Fallback-Cycling funktioniert wie bisher.

