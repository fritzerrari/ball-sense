

## Plan: Kalibrierung optimieren und Spielerzuordnung verbessern

### Problem-Analyse

**Kalibrierung (iOS):** Das `touch-none` CSS und `e.preventDefault()` in `handleTouchStart` blockiert auf iOS Safari ab dem 2. Touch-Event die Registrierung. Zusätzlich fehlt eine automatisierte Alternative zur manuellen 4-Punkt-Eingabe.

**Spielerzuordnung:** Die aktuelle Logik in `process-tracking` (Zeile 316-336) sortiert Tracks nach Länge und ordnet sie der Reihe nach den Spielern zu -- komplett willkürlich, kein Bezug zu Position, Trikotnummer oder Spielfeldbereich.

---

### Teil 1: Kalibrierung reparieren und verbessern

**1a. iOS Touch-Fix**
- `touch-none` CSS von Container entfernen (verhindert auf iOS weitere Touch-Events)
- Touch-Handling auf `pointerdown`/`pointermove` Events umstellen (einheitlich für Mouse + Touch)
- Touch-Target der Punkte auf 44x44px vergrößern (iOS HIG Minimum)

**1b. KI-basierte automatische Eckerkennung**
- Button "Automatisch erkennen" hinzufügen
- Hochgeladenes Bild an Gemini 2.5 Flash senden (über neue Edge Function `detect-field-corners`)
- Prompt: "Erkenne die 4 Ecken des Fußballfelds in diesem Bild. Gib die Koordinaten als normalisierte Prozentwerte zurück."
- Erkannte Punkte als Vorschlag setzen, Nutzer kann per Drag feinjustieren
- Fallback: Manuelle Eingabe bleibt möglich

**1c. Standard-Spielfeldgrößen als Presets**
- Dropdown mit gängigen Größen: "Großfeld 105×68m", "Kleinfeld 68×50m", "Jugend 80×55m"
- Reduziert manuelle Eingabefehler

---

### Teil 2: Spielerzuordnung massiv verbessern

**2a. Positionsbasierte Heuristik (Backend)**
Die aktuelle willkürliche Zuordnung wird durch einen intelligenten Algorithmus ersetzt:

```text
Aktuelle Logik:        Neue Logik:
Track 1 → Spieler 1    Track → Durchschnittsposition berechnen
Track 2 → Spieler 2    Position → Spielfeldzone mappen (TW, IV, MF, ST)
Track 3 → Spieler 3    Zone → Passende Spieler-Position matchen
(willkürlich)           (Hungarian Algorithm für optimale Zuordnung)
```

- Jeder Track bekommt eine Durchschnitts-(x,y)-Position
- Diese wird mit der taktischen Position des Spielers verglichen (TW hinten, ST vorne)
- Kostenfunktion: Distanz zwischen Track-Schwerpunkt und erwarteter Positionszone
- Optimale Zuordnung über Greedy-Matching (oder Hungarian wenn nötig)

**2b. Verbesserte manuelle Zuordnungs-UI (Frontend)**
- Spielfeld-Miniatur mit Track-Positionen als farbige Punkte anzeigen
- Drag-and-Drop: Spielername auf Track-Punkt ziehen
- Vorschlag der KI-Zuordnung visuell hervorheben (grün = sicher, gelb = unsicher)
- Confidence-Score pro Zuordnung anzeigen
- "Alle bestätigen" Button für schnelle Freigabe

**2c. Zuordnung vor Upload speichern**
- Neue Datenstruktur: `trackAssignments` Map (trackId → playerId)
- Wird als Teil des Upload-Payloads mitgesendet
- Backend verwendet die explizite Zuordnung statt Heuristik wenn vorhanden

---

### Technische Umsetzung

| Komponente | Änderungen |
|---|---|
| `src/pages/FieldCalibration.tsx` | Pointer Events statt Touch, Auto-Detect Button, Presets |
| `supabase/functions/detect-field-corners/index.ts` | Neue Edge Function, Gemini Vision API |
| `supabase/functions/process-tracking/index.ts` | Positionsbasierte Zuordnungs-Heuristik |
| `src/pages/TrackingPage.tsx` | Neue Zuordnungs-UI mit Spielfeld-Miniatur |
| `src/lib/football-tracker.ts` | Track-Assignments im Upload-Payload |

### Reihenfolge
1. iOS Touch-Fix (sofortige Verbesserung)
2. Positionsbasierte Zuordnung im Backend
3. Zuordnungs-UI im Frontend
4. KI-Eckerkennung (optional, Gemini-basiert)

