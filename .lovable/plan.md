

## Verwacklungs-Erkennung, Auto-Kalibrierung & Workflow-Vereinfachung

### Problem-Analyse

**1. Verwacklung/Stoß/Schwenk**: Aktuell wird nur der Zoom alle 60s geprüft. Wenn jemand die Kamera anstößt, schwenkt oder dreht, erkennt das System nichts — die Tracking-Daten werden unbrauchbar, ohne dass der Kameramann es merkt.

**2. Kamera-Workflow zu komplex**: 6 Wizard-Schritte, manueller Kalibrierungscheck, separate Seite für Kalibrierung mit Navigation weg vom Tracking.

**3. Spiel-Anlegen-Workflow**: Consent-Checkboxen im Details-Schritt blockieren, Kamera-Setup generiert nur Links aber keine Codes direkt, nach Erstellung kein direkter "Code generieren"-Flow.

---

### Teil 1: Verwacklungs- & Bewegungserkennung

Drei Mechanismen zur Erkennung von Kamera-Instabilität:

**A. Frame-Differenz-Analyse (primär)**
- Alle 5 Sekunden: Canvas-Snapshot vom Video, Vergleich mit vorherigem Frame
- Pixel-Differenz berechnen (Durchschnitt der RGB-Abweichung über Sampling-Grid)
- Schwellenwert: >15% Differenz bei >3 aufeinanderfolgenden Checks = "Instabilität erkannt"
- Unterscheidung: kurzer Stoß (1 Frame spike) vs. Schwenk (mehrere Frames kontinuierlich)

**B. DeviceMotion-API (ergänzend auf Mobilgeräten)**
- `window.addEventListener("devicemotion")` — misst Beschleunigung
- Threshold: >2g plötzliche Beschleunigung = Stoß erkannt
- Kontinuierliche Neigung >5° über 3s = Schwenk/Kippen

**C. Zoom-Monitoring (bestehend, erweitert)**
- Aktuell 60s Intervall → auf 10s verkürzen
- Sofortige Prüfung nach erkanntem Stoß

**Reaktion auf Instabilität:**
- Gelbes Banner: "📱 Kamera wurde bewegt — Bild prüfen!"
- Nach 10s ohne Korrektur: Orange Banner: "Empfehlung: Neu kalibrieren"
- Button "Alles OK" zum Wegklicken oder "Neu kalibrieren" für sofortige In-Place-Kalibrierung
- Bei schwerem Stoß: Akustischer Alarm (kurzer Ton)

**Dateien**: `src/lib/football-tracker.ts` (neue Methoden `startStabilityMonitoring`, `checkFrameDifference`), `src/pages/CameraTrackingPage.tsx`

### Teil 2: Auto-Kalibrierung & Selbstoptimierung

**Periodische Auto-Kalibrierung (alle 10 Minuten):**
- System nimmt automatisch einen Frame, sendet ihn an `detect-field-corners`
- Vergleicht erkannte Ecken mit gespeicherter Kalibrierung
- Wenn Abweichung >5%: Automatische Korrektur + Info-Banner "Kalibrierung automatisch angepasst"
- Wenn Abweichung >20%: Warnung + manuelle Bestätigung nötig

**In-Place-Kalibrierung (ohne Seitenwechsel):**
- Statt Navigation zu `/fields/:id/calibrate`: Inline-Dialog/Overlay direkt im Tracking-Screen
- Video pausiert kurz, 4-Punkt-Overlay erscheint über dem Live-Bild
- User tippt 4 Ecken → Speichern → Tracking geht sofort weiter
- Kein Seitenwechsel, kein Stream-Verlust

**Dateien**: `src/pages/CameraTrackingPage.tsx` (neues Inline-Kalibrierungs-Overlay), `src/lib/football-tracker.ts`

### Teil 3: Kamera-Workflow radikal vereinfachen

Aktuell 6 Schritte → **3 Schritte**:

```text
Schritt 1: Code eingeben → Auto-Login + Auto-Modell-Laden
Schritt 2: Kamera + Kalibrierung (kombiniert, inline)
Schritt 3: Tracking läuft
```

Konkrete Änderungen:
- **Auth + Loading zusammenführen**: Nach Code-Eingabe sofort Modell laden (parallel zur Session-Validierung)
- **Camera + Calibration zusammenführen**: Kamera startet automatisch. Kalibrierungsstatus wird als Badge angezeigt, nicht als eigener Schritt. Ein großer "Tracking starten"-Button mit Hinweis ob kalibriert oder nicht.
- **Ended-Phase**: Upload startet automatisch nach Beenden (kein extra Button-Klick)

**Dateien**: `src/pages/CameraTrackingPage.tsx`

### Teil 4: Spiel-Anlegen-Workflow vereinfachen

Aktuell 4-5 Schritte → **3 Schritte** mit integrierter Code-Generierung:

```text
Schritt 1: Typ + Details (kombiniert)
Schritt 2: Spieler (Heim + optional Gast)
Schritt 3: Kameras + Codes (auto-generiert, kopierbar)
```

Konkrete Änderungen:
- **Typ und Details in einem Schritt**: Typ-Auswahl als Toggle oben, Details darunter
- **Consent inline**: Statt blockierender Checkboxen → kompakter Consent-Banner am Ende von Schritt 1
- **Kamera-Codes direkt generieren**: Nach Erstellung werden automatisch Codes generiert und als große, kopierbare Kacheln angezeigt. "Code kopieren"-Button + "Per SMS teilen"-Button
- **Zusammenfassung vor Erstellung**: Letzte Seite zeigt Zusammenfassung + "Spiel erstellen & Codes generieren"

**Dateien**: `src/pages/NewMatch.tsx`

### Teil 5: System-Review & Fehlerbehebungen

**Erkannte Probleme:**

1. **`handleLiveSnapshot` navigiert weg**: Aktuell `window.location.href = /fields/...` — das stoppt den Kamerastream und zerstört den Tracker-State. Muss durch Inline-Kalibrierung ersetzt werden (Teil 2).

2. **Kamera 2 Upload**: `camera-ops` Edge Function sollte `cameraIndex` bis 4 akzeptieren (aktuell unklar). Upload-Timeout sollte 120s+ sein.

3. **Session-Restore fragil**: Wenn `fetchSession` fehlschlägt, wird der User auf `auth` zurückgesetzt — aber der localStorage-Token bleibt. Race condition möglich.

4. **Tracking-Overlay ohne Kalibrierungsdaten**: Das Overlay zeigt Detections in normalisierten Koordinaten, aber berücksichtigt nicht die `field_rect` der Kalibrierung. Bei Teilfeld-Kalibrierung wären die Marker falsch positioniert.

5. **`handleGoBack` von Tracking**: Stoppt den Tracker komplett — besser wäre Pausieren statt Stoppen.

---

### Technische Details

**Frame-Differenz-Algorithmus:**
```typescript
// Sampling: 20x15 Grid = 300 Pixel-Proben
// Differenz = Durchschnitt |R1-R2| + |G1-G2| + |B1-B2| / (3 * 255)
// Threshold: 0.15 = 15% durchschnittliche Farbänderung
```

**DeviceMotion:**
```typescript
window.addEventListener("devicemotion", (e) => {
  const acc = e.acceleration;
  if (!acc) return;
  const magnitude = Math.sqrt((acc.x??0)**2 + (acc.y??0)**2 + (acc.z??0)**2);
  if (magnitude > 20) onBumpDetected(); // ~2g
});
```

**Inline-Kalibrierung**: Neues State `showInlineCalibration` in CameraTrackingPage. Bei Aktivierung wird ein transparentes Overlay über dem Video gerendert, in dem der User 4 Punkte tippen kann. Kein Seitenwechsel nötig.

---

### Prioritätsreihenfolge

1. Inline-Kalibrierung (ersetzt den kaputten `handleLiveSnapshot`-Navigationsflow)
2. Kamera-Wizard auf 3 Schritte reduzieren
3. Frame-Differenz + DeviceMotion Verwacklungserkennung
4. Auto-Kalibrierung alle 10 Minuten
5. Spiel-Anlegen auf 3 Schritte mit Code-Generierung
6. Bug-Fixes (Session-Restore, Overlay-Koordinaten, Upload-Timeout)

