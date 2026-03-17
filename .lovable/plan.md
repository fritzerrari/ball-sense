

## Umfassendes Analyse-Dashboard & KI-Verbesserungsvorschläge

### Überblick

Das Projekt hat bereits die Grundstruktur für Statistiken (player_match_stats, team_match_stats), aber die Darstellung ist minimal — einfache Tabellen und Zahlen ohne Charts. Der Plan umfasst drei große Bereiche:

1. **Match-Report aufwerten** — Grafische Dashboards mit Recharts statt reiner Zahlentabellen
2. **Spielerprofil aufwerten** — Historische Trend-Charts mit Entwicklungskurven  
3. **KI-Verbesserungsanalyse** — Neue Edge Function für personalisierte Verbesserungsvorschläge

Die Daten werden bereits historisch pro Spieler/Spiel gespeichert (player_match_stats, team_match_stats). Es sind keine DB-Änderungen nötig.

---

### 1. Match-Report Dashboard (`src/pages/MatchReport.tsx`)

**Aktuell:** Nur Zahlenkarten und eine sortierbare Tabelle mit Heatmap-Aufklapper.

**Neu — Tab "Übersicht":**
- **Radial-Vergleichs-Chart** (RadarChart): Heim vs Auswärts mit Achsen Distanz, Speed, Sprints, Ballbesitz
- **Spieler-Ranking-Bars** (BarChart): Horizontale Bars der Top-5-Spieler nach km/Top-Speed/Sprints
- **Sprint-Verteilung** (AreaChart): Sprints über die Spielzeit (wenn positions_raw vorhanden)

**Neu — Tab "Heim"/"Auswärts":**
- Pro Spieler: Mini-Dashboard statt nur Heatmap im Aufklapper
  - Stat-Ring (kreisförmige Fortschrittsbalken) für km, Speed, Sprints relativ zum Teamdurchschnitt
  - Heatmap bleibt

**Neu — Tab "Vergleich":**
- Ersetze statische Zahlenkarten durch interaktiven Radar-Chart + Bar-Vergleich

**Neue Komponente:** `src/components/MatchCharts.tsx` — Enthält alle Recharts-Visualisierungen für den Match-Report (RadarChart, BarChart, AreaChart).

### 2. Spielerprofil Dashboard (`src/pages/PlayerProfile.tsx`)

**Aktuell:** 4 Statistik-Karten + simple Tabelle der letzten Spiele + durchschnittliche Heatmap.

**Neu:**
- **Trend-Charts** (LineChart/AreaChart): Distanz, Top-Speed, Sprints über die letzten 10-20 Spiele als Verlaufskurven
- **Leistungsentwicklung** (BarChart): Spiel-für-Spiel km mit Durchschnittslinie
- **Speed-Entwicklung** (LineChart): Top-Speed pro Spiel mit Trendlinie
- **Sprint-Trend** (AreaChart): Sprints pro Spiel

**Neue Komponente:** `src/components/PlayerCharts.tsx` — Recharts-Visualisierungen für Spielerprofile.

### 3. KI-Verbesserungsanalyse

**Neuer Button** auf dem Spielerprofil und im Match-Report: "KI-Analyse & Verbesserungsvorschläge"

**Neue Edge Function:** `supabase/functions/analyze-performance/index.ts`
- Empfängt `playerId` oder `matchId` + `type` ("player" | "team")
- Lädt historische Stats (letzte 10 Spiele) aus player_match_stats/team_match_stats
- Berechnet Trends serverseitig (Veränderungen km, Speed, Sprints über die letzten Spiele)
- Sendet an Lovable AI (Gemini 3 Flash) mit strukturiertem Prompt:
  - Leistungstrends erkennen
  - Stärken/Schwächen identifizieren
  - Konkrete Trainingsempfehlungen generieren
  - Taktische Anpassungen vorschlagen
- Streaming-Response (SSE) für sofortige Anzeige

**UI-Komponente:** `src/components/PerformanceAnalysis.tsx`
- Button "KI-Analyse" auf PlayerProfile und MatchReport
- Streaming-Markdown-Anzeige wie beim ReportGenerator
- Abschnitte: Leistungstrend, Stärken, Verbesserungspotential, Trainingsempfehlungen

### 4. Team-Dashboard auf dem Dashboard (`src/components/DashboardCharts.tsx`)

**Aktuell:** 3 einfache Charts (Distanz, Speed, Ballbesitz) über die Saison.

**Ergänzen:**
- **Sprint-Trend** (BarChart): Durchschnittliche Team-Sprints pro Spiel
- **Spieler-Leaderboard**: Top 5 Spieler nach Gesamtdistanz der Saison als horizontale Bars

---

### Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/components/MatchCharts.tsx` | NEU — Radar, Bar, Area Charts für Match-Report |
| `src/components/PlayerCharts.tsx` | NEU — Trend-Charts für Spielerprofil |
| `src/components/PerformanceAnalysis.tsx` | NEU — KI-Analyse-Widget mit Streaming |
| `supabase/functions/analyze-performance/index.ts` | NEU — Edge Function für KI-Verbesserungsvorschläge |
| `src/pages/MatchReport.tsx` | Charts einbinden, Tabs aufwerten |
| `src/pages/PlayerProfile.tsx` | Trend-Charts + KI-Analyse-Button einbinden |
| `src/components/DashboardCharts.tsx` | Sprint-Trend + Leaderboard ergänzen |
| `supabase/config.toml` | analyze-performance Function registrieren |

### Keine DB-Änderungen nötig

Alle benötigten Daten sind bereits in `player_match_stats` und `team_match_stats` vorhanden — Distanz, Speed, Sprints, Heatmaps, Minuten. Die historische Speicherung pro Spieler und Spiel existiert bereits.

