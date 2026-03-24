

## Auto-Erkennung: Spieler ohne Aufstellung automatisch identifizieren

### Was sich ändert

Aktuell setzt `process-tracking` voraus, dass `match_lineups` existieren, um Tracks Spielern zuzuordnen. Wenn keine Aufstellung eingetragen ist, werden zwar Tracks erkannt, aber keinem Spieler zugeordnet — die Stats sind leer.

Die Lösung: Wenn keine Lineup-Einträge vorhanden sind, schaltet das Backend in einen **Auto-Discovery-Modus**:

```text
Tracking-Daten (Tracks)
        ↓
┌───────────────────────────────┐
│ Schiedsrichter-Filter         │
│ (Seitenlinien-Ratio > 45%)   │
├───────────────────────────────┤
│ Ball-Track erkennen           │
│ (kleinste Bounding-Box,       │
│  höchste Geschwindigkeit)     │
├───────────────────────────────┤
│ Team-Clustering               │
│ (Y-Achse: obere vs untere    │
│  Hälfte = 2 Gruppen)         │
├───────────────────────────────┤
│ Heim = Gruppe näher an y<0.5  │
│ Gast = Gruppe näher an y>0.5  │
├───────────────────────────────┤
│ Auto-Lineup generieren        │
│ ("Spieler 1", "Spieler 2"...)│
│ + Position per KI-Inference   │
└───────────────────────────────┘
```

### Änderungen

#### 1. Frontend: "Ohne Aufstellung starten" explizit als Option

In `NewMatch.tsx` (Aufstellungs-Schritt):
- Prominenter Button "KI erkennt Spieler automatisch" neben dem Skip-Button
- Kurze Erklärung: "Die KI erkennt beim Tracking automatisch wie viele Spieler auf dem Feld sind und ordnet sie den Teams zu"
- User muss nur angeben: Spielformat (5er, 7er, 9er, 11er) ODER "Automatisch erkennen"
- Wenn "Automatisch": `squadSize` und `awaySquadSize` werden auf 0 gesetzt, keine Lineup-Einträge erstellt

#### 2. Backend: Auto-Discovery in `process-tracking`

In `supabase/functions/process-tracking/index.ts`, nach dem Lineup-Laden:

Wenn `trackableLineups.length === 0`:
1. **Schiedsrichter filtern**: Tracks mit `sidelineRatio > 0.45` oder `edgeRatio > 0.4` ausschließen (bestehende Logik)
2. **Ball-Track identifizieren**: Track mit kleinstem durchschnittlichen Bounding-Box-Bereich UND höchster Geschwindigkeitsvarianz separieren
3. **Team-Clustering per Y-Schwerpunkt**: Verbleibende Tracks nach `cy` (Y-Schwerpunkt) sortieren, K-Means mit k=2 anwenden (einfache Implementierung: Median-Split)
4. **Heim/Gast zuordnen**: Gruppe mit niedrigerem durchschnittlichen Y = "home", höherer Y = "away"
5. **Auto-Lineup generieren**: Für jeden Track einen `match_lineups`-Eintrag erstellen mit `player_name: "Spieler {n}"`, `team: "home"/"away"`, `player_id: null`
6. **Positionen ableiten**: Bestehende KI-Positions-Inference nutzen (Schwerpunkt → nächste POSITION_ZONE)
7. Stats normal berechnen und speichern

#### 3. Frontend: Auto-erkannte Spieler im Match-Report anzeigen

In `PerformanceAnalysis.tsx` / `MatchReport.tsx`:
- Wenn `player_id` null ist → Badge "KI-erkannt" neben dem Namen
- Hinweis: "Diese Spieler wurden automatisch erkannt. Du kannst sie nachträglich deinen Spielern zuordnen."
- Optional: Zuordnungs-Dialog wo der Coach "Spieler 3 (Home)" einem echten Kaderspieler zuordnen kann

### Technische Details

**K-Means-Vereinfachung (Median-Split)**:
```text
1. Berechne cy für alle verbleibenden Tracks
2. Sortiere nach cy
3. Teile am Median → Gruppe A (home) und Gruppe B (away)
4. Spieleranzahl pro Team = Gruppengröße
```

**Keine DB-Migration nötig**: `match_lineups` unterstützt bereits `player_id: null` und `player_name: text`. Die Auto-Lineup-Einträge werden nach der Verarbeitung eingefügt.

**Dateien**:
- `src/pages/NewMatch.tsx` — "KI erkennt automatisch" Option im Aufstellungs-Schritt
- `supabase/functions/process-tracking/index.ts` — Auto-Discovery-Logik wenn keine Lineups vorhanden
- `src/components/PerformanceAnalysis.tsx` — "KI-erkannt" Badge + nachträgliche Zuordnung

### Prioritätsreihenfolge
1. Backend Auto-Discovery (Kern-Feature)
2. Frontend "Ohne Aufstellung"-Option vereinfachen
3. Nachträgliche Spieler-Zuordnung im Report

