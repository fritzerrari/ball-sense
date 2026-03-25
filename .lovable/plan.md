

# Status-Analyse & Optimierungsplan

## Was funktioniert (stabile Basis)

1. **Frame-Capture Pipeline** — `frame-capture.ts` extrahiert alle 30s JPEG-Frames (640px, JPEG 0.6). ~50KB/Frame statt GB-Video.
2. **Dual-Stage Analysis** — `analyze-match` (Gemini Vision) → `generate-insights` (Gemini Text), entkoppelt via client-seitigen Trigger.
3. **Frame Persistence** — Frames in `match-frames` Storage Bucket, ermöglicht Retry und Reprocess.
4. **Reprocess Cleanup** — Alte `analysis_results`, `report_sections`, `training_recommendations` werden vor Neuanalyse gelöscht.
5. **Error Handling** — Beide Edge Functions setzen Job auf `failed` bei Fehlern. Storage-Cleanup nach Erfolg.
6. **Halftime Analysis** — `getSnapshot()` erlaubt Zwischenanalyse ohne Aufnahme zu stoppen.
7. **Dashboard** — Quick Stats, letzte Matches mit Status-Links, Trainingsempfehlungen.
8. **Matches-Seite** — Processing-Banner verlinken zur ProcessingPage. Filter, Suche, Sortierung.
9. **Onboarding** — 5-Schritt-Flow (Verein, Kader, Spielfeld, Install, Fertig) existiert bereits.
10. **Auth, Navigation, i18n, Theme** — stabil.

## Was fehlt / optimiert werden kann

### Bugs / Robustheit

1. **`analyze-match` catch-Block setzt Job nicht auf `failed`** — Zeile 275-279: Bei unbehandelten Fehlern (z.B. JSON-Parse-Fehler bei Tool Call) wird nur eine 500 Response zurückgegeben, aber der Job bleibt auf `analyzing` stecken. Der User sieht ewig den Spinner.

2. **Halftime überschreibt Frames, aber alter Job bleibt** — Wenn Halftime-Analyse gestartet wird, wird ein neuer Job erstellt. Der alte Job (falls vorhanden) bleibt mit falschem Status. Kein Problem, aber `ProcessingPage` pollt den *neuesten* Job — das passt. Allerdings: wenn die Halftime-Analyse noch läuft und der User "Stoppen & Endanalyse" drückt, wird ein *weiterer* Job erstellt und die Frames überschrieben. Die Halftime-Analyse arbeitet dann mit veralteten Daten oder läuft ins Leere.

3. **`generate-insights` liest `analysis_results` per `job_id`** — Wenn bei Reprocess ein neuer Job erstellt wird, aber die alten Results gelöscht und neue mit dem neuen `job_id` gespeichert werden, funktioniert das. ABER: bei Halftime-Analyse → Endanalyse könnte es zu einer Race Condition kommen, wenn die Halftime `generate-insights` noch läuft während die Endanalyse schon neue Results schreibt.

4. **`training_recommendations` Query im Dashboard hat kein `club_id` Filter** — Doch, hat es (Zeile 44). Aber es fehlt eine Deduplizierung: wenn mehrere Matches analysiert wurden, kommen bis zu 5 Recs pro Match. Das Dashboard zeigt nur die neuesten 5 insgesamt, was korrekt ist.

### UX-Optimierungen

5. **Kein Feedback nach Halftime-Analyse** — User sieht "HZ-Analyse läuft" Badge, aber keinen Link zum Report. Er muss manuell zu `/matches/{id}` navigieren, um die Halbzeit-Ergebnisse zu sehen.

6. **CameraTrackingPage hat keinen Link zum Report nach "done"** — Phase `done` zeigt nur "Weitere Aufnahme", aber keinen "Report ansehen" oder "Zur Analyse" Link.

7. **ProcessingPage zeigt keine Halbzeit-Ergebnisse** — Wenn eine Halbzeit-Analyse abgeschlossen wurde, zeigt die ProcessingPage nur den Status des letzten Jobs. Es gibt keinen Hinweis auf bereits verfügbare Halbzeit-Insights.

8. **NewMatch: `ageGroup` wird nie gespeichert** — Das Feld existiert im UI (Zeile 364-377) mit State (Zeile 30), wird aber beim `insert` in Zeile 62-76 nicht verwendet. Das `matches` Table hat kein `age_group` Feld.

9. **Matches-Seite: Searchbar nutzt `.includes()` statt `.indexOf()`** — Zeile 229: `searchValues.includes(query)` erfordert exakten Match, nicht Teilstring-Suche. "FC" findet nicht "FC Musterstadt".

### Architektur

10. **`match-videos` Bucket und `match_videos` Tabelle sind Altlasten** — Werden nirgendwo mehr befüllt. Der neue Flow nutzt `match-frames` Bucket, nicht `match-videos`.

11. **`training_recommendations` fehlt in DB-Schema-Übersicht** — Tabelle wird verwendet, erscheint aber nicht in den RLS-Policies. `generate-insights` nutzt Service Role, also funktioniert INSERT. Aber SELECT muss per RLS erlaubt sein (via club_id). Muss geprüft werden.

12. **Keine Benachrichtigung wenn Report fertig** — `notifications` Tabelle existiert, wird aber von `generate-insights` nicht befüllt. User erfährt nur durch Polling, dass der Report fertig ist.

---

## Umsetzungsplan

### Schritt 1: Kritische Bugfixes
- **`analyze-match` catch-Block**: Job auf `failed` setzen mit Error-Message im generischen catch-Block
- **Halftime Race Condition**: Vor dem Stoppen prüfen ob Halftime-Job noch läuft, ggf. warten oder canceln
- **Matches-Suche**: `.includes(query)` → `.indexOf(query) >= 0` für Teilstring-Suche

### Schritt 2: UX-Verbesserungen  
- **CameraTrackingPage "done"**: Link zur ProcessingPage (`/matches/{id}/processing`) hinzufügen
- **Halftime-Report-Link**: Nach erfolgreicher Halftime-Analyse einen "Ergebnisse ansehen" Link einblenden
- **Benachrichtigung erstellen**: In `generate-insights` nach Erfolg eine Notification in die `notifications` Tabelle schreiben
- **`ageGroup` entfernen oder speichern**: Entweder Feld aus UI entfernen oder `age_group` Spalte zur `matches` Tabelle hinzufügen

### Schritt 3: Cleanup
- **`match-videos` Bucket und `match_videos` Tabelle**: Nicht löschen (Migration-Risiko), aber im Code als deprecated markieren
- **`supabase/config.toml`**: Legacy Function-Einträge entfernen (`analyze-performance`, `process-tracking`, `detect-field-corners`, `cleanup-highlights`) — Moment, die wurden bereits gelöscht. Config prüfen.

### Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `supabase/functions/analyze-match/index.ts` | catch-Block: Job auf `failed` setzen |
| `supabase/functions/generate-insights/index.ts` | Notification erstellen nach Erfolg |
| `src/pages/CameraTrackingPage.tsx` | Link zum Report/Processing nach "done" |
| `src/pages/Matches.tsx` | Suche: Teilstring-Match statt exakt |
| `src/pages/NewMatch.tsx` | `ageGroup` UI entfernen (kein DB-Feld) |
| Migration (optional) | `age_group` Spalte zu `matches` hinzufügen, falls gewünscht |

