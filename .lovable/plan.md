

## Veo-inspirierte Optimierung: Gestaffelte Analyse-Pakete & Halbzeit-Analyse

### Veo-Referenz: Was Veo richtig macht

Veo liefert Analysen nicht als ein monolithisches Paket, sondern in gestaffelten Ebenen:
1. **Sofort** nach Spielende: Basis-Statistiken (Distanz, Sprints, Heatmaps) — rein algorithmisch, keine KI
2. **Innerhalb von Minuten**: Automatisches Highlight-Tagging und Schlüsselszenen
3. **Hintergrund**: Tiefere taktische Analyse als Premium-Feature

Das aktuelle System macht alles in einem KI-Call — das ist der Kernfehler.

---

### Plan: 3-Paket-Architektur + Halbzeit-Analyse

```text
PAKET 1: "Sofort-Stats" (0 Sekunden Wartezeit)
├── Rein algorithmisch, KEINE KI nötig
├── Distanz, Speed, Sprints, Heatmaps
├── Pass-/Duell-/Schuss-Statistiken
└── Verfügbar: sofort nach Tracking-Ende

PAKET 2: "Schnell-Fazit" (~15-30 Sekunden)
├── gemini-3-flash-preview / gemini-2.5-flash-lite
├── 3-5 Kernerkenntnisse pro Spieler
├── Kompakter Team-Überblick
└── Benachrichtigung: "Erste Analyse verfügbar!"

PAKET 3: "Tiefenanalyse" (Hintergrund, ~2-5 Min)
├── gemini-2.5-pro
├── Vollständige Trendanalyse + Trainingsableitungen
├── Taktische Bewertung + Belastungssteuerung
└── Benachrichtigung: "Komplette Analyse fertig!"
```

---

### Teil 1: Paket 1 — Sofort-Stats (algorithmisch)

Die `process-tracking` Edge Function berechnet bereits Stats (Distanz, Sprints etc.) — diese sind sofort verfügbar, ohne KI. Das Frontend soll diese Stats direkt anzeigen, ohne auf einen KI-Report zu warten.

- `PerformanceAnalysis` zeigt bei Status `done` sofort die Stats-Karten aus `player_match_stats`
- Kein Spinner, keine Wartezeit für Basis-Daten
- KI-Analyse wird als optionales Upgrade darunter angeboten

**Dateien**: `src/components/PerformanceAnalysis.tsx`, `src/pages/MatchReport.tsx`

### Teil 2: Paket 2 — Auto-Schnell-Fazit

Nach `process-tracking` werden automatisch Quick-Reports für alle Spieler + Team erstellt — aber mit dem schnellsten Modell (`gemini-2.5-flash-lite` statt `gemini-3-flash-preview`).

- Prompt wird radikal gekürzt: max 200 Wörter, 3-5 Bullet Points
- Kein Trend-Block, keine Historie — nur das aktuelle Spiel
- `process-ai-queue` bekommt neuen Depth-Level `instant` neben `quick` und `deep`
- MAX_PARALLEL von 3 auf 5 für `instant`-Reports

**Dateien**: `supabase/functions/process-ai-queue/index.ts`, DB-Migration (`depth` um `instant` erweitern)

### Teil 3: Halbzeit-Analyse

Bei Live-Upload-Modus: Nach ~45 Minuten Spielzeit automatisch Paket 1 + 2 für die erste Halbzeit generieren.

- `stream-tracking` Edge Function trackt die Spielzeit über Chunk-Timestamps
- Wenn `elapsed_minutes >= 42` und kein Halbzeit-Report existiert: automatisch `process-tracking` für bisherige Chunks triggern
- Halbzeit-Stats werden als separate Zeilen in `player_match_stats` gespeichert (neues Feld `period`: `first_half` / `second_half` / `full`)
- Frontend zeigt: "Halbzeit-Analyse verfügbar" als Badge

**Dateien**: `supabase/functions/stream-tracking/index.ts`, `src/components/ProcessingRoadmap.tsx`, DB-Migration

### Teil 4: Benachrichtigungssystem

Zwei In-App-Benachrichtigungen:

1. **"Erste Analyse verfügbar"** — wenn Paket 2 (Schnell-Fazit) fertig ist
2. **"Komplette Analyse fertig"** — wenn Paket 3 (Tiefenanalyse) abgeschlossen ist

Umsetzung:
- Neue Tabelle `notifications` (user_id, match_id, type, read, created_at)
- `process-ai-queue` schreibt bei Report-Completion eine Notification
- Frontend: Glocken-Icon im Header mit Unread-Count + Realtime-Subscription
- Toast-Notification wenn User gerade online ist

**Dateien**: DB-Migration, `src/components/AppLayout.tsx` (Notification-Bell), neues `src/components/NotificationBell.tsx`, `supabase/functions/process-ai-queue/index.ts`

### Teil 5: Robustheit & Fehlerresilienz

- `process-ai-queue`: Timeout-Guard pro Report (max 120s für instant, 300s für deep)
- Automatischer Retry bei Fehler (max 2 Versuche, dann `error` Status)
- Stuck-Detection: Reports die >10 Min im Status `generating` sind, werden automatisch auf `error` gesetzt
- Rate-Limit-Handling: Bei 429 → exponentielles Backoff, nicht sofort `error`

**Dateien**: `supabase/functions/process-ai-queue/index.ts`

### Teil 6: UI-Anpassungen

- `PerformanceAnalysis` wird umstrukturiert:
  - Oben: Sofort-Stats (immer sichtbar wenn Daten vorhanden)
  - Mitte: Schnell-Fazit (mit "Wird geladen..." oder fertig)
  - Unten: Button "Tiefenanalyse anfordern"
- `ProcessingRoadmap` zeigt die 3 Pakete als separate Fortschritts-Tracks
- Neues Paket-Badge: "Basis ✓ | Schnell-Fazit ✓ | Tiefenanalyse ⏳"

**Dateien**: `src/components/PerformanceAnalysis.tsx`, `src/components/ProcessingRoadmap.tsx`

---

### Technische Details

**DB-Migration**:
```sql
-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  match_id uuid,
  type text NOT NULL, -- 'quick_analysis_ready', 'deep_analysis_ready', 'halftime_ready'
  title text NOT NULL,
  body text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Halftime support
ALTER TABLE player_match_stats ADD COLUMN period text NOT NULL DEFAULT 'full';

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
```

**Performance-Vergleich**:
- Aktuell: Alles blockiert hinter KI → 5-25 Min Wartezeit
- Neu: Stats sofort (0s) → Schnell-Fazit (15-30s) → Deep optional (2-5 Min)

**Halbzeit-Machbarkeit**: Ja, funktioniert. Bei Live-Upload sind nach 45 Min alle Chunks der 1. Halbzeit vorhanden. `process-tracking` kann diese separat verarbeiten (algorithmisch ~5-10s), dann wird ein `instant`-Report automatisch getriggert (~15s). Gesamtzeit: ~25 Sekunden nach Halbzeitpfiff.

---

### Prioritätsreihenfolge

1. Sofort-Stats ohne KI-Wartezeit anzeigen (größter UX-Gewinn)
2. `instant` Depth-Level mit ultra-kurzem Prompt
3. Benachrichtigungssystem
4. Halbzeit-Analyse bei Live-Upload
5. Robustheit (Timeout, Retry, Stuck-Detection)

