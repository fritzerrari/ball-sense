

# Zeiterfassung, API-Integration & Fehlerprüfung

## 1. Halbzeit-Zeiterfassung einbauen

**Problem**: Die Aufnahmezeit (`duration_sec`) wird zwar kalkuliert und im JSON gespeichert, aber nirgends pro Halbzeit persistent in der DB gespeichert. Für Berechnungen (Laufleistung/min, Intensitätskurven) fehlen exakte Zeitstempel.

**Fix** — DB-Migration:
- Neue Spalten in `matches`:
  - `h1_started_at timestamptz`
  - `h1_ended_at timestamptz`
  - `h2_started_at timestamptz`
  - `h2_ended_at timestamptz`
  - `recording_started_at timestamptz`
  - `recording_ended_at timestamptz`

**Fix** — Frontend (`CameraTrackingPage.tsx`):
- Bei `startRecording()`: Zeitstempel `recording_started_at` (und `h1_started_at` bei HZ1) in `matches` schreiben
- Bei `triggerHalftime()`: `h1_ended_at` setzen
- Bei `startSecondHalf()`: `h2_started_at` setzen
- Bei `confirmStop()`: `h2_ended_at` bzw. `recording_ended_at` setzen
- Für Helper: Zeitstempel über `camera-ops` Edge Function durchreichen

**Fix** — Edge Functions:
- `camera-ops/index.ts`: Neues Action `update-timing` oder Zeitstempel in `upload-frames` mitschicken, `matches` updaten
- `generate-insights/index.ts`: Halbzeitdauern aus `matches` laden und im Prompt verwenden (z.B. "1. HZ: 47 Min, 2. HZ: 45 Min → Gesamtspielzeit: 92 Min")
- `analyze-match/index.ts`: `duration_sec` pro Halbzeit präziser berechnen statt Schätzung

## 2. API-Football besser integrieren + Alternativen

**Aktueller Stand**: API-Football ist vollständig eingebaut (Suche, Config, Sync Fixtures, Sync Player Stats, Standings). Problem: API-Football deckt Regionalliga und darunter NICHT zuverlässig ab.

**Alternative**: **OpenLigaDB** (kostenlos, open-source, Deutschland-fokussiert):
- Deckt 1.-3. Liga ab, aber NICHT Regionalliga oder tiefer
- Kein API-Key nötig — einfache REST-Calls
- Limitiert auf Ergebnisse/Tabellen — keine Spielerstatistiken

**Realistisches Fazit**: Für Regionalliga und tiefer existiert KEINE externe API mit detaillierten Statistiken. Die eigene Kamera-Analyse IST die einzige Datenquelle. Das ist ein USP.

**Was implementiert wird**:
- OpenLigaDB als Fallback für 1.-3. Liga einbauen (kostenlos, kein Key nötig)
  - Neue Edge Function `openligadb/index.ts` mit Endpunkten: Spielergebnisse, Tabelle
  - In `AdminApiFootball.tsx`: Tab/Section für OpenLigaDB-Anbindung (Liga auswählen)
  - Ergebnisse automatisch mit eigenen Matches abgleichen (Datum + Gegner → Score eintragen)
- API-Football bleibt für höhere Ligen als Premium-Option
- Im MatchReport: Wenn API-Daten vorhanden, merge mit eigenen Daten; sonst eigene Analyse als alleinige Quelle klar kennzeichnen

## 3. Match Events tatsächlich in Analyse verwenden

**Problem geprüft**: `generate-insights` lädt jetzt `match_events`, ABER:
- Die Events werden nur als Text-Kontext übergeben — sie beeinflussen nicht die strukturierten Felder (Momentum, Grades)
- Die Event-Buttons speichern zwar korrekt in die DB, aber die `minute`-Berechnung basiert auf `recordingStartTime` (relativer Timer), nicht auf der tatsächlichen Spielminute

**Fix**:
- `generate-insights`: Prompt explizit anweisen, dass die match_events FAKTISCH sind und Momentum-Scores, Match-Rating und Risk-Matrix darauf basieren MÜSSEN
- `MatchEventQuickBar.tsx`: Minute-Berechnung verbessern — bei Halbzeit 2 die Offset-Minute (45+) addieren
- Neue Event-Buttons hinzufügen: `foul`, `red_card`, `offside`, `free_kick` (mehr Daten = bessere Analyse)

## 4. Elapsed-Time-Display während Aufnahme

**Problem**: Die Aufnahme zeigt nur Frame-Count, keine Uhrzeit/Timer.

**Fix** in `CameraTrackingPage.tsx`:
- Live-Timer-Anzeige im Recording-Overlay: `MM:SS` seit Aufnahmestart
- Bei 2. HZ: `45:00 + MM:SS`
- Timer-Ref mit `setInterval(1000)` für Live-Update

## Dateien

| Datei | Änderung |
|---|---|
| DB-Migration | 6 neue Spalten in `matches` für Timing |
| `src/pages/CameraTrackingPage.tsx` | Zeitstempel bei Start/Stop/Halbzeit schreiben, Live-Timer-Anzeige |
| `src/components/MatchEventQuickBar.tsx` | Mehr Event-Buttons, korrekte Minutenberechnung für 2. HZ |
| `supabase/functions/camera-ops/index.ts` | Timing-Daten bei upload-frames in matches schreiben |
| `supabase/functions/generate-insights/index.ts` | Spielzeit aus matches laden, match_events stärker gewichten |
| `supabase/functions/openligadb/index.ts` | Neue Edge Function für OpenLigaDB (kostenlos, kein Key) |
| `src/components/AdminApiFootball.tsx` | OpenLigaDB-Tab ergänzen |

## Nicht implementiert (mit Begründung)

- **Automatische Tor/Foul-Erkennung per Kamera**: Bereits im `analyze-match`-Prompt angewiesen, visuelle Hinweise zu suchen (Jubel, Referee-Gesten). Mehr ist mit Standbild-Analyse (alle 30s) nicht zuverlässig möglich — das wäre Video-Analyse in Echtzeit, was die aktuelle Architektur nicht hergibt.
- **Ballbesitz-Tracking**: Nicht aus 30s-Standbildern ableitbar. Wird geschätzt basierend auf Spielerpositionsverteilung (bereits im Prompt).

