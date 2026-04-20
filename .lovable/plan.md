
## Kontext-Check
Das System nimmt **keine vollständigen Match-Videos** auf:
- `video-recorder.ts` puffert nur 30s im RAM für Highlight-Clips bei Live-Events (Tor, Karte etc.)
- `auto-clip-detector` legt nur **virtuelle Marker** an (`file_path: auto://...`)
- Die eigentliche Analyse läuft über **JPEG-Frames alle 30s** (siehe `mem://architecture/match-intelligence-pipeline-v2`)

→ **„Video-Mapping" und „Click-to-jump" sind sinnlos** ohne echtes Video. Stattdessen müssen wir die **Daten-Drilldowns** (Heatmap, Events, Positionen) zum Zeitpunkt des Patterns zeigen.

## Neu priorisierte offene Punkte

### Phase 1 — Cockpit-Kern (was noch fehlt)
- **1.1 Cockpit-Fallback-Banner**: Wenn AI-Gateway 500 zurückgibt, klares UI-Banner statt Toast-Spam.
- **1.2 Mobile-Layout** für `WhatIfBoard` und `AutoPatternClips` (aktuell desktop-fokussiert, Buttons brechen <380px).

### Phase 2 — Verknüpfung & Drilldowns (statt Video-Mapping)
- **2.1 AutoPatternClips → Daten-Drilldown**: Klick auf ein Pattern öffnet `MetricDetailDialog` mit:
  - Heatmap-Ausschnitt zur Pattern-Minute
  - Beteiligte Events aus `match_events` im Zeitfenster ±2 min
  - Optional: Positions-Snapshot (statisches Mini-Replay 30s aus `positions_raw`)
- **2.2 MatchContextBanner Drilldown**: Klick auf KPI-Pill (z.B. „Pässe +12% vs Liga") öffnet Dialog mit Verlaufsdiagramm der letzten 10 Spiele.
- **2.3 WhatIfBoard ↔ Training**: Aus einem Szenario-Ergebnis direkt einen Trainings-Fokus an `TrainingMicroCycle` übernehmen (Button „In Training übernehmen").
- **2.4 Liga-Benchmark Opt-in UI**: Toggle in `Settings.tsx` für `benchmark_opt_ins` (Backend existiert, UI fehlt).

### Phase 3 — Report & Distribution
- **3.1 PDF-Report erweitern**: `generate-pdf-report` rendert noch nicht:
  - Cockpit-Prioritäten (`DecisionCockpit`-Daten)
  - Liga-Kontext-Pills
  - What-if-Top-Szenario
  - Auto-Pattern-Liste (als statische Bullet-Points mit Minute + Beschreibung)
- **3.2 Push-Notifications**: Service Worker mit Web Push API, aktuell nur In-App Bell.
- **3.3 Gegner-Scouting Auto-Trigger**: Nach jedem Final-Job automatisch Scouting-Profil für den gespielten Gegner aktualisieren.

## Was wir streichen / anpassen
- ❌ ~~Video-Mapping für Auto-Clips~~ → ersetzt durch **2.1 Daten-Drilldown**
- ❌ ~~Click-to-jump in Video-Player~~ → kein echtes Video vorhanden
- ⚠️ `AutoPatternClips` umbenennen in **„Auto-Pattern Insights"** (kein Clip-Bezug mehr)

## Empfohlene Reihenfolge
| Block | Aufwand | Wert |
|---|---|---|
| **Phase 1** (1.1 + 1.2) | klein | hoch (Stabilität) |
| **Phase 2.1 + 2.2** | mittel | sehr hoch (echter Drilldown statt toter Klicks) |
| **Phase 2.4** | klein | mittel (PRO-Feature freischalten) |
| **Phase 3.1** | mittel | hoch (Report ist Trainer-Endprodukt) |
| **Phase 2.3** | klein | mittel |
| **Phase 3.2 + 3.3** | groß | mittel (nice-to-have) |

## Nächster konkreter Schritt
Ich schlage vor: **Phase 1 + 2.1 + 2.2 in einem Loop** (Cockpit-Stabilisierung + echte Drilldowns für Patterns/Context). Das macht das Cockpit produktiv nutzbar.

Sag „**los: Phase 1 + 2.1 + 2.2**" oder wähle eine andere Kombination.
