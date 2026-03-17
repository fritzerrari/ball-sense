

## Hyper-professionelles Analyse-Tool: Komplettausbau

### Status Quo

**Bereits vorhanden:**
- GPS-Tracking: Distanz, Speed, Sprints, Heatmaps (DB: `player_match_stats`)
- Externe Spielstats via API-Football: Tore, Assists, Pässe, Zweikämpfe etc. (DB: `api_football_player_stats`)
- Demo-Daten haben bereits alle erweiterten Stats (Pässe, Zweikämpfe, Tore, etc.)
- ReportGenerator: Nur Vor- und Spielbericht, 3 Stile, 3 Längen
- Export: Nur Markdown-Download + Copy, Share = Link kopieren

**Fehlt:**
- DB-Spalten für Ballkontakte/Pässe/Zweikämpfe etc. in `player_match_stats` (werden aktuell nur über die externe API abgebildet)
- Halbzeitbericht als Berichtstyp
- Social-Media-Stil und weitere Berichtsformate
- KI-Trainingsplan-Generierung
- Echtes PDF-Export, Email-Share, WhatsApp/Social-Share
- Demo zeigt nicht alle Report-Typen und den Trainingsplan
- Features-Sektion erwähnt die neuen Fähigkeiten nicht

---

### Plan (7 Arbeitspakete)

#### 1. DB-Migration: Erweiterte Spielerstatistiken

Neue Spalten in `player_match_stats`:
- `ball_contacts` (int), `passes_total` (int), `passes_completed` (int), `pass_accuracy` (numeric)
- `duels_total` (int), `duels_won` (int), `tackles` (int), `interceptions` (int)
- `ball_recoveries` (int), `shots_total` (int), `shots_on_target` (int)
- `goals` (int), `assists` (int), `crosses` (int), `fouls_committed` (int), `fouls_drawn` (int)
- `yellow_cards` (int), `red_cards` (int), `dribbles_success` (int), `aerial_won` (int)
- `rating` (numeric)

Alle nullable mit Default 0 oder null — keine Breaking Changes.

#### 2. Match-Report: Erweiterte Statistik-Darstellung

**`src/pages/MatchReport.tsx`** — Spielertabelle erweitern:
- Neue Spalten: Tore, Assists, Pässe (Genauigkeit), Zweikämpfe (Quote), Ballkontakte, Schüsse
- Aufklapper pro Spieler: Erweiterte Stats-Karte (wie im Demo-PlayerDetailModal) mit allen Kategorien (Passspiel, Zweikämpfe, Offensive, Disziplin)
- KI-Analyse-Button pro Spieler direkt in der Tabelle

**`src/components/MatchCharts.tsx`** — Neue Charts:
- Top 5 nach Passgenauigkeit, Zweikampfquote, Tore+Assists
- Passquote-Vergleich Heim vs Auswärts (BarChart)

#### 3. ReportGenerator: Halbzeitbericht + Social Media + Trainingsplan

**`src/components/ReportGenerator.tsx`:**
- Neuer Typ: `halftime` — Halbzeitbericht
- Neuer Stil: `social` — Social-Media-Post (kurz, Emojis, Hashtags)
- Neuer Stil: `newspaper` — Zeitungsbericht (klassisch, neutral)
- Neuer Button: "Trainingsplan generieren" — Eigener Modus der statt Spielbericht einen individualisierten Trainingsplan pro Spieler generiert

**`supabase/functions/generate-report/index.ts`:**
- `halftime`-Prompt hinzufügen (Analyse der ersten Hälfte, taktische Anpassungen)
- `social`-Stil und `newspaper`-Stil hinzufügen
- Neuer `reportType: "training"` — Trainingsplan basierend auf Match-Daten + historischen Spieler-Trends

#### 4. Export & Share erweitern

**`src/components/ReportGenerator.tsx`:**
- **PDF-Export**: HTML-to-PDF via `window.print()` mit Print-Stylesheet oder jsPDF
- **Email-Share**: `mailto:` Link mit Subject und Body (Markdown als Plaintext)
- **WhatsApp-Share**: `https://wa.me/?text=...` 
- **Twitter/X-Share**: `https://twitter.com/intent/tweet?text=...`
- **Clipboard**: Bereits vorhanden ✓

Share-Buttons als Dropdown neben dem bestehenden Copy/Download.

#### 5. Spielerprofil: Erweiterte historische Analyse

**`src/pages/PlayerProfile.tsx`:**
- Saisonübersicht erweitern: Tore, Assists, Passquote, Zweikampfquote (aus neuen DB-Spalten)
- Neue Trend-Charts in `PlayerCharts.tsx`: Passgenauigkeit, Zweikampfquote, Rating über die Saison
- "Trainingsplan generieren"-Button: Ruft die analyze-performance Edge Function mit `type: "training"` auf

**`supabase/functions/analyze-performance/index.ts`:**
- Neuer Typ `training`: Generiert Wochentrainingsplan basierend auf Schwächen/Stärken aus den letzten 10 Spielen

#### 6. Demo-Sektion anpassen

**`src/components/landing/DemoSection.tsx`:**
- KI-Bericht Tab: Report-Typ-Umschalter simulieren (Vorbericht / Halbzeit / Spielbericht)
- Stil-Umschalter simulieren (Analytisch / Journalistisch / Social Media / Zeitung)
- Share-Buttons in der Demo anzeigen (PDF, WhatsApp, Email, Twitter)
- Neuer Tab oder Bereich: "KI-Trainingsplan" — simulierter Trainingsplan für einen Spieler
- Spielertabelle im Players-Tab: Alle erweiterten Stats anzeigen (bereits in demo-data vorhanden)

**`src/components/landing/FeatureCards.tsx`:**
- Neue Feature-Karte: "KI-Trainingsplan" — Personalisierte Trainingsempfehlungen
- Feature-Text für "KI-Berichte" erweitern: Vorbericht, Halbzeit, Spielbericht, Social Media, Trainingsplan

#### 7. `types.ts` und Hooks aktualisieren

- `PlayerMatchStats` Interface erweitern um alle neuen Felder
- `usePlayerMatchStats` und `usePlayerAllStats`: Neue Felder in Select einbeziehen
- `useSeasonStats`: Erweiterte Aggregationen (Tore, Assists Saison-Total)

---

### Betroffene Dateien

| Datei | Änderung |
|---|---|
| DB Migration | Neue Spalten in player_match_stats |
| `src/lib/types.ts` | PlayerMatchStats Interface erweitern |
| `src/hooks/use-match-stats.ts` | Selects erweitern |
| `src/pages/MatchReport.tsx` | Erweiterte Spielertabelle + Charts |
| `src/components/MatchCharts.tsx` | Neue Vergleichs-Charts |
| `src/components/ReportGenerator.tsx` | Halbzeit, Social, Zeitung, Trainingsplan, Share-Buttons |
| `supabase/functions/generate-report/index.ts` | Neue Prompts + Typen |
| `supabase/functions/analyze-performance/index.ts` | Trainingsplan-Modus |
| `src/pages/PlayerProfile.tsx` | Erweiterte Stats + Trainingsplan-Button |
| `src/components/PlayerCharts.tsx` | Neue Trend-Charts |
| `src/components/landing/DemoSection.tsx` | Erweiterte Demo |
| `src/components/landing/FeatureCards.tsx` | Neue Feature-Beschreibungen |

