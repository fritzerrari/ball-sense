

# Fix-Plan: Anzeige, Team-Zuordnung bei Events, Ergebnisdarstellung

## Problem 1: Seite wird nicht angezeigt

Die Console-Logs zeigen `forwardRef`-Warnungen bei `Login` und `ThemeToggle` — keine fatalen Fehler. Der Vite-Ping-Request liefert 404, was auf ein stale Service-Worker-Problem hinweist. Der Dev-Server selbst läuft fehlerfrei. Maßnahmen:
- `ThemeToggle` mit `React.forwardRef` wrappen (beseitigt die React-Warnung, die in manchen Browsern den Render blockieren kann)
- Login-Komponente ebenfalls forwardRef-kompatibel machen

## Problem 2: Heim vs. Gegner nicht unterscheidbar

Im `MatchScorecard` werden beide Teams identisch dargestellt — keine farbliche Differenzierung. Im `TacticalReplayField` fehlt ebenfalls eine Trikot-Farb-Zuordnung.

**Lösung:**
- `MatchScorecard`: Heimteam-Name in Primärfarbe (grün), Gegner-Name in einer Kontrastfarbe (z.B. Orange/Rot) darstellen
- Trikot-Farben in der `TacticalReplayField`-Legende und den Spieler-Kreisen klarer differenzieren (Heim = Primärfarbe, Gegner = Rot/Orange)
- Optional: Kleines Trikot-Icon oder farbiger Punkt neben dem Teamnamen

## Problem 3: Events haben keine Team-Zuordnung (Hauptproblem)

Der `MatchEventQuickBar` hardcodet `team: "home"` für ALLE Events. Wenn der Gegner ein Tor schießt und der Trainer auf "Tor" klickt, wird es als Heimtor gespeichert. Das verfälscht das gesamte Spielergebnis.

**Lösung: Team-Toggle im QuickBar**

1. **Neuer State `activeTeam`**: Toggle-Button oben im QuickBar mit "Heim" (Standard) und "Gegner"
   - Visuell klar: Heim-Modus = grüner Hintergrund, Gegner-Modus = roter/orangener Hintergrund
   - Der gesamte Button-Bereich ändert seine Hintergrundfarbe, damit sofort erkennbar ist, für wen man gerade Events loggt
   - Haptic Feedback beim Teamwechsel

2. **Event-Erfassung anpassen**: `team`-Wert aus `activeTeam` lesen statt hardcoded `"home"`
   - Betrifft sowohl den direkten Supabase-Insert als auch den `camera-ops` Fetch
   - Default bleibt "home" (Coach loggt primär für sein Team)

3. **Feedback optimieren**: Toast zeigt "Tor (Heim) ✓" oder "Tor (Gegner) ✓"

## Problem 4: Spielergebnis im Report (2:0 statt 1:1)

Das `match_rating`-Schema in `generate-insights` enthält KEINE Felder `home_goals`/`away_goals`. Das Ergebnis wird vom AI aus den Events interpretiert — und da alle Events `team: "home"` haben, denkt die KI, es sei 2:0.

**Lösung:**

1. **`generate-insights` Tool-Schema erweitern**: `home_goals` und `away_goals` als required-Felder in `match_rating` hinzufügen
2. **Events-Kontext verbessern**: Im Prompt explizit `team`-Zuordnung hervorheben: "Tor (Heim)" vs "Tor (Gegner)"
3. **Scorecard**: Zeigt die Ergebnis-Zahlen bereits an, wenn sie im Rating vorhanden sind — das funktioniert schon

---

## Dateien und Änderungen

| Datei | Änderung |
|---|---|
| `src/components/ThemeToggle.tsx` | `forwardRef` wrappen |
| `src/components/MatchEventQuickBar.tsx` | Team-Toggle (home/away) + farbliches Feedback hinzufügen |
| `supabase/functions/generate-insights/index.ts` | `home_goals`/`away_goals` ins match_rating-Schema + Events-Prompt optimieren |
| `src/components/MatchScorecard.tsx` | Farbliche Team-Differenzierung (Heim grün, Gegner orange) |
| `src/components/tactical-replay/TacticalReplayField.tsx` | Klarere Trikot-Farb-Legende |

