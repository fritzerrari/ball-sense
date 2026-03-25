

# Implementierungsplan: 8 Analyse-Features + Landing/Demo Update

## Übersicht

Acht neue Analyse-Features, die auf der bestehenden `analyze-match` + `generate-insights` Pipeline aufbauen. Dazu Aktualisierung der Landing Page Features und Demo Section.

---

## Phase 1: Backend — Analyse-Prompt erweitern

### `supabase/functions/analyze-match/index.ts`

Das Tool-Schema (`submit_analysis`) wird um 4 neue Top-Level-Properties erweitert:

1. **`pressing_data`** — Array pro Frame: `pressing_line_home` (y: 0-100), `pressing_line_away`, `compactness_home` (Abstand höchste/tiefste Linie), `compactness_away`
2. **`transitions`** — Array: `{ frame_index, type: "ball_win_counter" | "ball_loss_gegenpressing", speed: "fast"|"medium"|"slow", players_in_new_phase: number, description }`
3. **`pass_directions`** — Objekt: `{ home: { long_pct, short_pct, build_up_left_pct, build_up_center_pct, build_up_right_pct }, away: { ... } }`
4. **`formation_timeline`** — Array: `{ frame_index, minute_approx, home_formation, away_formation, change_trigger? }`

Der Prompt-Text wird um Anweisungen ergänzt, diese Felder aus den Frames zu schätzen. Die neuen Felder werden als separate `analysis_results` rows gespeichert (`pressing_data`, `transitions`, `pass_directions`, `formation_timeline`).

### `supabase/functions/generate-insights/index.ts`

Der Insight-Prompt bekommt die neuen Analyse-Daten als Kontext. Zusätzlich wird ein neues Tool-Property `opponent_scouting` ergänzt:
- `preferred_attack_side`, `formation_weaknesses`, `recommended_counter_strategy`

Dieses wird als `report_sections` mit `section_type: "opponent_scouting"` gespeichert.

---

## Phase 2: Neue UI-Komponenten

### 2.1 `src/components/PressingChart.tsx` (NEU)
- Pressing-Höhe im Zeitverlauf als LineChart (Home/Away Pressing-Linie)
- Kompaktheits-Band als Area zwischen höchster und tiefster Linie
- Korrelation-Hinweis: "Pressing hoch → X Ballgewinne in dieser Phase"

### 2.2 `src/components/TransitionAnalysis.tsx` (NEU)
- Balkendiagramm: Anzahl Konter vs. Gegenpressing-Situationen
- Umschaltgeschwindigkeits-Indikator (Ampelsystem)
- Timeline der Umschaltmomente

### 2.3 `src/components/PassDirectionMap.tsx` (NEU)
- SVG-Spielfeld mit Richtungspfeilen (dicke = Häufigkeit)
- Aufbau links/zentral/rechts als Balken
- Lang vs. Kurz als Tortendiagramm

### 2.4 `src/components/PlayerComparison.tsx` (NEU)
- Zwei Spieler auswählen (Dropdown)
- Radar-Chart mit 8 Metriken (Distanz, Sprints, Passquote, Zweikampfquote, Ballkontakte, Ballgewinne, Tore+Assists, Rating)
- Trend-Vergleich: Line-Chart beider Spieler über letzte Spiele
- Positionsspezifische Benchmark-Hinweise

### 2.5 `src/components/FatigueIndicator.tsx` (NEU)
- Berechnung aus `frame_positions`: Sprint-Häufigkeit pro 15-Min-Intervall
- Bar-Chart: Laufintensität 1.-6. Viertelstunde
- Positionsdrift-Indikator (durchschnittliche y-Position pro Viertel → Trend nach hinten = Ermüdung)

### 2.6 `src/components/FormationTimeline.tsx` (NEU)
- Horizontale Timeline mit Formationswechseln
- Farbcodierte Segmente pro Formation
- "Gewechselt in Min. 60: 4-4-2 → 4-3-3" Annotationen

### 2.7 `src/components/OpponentScoutReport.tsx` (NEU)
- Strukturierter Report aus `report_sections` WHERE `section_type = 'opponent_scouting'`
- Bevorzugte Angriffsseite als Feld-Overlay
- Empfehlungen als Coaching-Cards

### 2.8 Saison-Dashboard Erweiterung in `src/pages/TrendDashboard.tsx`
- Heim vs. Auswärts Split (falls `match_type` oder ähnliches vorhanden, sonst alle als "Heim")
- Formkurve letzte 5 Spiele (Ampel: Dominanz-Trend)
- Saisonziel-Tracker: Konfigurierbare Ziele via localStorage (z.B. "Gegentore < 1.5/Spiel")
- Pressing-Trend über Saison (aus neuen `pressing_data` results)

---

## Phase 3: Integration in bestehende Seiten

### `src/pages/MatchReport.tsx`
Neue Sektionen nach dem Tactical Replay einfügen (alle lazy-loaded):
1. **PressingChart** — wenn `pressing_data` vorhanden
2. **TransitionAnalysis** — wenn `transitions` vorhanden
3. **PassDirectionMap** — wenn `pass_directions` vorhanden
4. **FormationTimeline** — wenn `formation_timeline` vorhanden
5. **OpponentScoutReport** — wenn `opponent_scouting` Section vorhanden
6. **FatigueIndicator** — berechnet aus `frame_positions`

### `src/pages/PlayerProfile.tsx`
- Neuer Button "Spieler vergleichen" → öffnet `PlayerComparison` als Dialog
- Ermüdungs-Sektion für einzelne Spiele

### Neue Route: `/players/compare`
- Standalone-Vergleichsseite mit URL-Params `?p1=id&p2=id`
- In `App.tsx` als lazy route registrieren

---

## Phase 4: Landing Page & Demo aktualisieren

### `src/components/landing/FeatureCards.tsx`
Neue Feature-Cards hinzufügen:
- **Pressing-Analyse**: "Wie hoch verteidigt dein Team? Pressing-Höhe und Kompaktheit im Zeitverlauf."
- **Gegner-Scouting**: "Automatischer Scouting-Report: Schwachstellen und empfohlene Taktik gegen jeden Gegner."
- **Spieler-Vergleich**: "Head-to-Head: Zwei Spieler im Radar-Chart und Trend-Vergleich."

### `src/components/landing/DemoSection.tsx`
Im Dashboard-State des Demos neue Tabs/Panels ergänzen:
- Pressing-Chart Mock-Daten
- Formation-Timeline Vorschau
- Gegner-Scouting Snippet

---

## Betroffene Dateien

| Datei | Aktion |
|---|---|
| `supabase/functions/analyze-match/index.ts` | Schema + Prompt erweitern |
| `supabase/functions/generate-insights/index.ts` | Opponent Scouting + neuer Kontext |
| `src/components/PressingChart.tsx` | NEU |
| `src/components/TransitionAnalysis.tsx` | NEU |
| `src/components/PassDirectionMap.tsx` | NEU |
| `src/components/PlayerComparison.tsx` | NEU |
| `src/components/FatigueIndicator.tsx` | NEU |
| `src/components/FormationTimeline.tsx` | NEU |
| `src/components/OpponentScoutReport.tsx` | NEU |
| `src/pages/MatchReport.tsx` | 6 neue Sektionen |
| `src/pages/TrendDashboard.tsx` | Saison-Erweiterungen |
| `src/pages/PlayerProfile.tsx` | Vergleichs-Button + Ermüdung |
| `src/pages/PlayerCompare.tsx` | NEU — Standalone-Vergleich |
| `src/App.tsx` | Neue Route `/players/compare` |
| `src/components/landing/FeatureCards.tsx` | 3 neue Cards |
| `src/components/landing/DemoSection.tsx` | Neue Demo-Panels |

## Keine DB-Migration nötig

Alle neuen Daten werden als `analysis_results` (JSON in `data`-Spalte) oder `report_sections` gespeichert — keine Schema-Änderungen erforderlich.

