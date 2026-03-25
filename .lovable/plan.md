

# Spielzug-Animation: Was geht, was fehlt

## Aktuelle Datenlage

Die `analyze-match` Edge Function extrahiert aktuell **keine Spielerpositionen pro Frame**. Die Gemini-Vision-Analyse liefert nur:
- `match_structure` (Dominanz, Tempo, Phasen)
- `danger_zones` (Angriffs-/Schwachzonen links/mitte/rechts)
- `chances` (Anzahl Chancen)
- `ball_loss_patterns` (Zone + Beschreibung)

Das sind **aggregierte taktische Aussagen**, keine Frame-für-Frame-Positionsdaten. Für eine animierte Spielzug-Grafik fehlt die entscheidende Ebene: **x,y-Koordinaten von Spielern und Ball pro Zeitpunkt**.

## Was technisch möglich ist

### Option A: KI-geschätzte Spielzüge (realistisch, sofort umsetzbar)

Gemini Vision kann aus den Frame-Bildern **grobe Spielerpositionen schätzen** — nicht pixelgenau, aber gut genug für eine schematische Taktik-Animation. Der Prompt wird erweitert um:

```
Für jeden Frame: Schätze die ungefähren Positionen (x,y in Prozent des Spielfelds)
von erkennbaren Spielern beider Teams und dem Ball.
```

Das liefert pro Frame ~10-22 geschätzte Positionen. Daraus kann man:
- **Spielzüge als animierte Pfade** auf dem SVG-Spielfeld zeichnen (Pfeile, Punkte die sich bewegen)
- **Schlüsselszenen** (z.B. Angriffszüge, Ballverluste) als 5-10s Animationen darstellen
- **Play/Pause/Scrub** Timeline im MatchReport

Genauigkeit: ~70-80% bei guter Kameraposition. Reicht für taktische Muster, nicht für Laufwege-Statistiken.

### Option B: Computer Vision Tracking (präzise, aufwändig)

Echtes Player-Tracking mit YOLO/DeepSORT pro Frame. Braucht GPU-Backend, deutlich mehr Rechenzeit. Nicht im aktuellen Scope.

## Umsetzungsplan (Option A)

### Schritt 1: Analyse-Prompt erweitern
- `analyze-match` Tool-Schema um `player_positions` Array erweitern
- Pro Frame: Array von `{ team: "home"|"away", x: 0-100, y: 0-100, role?: string }`
- Ball-Position separat: `{ x, y }` pro Frame
- Gemini liefert das als Teil des `submit_analysis` Tool Calls

### Schritt 2: Positionen in DB speichern
- Neuer `analysis_results` Eintrag mit `result_type: "frame_positions"`
- `data`: Array mit Zeitstempel + Positionen pro Frame

### Schritt 3: Animierte Taktik-Komponente bauen
- Neue Komponente `TacticalReplay.tsx`
- SVG-basiert auf dem bestehenden `HeatmapField`-Spielfeld
- Spieler als farbige Kreise (Heim/Gast), Ball als weißer Punkt
- CSS-Animationen zwischen Frames (interpolierte Bewegung)
- Timeline-Slider: Frame-für-Frame oder Auto-Play
- Schlüsselszenen-Marker (z.B. "Angriff über links, Min 23")

### Schritt 4: In MatchReport integrieren
- Neue Sektion "Spielzug-Replay" zwischen Coaching-Insights und Trainingsempfehlungen
- Dropdown für erkannte Schlüsselszenen
- Play/Pause Button + Geschwindigkeitsregler

### Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `supabase/functions/analyze-match/index.ts` | Tool-Schema um `player_positions` erweitern |
| `src/components/TacticalReplay.tsx` | Neue animierte Spielfeld-Komponente |
| `src/pages/MatchReport.tsx` | TacticalReplay-Sektion einbauen |

### Einschränkungen (transparent kommunizieren)
- Positionen sind KI-Schätzungen, keine exakten Messwerte
- Bei schlechter Kameraqualität oder Weitwinkel sinkt die Genauigkeit
- Maximal ~20 Frames = ~20 Zeitpunkte, dazwischen wird interpoliert
- Spieler-Identifikation (wer ist wer) ist unzuverlässig — nur Team-Zuordnung

