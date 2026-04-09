

# Plan: Tutorial-Seite + Umfassender PDF-Report

## Teil 1: Tutorial-Seite mit Features & Workflow

Die bestehende `/guide`-Seite (FullGuide.tsx) wird zu einer visuellen Tutorial-Seite umgebaut mit zwei Hauptbereichen:

### A. Neues Tutorial-Layout
**Datei: `src/pages/TutorialPage.tsx`** (neue Seite)

Aufbau:
1. **Hero-Bereich**: "So funktioniert FieldIQ" mit animiertem Workflow-Diagramm
2. **Vor dem Spiel** (Schritt-für-Schritt mit visuellen Karten):
   - Verein & Kader anlegen (mit illustriertem Mockup)
   - Spielfeld einrichten
   - Spiel anlegen & Aufstellung wählen
   - Kamera positionieren (Tipps mit Diagramm: Höhe, Winkel, Sonne)
3. **Während des Spiels**:
   - Events loggen (Team-Toggle erklärt, Undo erklärt)
   - Live-Score sichtbar
   - Halbzeit-Upload optional
4. **Nach dem Spiel**:
   - Analyse wird gestartet
   - Report lesen & verstehen
   - PDF exportieren
   - Ergebnis korrigieren
5. **Feature-Highlights** (visuell als Cards mit Icons):
   - KI-Coaching-Report (Match-Rating, Taktische Noten, Momentum)
   - Spielzug-Replay (animierte Taktik-Grafik)
   - Gegner-DNA & Scouting
   - Trainings-Mikrozyklus
   - PDF-Export (4 Report-Typen)
   - Multi-Kamera-Support
   - Spielvorbereitung
   - KI-Assistent

Jeder Schritt enthält ein visuelles Mockup-Element (CSS-basiert, keine externen Bilder) das den jeweiligen Screen simuliert.

### B. Navigation verlinken
- **Landing Footer**: Link "Tutorial" in der Help-Spalte
- **AppLayout**: Link "Tutorial" im Mehr-Menü
- **App.tsx**: Route `/tutorial` hinzufügen

**Dateien:**
| Datei | Änderung |
|---|---|
| `src/pages/TutorialPage.tsx` | Neue Seite |
| `src/App.tsx` | Route `/tutorial` |
| `src/components/AppLayout.tsx` | Link im Mehr-Menü |
| `src/components/landing/Footer.tsx` | Link in Help-Spalte |

---

## Teil 2: Umfassender PDF-Report

Der aktuelle `generate-pdf-report` Edge Function wird massiv erweitert:

### A. Mehr Daten laden
- **Match-Lineups** laden (Aufstellung Heim + Gegner)
- **Away-Spieler-Stats** laden (nicht nur Home)
- **Match-Score** aus `matches.home_score`/`away_score` laden (Ground Truth)
- Alle report_sections werden bereits geladen

### B. Deutlich erweiterter AI-Prompt (nur `full_report`)
Der Prompt wird auf ~25 Sektionen erweitert:

1. **Deckblatt** (Verein, Gegner, Datum, Ergebnis groß)
2. **Inhaltsverzeichnis**
3. **Management Summary** (1 Seite: Ergebnis, 3 Key-Takeaways, Gesamtnote, Empfehlung)
4. **Mannschaftsaufstellung** (Formation als CSS-Feld-Grafik mit Spielernamen/Nummern, Start-11 + Bank)
5. **Spielergebnis & Match-Rating** (Gesamtnote + Sub-Scores als horizontale Balken)
6. **Taktische Bewertung** (A-F Grades als farbige Badges, 6 Dimensionen)
7. **Momentum-Timeline** (CSS-basierter Verlauf mit Event-Markern)
8. **Event-Chronik** (Alle Events als Timeline: Tore, Karten, Chancen, Fouls mit Minute und Team-Farbe)
9. **Chancen-Analyse** (Schüsse aufs Tor pro Team als Balken-Vergleich)
10. **Stärken & Schwächen Heim** (Tabelle mit Grün/Rot-Indikatoren)
11. **Stärken & Schwächen Gegner** (Gegner-DNA als Radar-ähnliche CSS-Grafik)
12. **Coaching-Insights** (nummeriert, priorisiert, mit Impact-Score)
13. **Risiko-Matrix** (Severity + Dringlichkeit als farbcodierte Tabelle)
14. **Spieler-Spotlight** (MVP + Sorgenspieler mit Metriken-Vergleich)
15. **Spieler-Bewertungen** (Komplette Tabelle ALLER Spieler: Rating, Distanz, Tore, Assists, Pässe, Zweikämpfe, Sprints)
16. **Gegner-Analyse** (Do/Don't, Spielstil-Fingerabdruck)
17. **Trainingsempfehlungen** (priorisiert)
18. **Trainings-Mikrozyklus** (3 Sessions als Karten mit Übungen, Dauer, Intensität)
19. **Fazit & Ausblick** (Zusammenfassung + 3 Prioritäten fürs nächste Spiel)
20. **Notizseiten** (2 Seiten liniert)

### C. CSS-Charts im Prompt anfordern
Der Prompt wird explizit anweisen:
- **Formations-Grafik**: CSS-Grid mit 4 Linien (TW, Abwehr, Mittelfeld, Sturm), Spieler als farbige Kreise mit Nummer
- **Balkendiagramme**: Horizontale CSS-Balken für alle Vergleichswerte (Ballbesitz, Pässe, Zweikämpfe)
- **Event-Timeline**: Vertikale Timeline mit farbigen Dots (grün=Heim, rot=Gegner) und Minuten-Labels
- **Radar-Chart als CSS**: Pentagon/Hexagon mit Werten als gestapelte Flächen (vereinfacht als Balkengruppe)
- **Heatmap-Tabelle**: 3x3 Grid mit Farbintensität für Zonen-Aktivität

### D. Stärkeres AI-Modell
Wechsel von `gemini-3-flash-preview` auf `google/gemini-2.5-pro` für höhere Qualität bei dem komplexen HTML-Output.

**Datei:** `supabase/functions/generate-pdf-report/index.ts`

---

## Dateien-Übersicht

| Datei | Änderung |
|---|---|
| `src/pages/TutorialPage.tsx` | Neue visuell-reichhaltige Tutorial-Seite |
| `src/App.tsx` | Route `/tutorial` |
| `src/components/AppLayout.tsx` | Tutorial-Link im Menü |
| `src/components/landing/Footer.tsx` | Tutorial-Link im Footer |
| `supabase/functions/generate-pdf-report/index.ts` | Lineups laden, Away-Stats, erweiterter Prompt mit Charts, Management Summary, stärkeres Modell |

