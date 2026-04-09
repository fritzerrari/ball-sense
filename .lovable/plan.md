

# Analyse & Gamechanger-Vorschläge für FieldIQ

## Aktuelle Datenanalyse

Das letzte Spiel (08.04.) zeigt die Probleme klar:
- **9 Events**, davon **7x `shot_on_target`**, **2x `goal`** — alle mit `team: "home"`
- Der Team-Toggle wurde zwar eingebaut, aber die `homeTeamName`/`awayTeamName`-Props werden im `CameraTrackingPage` **nicht an den QuickBar übergeben** — der Nutzer sieht nur "Heim" und "Gegner" als Standardwerte
- Kein Live-Spielstand auf dem Tracking-Screen sichtbar

## Was verbessert werden kann

### 1. Live-Spielstand auf dem Tracking-Screen (Quick Win)
Während der Aufnahme wird kein laufender Spielstand angezeigt. Der Coach sieht nicht, wie viele Tore er für welches Team geloggt hat.

**Änderung:** Kleines Score-Badge oben auf dem Kamera-Screen: `Heim 2 : 0 Gegner` — live aktualisiert bei jedem Goal-Event.

**Datei:** `src/pages/CameraTrackingPage.tsx` — Score-State tracken aus Events, im Recording-Overlay anzeigen.

### 2. Team-Namen an QuickBar durchreichen (Bug-Fix)
Aktuell bekommt `MatchEventQuickBar` keine `homeTeamName`/`awayTeamName`-Props im CameraTrackingPage. Der Coach sieht nur "Heim"/"Gegner" statt z.B. "FC Muster"/"SV Gegner".

**Änderung:** Match-Daten (`away_club_name`, Club-Name) laden und als Props übergeben.

**Datei:** `src/pages/CameraTrackingPage.tsx`

### 3. Event-Korrektur während der Aufnahme (Gamechanger)
Aktuell kann man Events nicht löschen — wenn man versehentlich "Tor" drückt, bleibt es für immer. Das verfälscht die gesamte Analyse.

**Änderung:** 
- Mini-Event-Log unterhalb der Buttons (letzte 3 Events als Chips)
- Jeder Chip hat ein X zum Löschen
- Bestätigungsdialog: "Tor (Heim, Min. 7) wirklich entfernen?"

**Dateien:** `src/components/MatchEventQuickBar.tsx` — Event-History als State + Lösch-Funktion

### 4. Post-Match Ergebnis-Korrektur (Gamechanger)
Nach dem Spiel sollte der Coach das Endergebnis manuell korrigieren können, falls Events falsch geloggt wurden. Das korrigierte Ergebnis wird dann in der Analyse verwendet.

**Änderung:**
- Im `PostMatchEventEditor` (bereits vorhanden): Editable Score-Felder hinzufügen
- Score in `matches`-Tabelle speichern (neue Spalten `home_score`, `away_score`)
- `generate-insights` nutzt diese als höchste Priorität ("Ground Truth") statt Events zu zählen

**Dateien:** 
- Migration: `home_score` und `away_score` Spalten auf `matches`
- `src/components/PostMatchEventEditor.tsx`
- `supabase/functions/generate-insights/index.ts`

### 5. Intelligente Event-Duplikat-Erkennung
7x `shot_on_target` in 8 Minuten deutet auf versehentliche Doppelklicks hin (trotz Debounce). 

**Änderung:** Nach dem Speichern eines Events kurz den Button deaktivieren (visuell mit Countdown-Ring, 3 Sekunden), damit der Coach bewusst erneut klicken muss.

**Datei:** `src/components/MatchEventQuickBar.tsx`

---

## Empfohlene Priorität

| # | Feature | Impact | Aufwand |
|---|---------|--------|---------|
| 1 | **Event-Korrektur (Undo/Delete)** | Gamechanger — verhindert falsche Analysen | Mittel |
| 2 | **Post-Match Score-Korrektur** | Gamechanger — letzte Sicherheit für korrekte Ergebnisse | Mittel |
| 3 | **Live-Spielstand im Tracking** | Hoch — Coach hat Überblick | Klein |
| 4 | **Team-Namen durchreichen** | Bug-Fix — bessere UX | Klein |
| 5 | **Cooldown nach Event-Klick** | Mittel — weniger Fehlklicks | Klein |

## Technische Umsetzung

### Neue DB-Spalten (Migration)
```sql
ALTER TABLE matches ADD COLUMN home_score integer DEFAULT NULL;
ALTER TABLE matches ADD COLUMN away_score integer DEFAULT NULL;
```

### Dateien-Übersicht
| Datei | Änderung |
|---|---|
| `src/components/MatchEventQuickBar.tsx` | Event-Log mit Undo, Cooldown-Timer, Live-Score-Callback |
| `src/pages/CameraTrackingPage.tsx` | Live-Score-Anzeige, Team-Namen laden & übergeben |
| `src/components/PostMatchEventEditor.tsx` | Score-Korrektur-Felder |
| `supabase/functions/generate-insights/index.ts` | `home_score`/`away_score` aus matches als Ground Truth nutzen |
| Migration | `home_score`, `away_score` auf `matches` |

