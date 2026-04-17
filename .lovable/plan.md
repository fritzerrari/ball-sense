

## Das Problem verstanden

Die WiFi-Rückfahrkamera (z.B. SafetyCam) erstellt ein **eigenes WiFi-Netz**, mit dem sich das Smartphone verbinden muss. Während dieser Verbindung hat das Phone:
- ❌ Kein Internet (außer Mobilfunk-Daten sind aktiv)
- ❌ Kein Heim-WiFi parallel
- ✅ Aber: Mobile Daten (4G/5G) bleiben verfügbar

## Die gute Nachricht: Es funktioniert trotzdem

Android kann **WiFi (für Cam) + Mobile Daten (für Internet)** gleichzeitig nutzen — das ist der Standard-Setup für solche Cams. FieldIQ braucht Internet für:
- Frame-Upload zu Supabase Storage
- Event-Sync, Realtime, KI-Pipeline

→ Lösung: **Mobile Daten müssen aktiv bleiben**, während das WiFi mit der Cam gekoppelt ist.

## Was im Workflow ergänzt wird

### 1. Erweiterter Setup-Dialog `ExternalCameraSetup.tsx`
Neuer **Schritt 0** vor den bisherigen 3 Schritten:

> **Vor dem Start: Netzwerk vorbereiten**
> 1. ✅ Mobile Daten einschalten (Einstellungen → Mobilfunk)
> 2. ✅ WiFi mit deiner Kamera verbinden (z.B. "SafetyCam_XXXX")
> 3. ✅ "Trotzdem verbinden" bestätigen, falls Android warnt "Kein Internet über WiFi"
> 4. ⚠️ Android-Einstellung prüfen: "Mobile Daten bei WiFi-ohne-Internet erlauben" (je nach Hersteller anders benannt)

Plus visuelles Diagramm:
```text
[Kamera] ──WiFi──> [Phone] ──Mobilfunk──> [Internet/FieldIQ]
```

### 2. Live-Verbindungs-Check in `CameraTrackingPage.tsx`
Vor `getDisplayMedia()`-Aufruf zwei Checks:
- `navigator.onLine` → ist überhaupt Internet da?
- Ein leichter `fetch()` zu Supabase → echte Konnektivität testen

Falls **kein Internet**: klare Warnung mit Lösungs-Hint statt cryptic Error.

### 3. Während der Aufnahme: Connectivity-Watcher
- `online`/`offline`-Events des Browsers überwachen
- Bei Verbindungsabbruch: Toast "Mobile Daten unterbrochen — Frames werden gepuffert"
- Beim Wiederverbinden: Auto-Resume des Frame-Uploads (Pipeline puffert ohnehin in Storage-JSON)

### 4. Datenverbrauch-Hinweis im Setup
Transparente Aussage: "Pro 90-Min-Spiel ca. 8-15 MB mobile Daten (nur Frames + Events, kein Video)."

### 5. Memory-Update
Erweiterung von `mem://features/external-camera-mode.md` um die Netzwerk-Anforderung (Mobile Daten + WiFi-Cam parallel, Android-Setting "WiFi without Internet allow").

## Was unverändert bleibt
- ✅ Bildschirm-Capture-Logik (`useDisplayCapture`)
- ✅ Frame-Pipeline, Event-Tracking, Halbzeit-Logik
- ✅ Alle anderen Aufnahme-Modi

## Klare Limits (transparent in UI)
- ⚠️ Ohne Mobilfunk-Vertrag/Datentarif unmöglich
- ⚠️ Schlechter Empfang am Sportplatz → Frame-Puffer kann volllaufen
- ⚠️ Manche Android-Hersteller (Xiaomi, Huawei) verstecken die "Mobile Daten bei WiFi" Option tief in den Einstellungen

## Was bewusst NICHT gebaut wird
- ❌ Auto-Switch zwischen WiFi und Mobile Daten (Android-API erlaubt das nicht aus Browser)
- ❌ Lokales Frame-Caching mit späterem Sync (zu komplex für Beta — kommt evtl. später)

## Antwort auf deine Frage
**Ja, das funktioniert** — solange du **mobile Daten aktiv** hast. Der Setup-Dialog erklärt es Schritt für Schritt mit Diagramm, und FieldIQ prüft vor Start, ob wirklich Internet da ist.

