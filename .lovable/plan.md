

# Analyse: Was geht, was fehlt, was wäre möglich

## Status Quo — Was funktioniert

| Feature | Status |
|---|---|
| 1 Smartphone filmt, Frames alle 30s | ✅ Funktioniert |
| Gemini Vision analysiert Formationen, Gefahrenzonen | ✅ Funktioniert |
| Halbzeit-Analyse während Aufnahme | ✅ Funktioniert |
| Coaching-Insights + Trainingsplan | ✅ Funktioniert |
| Spielzug-Replay (geschätzte Positionen) | ✅ Funktioniert |
| Platz-Kalibrierung mit KI-Eckerkennung | ✅ Code vorhanden (FieldCalibration.tsx + detect-field-corners Edge Function) |
| Teilausschnitte (linke/rechte Hälfte, custom) | ✅ Im Kalibrierungs-Code implementiert |
| Video-Upload + Live-Aufnahme | ✅ Beides möglich (NewMatch.tsx) |

## Deine Fragen im Detail

### 1. Automatische Platzerkennung

**Ist bereits implementiert!** Die `FieldCalibration.tsx` nutzt eine `detect-field-corners` Edge Function die via Gemini Vision:
- 4 Eckpunkte automatisch erkennt
- Feldtyp identifiziert (Großfeld, Kleinfeld, Jugend, Futsal)
- Dimensionen vorschlägt (z.B. 105×68m)
- Erkennt ob es ein echtes Spielfeld ist oder nicht
- Teilansichten erkennt (nur linke/rechte Hälfte sichtbar)

**Was fehlt**: Die Kalibrierung wird aktuell NICHT automatisch vor der Analyse ausgelöst. Der User muss manuell zu `/fields/:id/calibrate` navigieren. Das könnte automatisiert werden.

### 2. Kamera schwenkt oder zoomt

**Problem**: Aktuell nimmt das System an, dass die Kamera statisch steht. Bei Schwenk/Zoom verschieben sich die Spielfeldkoordinaten zwischen Frames — die KI-Positionsschätzungen werden inkonsistent.

**Was machbar wäre** (rein mit Gemini Vision, ohne extra Backend):
- **Schwenk-Erkennung**: Gemini kann pro Frame den sichtbaren Feldausschnitt schätzen ("Frame zeigt linke Hälfte" vs. "Frame zeigt Mittellinie"). Das Prompt wird um eine `visible_area` Angabe pro Frame erweitert
- **Normalisierung**: Positionen werden relativ zum sichtbaren Ausschnitt geschätzt und dann auf das Gesamtfeld hochgerechnet
- **Zoom-Toleranz**: Gemini erkennt Nahaufnahmen ("Strafraum-Detail") und markiert diese — solche Frames werden für taktische Übersicht ignoriert, aber für Detailanalyse genutzt
- **Qualitäts-Warnung**: Starke Schwenks/Zooms → niedrigere Confidence im Report

**Limitierung**: Das funktioniert als "Best Effort". Exakte Koordinaten bei dynamischer Kamera sind ohne Computer Vision (Homographie-Transformation pro Frame) nicht möglich.

### 3. Optimale Kamera-Anzahl und Platzierung

**Aktueller Stand**: 1 Kamera. Mehr ist im Code nicht vorgesehen.

**Optimale Konfiguration für das aktuelle System**:

```text
                    ┌─────────────────────────────┐
                    │         Spielfeld            │
                    │                              │
                    │                              │
                    │                              │
                    └─────────────────────────────┘
                              📱
                        Mittellinie, erhöht
                        (Tribüne, 3-5m Höhe)
```

1 Kamera reicht, weil:
- Gemini analysiert Standbilder, keine Echtzeit-Tracks
- Höhere Position = bessere Übersicht = bessere KI-Schätzungen
- Schräge Perspektive (Eckfahne) ist schlecht → Mittellinie ideal

**Was mit 2 Kameras möglich wäre** (Feature-Erweiterung):
- Kamera 1: Linke Hälfte, Kamera 2: Rechte Hälfte
- Frames beider Kameras werden als 2 Bild-Sets an Gemini geschickt
- KI fusioniert die Perspektiven zu einem Gesamtbild
- Payload verdoppelt sich → Edge Function muss 40 statt 20 Frames verarbeiten

### 4. Teilausschnitte

**Bereits implementiert** in der Kalibrierung (`coverage: "left_half" | "right_half" | "custom"`). Die KI kann auch Teilansichten erkennen. Was fehlt:
- Die `analyze-match` Function nutzt die Kalibrierungsdaten des Feldes NICHT — sie weiß nicht, dass nur die linke Hälfte gefilmt wird
- Positionsschätzungen beziehen sich immer auf "das sichtbare Feld"

### 5. User-Fehler vermeiden

**Aktuelle Schwachstellen** wo User scheitern können:

| Fehlerquelle | Auswirkung | Lösung |
|---|---|---|
| Kein Platz angelegt → Spiel kann nicht erstellt werden | Blockiert | Auto-Platz erstellen wenn keiner vorhanden |
| Kamera zu nah am Spielfeld (Bodenhöhe) | Schlechte Analyse | Positionierungstipps vor Aufnahmestart |
| Aufnahme zu kurz (< 5 Frames) | Sinnlose Analyse | Mindest-Aufnahmezeit erzwingen (z.B. 3 Min) |
| Versehentlich gestoppt | Daten verloren | Bestätigungsdialog vor Stop |
| Handy dreht sich → Stream bricht ab | Frames verloren | Orientation Lock erzwingen |
| Browser-Tab wechseln → Kamera pausiert | Lücken in Frames | Warnung bei Visibility Change |
| Kein Internet beim Analyse-Start | Upload schlägt fehl | Offline-Queue mit Retry |
| Doppeltes Analyse-Triggering | Duplicate Jobs | Debounce + Check ob Job bereits existiert |

---

## Umsetzungsplan: Erweiterte Features

### Schritt 1: Smart Recording Guard (User-Fehler vermeiden)

Neue Komponente `RecordingGuard` die vor und während der Aufnahme prüft:
- **Vor Start**: Kamera-Positionierungstipps-Overlay ("Stelle dein Handy erhöht auf, Blick auf Mittellinie")
- **Orientierungssperre**: `screen.orientation.lock("landscape")` beim Aufnahmestart
- **Visibility-Warnung**: `document.visibilitychange` Listener → Toast "App im Vordergrund halten!"
- **Mindest-Frames**: Stop-Button erst aktiv nach >= 5 Frames (2.5 Min)
- **Bestätigungsdialog**: "Aufnahme wirklich beenden?" vor dem Stoppen
- **Frame-Qualitätsprüfung**: Schwarze/unscharfe Frames automatisch überspringen

### Schritt 2: Auto-Setup (Platz automatisch erkennen)

Wenn der User "Aufnahme starten" drückt:
1. Erster Frame wird an `detect-field-corners` geschickt (bereits vorhandene Edge Function)
2. Wenn kein Platz kalibriert → automatische Felderkennung aus dem ersten Kamerabild
3. Ergebnis wird als Banner angezeigt: "Großfeld erkannt (105×68m) ✓" oder "Feld konnte nicht erkannt werden — Analyse läuft trotzdem"
4. Kalibrierungsdaten werden an `analyze-match` weitergegeben für bessere Positionsschätzungen

### Schritt 3: Schwenk/Zoom-Toleranz

`analyze-match` Prompt erweitern:
- Pro Frame zusätzlich `visible_area: { description: string, estimated_coverage_pct: number }` abfragen
- Frames mit < 30% Feldabdeckung (Zoom auf Spieler) als "Detail-Frame" markieren → nicht für Taktik-Replay nutzen
- Im Report anzeigen: "3 von 20 Frames zeigten Nahaufnahmen und wurden für die taktische Analyse ausgeschlossen"

### Schritt 4: Kalibrierungsdaten in Analyse integrieren

`analyze-match` bekommt Feld-Infos:
- `field_dimensions`, `coverage`, `field_rect` aus der Kalibrierung
- Prompt sagt der KI: "Die Kamera zeigt nur die linke Spielfeldhälfte. Positionsangaben normalisieren auf das Gesamtfeld."
- Bessere Positionsschätzungen im Tactical Replay

### Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/pages/CameraTrackingPage.tsx` | RecordingGuard einbauen, Orientierungssperre, Visibility-Warnung |
| `src/pages/NewMatch.tsx` | Gleiche Guards für Record-Modus |
| `src/lib/frame-capture.ts` | Frame-Qualitätsprüfung (Schwarzbild-Erkennung), Orientierungs-Metadaten |
| `supabase/functions/analyze-match/index.ts` | Prompt um visible_area + Kalibrierungsdaten erweitern |
| `src/components/RecordingGuard.tsx` | NEU — Positionierungstipps, Orientation Lock, Visibility Warning |
| `src/components/CameraSetupOverlay.tsx` | NEU — Tipps vor Aufnahmestart |

### Was NICHT geht (Grenzen)
- Echtes Multi-Kamera-Stitching → braucht dediziertes CV-Backend
- Exakte Spieler-Identifikation (Trikotnummer lesen) → Gemini kann das nur sporadisch
- Echtzeit-Tracking mit fps-genauen Positionen → braucht YOLO/DeepSORT
- Automatische Schwenk-Kompensation (Homographie pro Frame) → braucht OpenCV

