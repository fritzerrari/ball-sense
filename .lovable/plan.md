

## Frage verstanden

Du möchtest wissen, ob du **mitten im Spiel** (z. B. zur Halbzeit, oder einfach in der 23. Minute) **eine zusätzliche Kamera dazuschalten** kannst — und ob das System dann:

1. erkennt, dass eine neue Kamera dazugekommen ist,
2. weiß, **ab wann** diese Kamera Frames liefert,
3. alle Frames (auch teilweise überlappende Zeiten) korrekt **chronologisch zusammenführt**.

## Aktueller Stand (recherchiert)

Aus `mem://architecture/frame-orchestration-and-merging` und `supabase/functions/camera-ops/index.ts`:

- **Jeder Frame trägt einen Wall-Clock-Timestamp** (ms, `Date.now()`), erfasst clientseitig in `frame-capture.ts`.
- Helfer schreiben in `_cam{session.camera_index}.json` (cam1, cam2, cam3), Trainer in `_cam0.json`.
- Nach jedem Upload werden **alle vorhandenen `_cam*.json`-Dateien** geladen, Frames per Timestamp sortiert und zur globalen `{matchId}.json` gemerged.
- `analyze-match` liest die zeitsortierte globale Datei.
- Pro Verein sind bis zu **3 aktive Kamera-Codes** gleichzeitig erlaubt (`mem://features/match-setup-constraints`).
- Helfer können sich über Code + Match-ID jederzeit einklinken.

### Heißt konkret für deine Frage:

**Ja, technisch funktioniert das schon heute** — mit einer Einschränkung, die ich gleich erkläre.

| Szenario | Funktioniert heute? |
|---|---|
| Helfer #1 startet ab Anpfiff, Helfer #2 schaltet sich in der 23. Minute dazu | **Ja** — cam2-Frames werden ab dem ersten Upload zeitsortiert eingemerged |
| Helfer schaltet sich erst zur Halbzeit dazu | **Ja** — Frames landen korrekt im H2-Bereich der Timeline |
| Zwei Helfer filmen zeitweise dieselbe Sekunde | **Ja** — beide Frames werden behalten, chronologisch nebeneinander einsortiert (gibt mehr Datenpunkte für die KI, kein Verlust) |
| Trainer pausiert, Helfer filmt weiter | **Ja** — Helfer-Frames laufen einfach durch |

**Aktuelle Einschränkung:** Es gibt heute **keine UI-Sichtbarkeit**, dass mitten im Spiel eine neue Kamera dazugekommen ist. Für dich als Trainer ist nicht erkennbar:
- *„Aha, ab Minute 23 hilft mir Klaus mit zweitem Handy."*
- *„Wie viele Kameras laufen gerade?"*
- *„Welche Kamera hat welche Zeitabschnitte abgedeckt?"*

Im Report siehst du am Ende nur „X Kameras beteiligt" als Zahl, aber nicht **wann welche** aktiv war.

## Vorschlag — drei kleine Verbesserungen für volle Transparenz

### 1. Live-Anzeige aktiver Kameras im `CameraRemotePanel`
Im Trainer-Live-Panel zusätzlich für jede aktive Helfer-Session anzeigen:
- **„Beigetreten: 14:23"** (= `created_at` der Session)
- **„Frames synchronisiert: 142"** (gibt es schon in `status_data.synced_frames`)
- **„Erste/letzte Frame-Zeit"** (aus `_cam{i}.json`)

So siehst du in Echtzeit, wer wann dazugekommen ist und wer aktiv liefert.

### 2. Coverage-Timeline im Report
Im `MatchReport.tsx` ein kleiner Streifen unter den KPIs:

```text
Kamera-Abdeckung über die Zeit:
Cam0 (Trainer):  ████████████████████████  0–90'
Cam1 (Helfer A): ████████░░░░░░░░░░░░░░░░  0–28'
Cam2 (Helfer B): ░░░░░░░░░░░░████████████  45–90'
```

Berechnet aus den `timestamps`-Arrays der einzelnen `_cam{i}.json`-Dateien gegen `recording_started_at` / `recording_ended_at`.

### 3. Toast-Benachrichtigung beim Trainer
Wenn `camera_access_sessions` per Realtime einen neuen Eintrag bekommt während ein Match läuft:
> *„Neue Kamera ist beigetreten — Helfer 'Klaus' filmt jetzt mit (Cam2)."*

Nutzt das bereits existierende Notification-System (`mem://features/notification-infrastructure`).

## Backend-Änderungen: keine

Die ganze Merge-Logik ist bereits Timestamp-basiert und Race-Condition-sicher. Es geht **rein um UI-Transparenz**.

## Betroffene Dateien

**Ändern:**
- `src/components/CameraRemotePanel.tsx` — Beitritts-Zeit + Frame-Coverage pro Helfer anzeigen
- `src/pages/MatchReport.tsx` — Kamera-Coverage-Timeline-Streifen einfügen
- `src/pages/CameraTrackingPage.tsx` — Realtime-Subscription auf `camera_access_sessions` für Trainer-Toast
- `src/lib/match-analysis.ts` — kleine Helper-Funktion `computeCameraCoverage(matchId)` die per `_cam{i}.json` die Zeit-Spans berechnet

**Neu:**
- `src/components/CameraCoverageTimeline.tsx` — wiederverwendbarer Coverage-Streifen

**Unverändert:**
- Frame-Pipeline, Storage, `camera-ops`, `analyze-match` — die machen alles schon korrekt.

## Antwort auf deine Frage in einem Satz

**Ja**, du kannst zu **jedem beliebigen Zeitpunkt** (Halbzeit, Mitte H1, sogar in der Nachspielzeit) eine weitere Kamera per Helfer-Code dazuschalten — das System merged alle Frames per echtem Wall-Clock-Timestamp sauber chronologisch, auch bei zeitlichen Überlappungen. Die KI bekommt eine durchgehende, zeitsortierte Frame-Sequenz aus allen aktiven Kameras. Ich schlage zusätzlich die drei UI-Verbesserungen oben vor, damit du diese Flexibilität auch **siehst und nachvollziehen** kannst.

