

# Weitwinkel-Fix & Layout-Optimierung für Kamera-Tracking

## Problem 1: Kein Weitwinkel-Button auf Pixel 8a

Das Pixel 8a hat 2 Rückkameras (64MP Haupt + 13MP Ultrawide). Die aktuelle Erkennung scheitert wahrscheinlich daran, dass:
- Android Chrome Labels wie `"camera2 0, facing back"` zurückgibt — ohne "wide"/"ultra" im Text
- Die Filterlogik `label.includes("front")` matched auf `"facing front"`, was korrekt filtert — aber möglicherweise gibt es Timing-Probleme: `detectCameras()` läuft asynchron beim Mount, `initStream()` wird aber evtl. aufgerufen bevor die Erkennung fertig ist (leeres `cameras`-Array → Fallback auf `facingMode: environment`)

**Fix:** 
- `detectCameras()` muss **vor** `initStream()` abgeschlossen sein (await-Kette)
- Zusätzlich: Debug-Toast einbauen, der beim Laden die Anzahl erkannter Kameras anzeigt (nur temporär, um das Problem auf dem Gerät zu verifizieren)
- Robustere Erkennung: Alle `videoinput`-Geräte nehmen, dann nur explizit "facing front" ausfiltern (statt auf "front" allgemein zu prüfen)

## Problem 2: Layout nicht optimal

Aus dem Screenshot: Die Event-Buttons (Tor, Chance, Gelb, etc.) nehmen ca. 40% des sichtbaren Kamerabildes ein. Die Buttons unten (Halbzeit, Stoppen) sind sehr groß.

**Optimierungen:**
- Event-QuickBar kompakter: Buttons kleiner, in einer scrollbaren Zeile statt 2x4-Grid
- Bottom-Controls kompakter: Halbzeit-Button schmaler (h-10 statt h-12), Stoppen-Button h-12 statt h-14
- Kamerabild bekommt mehr Raum

## Änderungen

### 1. `src/hooks/use-ultra-wide-camera.ts`
- `detectCameras` als Promise returnen, in `initStream` zuerst `await detectCameras()` aufrufen falls noch nicht fertig
- Filter anpassen: nur `"facing front"` explizit ausschließen (nicht generisches "front")
- Console-Log der erkannten Kameras für Debugging

### 2. `src/pages/CameraTrackingPage.tsx`  
- `initCamera` wartet auf Kameraerkennung bevor Stream gestartet wird
- Bottom-Controls: Padding und Button-Höhen reduzieren (`p-3` statt `p-4`, `h-11`/`h-12` statt `h-12`/`h-14`)
- Kamera-Wechsel-Button immer anzeigen (auch bei 1 Kamera, dann als Info "1 Kamera erkannt"), damit User sieht, dass das Feature existiert

### 3. `src/components/MatchEventQuickBar.tsx`
- Event-Buttons in horizontaler Scroll-Zeile statt 4-Spalten-Grid
- Kompaktere Höhe (h-8 statt h-10) für Mobile
- Team-Toggle schmaler

### 4. `src/components/CameraSetupOverlay.tsx`  
- Keine Änderung nötig (Weitwinkel-Tipp bereits vorhanden)

