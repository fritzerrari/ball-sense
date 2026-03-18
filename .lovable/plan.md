
Ziel: Die Analyse soll von einem statischen Bericht zu einem vernetzten Coaching-Cockpit werden: Schwachstellen-Heatmap, Gegentor-Analyse, klickbare Drilldowns von Team zu Spieler und eine intelligentere Nutzerführung, damit Trainer schneller zu klaren Maßnahmen kommen.

1. Was aktuell schon möglich ist
- Team- und Spielerwerte sind bereits gut vorhanden:
  - Pässe, Passquote, Zweikämpfe, Tackles, Interceptions, Ballgewinne
  - Schüsse, Tore, Assists, Fouls, Karten, Kopfballduelle
  - Heatmaps auf Team- und Spielerebene
- Es gibt schon klickbare KPI-/Chart-Dialoge über `MetricDetailDialog`.
- Es gibt bereits erste Führung im Dashboard über `MatchFlowGuide`.
- Spielerseiten und Leaderboards verlinken teilweise schon in Einzelprofile.

2. Was aktuell noch fehlt
- Gegentor-Analyse ist nur sehr begrenzt möglich:
  - `match_events` unterstützt aktuell nur wenige Event-Typen (`substitution`, `red_card`, `yellow_red_card`, `player_deactivated`).
  - Es fehlen strukturierte Tore/Gegentore mit Minute, Ursache, Zone, Sequenz, Standard/Konter/Fehler etc.
- Eine echte Schwachstellen-Heatmap existiert noch nicht:
  - Die vorhandenen Heatmaps zeigen Präsenz, aber noch keine „Risiko-/Schwachzonen“-Logik.
- Team-zu-Spieler-Drilldowns sind noch nicht durchgängig:
  - in MatchReport gibt es noch viele Kennziffern ohne direkte Navigation in passende Spieleransichten.
- Die Nutzerführung ist noch eher linear statt intelligent kontextbezogen.

3. Umsetzungsplan
A. Schwachstellen-Heatmap hinzufügen
- Neue Analysefläche im MatchReport:
  - „Schwachstellen-Heatmap“
  - „Druckzonen / Problemzonen“
  - „Defensiv anfällige Bereiche“
- Sofort umsetzbar auf Basis vorhandener Daten:
  - abgeleitete Risiko-Heatmap aus Team-Heatmaps, gegnerischem Offensivprofil, Ballgewinnen, Zweikampfquote, Fouls, Schüssen aufs Tor
  - Kennzeichnung von Zonen, in denen das Team:
    - wenig Zugriff hat
    - wenig Ballgewinne erzeugt
    - häufiger unter Druck gerät
- Interaktiv:
  - Klick auf Zone/Karte öffnet Drilldown mit Erklärung
  - direkte Links zu betroffenen Spielern und deren Profilen

B. Gegentor-Analyse ergänzen
- Neue MatchReport-Sektion:
  - „Gegentore: Wann, wie, warum“
  - Timeline + Ursachenmodule
- Stufe 1: sofort mit vorhandenen Daten
  - Nutzung von API-Matchstats + vorhandenen Match-Events + Team-/Spielerwerten
  - Analyse der Phasen:
    - frühe Gegentore
    - späte Gegentore
    - Einbruch nach Intensitätsverlust
    - Fouls/Karten/Defensivabfall als Risikosignale
- Stufe 2: strukturiert ausbauen
  - Eventmodell erweitern für:
    - `goal`, `conceded_goal`, `yellow_card`, `foul`, `assist`, `shot`, `shot_on_target`, `corner`, `penalty`, `counter_attack`, `set_piece`
  - zusätzliche Felder:
    - Zone, Ursache, Voraktion, Schwachstelle, Notiz
- Ergebnis:
  - echte Kausalanalyse statt nur Textinterpretation

C. Teamanalyse mit tiefen Drilldowns verknüpfen
- Jede Team-KPI im MatchReport klickbar machen:
  - nicht nur Dialog, sondern auch „weiter zu Spielern“
- Im Drilldown:
  - Top-Verursacher / Top-Performer
  - Links direkt zu Spielerprofilen
  - passende Matchwerte und Heatmaps
- Beispiele:
  - Klick auf „Ballgewinne“ → Spieler-Ranking + Links zu Defensivprofilen
  - Klick auf „Passquote“ → Passgeber/Unsicherheiten + Links zu Spielerprofilen
  - Klick auf „Schwachzonen“ → betroffene Defensivspieler/Seitenräume

D. Interaktivität und Verlinkung deutlich ausbauen
- Dashboard:
  - KPI-Karten und Trendcharts direkt zu Match-, Team- oder Spieleranalysen verlinken
- MatchReport:
  - Teamkarten, Vergleichswerte, Top-Player-Charts und Heatmaps miteinander vernetzen
- PlayerProfile:
  - Rücksprünge zu relevanten Matches
  - Links von Saison-KPIs in passende Matchlisten / letzte Spiele / Heatmaps
- Berichtsgenerator:
  - Berichte stärker mit Analysebereichen verbinden:
    - Vorbericht
    - Spielbericht
    - Pressebericht
    - Trainingsableitungen
  - klare Rubrik „Berichte & Presse“

E. Intelligentere Nutzerführung für Trainer
- `MatchFlowGuide` zu einem kontextsensitiven Coach Guide ausbauen:
  - „Was ist dein nächster sinnvoller Schritt?“
  - je nach Matchstatus, fehlenden Daten und offenen Analysen
- Neue kontextbasierte Guidance-Karten:
  - „Du hast Trackingdaten, aber noch keine Gegentor-Analyse“
  - „Hier sind 3 auffällige Schwachstellen“
  - „Diese Spieler solltest du als Nächstes prüfen“
  - „Aus dieser Analyse kannst du direkt einen Trainingsplan erzeugen“
- Ziel:
  - weniger Suche
  - schnellere Orientierung
  - mehr Spaß und klarere Wege im System

4. Benötigte Änderungen
Frontend
- `src/pages/MatchReport.tsx`
  - neue Sektionen für Schwachstellen-Heatmap, Gegentor-Analyse, Navigations-Links
- `src/pages/Dashboard.tsx`
  - intelligentere Einstiegspunkte und klickbare Analysepfade
- `src/pages/PlayerProfile.tsx`
  - bessere Rückverlinkung und verknüpfte Match-/Rollenanalyse
- `src/components/MatchCharts.tsx`
  - neue interaktive Risiko-/Schwachstellenmodule
- `src/components/DashboardCharts.tsx`
  - tiefere Drilldowns und schnellere Navigation
- `src/components/PlayerCharts.tsx`
  - stärkere Verbindung von Match- und Saisonanalyse
- `src/components/MetricDetailDialog.tsx`
  - Aktionsbereich ergänzen: Links zu Spielern, Matchdetails, Folgeanalysen
- `src/components/MatchFlowGuide.tsx`
  - intelligenter Guidance-Ausbau
- `src/components/ReportGenerator.tsx`
  - klarere Rubrik „Berichte & Presse“

Backend / Datenmodell
- `match_events` erweitern:
  - zusätzliche Event-Typen für Tore, Karten, Fouls, Abschlüsse, Standards, Konter
- optional neue Felder oder neue Tabelle für Gegentor-/Schwachstellenanalyse:
  - Minute
  - Zone
  - Ursache
  - Voraktion
  - betroffene Linie
  - Severity / Pattern

KI-/Analyse-Logik
- `analyze-performance`
  - Teamanalyse um Module erweitern:
    - Gegentor-Muster
    - Schwachstellen
    - auffällige Linien/Spieler
    - Handlungsempfehlungen
  - klare Trennung zwischen:
    - belastbar vorhanden
    - indirekt abgeleitet
    - noch fehlend

5. Technische Einschätzung
- Schwachstellen-Heatmap kann in einer ersten Version ohne neue Datenbankstruktur gebaut werden.
- Eine wirklich starke Gegentor-Analyse braucht aber strukturiertere Match-Events.
- Die vorhandene Heatmap- und Dialog-Architektur ist gut genug, um schnell eine hochwertige vernetzte UX aufzubauen.
- RLS wirkt passend, weil Match-, Lineup-, Event- und Statistikdaten bereits auf den eigenen Verein begrenzt sind; neue Event-/Analysefelder sollten denselben Match-bezogenen Zugriff nutzen.

6. Empfohlene Reihenfolge
1. MatchReport interaktiver machen: Team-KPIs → Spieler-Drilldowns
2. Schwachstellen-Heatmap als erste intelligente Risikoansicht ergänzen
3. Coach Guide / Nutzerführung ausbauen
4. Berichtsbereich stärker vernetzen
5. Danach Datenmodell für echte Gegentor-Ursachenanalyse erweitern
6. KI-Auswertung auf die neuen Event-Daten anheben

7. Ergebnis nach Umsetzung
- Trainer sehen nicht nur Zahlen, sondern konkrete Schwachstellen und Wege zur nächsten Aktion
- Teamanalyse führt direkt in betroffene Spieleranalysen
- MatchReport wird zum interaktiven Coaching-Cockpit
- Die Nutzerführung wird deutlich klarer, intelligenter und motivierender
- Gegentore können erst grob, danach mit Datenmodell-Erweiterung wirklich professionell analysiert werden

Technische Details
- Sofort machbar:
  - Schwachstellen-Heatmap
  - Team→Spieler Drilldowns
  - mehr Verlinkungen
  - intelligenter Guide
- Zusätzliche Daten nötig für volle Gegentor-Analyse:
  - neue `match_event_type`-Werte
  - strukturierte Ursache-/Zonenfelder
- Bestehende Dateien folgen bereits demselben Visual- und Dialogmuster; darauf würde ich aufbauen statt neu anzusetzen.
