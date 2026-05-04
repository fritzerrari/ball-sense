
# Plan: U19 Viktoria Live-Daten + Coach Mission Control UX

Zwei zusammenhängende Bausteine: **(A)** vollautomatisches, dauerhaft aktuelles Datenfundament für die U19 Viktoria Aschaffenburg, und **(B)** ein radikal vereinfachtes, geführtes Trainer-Erlebnis ("Mission Control"), das jeden Klick erklärt.

---

## A) U19-Daten – automatisch & immer aktuell

### Auto-Import beim ersten Login
- Beim Login eines Viktoria-Vereins erkennt das System fehlende Team-Bibliothek und startet **automatisch** den Scrape (keine URL-Eingabe nötig).
- Default-URL für SV Viktoria Aschaffenburg ist hinterlegt; **U19 wird automatisch als `is_default` markiert**, sobald der Verein das wünscht (oder per One-Click-Button "U19 als Standard").
- Sichtbare Live-Progress-Anzeige: "Lade U19 Kader… Spielplan… Tabelle… Spielerstatistiken…" mit Fortschrittsbalken.

### Was importiert wird (U19 vollständig)
- **Kader**: Name, Rückennummer, Position, Tore, Vorlagen, Karten, Einsätze.
- **Spielplan**: Alle anstehenden Spiele (Datum, Uhrzeit, Gegner, Heim/Auswärts, Wettbewerb).
- **Ergebnisse**: Letzte Spiele inkl. Endstand & Wettbewerb.
- **Tabelle**: Aktuelle Position, Punkte, Tordifferenz, Form (letzte 5).
- **Saisonverlauf**: Punkte pro Spieltag → Trend-Chart.

### Dauerhafte Aktualisierung (3 Ebenen)
1. **pg_cron Nightly** (03:00) – ruft `scrape-club-teams` für alle Vereine mit hinterlegter URL erneut auf, mergt via `external_match_id` (kein Duplikat).
2. **Pull-to-Refresh** – Button "🔄 Jetzt aktualisieren" auf Dashboard und Mannschafts-Bibliothek (max. 1×/h Throttle).
3. **Pre-Match-Trigger** – 24h vor dem nächsten geplanten Spiel automatischer Re-Scrape, damit Aufstellung/Statistiken fresh sind.

### Neue Sichtbarkeit (wo der Trainer es findet)
- **Dashboard-Hero-Karte**: "Nächstes U19-Spiel: Sa 15.05. · 14:00 · vs. TSV X (Auswärts)" mit Countdown.
- **Tab "Mannschaft" → U19**: Tabelle, Form, Top-Scorer, Spielplan-Liste.
- **Im "Neues Spiel"-Wizard**: Gegner & Datum sind bereits **vorausgefüllt** aus dem nächsten Fixture – Trainer bestätigt nur noch.

---

## B) Mission Control – das neue Trainer-Erlebnis

Problem heute: Sidebar mit ~15 Einträgen, viele Fachbegriffe, kein klarer Einstieg. Lösung: ein **handlungsorientiertes Cockpit** statt eines Werkzeugkastens.

### B1) Neues Dashboard "Mission Control"
Drei klare Zonen, in dieser Reihenfolge:

```
┌──────────────────────────────────────────────────────┐
│  HEUTE                                                │
│  ▸ Großer Status-Held: "Was musst du jetzt tun?"     │
│    z.B. "🎬 Spiel in 2 Tagen – Aufstellung planen"   │
│  ▸ 1 primärer CTA-Button (groß, grün)                │
├──────────────────────────────────────────────────────┤
│  DEINE U19  (Live-Daten)                              │
│  ▸ Tabelle (Pos. 4 · 22 Pkt · Form WWUNW)            │
│  ▸ Nächstes Spiel · Top-Scorer · letzter Sieg        │
├──────────────────────────────────────────────────────┤
│  WERKZEUGE  (4 große Tiles, mit Erklärung)           │
│  📹 Spiel aufnehmen · 📊 Analysen · 👥 Kader · ⚙️    │
└──────────────────────────────────────────────────────┘
```

Jede Tile hat **Titel + 1 Satz Erklärung** ("Nimm ein Spiel mit dem Handy auf – wir analysieren es automatisch"), kein Fachjargon.

### B2) Geführter 3-Minuten-Onboarding-Flow
Erweiterung des bestehenden `CoachWelcomeTour` zu einem **vollwertigen Onboarding-Wizard** beim allerersten Login:

1. **"Willkommen, Trainer!"** – 1 Satz: was macht das System.
2. **"Welcher Verein?"** – Suchfeld mit fussball.de-Autocomplete → 1-Klick-Import.
3. **"Welche Mannschaft trainierst du?"** – Liste der gerade importierten Teams → Auswahl (z.B. U19) wird Standard.
4. **"So nimmst du dein erstes Spiel auf"** – 30-Sekunden-Erklärvideo / animiertes GIF.
5. **"Fertig!"** – Direkter Sprung ins Mission Control mit "Erstes Spiel anlegen" CTA.

Onboarding-Status in `profiles.onboarding_completed_at` (neue Spalte). Nicht abgeschlossene Trainer sehen oben einen sanften Hinweis-Banner mit "Tour fortsetzen".

### B3) Vereinfachte Sidebar
Reduktion von ~15 auf **5 Hauptpunkte** mit Sub-Menüs (collapsible):

- **🏠 Cockpit** (Mission Control)
- **⚽ Spiele** (Neu, Laufend, Vergangen)
- **👥 Mannschaft** (Kader, Tabelle, Spielplan, Eltern-Push)
- **📊 Analysen** (Reports, Trends, Vergleich, Scouting)
- **⚙️ Einstellungen** (Verein, Bibliothek, Helfer-Codes, Plan)

Admin-Tab nur sichtbar wenn `is_super_admin`.

### B4) "Was bedeutet das?" überall
- Kleine **(?)-Icons** neben jedem Fachbegriff (Heatmap, xG, Pressing-Index, Compactness…) → Tooltip mit 1 Satz Klartext.
- Erste Nutzung einer Funktion zeigt **Coach-Mark** (Spotlight-Overlay) – einmalig, dismissable.

### B5) Empty-States als Lehrer
Statt "Noch keine Daten" zeigen leere Bereiche **was der Trainer als Nächstes tun kann**:
- Kader leer → "Importiere deinen Kader in 30 Sek. → [Button]"
- Keine Spiele → "Lege dein erstes Spiel an, Datum & Gegner sind aus deiner U19 schon da → [Button]"

### B6) Spracheinstellung & Tonalität
- Konsequent **"Du"-Ansprache**, keine Fachwörter im Hauptflow.
- Zahlen werden immer mit Kontext angezeigt: "68 % Ballbesitz (Liga-Schnitt: 51 %)".

---

## Technische Details (für Entwickler)

| Bereich | Änderung |
|---|---|
| DB | `ALTER TABLE profiles ADD COLUMN onboarding_completed_at timestamptz`; neue View `v_next_fixture_per_team` für Dashboard. |
| pg_cron | Job `nightly-team-resync` (03:00) → `net.http_post` an `scrape-club-teams` für jeden Verein mit `external_url`. |
| Edge Function | `scrape-club-teams` erweitern: optional `auto=true` → ohne URL, nimmt gespeicherte URL aus letztem Import. Pre-Match-Trigger: neuer Job `prematch-resync` der `team_fixtures` mit kickoff < now()+24h prüft. |
| Frontend | Neue Komponenten: `MissionControl.tsx` (ersetzt aktuellen `Dashboard.tsx`-Hauptbereich), `OnboardingWizard.tsx` (5 Steps), `HelpTooltip.tsx`, `SmartEmptyState.tsx`, neue `Sidebar.tsx`-Struktur. |
| FullGuide / FeatureCards | Aktualisieren um U19-Auto-Import & neues Cockpit zu erklären. |
| i18n | Neue Keys für Onboarding, Tooltips, Empty-States (DE + EN). |

---

## Was du danach hast
- Die **U19 Viktoria** ist mit Kader, Tabelle, Spielplan & Statistiken im System – aktualisiert sich nachts und vor jedem Spiel von selbst.
- Ein Trainer, der zum ersten Mal einloggt, weiß **innerhalb von 60 Sekunden**, was er sieht und was er als Nächstes tun soll.
- Die App fühlt sich nicht mehr an wie ein Werkzeugkasten, sondern wie ein **Co-Trainer**, der durch die Saison führt.

Sag "los" und ich baue es in dieser Reihenfolge: (1) Auto-Import + Cron, (2) Mission Control Dashboard, (3) Onboarding Wizard + Sidebar-Refactor, (4) Tooltips & Empty-States, (5) Doku-Update.
