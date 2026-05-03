# Plan: Erweiterte Spielerkennung + Season Hub Integration + Presse-Berichte

## Teil A — Bessere automatische Spielerkennung (Live & Post-Match)

### A1. Erweiterte Event-Erkennung im AI-Prompt
Die bestehende `analyze-match` Edge Function mit Gemini 2.5 Flash erkennt aktuell Spielerpositionen + grobe Szenen. Ausbau um spezifische Event-Klassen:

**Neue erkannte Events (über Gemini Vision Multi-Frame-Analyse):**
- **Tor-Erkennung** (verfeinert): Ball-im-Tor + Jubel-Cluster + Spielfluss-Stop als Trigger → Confidence-Score
- **Ecke**: Ball verlässt Grundlinie + Spieler-Cluster an Eckfahne
- **Einwurf** / **Freistoß** / **Elfmeter**: Ball ruht + Spieler-Formation
- **Kopfball-Duell**: Zwei Spieler springen gleichzeitig + Ball auf Kopfhöhe
- **Schuss aufs Tor**: Schnelle Ballbewegung Richtung Tor (>40 km/h Ballspeed)
- **Großchance**: Schuss aus Strafraum + freie Schussbahn
- **Fehlpass**: Ball wechselt Teambesitz binnen <3s ohne Defensiv-Aktion
- **Zweikampf gewonnen/verloren**: Ball-Possession-Wechsel im 1v1-Cluster
- **Pressing-Aktion**: ≥3 eigene Spieler in 15m-Radius um ballführenden Gegner

### A2. Live-Event-Stream (während des Spiels)
Neuer Mechanismus `live-event-detector` Edge Function:
- Wird alle 30s vom Tracking-Client getriggert
- Holt die letzten 4–6 Frames aus Storage
- Sendet Mini-Prompt an Gemini Flash-Lite (schnell, billig)
- Schreibt erkannte Events sofort in `match_events` mit `auto_detected: true` und `confidence`
- Frontend `LiveEventTicker` zeigt sie in Echtzeit (existiert bereits)

### A3. Spielerstärken-Profil
Neue Berechnung in `analyze-performance`:
- **Top-Speed**: Bereits vorhanden (`top_speed_kmh`)
- **Sprint-Profil**: Anzahl Sprints + Gesamtsprintdistanz pro Spieler
- **Zweikampf-Rate**: gewonnene / total (aus Event-Clustern)
- **Pass-Genauigkeit**: completed / total (aus Ballbesitz-Wechseln)
- **Schuss-Effizienz**: shots_on_target / shots_total
- **Kopfball-Stärke**: aerial_won / aerial_total
- **Defensiv-Aktionen**: tackles + interceptions + ball_recoveries
Ausgegeben als **5-Achsen-Radar** im Spielerprofil und MatchReport.

### A4. Schwächen-Heatmap
Neue Auswertung pro Spieler in PDF-Report:
- Zonen mit überdurchschnittlich vielen Fehlpässen → rot eingefärbt
- Zweikampf-Verlust-Hotspots auf der Heatmap
- "Stille Zonen" (Spieler nie dort gewesen, obwohl Position es erwartet)

### A5. Tabelle für ungeprüfte Auto-Events
Migration: `match_events` bekommt zwei neue Felder:
- `auto_detected boolean DEFAULT false`
- `confidence numeric` (0–1)
- `verified boolean DEFAULT false` (Ground-Truth-Flag nach manuellem Review)

Bei `confidence < 0.7` zeigt der Live-Ticker einen "Bitte prüfen"-Badge. Im `PostMatchEventEditor` werden diese Events priorisiert angezeigt.

## Teil B — Season Hub im Trainer-Menü & PDF-Report

### B1. Bereits in Sidebar — jetzt auch ins Mobile-Menü
- **Mobile Bottom-Nav** bekommt 5. Tab "Season" (Trophy-Icon) statt nur über "Mehr" erreichbar
- **Dashboard** bekommt Quick-Card "Season Hub öffnen" mit Live-Tabellenplatz + nächstem Gegner

### B2. Season-Daten in PDF-Report
Erweiterung von `generate-pdf-report`:
- **Neue PDF-Seite** "Saison-Kontext" zwischen Deckblatt und Match-Analyse:
  - Aktueller Tabellenplatz + Punktekonto
  - Letzte 5 Ergebnisse als Form-Strip (W/D/L Badges)
  - Restspielplan kompakt (nächste 3 Spiele)
  - Vergleich: Eigene Tore/Spiel vs. Liga-Schnitt
- Daten kommen aus `season_hub_cache` (72h TTL bereits vorhanden)
- Falls kein Cache: Fallback zur bestehenden eigenen Match-Historie

## Teil C — Presse-Berichte (Vor- & Nach-Spiel)

### C1. Datenbank
Neue Tabelle `press_releases`:
- `match_id` (FK auf matches)
- `kind` enum: `pre_match` | `post_match`
- `language` text default `'de'`
- `headline`, `lead`, `body_html`, `quotes_jsonb`
- `tone` enum: `neutral` | `enthusiastic` | `analytical`
- `length` enum: `short` (300W) | `medium` (600W) | `long` (1200W)
- `status`: `draft` | `approved` | `published`
- `generated_by_ai boolean`, `manually_edited boolean`
- RLS: nur Vereinsmitglieder

### C2. Edge Function `generate-press-release`
- Eingabe: `match_id`, `kind`, `tone`, `length`, optional `quotes` (Trainer-O-Töne)
- **Pre-Match**: Holt aus `season_hub_cache` (Tabellenplatz, Form, Gegner-Form, Bilanz), historische Begegnungen aus eigener Match-DB, Vorschau-Tonalität
- **Post-Match**: Holt finale Stats (`team_match_stats`, `match_events`, `player_match_stats`), Highlights + KI-Matchplan-Rückblick
- Gemini 2.5 Flash erstellt: Headline + Lead + Body in Pressetext-Stil (Konjunktiv für Zitate, Aktiv-Formulierung, Vereinsperspektive)
- Speichert in `press_releases`, gibt JSON zurück

### C3. UI `PressReleaseGenerator` Komponente
Eingebettet in `MatchReport` Seite (neuer Tab "Presse"):
- Zwei Buttons: **Vorbericht erstellen** / **Spielbericht erstellen** (letzterer aktiv erst wenn Match-Status = `final`)
- Form: Tonalität (Dropdown), Länge (Dropdown), optional Trainer-Zitate (2 Textfelder)
- Generieren-Button → ruft Edge Function
- Vorschau im Rich-Text-Editor (Tiptap-light, plain HTML reicht)
- Aktionen:
  - **Bearbeiten** (markiert `manually_edited = true`)
  - **Kopieren** (Plaintext für E-Mail)
  - **Als PDF speichern** (window.print mit Press-Stylesheet)
  - **Per WhatsApp teilen** (über bestehenden `share-whatsapp.ts`)
  - **An Verteiler senden** (mailto: mit Pressetext im Body)

### C4. Pre-Match-Bericht-Quelle (Vor dem Spiel)
Bereits via `season-hub` + `match-preparation` vorhanden — wird wiederverwendet:
- Gegner-DNA aus eigener Match-Historie
- Aktuelle Form beider Mannschaften
- Letzte direkte Begegnungen
- Coach-Statement-Vorschlag (KI-generiert, austauschbar)

## Technischer Bereich

**Neue / geänderte Dateien:**
- Migration: `match_events` + `auto_detected`, `confidence`, `verified` Spalten
- Migration: `press_releases` Tabelle + RLS
- Edge Function (neu): `live-event-detector/index.ts` (30s-Trigger)
- Edge Function (neu): `generate-press-release/index.ts`
- Edge Function (geändert): `analyze-match/index.ts` — erweiterter Prompt + Event-Klassen
- Edge Function (geändert): `analyze-performance/index.ts` — Spieler-Stärken-Profil
- Edge Function (geändert): `generate-pdf-report/index.ts` — Saison-Seite
- Frontend: `src/pages/MatchReport.tsx` — neuer Tab "Presse"
- Frontend (neu): `src/components/PressReleaseGenerator.tsx`
- Frontend (neu): `src/components/PlayerStrengthRadar.tsx`
- Frontend (neu): `src/components/PlayerWeaknessHeatmap.tsx`
- Frontend (geändert): `src/components/AppLayout.tsx` — Season-Tab ins Mobile-Bottom
- Frontend (geändert): `src/pages/Dashboard.tsx` — Season-Hub Quick-Card
- Frontend (geändert): `src/components/PostMatchEventEditor.tsx` — Filter "Nur ungeprüfte (auto)"
- Frontend (geändert): `src/components/LiveEventTicker.tsx` — Confidence-Badge

**Memories anlegen:**
- `architecture/live-event-detection` — 30s-Trigger, Confidence-Schema, Auto vs Verified
- `features/press-release-system` — Tonalitäten, Längen, Datenquellen
- `features/player-strength-profile` — 5-Achsen-Radar Berechnung

**Reihenfolge der Implementierung:**
1. Migrationen (match_events Felder + press_releases Tabelle)
2. Backend: erweiterte analyze-match + neuer live-event-detector
3. Backend: generate-press-release + PDF-Report Saison-Seite
4. Frontend: Presse-Tab + Strengths-Radar + Mobile-Nav-Update
5. Memory-Dateien + Index-Update
