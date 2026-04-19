

## Frage

Darf nur **eine** Person Events (Tor, Ecke, Chance, Karte etc.) protokollieren — und was passiert, wenn **zwei** Personen (z. B. Trainer + Helfer) das fast gleichzeitig tun?

## Aktueller Stand (recherchiert)

Aus `src/components/MatchEventQuickBar.tsx` und `supabase/functions/camera-ops/index.ts`:

### Wer kann heute Events anlegen?

| Rolle | Event-Quick-Bar sichtbar? | Schreibweg |
|---|---|---|
| **Trainer** (eingeloggt, Self-Mode) | Ja | Direkt in `match_events` via Supabase-Client (RLS auf eigenen Club) |
| **Helfer** (nur Code, kein Login) | Ja, wenn `MatchEventQuickBar` mit `sessionToken` gerendert wird | Über `camera-ops`-Edge-Function (`action: "log-event"`) |
| **Andere Vereinsmitglieder** | Nein, RLS verbietet Insert auf fremde `home_club_id` | — |

→ Es können also **mehrere Personen gleichzeitig** Events anlegen: ein Trainer und 1–3 Helfer pro Spiel.

### Was passiert technisch bei (fast) gleichzeitigem Klick?

1. **Beide Events werden gespeichert.** Jeder Insert erzeugt eine eigene UUID, es gibt keinen Unique-Constraint auf `(match_id, event_type, minute, team)`. Ergebnis: **doppelte Tore in der Liste**, doppelter Score-Hochzähler in `MatchScorecard`.
2. **Lokaler Debounce hilft nur pro Gerät** — 500 ms in `debounceRef`, 3 s `cooldownSet`. Beides ist clientseitig und greift **nicht** zwischen verschiedenen Geräten.
3. **Realtime-Sync zwischen den Geräten gibt es nicht** für `match_events` — der zweite Tipper sieht den Klick des ersten nicht und drückt nochmal.
4. **Auswirkung im Bericht:** doppelte Goals erhöhen `home_score`/`away_score` falsch, verfälschen den Match-Verlauf und die Highlight-Clips (zwei 20s-Clips für dasselbe Tor).

### Was schützt heute schon?

- **`PostMatchEventEditor`** erlaubt nach dem Spiel manuelles Löschen/Korrigieren — Ground Truth wird so gesetzt.
- **Undo-Chips** in der QuickBar (3 letzte Events pro Gerät) können sofort entfernt werden — aber nur die eigenen, nicht die vom anderen Gerät.

## Lösungsvorschlag — drei Stufen

### Stufe 1: Server-Deduplizierung (Pflicht, klein, hoher Nutzen)

In `camera-ops` (`log-event`) und in einem neuen DB-Helper für den Trainer-Pfad: Vor jedem Insert prüfen, ob in den letzten **8 Sekunden** für dasselbe `match_id` + `event_type` + `team` schon ein Event existiert. Wenn ja → kein neuer Insert, stattdessen die existierende ID zurückgeben (idempotent).

→ Doppel-Klick zwischen zwei Geräten produziert nur **ein** Event. Beide UIs zeigen denselben Eintrag in der Undo-Liste.

```text
Trainer drückt "Tor Heim" um 14:23:05
Helfer drückt "Tor Heim" um 14:23:09
   → Server findet existierendes Event (4s zurück, gleicher Typ, gleiches Team)
   → gibt bestehende ID zurück, kein Insert
   → home_score bleibt korrekt bei +1
```

### Stufe 2: Live-Anzeige fremder Events (UI-Transparenz)

Realtime-Subscription auf `match_events` in `MatchEventQuickBar` und Trainer-Dashboard. Wenn ein anderes Gerät ein Event setzt:
- Toast: *„Helfer hat ‚Ecke Heim, Min. 23' protokolliert"*
- Event erscheint in der Undo-Chip-Leiste **aller** verbundenen Geräte

→ Trainer sieht sofort, dass Helfer schon getippt hat, und drückt nicht doppelt.

### Stufe 3: Optionaler „Event-Lead"-Modus (für Profis)

Im `CameraSetupOverlay` Schalter „Nur ich protokolliere Events". Wenn aktiv, blendet die QuickBar bei allen Helfer-Sessions des Matches aus. Der Trainer behält die volle Kontrolle, Helfer liefern nur Frames.

→ Für Vereine, die klare Rollen wollen.

## Betroffene Dateien

**Ändern:**
- `supabase/functions/camera-ops/index.ts` — `log-event` mit 8s-Dedup-Lookup
- `src/components/MatchEventQuickBar.tsx` — Trainer-Pfad nutzt neuen Dedup-Helper, Realtime-Subscription für fremde Events, Undo-Chips zeigen auch fremde
- `src/components/CameraSetupOverlay.tsx` — Optional: Schalter „Nur ich protokolliere Events"
- `src/pages/CameraTrackingPage.tsx` — Liest Lead-Flag aus Match-Setup, gibt an QuickBar weiter

**Neu:**
- `src/lib/match-events.ts` — Wiederverwendbarer `insertMatchEventDeduped(matchId, type, team, minute)`-Helper für den Trainer-Direktpfad

**Unverändert:**
- `match_events` Schema, RLS, `PostMatchEventEditor`, Highlight-Pipeline

## Antwort in einem Satz

**Heute** kann jeder (Trainer + Helfer) Events anlegen — bei gleichzeitigem Klick entstehen **doppelte Einträge** und der Score wird falsch hochgezählt. Mit der vorgeschlagenen **8-Sekunden-Server-Deduplizierung + Realtime-Anzeige fremder Events** wird das Problem sauber gelöst, ohne jemandem die QuickBar wegzunehmen.

