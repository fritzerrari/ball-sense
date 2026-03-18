
Ziel: Die Analyseflächen sollen visuell deutlich hochwertiger werden und die KI soll mehr echte Fußballkennzahlen fachlich sauber auswerten statt nur Laufdaten und einfache Peaks.

1. Was ich im aktuellen Stand gefunden habe
- Es gibt bereits viele verwertbare Leistungsdaten im Backend, deutlich mehr als aktuell im UI gezeigt wird:
  - Pässe, Passquote
  - Zweikämpfe, Tackles, Interceptions, Ballgewinne
  - Schüsse, Tore, Assists
  - Fouls, Karten
  - Dribblings, Flanken, Kopfballduelle (aktuell nur `aerial_won`)
  - Ballkontakte, Rating
- Die aktuellen Diagramme sind funktional, aber gestalterisch eher „Basis-Recharts“:
  - `DashboardCharts.tsx`
  - `PlayerCharts.tsx`
  - `MatchCharts.tsx`
- Es existiert schon ein moderner Chart-Wrapper in `src/components/ui/chart.tsx`, wird aber in den Analyse-Views noch nicht genutzt.
- Die KI-Analyse in `analyze-performance` verarbeitet bereits viele Metriken, aber:
  - die Ausgabe ist noch zu textlastig und nicht modular genug,
  - Team-Analysen verdichten die erweiterten Werte noch nicht stark genug,
  - für „Ballverluste“ gibt es aktuell keinen expliziten Datenwert in der Tabelle.
- Nebenbei wichtig: `PerformanceAnalysis.tsx` sendet aktuell noch den statischen Publishable Key statt des echten Session-Tokens. Das sollte in derselben Umsetzung sauber korrigiert werden.

2. Umsetzungsplan
A. Analyse-Design modernisieren
- Alle Analyse-Charts auf eine einheitliche Dashboard-Sprache umstellen:
  - dunkle/glassige KPI-Karten,
  - farbcodierte Metrik-Gruppen,
  - weichere Gradients, feinere Gitter, bessere Tooltips,
  - konsistente Legenden/Labels/Einheiten.
- Dafür die bestehenden Recharts-Komponenten schrittweise auf den vorhandenen `ChartContainer`, `ChartTooltipContent`, `ChartLegendContent` Wrapper umstellen.

B. Match-Report deutlich ausbauen
- Die Match-Ansicht nicht nur mit „Top Laufdistanz / Top Speed / Top Sprints“ zeigen, sondern in mehrere moderne Analyseblöcke gliedern:
  - Physis: Distanz, Top Speed, Sprints, Sprintdistanz
  - Ballbesitz & Aufbau: Pässe, Passquote, Ballkontakte
  - Duellverhalten: Zweikampfquote, Tackles, Interceptions, Ballgewinne
  - Offensivwirkung: Schüsse, Schüsse aufs Tor, Tore, Assists, Flanken
  - Disziplin: Fouls, Gelb, Rot
- Zusätzlich moderne Vergleichsvisualisierungen ergänzen:
  - Home vs Away Metric Comparison
  - Top-Performer je Kategorie
  - kompakte KPI-Stripcards über den Charts
  - optional Radar nur als Zusatz, nicht mehr als Hauptgrafik

C. Spielerprofil massiv verbessern
- `PlayerCharts.tsx` von 5–6 Einzelcharts zu einer strukturierteren Analysefläche umbauen:
  - Trend-Tab oder Sektionen für Physisch / Ball / Defensiv / Offensiv
  - Formkurve über letzte Spiele
  - Wirkungsprofil je Spieler
- Neue Charts für vorhandene Daten:
  - Pässe gesamt + Passquote
  - Zweikampfquote
  - Tackles + Interceptions + Ballgewinne
  - Tore + Assists + Schüsse
  - Fouls + Karten
  - Kopfballduelle (soweit aktuell möglich über `aerial_won`)
- Die bestehende Heatmap bleibt, wird aber optisch stärker als Teil des Analyse-Dashboards eingebunden.

D. Dashboard-Charts moderner machen
- `DashboardCharts.tsx` von einfachen Saisonkurven zu einem echten Überblick umbauen:
  - Formtrend der letzten Spiele
  - Teamintensität
  - Ballkontroll-Trend
  - Leaderboards nach Metrik statt nur Gesamt-km
- Ziel: Schon auf dem Dashboard sichtbar machen, ob Team eher über Kontrolle, Intensität oder Duellstärke kommt.

E. KI-Analyse inhaltlich ausbauen
- `analyze-performance` fachlich stärker strukturieren:
  - feste Abschnitte pro Analysemodul
  - klare Trennung zwischen Physis, Ballarbeit, Defensivverhalten, Offensivbeitrag, Disziplin, Datenqualität
- Teamanalyse soll nicht nur Fließtext erzeugen, sondern explizit aus allen verfügbaren Werten ableiten:
  - Passsicherheit
  - Zweikampfverhalten
  - Restverteidigungs- und Gegenpressing-Indizien
  - Offensivproduktion
  - individuelle Wirkungsträger
- Spieleranalyse positionsbezogener machen:
  - z. B. Innenverteidiger anders bewerten als Flügelspieler oder 6er
  - stärker auf Profil, Rolle und Wiederholbarkeit eingehen
- Daten-Ausreißer weiter sauber markieren, damit keine unrealistischen Topspeeds oder Mini-Stichproben falsch interpretiert werden.

F. Fehlende Kennzahlen sauber behandeln
- Für „Ballverluste“ gilt aktuell:
  - dafür existiert in den vorhandenen Tabellen kein eigenes Feld.
- Deshalb zwei Stufen:
  1. Sofort: KI benennt Ballverluste nur dort, wo sie sich belastbar indirekt aus vorhandenen Werten ableiten lassen, und markiert sonst die Datenlücke.
  2. Optionaler Ausbau danach: neue Tracking-/Event-Metrik für Ballverluste im Backend ergänzen, damit echte Visualisierung und präzise KI-Bewertung möglich werden.
- Gleiches gilt für detailliertere Kopfballquote: aktuell ist nur `aerial_won` sichtbar, nicht komplette Kopfballduelle.

3. Technische Umsetzung
- Betroffene Frontend-Dateien:
  - `src/components/DashboardCharts.tsx`
  - `src/components/PlayerCharts.tsx`
  - `src/components/MatchCharts.tsx`
  - `src/pages/MatchReport.tsx`
  - `src/pages/PlayerProfile.tsx`
  - `src/components/PerformanceAnalysis.tsx`
- Betroffene Backend-Datei:
  - `supabase/functions/analyze-performance/index.ts`
- Wahrscheinlich zusätzliche kleine Hilfsbausteine:
  - gemeinsame Metric-Definitionen / Labels / Formatter
  - wiederverwendbare KPI-Card-Komponente für Analyseblöcke
- Sicherheits-/Stabilitätspunkt:
  - `PerformanceAnalysis.tsx` auf echte Auth-Session umstellen, analog zu Report/Assistant.

4. Ergebnis nach Umsetzung
- Moderneres Analyse-Dashboard statt einfacher Standarddiagramme
- Deutlich mehr Fußballlogik in der KI-Auswertung
- Sichtbare Auswertung von Zweikämpfen, Pässen, Assists, Toren, Fouls, Ballgewinnen, Interceptions, Ballkontakten usw.
- Klare Kennzeichnung von Metriken, die heute noch nicht vollständig vorhanden sind (z. B. echte Ballverluste)

5. Empfohlene Reihenfolge
1. Auth-Fix und gemeinsames Chart-Styling-Fundament
2. Match-Report modernisieren
3. Spielerprofil erweitern
4. Dashboard aufwerten
5. KI-Prompts und Analyse-Logik vertiefen
6. Danach optional fehlende Rohmetriken wie Ballverluste im Backend ergänzen

Technische Details
- Vorhandene Datenbasis reicht bereits für einen großen Qualitätssprung ohne neue Tabellen.
- Für echte „Ballverluste“-Grafiken ist sehr wahrscheinlich eine Backend-Erweiterung nötig.
- Ich würde bewusst keine komplett neue Chart-Library einführen, sondern das bestehende Recharts-Setup mit dem vorhandenen `ui/chart.tsx` modernisieren. Das ist schneller, konsistenter und risikoärmer.
