

# Daten-Synergie, Confidence-Transparenz & Game-Changer

## Analyse: Was wir haben vs. was wir daraus noch nicht machen

### Vorhandene Datenquellen
- Spieler-Tracking (Positionen, Speed, Distanz, Sprints)
- Manuelle Events (Tore, Karten, Fouls, Freistoesse)
- KI-Taktik-Insights (Pressing, Formationen, Momentum, Opponent DNA)
- Halbzeit-Timing (exakte Dauer pro Halbzeit)
- Gegner-Historie (akkumuliertes Scouting-Profil)
- Training Recommendations (pro Spiel)
- Spieler-Vergleich (Radar-Charts)
- Trend-Dashboard (Dominanz/Tempo ueber Saison)

### Was FEHLT an Cross-Korrelation

**1. Spielvorbereitung (PRE-Match) — DER GAME-CHANGER**
Aktuell: ALLES ist Post-Match. Kein Tool nutzt die akkumulierten Daten VOR dem naechsten Spiel.
- Gegner-DNA aus Historie + eigene Formkurve + Trend-Schwaechen = automatischer **Matchplan-Vorschlag**
- "Gegen diesen Gegner habt ihr 3x gespielt, 2x links angegriffen, 1x verloren weil Pressing-Hoehe in HZ2 abfiel"
- Formations-Empfehlung basierend auf Gegner-Stil und eigener Staerke

**2. Auswechslungs-Impact**
Daten vorhanden: `subbed_in_min`, `subbed_out_min` in `match_lineups` + Momentum-Timeline
Nicht verknuepft: Wie veraendert sich Momentum/Pressing/Tempo NACH einer Einwechslung?

**3. Spieler-Formkurve (Saison-Verlauf)**
Daten vorhanden: `player_match_stats` ueber viele Spiele
Nicht visualisiert: Individuelle Leistungskurve (Rating, Distanz, Sprints pro Spiel als Linie)

**4. Set-Piece-Conversion**
Daten vorhanden: Events `corner`, `free_kick` + `goal` mit Minuten
Nicht berechnet: Wie viele Standards fuehren zu Toren? Effizienz-Rate.

**5. Ermuedungs-Korrelation mit Gegentoren**
Daten vorhanden: Fatigue-Indicator (Sprint-Frequenz pro 15-Min-Intervall) + Gegentor-Minuten
Nicht verknuepft: Fallen Gegentore mit Ermuedungsphasen zusammen?

**6. Heim/Auswaerts-Splits**
Daten vorhanden: `matches` hat Heim-Club
Nicht analysiert: Systematische Heim-/Auswaerts-Unterschiede in Dominanz, Pressing, Ergebnis

---

## Confidence-Anzeige: Verkaufsfoerdernd oder kontraproduktiv?

**Ergebnis der Pruefung: VERKAUFSFOERDERND — wenn richtig geframt.**

- Bereits implementiert: `confidence: "high" | "medium" | "estimated"` pro Insight mit Labels "Belastbar", "Eingeschraenkt", "Geschaetzt"
- Das System zeigt bereits DataQualityBadges und AnalysisStage (Prognose/Vorlaeufig/Final)
- **Das ist ein USP, kein Problem.** Kein Konkurrent-Tool zeigt Transparenz. Trainer vertrauen dem System MEHR, wenn es ehrlich sagt "diese Zahl ist eine Schaetzung"

**Was noch fehlt:**
- Pro Metrik ein kurzer Tooltip WARUM die Confidence so ist (z.B. "Basiert auf 12 von 15 analysierten Frames" oder "Spieler war nur in 60% der Frames sichtbar")
- Ein globaler **Analyse-Guetesiegel** pro Match: "Datenqualitaet: 87% — Feldabdeckung gut, 2 Spieler zeitweise verdeckt"

---

## Der Game-Changer: KI-Matchvorbereitung

**Warum das ein Ass im Aermel ist:**
- KEIN Tool im Amateurfussball bietet automatisierte Spielvorbereitung
- GPS-Westen liefern NUR koerperliche Daten — keine taktische Vorbereitung
- Profi-Systeme (Wyscout, InStat) kosten 5-stellig und haben keine Regionalliga-Daten

**Wie es funktioniert:**
1. Trainer waehlt naechsten Gegner
2. System zieht: Alle bisherigen Spiele gegen diesen Gegner (Opponent History), eigene Formkurve (Trend Dashboard), aktuelle Schwaechen (Risk Matrix der letzten 3 Spiele), Gegner-DNA (Spider-Chart Werte)
3. KI generiert: Formations-Empfehlung, taktische Schwerpunkte, Warnung vor Gegner-Staerken, Aufstellung-Vorschlag basierend auf Spieler-Form

---

## Implementierungsplan

### 1. KI-Matchvorbereitung (Game-Changer)
- Neue Seite `src/pages/MatchPrep.tsx` — erreichbar von Dashboard + vor Spielerstellung
- Neuer Edge Function `supabase/functions/match-preparation/index.ts`
  - Laedt: Gegner-Historie, eigene letzte 5 Spiele (Tactical Grades, Risk Matrix), Spieler-Formkurven
  - KI-Prompt: "Erstelle taktische Spielvorbereitung gegen [Gegner] basierend auf bisherigen Daten"
  - Output: Formations-Empfehlung, 3 taktische Schwerpunkte, Aufstellungs-Tipps, Warnungen
- DB: Neue Tabelle `match_preparations` (match_id, club_id, opponent_name, preparation_data jsonb, created_at)

### 2. Confidence-Tooltips erweitern
- `generate-insights` Prompt ergaenzen: Pro Insight eine `confidence_reason` (1 Satz) zurueckgeben
- MatchReport UI: Tooltip bei Hover auf Confidence-Badge zeigt Reason
- Globaler "Analyse-Guetesiegel" Header im MatchReport basierend auf data_quality_score + Frame-Coverage

### 3. Spieler-Formkurve
- Neue Komponente `src/components/PlayerFormCurve.tsx`
- LineChart: Rating/Distanz/Sprints ueber letzte 10 Spiele
- Einbinden in `PlayerProfile.tsx`

### 4. Auswechslungs-Impact
- `generate-insights` Prompt erweitern: Lineup-Daten (wer wurde wann ein-/ausgewechselt) mitgeben
- Neues Feld im Cockpit: "Substitution Impact" — Momentum-Delta vor/nach Wechsel

### 5. Set-Piece-Effizienz
- Berechnung in `match-analysis.ts`: Standards zaehlen, Tore innerhalb 2 Min nach Standard = Conversion
- Anzeige als kleine Stat-Card im MatchReport

### 6. Ermuedungs-Gegentor-Korrelation
- In TrendDashboard: Overlay von Gegentor-Minuten auf Fatigue-Kurve
- Automatische Warnung wenn >50% der Gegentore in Ermuedungsphasen fallen

---

## Dateien

| Datei | Aenderung |
|---|---|
| `src/pages/MatchPrep.tsx` | **NEU** — KI-Spielvorbereitung |
| `supabase/functions/match-preparation/index.ts` | **NEU** — Aggregiert Historie + generiert Matchplan |
| DB-Migration | Neue Tabelle `match_preparations` |
| `src/components/PlayerFormCurve.tsx` | **NEU** — Individuelle Leistungskurve |
| `src/pages/PlayerProfile.tsx` | PlayerFormCurve einbinden |
| `supabase/functions/generate-insights/index.ts` | confidence_reason + Lineup-Daten fuer Sub-Impact |
| `src/pages/MatchReport.tsx` | Confidence-Tooltips, Guetesiegel-Header, Set-Piece-Stat |
| `src/lib/match-analysis.ts` | Set-Piece-Conversion Berechnung |
| `src/pages/TrendDashboard.tsx` | Ermuedungs-Gegentor-Overlay |
| `src/App.tsx` | Route `/match-prep/:opponentName?` |
| `src/pages/Dashboard.tsx` | Link zur Spielvorbereitung |

