
Ziel: Ich würde das Coaching-Cockpit strukturell neu ordnen, damit es für Trainer schneller erfassbar ist, die Charts moderner wirken und keine Texte mehr in Cards oder Grafiken kollidieren.

1. Prüfung des aktuellen Problems
- Im Match-Report ist die Übersicht aktuell zu dicht:
  - KPI-Strip, Insights, Teamkarten, Vergleichsdiagramm und 6 Top-Charts kommen sehr schnell hintereinander.
  - Die Top-Player-Karten sind visuell moderner als vorher, aber noch zu starr für kleinere Breiten und für längere Spielernamen/Werte.
- Im Screenshot erkennbar:
  - Peak-Boxen und Seitencards nehmen viel Platz weg.
  - Chart-Fläche wird zu schmal.
  - Labels, Namen und Zusatztexte konkurrieren miteinander.
  - Bei Extremwerten wie 76,3 km/h fehlt ein starker visueller Indikator direkt im Chart.
- Die aktuelle Startansicht hat noch keine echte Trainer-Summary am Anfang, sondern springt direkt in viele Module.

2. Empfohlene inhaltliche Neu-Struktur für bessere Übersicht
A. Neue Summary ganz oben
Ich würde am Anfang eine kompakte Coach Summary einbauen, weil sie für Trainer klar hilfreich ist:
- Match-Kernaussage in 3 bis 4 Punkten
- wer das Spiel kontrolliert hat
- größte Warnung oder Datenauffälligkeit
- Top-Spieler / Fokusspieler
- empfohlene nächste Aktion für den Coach

Beispielstruktur:
- Summary Header
- 3 Insight-Cards:
  - Spielkontrolle
  - Risiko / Datenqualität
  - Coaching-Empfehlung
- optional ein Mini-Scoreboard mit Ballbesitz, Passquote, Zweikampfquote

B. Übersicht in klarere Blöcke teilen
Statt viele gleich gewichtete Module direkt untereinander:
1. Coach Summary
2. Match-KPIs
3. Teamvergleich
4. Top-Spieler-Leaderboards
5. Taktische Insights / Heatmap / Gegentor-Analyse
6. Was-wäre-wenn / KI-Module

Dadurch wird der Blickfluss für Trainer logischer.

3. Chart-Überarbeitung
A. Top-Player-Charts modernisieren
Auf Basis deines Screenshots würde ich die Leaderboard-Charts noch moderner machen:
- größere, ruhigere Chartfläche
- kleinere Peak-Kachel
- weniger Text im Kopfbereich
- zusätzliche Indikator-Leiste für Einordnung:
  - normal
  - stark
  - auffällig
  - unrealistisch
- visuelle Hervorhebung des Top-Werts über Ring/Badge/Glow statt großer Textblöcke
- längere Namen nicht mehr hart in denselben Bereich pressen

B. Bessere Responsivität
- Desktop: 3 Spalten nur wenn genug Breite vorhanden
- mittelgroße Screens: 2 Spalten
- kleinere Breiten: 1 Spalte
- Peak- und Spread-Infos unter den Chart statt dauerhaft rechts daneben, wenn Platz knapp ist
- Chart-Labels kürzen, aber Tooltip vollständig lassen
- sichere Mindesthöhen und feste Textzonen, damit nichts überlappt

C. Indikator für Ausreißer direkt im Chart
Für Werte wie 76,3 km/h:
- Warnindikator direkt in der Chart-Karte
- Peak-Kachel in Warnzustand
- kleine Datenqualitätsampel
- Hinweis wie „Plausibilität prüfen: mögliche Fehlkalibrierung“
So ist das Problem nicht nur im Panel versteckt, sondern direkt sichtbar.

4. Layout-Verbesserungen im Coaching-Cockpit
- Die erste Übersicht würde ich stärker in ein echtes Cockpit umwandeln:
  - obere Summary-Zone
  - darunter nur 1 primäres Vergleichsmodul
  - Top-Charts in eigenem Abschnitt mit klarer Überschrift
- Teamkarten kompakter machen, damit sie eher scannbar sind
- Insights-Panel und Top-Charts optisch stärker voneinander trennen
- Was-wäre-wenn nicht zu früh im Flow, sondern nach Analyseblock platzieren
- mobile/tablet Breakpoints gezielt nachziehen, damit Karten nicht gequetscht werden

5. Betroffene Hauptdateien
- `src/pages/MatchReport.tsx`
  - neue Reihenfolge, neue Summary, bessere Grid-Logik
- `src/components/MatchCharts.tsx`
  - Top-Player-Charts, Peak-Indikatoren, responsive Umbau
- `src/components/MatchInsightsPanel.tsx`
  - kompaktere Darstellung, bessere Priorisierung
- `src/components/DataQualityPanel.tsx`
  - direkte Verknüpfung mit auffälligen Charts
- `src/components/WhatIfBoard.tsx`
  - später im Flow und visuell sauberer eingebunden

6. Technische Umsetzung
- Neue `CoachSummary`-Komponente für den Einstieg
- Responsive Grid-Strategie für Übersicht und Leaderboards vereinheitlichen
- Chart-Karten intern umbauen:
  - Header verschlanken
  - Chart zuerst, Metadaten danach
  - Peak/Spread adaptiv positionieren
- Datenqualitätsindikator in betroffene Leistungsdiagramme integrieren
- lange Texte/Namen mit festen Zonen, `line-clamp`, flexibler Stapelung und kleineren Sekundärinfos absichern

7. Ergebnis nach Umsetzung
- keine überlappenden Texte mehr in Cards/Charts
- deutlich modernerer Leaderboard-Look
- Trainer sehen am Anfang sofort eine nützliche Summary
- bessere Lesbarkeit auf Desktop, Tablet und kleineren Breiten
- unrealistische Werte werden direkt im Chart als auffällig markiert
- das Coaching-Cockpit wirkt mehr wie ein fokussiertes Analyse-Dashboard und weniger wie eine lose Modulsammlung

Technische Details
- Hauptursache der Überlagerungen ist weniger die einzelne Grafik als die Kombination aus starrem Card-Innenlayout, rechter Meta-Spalte und zu dichter Informationsmenge pro Karte.
- Die sinnvollste Verbesserung ist nicht nur „schönere Charts“, sondern eine neue Informationshierarchie.
- Die Summary am Anfang ist aus UX-Sicht klar sinnvoll, besonders für Trainer, die nicht jedes Modul einzeln lesen wollen.