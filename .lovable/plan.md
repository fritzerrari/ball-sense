

## Mein Take auf die Kritik

Der Reviewer hat **recht**. Wir haben das Tool zu sehr in Richtung "schöner Bericht" entwickelt. Was fehlt, ist der **Sprung vom Analyse-Assistent zum Entscheidungs-Coach**.

Die gute Nachricht: **Wir haben fast alle Bausteine schon** (Highlight-Clips, AI-Chat, Coaching-Cockpit, Training-Microcycle, Player-Stats). Sie sind nur nicht **verzahnt** und nicht **priorisiert**. Statt "alles ist wichtig" brauchen wir "**hier sind die Top 3, alles andere ist Detail**".

Ich schlage einen **3-Phasen-Umbau** vor — gestaffelt nach Impact, nicht nach Aufwand. Wir machen **nicht alles auf einmal**, sondern Phase 1 jetzt (größter Hebel), dann iterieren.

---

## Phase 1: Trainer-Cockpit (jetzt) — die 4 wichtigsten Upgrades

### 1.1 "Decision Cockpit" als neuer **Top-Reiter** (ersetzt nicht, ergänzt)

Eine einzige Seite, die der Trainer **vor** dem Bericht sieht:

```text
┌─────────────────────────────────────────────────────┐
│  ENTSCHEIDUNGS-COCKPIT                              │
├─────────────────────────────────────────────────────┤
│  🔴 #1 KRITISCH (kostet Tore)                       │
│     "Zentrum offen bei Ballverlust → 2 Gegentore"   │
│     [▶ Szene ansehen]  [📋 Training öffnen]         │
│                                                     │
│  🟠 #2 RISIKO (gegen stärkere Teams)                │
│     "5 frühe Fouls — taktisch ok hier, riskant      │
│      gegen Ligaspitze"                              │
│     [▶ Foul-Clips]                                  │
│                                                     │
│  🟢 #3 STÄRKE (ausbauen)                            │
│     "30% Aufbau über rechts erfolgreich"            │
│     [▶ Beste Szene]                                 │
└─────────────────────────────────────────────────────┘
```

**Was neu ist:**
- **Harte Top-3-Priorisierung** mit Impact-Bewertung (kostet Tore / bringt Tore / Risiko)
- Jede Aussage hat **direkt einen Clip-Button** (Video-Verknüpfung — Punkt 3 der Kritik)
- Jede Aussage hat **direkt einen Trainings-Button** → springt zur passenden Übung
- Edge Function `decision-cockpit` (neu): nutzt Spiel-Events + Stats + bestehende `report_sections`, lässt Gemini **priorisieren statt beschreiben** (Tool-Call mit `priority`, `impact_type`, `linked_event_minute`, `linked_video_id`, `linked_drill_key`)

### 1.2 Spielidentität / Team-DNA (Punkt 6)

**Neuer Setup-Step bei Match-Erstellung:**
- Trainer wählt **eine** Identität: `Pressing` / `Ballbesitz` / `Umschalt` / `Defensiv-kompakt`
- Speichern in `matches.team_identity` (neue Spalte)
- Cockpit bewertet jede Phase: **"Wie nah wart ihr an eurer DNA?"** (0-100%)
- Wenn nicht gesetzt → KI schlägt vor basierend auf gespielten Mustern

### 1.3 Spieler-individuelle Karten (Punkt 4) — überarbeitet

`PlayerSpotlight` wird zu **`PlayerDevelopmentCards`**:
- Pro Spieler (Top 5 + alle anklickbar):
  - **2 Stärken** (datenbasiert, mit Beispiel-Minute)
  - **2 Entwicklungsfelder** (mit konkreter Spielsituation)
  - **1 zugeordnete Übung** aus dem Microcycle
  - **▶-Button** → relevanter Clip (falls vorhanden)
- Edge Function `player-development` (neu) generiert das pro Spieler

### 1.4 Trainings-Ableitung "echt" (Punkt 5)

`TrainingMicroCycle` wird umgebaut:
- Jede Übung zeigt **explizit ihren Auslöser**:
  ```
  Übung: 6v6 Umschaltspiel mit Zonenbindung
  ↑ Weil: Zentrum offen bei Ballverlust (Min 23, 67)
  [▶ Auslöser-Szene]
  ```
- Statt "Standard-Bibliothek" → echte `data → situation → drill`-Kette via Tool-Call

---

## Phase 2 (später, separater Loop)

- **Was-wäre-wenn-Simulationen** (Punkt 7) — bauen wir bewusst noch nicht, weil das einen eigenen Mini-ML-Layer braucht. Heute haben wir schon den `TacticalAIChat`, der das textuell macht — das reicht erstmal.
- **Kontext-Intelligenz Liga/Gegner** (Punkt 2) — sobald wir Liga-Daten haben (api-football.com), bewertet das Cockpit relativ statt absolut.
- **Auto-Clip-Generierung aus Heatmap-Mustern** (statt nur aus Events) — größerer Eingriff in `analyze-match`.

---

## Konkrete Code-Änderungen Phase 1

| Datei | Aktion |
|---|---|
| `supabase/functions/decision-cockpit/index.ts` | **NEU** — Tool-Call mit `top_priorities[]`, jeweils `priority`, `impact`, `linked_event_minute`, `linked_drill_key`, `evidence` |
| `supabase/functions/player-development/index.ts` | **NEU** — pro Spieler 2 Stärken + 2 Felder + 1 Drill |
| `src/components/DecisionCockpit.tsx` | **NEU** — Top-3-Karten mit Clip- & Drill-Sprung |
| `src/components/PlayerDevelopmentCards.tsx` | **NEU** — ersetzt aktuellen `PlayerSpotlight` im Player-Tab |
| `src/components/TrainingMicroCycle.tsx` | **EDIT** — Auslöser-Spalte + Clip-Button |
| `src/pages/MatchReport.tsx` | **EDIT** — neuer **erster** Tab "Cockpit" (Decision-First), bestehende Tabs bleiben |
| `src/pages/NewMatch.tsx` | **EDIT** — Team-DNA-Auswahl im Wizard |
| Migration | `matches.team_identity text`, optional Spalte für Cockpit-Cache |
| Cross-Linking | Cockpit-Cards setzen URL-Param `?tab=training&drill=xyz` bzw. `?clip=video_id` — bestehende Tab-Sync-Logik nutzen |

---

## Was wir bewusst **nicht** tun

- **Kein vollständiger Neubau** — die Infrastruktur stimmt
- **Kein "noch mehr Charts"** — Kritik war: zu viel "schön", zu wenig "entscheidend"
- **Kein Was-wäre-wenn-Simulator** in Phase 1 — zu groß, lieber gut als schnell
- **PDF-Report bleibt erstmal wie er ist** — der ist gerade neu und gut, das Cockpit ist ein **separater** Layer

---

## Erwartetes Ergebnis nach Phase 1

Der Trainer öffnet den Report und sieht **zuerst**:
> "Diese 3 Dinge entscheiden dein nächstes Spiel. Klick → Szene. Klick → Training."

Statt heute:
> "Hier sind 12 wunderschön formulierte Erkenntnisse, viel Spaß beim Lesen."

**Das** ist der Sprung vom Analyse-Assistenten zum Entscheidungs-Coach.

