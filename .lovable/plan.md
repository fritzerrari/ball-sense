

# Match Report Redesign: Wow-Effekt, Interaktivitaet & besseres Tactical Replay

## Probleme (Screenshot + Feedback)

1. **Tactical Replay**: Zu wenige Spieler (oft nur 5-8 statt 22), langsam, Positionen ungenau
2. **Report-Layout**: Alles auf einer langen Seite — kein klarer Einstieg, keine Hierarchie
3. **Zu komplex**: Trainer wollen schnelle Antworten, nicht 15 Karten durchscrollen
4. **Fehlende Interaktivitaet**: Kein Drill-down von Uebersicht → Detail

---

## Loesung: "Summary-First" mit Drill-Down Tabs

### Neues Layout-Konzept

```text
┌─────────────────────────────────────────┐
│  HERO SCORECARD (Rating + Ergebnis)     │
├─────────────────────────────────────────┤
│  3 QUICK-ACTION CARDS (klickbar)        │
│  ┌──────┐ ┌──────┐ ┌──────┐            │
│  │Top 3 │ │Sofort│ │Naech-│            │
│  │Stärk.│ │fixen │ │stes  │            │
│  └──────┘ └──────┘ │Spiel │            │
│                     └──────┘            │
├─────────────────────────────────────────┤
│  TAB-NAVIGATION                         │
│  [Uebersicht] [Taktik] [Spieler]        │
│  [Gegner] [Training]                    │
├─────────────────────────────────────────┤
│  TAB-INHALT (je nach Auswahl)           │
└─────────────────────────────────────────┘
```

**Tab-Inhalte:**
- **Uebersicht**: Executive Summary + Momentum + Tactical Grades + Key Insights
- **Taktik**: Pressing, Formationen, Passrichtung, Transitions, Tactical Replay, Heatmap
- **Spieler**: MVP/Sorgenspieler, Ermuedung, Spieler-Vergleich
- **Gegner**: Opponent DNA (Radar), Do/Don't, Scout-Report, Historie
- **Training**: Mikrozyklus, Trainingsempfehlungen, Risiko-Matrix

### Quick-Action Cards (NEU — der Wow-Faktor)

Drei grosse, animierte Karten direkt unter dem Scorecard:

1. **"Top 3 Staerken"** — gruene Karte, 3 Bullet-Points aus den Insights mit hoechstem Impact-Score
2. **"Sofort verbessern"** — rote Karte, 3 dringendste Risiken (urgency=immediate)
3. **"Spielplan fuers naechste Spiel"** — blaue Karte, Do-Actions kompakt

Jede Karte ist klickbar und springt zum relevanten Tab.

---

## Tactical Replay Upgrade

### Problem: Zu wenige Spieler
Die KI liefert nur die erkannten Spieler (oft 8-12 von 22). Die restlichen fehlen komplett.

### Loesung: Intelligentes Auffuellen + Jersey-Nummern
- **Mindestens 11 pro Team erzwingen**: Wenn weniger als 11 Spieler pro Team im Frame, fuelle mit "Ghost-Playern" auf Basis der erkannten Formation (z.B. wenn 4-3-3 erkannt, setze fehlende Positionen an typische Koordinaten)
- **Ghost-Spieler**: Halbdurchsichtig (opacity 0.4), gepunktet umrandet — klar als "geschaetzt" markiert
- **Jersey-Nummern**: Wenn vorhanden, als kleine Zahl im Kreis anzeigen
- **Trails**: Kurze Bewegungslinien (letzte 3 Frames) hinter jedem Spieler fuer Dynamik-Gefuehl
- **Ball-Trail**: Gestrichelte Linie fuer Ballbewegung
- **Groesserer Darstellungsbereich**: Von `aspect-[105/68]` Card zu einem prominenteren Full-Width-Element
- **Szenen-Leiste**: Klickbare Szenen-Thumbnails mit Vorschau-Text (statt nur kleine Pills)

### Aenderung im Analyse-Prompt
Im `analyze-match` Edge Function: Explizit 22 Spieler pro Frame anfordern (11 home + 11 away). Wenn nicht alle erkennbar, soll die KI Schaetzpositionen basierend auf Formation und Spielsituation liefern, mit einem `estimated: true` Flag.

---

## Dateien

| Datei | Aenderung |
|---|---|
| `src/pages/MatchReport.tsx` | Komplett umstrukturieren: Hero + Quick-Actions + Tab-Navigation statt linearer Scroll |
| `src/components/TacticalReplay.tsx` | Ghost-Spieler-Auffuellung, Trails, Jersey-Nummern, groessere Darstellung, Szenen-Leiste |
| `src/components/MatchScorecard.tsx` | Ergebnis-Anzeige (Tore) prominenter, Vereinslogos wenn vorhanden |
| `src/components/MatchInsightsPanel.tsx` | **NEU** — Quick-Action Cards (Top-Staerken, Sofort-Fixes, Spielplan) |
| `supabase/functions/analyze-match/index.ts` | Prompt anpassen: 22 Spieler pro Frame erzwingen, `estimated` Flag |

Keine DB-Migration noetig.

