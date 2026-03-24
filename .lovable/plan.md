

## Zoom & Teilfeld-Kalibrierung: Erweiterte Kamera-Modi

### Kernidee

Aktuell speichert die Kalibrierung nur 4 Eckpunkte des **gesamten** Feldes. Das bedeutet: Wenn die Kamera nach der Kalibrierung zoomt oder nur einen Teil des Feldes filmt, stimmen die Koordinaten nicht mehr.

Die Lösung: **Jede Kamera kalibriert ihren eigenen sichtbaren Bereich** — egal ob Vollfeld, Halbfeld oder gezoomter Ausschnitt. Das Backend fusioniert die Teilbereiche automatisch.

```text
┌─────────────────────────────────────────┐
│              Gesamtes Feld              │
│                                         │
│  ┌──────────────┐   ┌──────────────┐   │
│  │   Kamera 1   │   │   Kamera 2   │   │
│  │  (linke H.)  │   │  (rechte H.) │   │
│  │  gezoomt     │   │  gezoomt     │   │
│  └──────────────┘   └──────────────┘   │
│         ↓                   ↓          │
│     Teilfeld-            Teilfeld-      │
│     Kalibrierung         Kalibrierung   │
│         └───────┬───────────┘          │
│           Backend-Fusion               │
│           → Vollfeld-Analyse           │
└─────────────────────────────────────────┘
```

---

### Plan

#### Teil 1: Erweitertes Kalibrierungs-Datenmodell

`CalibrationData` bekommt neue Felder:

- `coverage`: `"full"` | `"left_half"` | `"right_half"` | `"custom"` — welcher Feldbereich sichtbar ist
- `field_rect`: `{ x: number, y: number, w: number, h: number }` — normalisierter Bereich des Gesamtfeldes (0-1), z.B. linke Hälfte = `{ x: 0, y: 0, w: 0.5, h: 1 }`
- `zoom_level`: Erkannter oder geschätzter Zoom-Faktor

**Dateien**: `src/lib/types.ts`

#### Teil 2: Geführter Kalibrierungs-Wizard mit Abdeckungserkennung

Im Kalibrierungsschritt (Phase `calibration`) wird dem User eine **visuelle Auswahl** angeboten:

1. **Auto-Erkennung**: System prüft ob die 4 markierten Ecken das volle Feld oder nur einen Teil abdecken (anhand der Seitenverhältnisse und Position der Punkte relativ zum bekannten Feld)
2. **Manuelle Auswahl** als Fallback: "Was siehst du im Bild?"
   - Ganzes Feld
   - Linke Hälfte (bis Mittellinie)
   - Rechte Hälfte (ab Mittellinie)
   - Eigener Bereich (4 Ecken frei markieren + Position auf Miniatur-Feld angeben)

Der User sieht eine **Miniatur-Feldskizze** wo sein sichtbarer Bereich farbig hervorgehoben wird — sofort verständlich, keine technischen Begriffe.

**Dateien**: `src/pages/FieldCalibration.tsx`, `src/pages/CameraTrackingPage.tsx`

#### Teil 3: Pro-Kamera-Kalibrierung statt Feld-Kalibrierung

Aktuell wird die Kalibrierung am **Feld** gespeichert. Für Zoom/Teilfeld muss jede Kamera ihre **eigene** Kalibrierung haben.

- Neue DB-Spalte: `tracking_uploads.calibration` (JSONB) — speichert die Kalibrierung pro Kamera pro Match
- Die Feld-Kalibrierung bleibt als Default/Fallback
- Bei Neu-Kalibrierung während des Trackings wird die kameraspezifische Kalibrierung aktualisiert

**DB-Migration**: `ALTER TABLE tracking_uploads ADD COLUMN calibration jsonb DEFAULT NULL`

#### Teil 4: Zoom-Erkennung und Warnung

Beim Tracking-Start und periodisch (alle 60s):

- System vergleicht das aktuelle Kamera-FOV mit der Kalibrierung
- Wenn der Zoom sich verändert hat → **gelbes Banner**: "Zoom hat sich verändert. Neu kalibrieren?"
- Automatische Erkennung über `MediaStreamTrack.getCapabilities().zoom` und `getSettings().zoom`

**Dateien**: `src/lib/football-tracker.ts`, `src/pages/CameraTrackingPage.tsx`

#### Teil 5: Backend-Fusion für Teilfelder

`process-tracking` erkennt ob Kameras unterschiedliche Feldbereiche abdecken:

- Liest `calibration.field_rect` pro Kamera
- Mapped Detections in den Gesamtfeld-Koordinatenraum: `global_x = field_rect.x + detection.x * field_rect.w`
- Deduplizierung in Überlappungszonen (bestehender Algorithmus, jetzt mit korrekten Koordinaten)
- Qualitätsbonus: Spieler in Überlappungszonen → höhere Konfidenz

**Dateien**: `supabase/functions/process-tracking/index.ts`

#### Teil 6: Selbsterklärendes Wizard-UX

Der gesamte Kalibrierungsprozess wird mit **visuellen Hilfen** versehen:

- **Animations-Overlay**: Pulsierender Rahmen zeigt wo die 4 Ecken hin sollen
- **Echtzeit-Vorschau**: Während der Punkt-Markierung zeigt eine kleine Feldskizze sofort den erkannten Bereich
- **Tipp-Karten**: "Tipp: Zoome rein für genauere Tracking-Daten in deiner Spielhälfte" / "Tipp: Zeige das ganze Feld für eine Gesamtübersicht"
- **Validierung**: Prüft ob die 4 Punkte plausibel sind (kein Dreieck, Mindestgröße, Seitenverhältnis)

**Dateien**: `src/pages/FieldCalibration.tsx`

---

### Technische Details

**CalibrationData-Erweiterung**:
```typescript
export interface CalibrationData {
  points: { x: number; y: number }[];
  width_m: number;
  height_m: number;
  calibrated_at: string;
  coverage?: "full" | "left_half" | "right_half" | "custom";
  field_rect?: { x: number; y: number; w: number; h: number };
  zoom_level?: number;
}
```

**Koordinaten-Transformation im Backend**:
```typescript
// Kamera sieht nur rechte Hälfte: field_rect = { x: 0.5, y: 0, w: 0.5, h: 1 }
const globalX = fieldRect.x + detection.x * fieldRect.w;  // 0.5 + 0.3*0.5 = 0.65
const globalY = fieldRect.y + detection.y * fieldRect.h;  // 0 + 0.7*1 = 0.7
```

**DB-Migration**:
```sql
ALTER TABLE tracking_uploads ADD COLUMN calibration jsonb DEFAULT NULL;
```

---

### Prioritätsreihenfolge

1. Erweitertes CalibrationData-Modell mit Coverage/Field-Rect
2. Visuelle Abdeckungsauswahl im Kalibrierungs-Wizard
3. Pro-Kamera-Kalibrierung (DB + Frontend)
4. Backend-Fusion für Teilfelder
5. Zoom-Erkennung mit Warnung
6. UX-Verfeinerung (Animationen, Tipps, Validierung)

