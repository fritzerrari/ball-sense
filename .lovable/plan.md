

## Tiefenanalyse: Warum das System nicht funktioniert

### Kernproblem identifiziert

**Die gesamte Tracking-Engine ist eine Simulation.** Die Datei `src/lib/football-tracker.ts` enthaelt diese Kommentare:

```
FootballTracker - Abstraction layer for on-device YOLO tracking.
Currently runs as a scaffold/stub. Real ONNX inference will be plugged in later.
```

Die Methode `initStablePlayers()` erzeugt zufaellige Spielerpositionen, `updateStablePlayers()` bewegt sie zufaellig. Kein einziger Frame des Kamerabilds wird tatsaechlich analysiert. Deshalb:

- **Heatmap stimmt nicht**: Sie zeigt zufaellige Simulationsdaten, nicht die echte Spielerverteilung
- **Schwachstellen-Heatmap falsch**: Basiert auf den gleichen simulierten Daten
- **15 Spieler erkannt**: Es werden immer genau `homeSquadSize + awaySquadSize` simulierte Spieler erzeugt
- **Analyse-Status immer gleich**: "Vorlaeufig 70%" ist ein fester Wert aus `getAnalysisStatusInfo()`, nicht match-spezifisch
- **Plus-Markierungen stimmen nicht**: Overlay zeichnet simulierte Positionen, nicht echte

### Loesung: 3-Phasen-Umbau

---

#### Phase 1 — Echte Frame-Analyse via Gemini Vision (Sofort)

Statt der Simulation wird jeder N-te Kameraframe an Gemini Vision gesendet, um echte Spielerpositionen zu erkennen.

**Neue Edge Function `analyze-frame`**:
- Empfaengt ein Base64-Bild vom Kamerastream
- Sendet es an `google/gemini-2.5-flash` mit einem Prompt der Spielerpositionen als JSON zurueckgibt
- Gibt `{detections: [{x, y, team, label}...]}` zurueck
- Wird alle 2-3 Sekunden aufgerufen (nicht jeden Frame — Rate-Limits beachten)

**FootballTracker Umbau**:
- `startTracking()` startet einen Intervall der alle 2-3s ein Standbild vom Video extrahiert
- Dieses Bild wird an `analyze-frame` gesendet statt `updateStablePlayers()` aufzurufen
- Zwischen den KI-Frames wird linear interpoliert (Positionen glaetten)
- Fallback: wenn KI nicht antwortet (Timeout, Rate-Limit), letzten bekannten Frame wiederverwenden
- Die Simulation (`initStablePlayers`, `updateStablePlayers`, `stablePlayers`) wird komplett entfernt

**Prompt-Design fuer Gemini Vision**:
```
Analyze this football match frame. Return JSON with detected players:
- x, y: normalized 0-1 position in image
- team: "home" (darker/colored jersey) or "away" (lighter jersey) or "referee"
- label: "person" or "ball"
Only return players actually visible. Do NOT fabricate positions.
```

#### Phase 2 — Match-spezifischer Analyse-Status (Sofort)

**`AnalysisStatusBanner` korrigieren**:
- Statt fester "70%" den echten `processing_progress.progress` Wert aus der DB nutzen
- Zeige tatsaechliche Datenquellen: "X Frames analysiert, Y Spieler erkannt, Z% Feldabdeckung"
- Wenn match.processing_progress vorhanden, zeige diese Werte statt generischer Stufen

**`getAnalysisStatusInfo` anpassen**:
- Progress-Wert nicht mehr hardcoden (35/70/100), sondern als Parameter aus dem Match uebernehmen
- Bei "vorlaeufig": tatsaechlichen coverage_ratio * 100 als Progress verwenden

#### Phase 3 — Heatmap und Schwachstellen-Analyse korrigieren (Folge)

**Heatmap**:
- Bleibt technisch gleich, zeigt aber jetzt echte Daten statt Simulation
- `computeTrackStats()` im Backend bekommt echte Positionsdaten
- Grid-Normalisierung bleibt, Darstellung passt sich automatisch an

**Schwachstellen-Heatmap**:
- `deriveWeaknessHeatmap()` arbeitet mit echten team_match_stats.formation_heatmap Werten
- Keine Aenderung in der Logik noetig — das Problem war nur die Eingangsdaten-Qualitaet

---

### Technische Details

**Neue Datei: `supabase/functions/analyze-frame/index.ts`**
```typescript
// Empfaengt Base64-Bild, sendet an Gemini Vision
// Gibt Spielerpositionen zurueck
// Rate-Limiting: max 30 Aufrufe/Minute pro Match
```

**Geaenderte Datei: `src/lib/football-tracker.ts`**
- Entferne: `stablePlayers`, `initStablePlayers`, `updateStablePlayers`, `ballX/Y/Vx/Vy`
- Neu: `analyzeFrame()` — extrahiert Canvas-Bild, sendet an Edge Function
- Neu: `interpolatePositions()` — glaettet zwischen KI-Frames
- Intervall von 500ms (Simulation) auf 2500ms (KI-Analyse) anpassen
- Zwischen KI-Frames: letzte bekannte Positionen beibehalten

**Geaenderte Datei: `src/components/AnalysisStatusBanner.tsx`**
- Neuer Prop: `actualProgress?: number` (aus processing_progress)
- Zeige echten Progress statt hardcodiertem Stufenwert

**Geaenderte Datei: `src/pages/MatchReport.tsx`**
- Lese `match.processing_progress?.progress` und gebe es an AnalysisStatusBanner weiter
- Lese echte Felder: tracked_player_count, cameras_used, coverage_ratio aus team_match_stats.raw_metrics

**Geaenderte Datei: `src/lib/analysis-status.ts`**
- `getAnalysisStatusInfo()` akzeptiert optionalen `actualProgress` Parameter
- Nutze diesen statt fester Werte

### Dateien

| Datei | Aenderung |
|-------|-----------|
| `supabase/functions/analyze-frame/index.ts` | Neue Edge Function fuer Echtzeit-Frame-Analyse |
| `src/lib/football-tracker.ts` | Simulation entfernen, echte KI-Analyse einbauen |
| `src/components/AnalysisStatusBanner.tsx` | Echten Progress-Wert anzeigen |
| `src/pages/MatchReport.tsx` | Match-spezifische Daten an Banner weitergeben |
| `src/lib/analysis-status.ts` | Dynamischen Progress-Wert unterstuetzen |
| `src/lib/live-stats-engine.ts` | Anpassung an variable Frame-Rate (2.5s statt 0.5s) |

### Prioritaet

1. `analyze-frame` Edge Function (ohne diese laeuft nichts)
2. `FootballTracker` Umbau (Simulation raus, echte Analyse rein)
3. Analyse-Status match-spezifisch machen
4. LiveStatsEngine an neue Frame-Rate anpassen
5. Heatmap-Korrekturen (folgen automatisch aus echten Daten)

