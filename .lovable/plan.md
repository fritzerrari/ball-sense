

## Performance-Analyse und Lösungsplan

### ✅ Umgesetzt

**1. 3-Tier KI-Modell-System**:
- `instant` → `gemini-2.5-flash-lite` (schnellstes Modell, 3-5 Bullet Points, max 200 Wörter)
- `quick` → `gemini-3-flash-preview` (kompakte Analyse, max 800 Wörter)
- `deep` → `gemini-2.5-pro` (vollständige Tiefenanalyse)

**2. Parallele Verarbeitung**: MAX_PARALLEL von 3 auf 5 für instant-Reports

**3. Robustheit**:
- Timeout-Guards: 2 Min (instant), 3 Min (quick), 5 Min (deep)
- Stuck-Detection: Reports >10 Min im Status `generating` → automatisch `error`
- Rate-Limit 429: Re-Queue statt Error
- AbortController für harte Timeouts

**4. Benachrichtigungssystem**:
- Neue `notifications` Tabelle mit RLS + Realtime
- `NotificationBell` Komponente im Header
- Toast bei neuer Benachrichtigung
- Automatische Notification bei Report-Completion

**5. Halbzeit-Analyse**:
- `stream-tracking` erkennt nach 42 Min automatisch Halbzeit
- Triggert `process-tracking` mit `period: first_half`
- Neue Spalte `player_match_stats.period` (`full`, `first_half`, `second_half`)

**6. UI 3-Paket-System**:
- "Sofort-Fazit" Button (instant)
- "Schnell-Analyse" Button (quick)
- "Tiefenanalyse" Button (deep)

### Geschwindigkeitsvergleich
- Vorher: gemini-2.5-pro für alles → 60-120s pro Report, sequenziell
- Jetzt: instant (gemini-2.5-flash-lite, ~10-15s) → quick (~20-30s) → deep (optional, 2-5 Min)
- 11 Spieler instant parallel: ~15-20s statt ~25 Min
