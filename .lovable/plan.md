

# Weitwinkel-Modus für Kamera-Tracking

## Problem
Wenn man am Spielfeldrand steht und nicht hoch genug oder weit genug entfernt ist, passt das gesamte Spielfeld nicht ins Bild. Moderne Smartphones haben oft eine Ultra-Weitwinkel-Kamera (0.5x), die hier helfen kann.

## Lösung
Ein **Weitwinkel-Toggle** in der Kamera-Tracking-Oberfläche, der automatisch die Ultra-Weitwinkel-Kamera des Smartphones aktiviert (sofern vorhanden). Zusätzlich eine Einstellung in den Settings, um den Standard festzulegen.

## Umsetzung

### 1. Weitwinkel-Toggle auf der Tracking-Seite
- **`src/pages/CameraTrackingPage.tsx`**: Neuer State `useUltraWide` (boolean). In `initCamera()` wird `getUserMedia` mit einem zusätzlichen Constraint erweitert:
  - Ultra-Weitwinkel: `{ facingMode: "environment", zoom: 0.5 }` (oder über `getCapabilities()` die minimale Focal Length wählen)
  - Fallback: Wenn das Gerät keine Ultra-Weitwinkel-Kamera hat, wird ein Toast angezeigt ("Kein Weitwinkel verfügbar") und der Standard-Modus beibehalten
- Ein kleiner Button (z. B. `0.5x` / `1x`) wird im Recording-UI angezeigt (oben rechts neben dem Timer), der den Stream live umschaltet

### 2. Kamera-Auswahl über verfügbare Geräte
- Beim Start `navigator.mediaDevices.enumerateDevices()` aufrufen, um alle Rückkameras zu erkennen
- Über `deviceId`-Constraint gezielt die Ultra-Weitwinkel-Kamera ansprechen (erkennbar an Label-Strings wie "wide", "ultra" oder der niedrigsten Focal Length)
- Stream-Wechsel: Alten Stream stoppen, neuen Stream mit anderem `deviceId` starten, an `videoRef` binden — laufende Frame-Capture läuft nahtlos weiter

### 3. Settings-Integration
- **`src/pages/Settings.tsx`**: Neuer Abschnitt "Kamera-Einstellungen" mit einem Switch "Weitwinkel als Standard verwenden"
- Wird in `localStorage` gespeichert (`fieldiq_prefer_ultrawide`)
- `CameraTrackingPage` liest diesen Wert beim Start als Default

### 4. Setup-Overlay-Tipp
- **`src/components/CameraSetupOverlay.tsx`**: Neuer Tipp-Eintrag: "Weitwinkel nutzen — Zu nah am Feld? Aktiviere den 0.5x-Modus für mehr Übersicht."

## Technische Details
- Die Web API `MediaTrackConstraints` unterstützt `deviceId` für Kamera-Wechsel und `zoom` (experimentell) für Zoom-Steuerung
- Primärer Ansatz: `enumerateDevices()` → Kamera mit "wide" im Label oder niedrigstem Zoom finden → per `deviceId` auswählen
- Fallback: Wenn nur eine Rückkamera vorhanden ist, wird der Toggle ausgeblendet
- Frame-Capture bleibt unverändert — sie greift auf dasselbe `videoRef` zu

