

## Analyse: "Tracking starten — passiert nichts"

### Problem

Der Tracking-Flow hat mehrere UX-Probleme, die den Eindruck erwecken, dass nichts passiert:

1. **Kein direkter "Tracking starten"-Button** auf der Match-Seite — nur kryptische `/track?cam=0` Links zum Kopieren
2. **Kein visuelles Feedback im Match-Report**, wenn man im Status `setup` ist — kein prominenter Start-Button
3. **Die Tracking-Seite selbst** funktioniert technisch (Phasen: Loading → Kamera → Kalibrierung → Tracking), aber der Einstieg ist versteckt

### Plan

#### 1. Prominenten "Tracking starten"-Button auf Match-Report-Seite
- Bei Status `setup`: Großen, auffälligen "Tracking starten"-Button anzeigen (statt nur Monospace-Links)
- Button verlinkt direkt auf `/matches/:id/track?cam=0`
- Darunter: Optional weitere Kameras als sekundäre Links

#### 2. Multi-Kamera-Links besser darstellen
- QR-Code-Hinweis beibehalten, aber als aufklappbaren Bereich
- Kamera-1-Link als Hauptaktion, Kamera 2+3 als "Weitere Kameras hinzufügen"

#### 3. Tracking-Seite: Besseres Feedback in der Loading-Phase
- Deutlicheren Fortschrittstext zeigen ("Schritt 1 von 3: KI-Modell laden")
- Nach dem Laden automatisch zur Kamera-Phase wechseln — das passiert schon, aber der Übergang ist zu schnell/unauffällig

#### Betroffene Dateien
- `src/pages/MatchReport.tsx` — "Tracking starten"-Button prominent einbauen
- `src/pages/TrackingPage.tsx` — Phase-Übergänge klarer machen, Stepper-Anzeige hinzufügen

