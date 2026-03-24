

## Performance-Analyse und Lösungsplan

### Identifizierte Engpässe

**1. Tracking-Verarbeitung (`process-tracking`)**: Synchron in einem Request -- Download aller Kamera-JSONs, Frame-Merging, Track-Building, Stats-Berechnung, DB-Writes. Bei 90 Minuten Spieldaten mit 3 Kameras = tausende Frames in einem Edge Function Call.

**2. KI-Analyse (`process-ai-queue`)**: Nutzt `google/gemini-2.5-pro` -- das langsamste und teuerste Modell. Sequenziell: nur ein Report gleichzeitig. Bei 11 Spielern = 11 Reports nacheinander.

**3. Kein Live-Upload**: Alle Tracking-Daten werden erst nach Spielende als ein großer JSON-Blob hochgeladen.

---

### Lösungskonzept: 3-Stufen-Architektur

```text
┌──────────────────────────────────────────────────┐
│  STUFE 1: Live-Streaming (während des Spiels)    │
│  Kamera sendet Frames alle 30s in Micro-Batches  │
│  → Sofortige Speicherung + inkrementelle Stats   │
├──────────────────────────────────────────────────┤
│  STUFE 2: Schnell-Analyse (sofort nach Abpfiff)  │
│  Stats bereits vorberechnet → gemini-3-flash     │
│  → Kurzfazit in <30 Sekunden pro Spieler         │
├──────────────────────────────────────────────────┤
│  STUFE 3: Tiefenanalyse (Hintergrund-Queue)      │
│  gemini-2.5-pro für detaillierte Reports         │
│  → Parallel: bis zu 3 Reports gleichzeitig       │
└──────────────────────────────────────────────────┘
```

---

### Teil 1: Live-Streaming der Tracking-Daten

Der User wählt beim Tracking-Start: **"Live-Upload"** oder **"Upload nach Spielende"**.

**Live-Upload-Modus**:
- `FootballTracker` sendet alle 30 Sekunden einen Micro-Batch (ca. 60 Frames) an eine neue Edge Function `stream-tracking`
- Jeder Batch wird als separater Chunk in Storage gespeichert: `tracking/{matchId}/cam_{idx}/chunk_{seq}.json`
- Bei Verbindungsabbruch: Chunks werden lokal gepuffert und beim Reconnect nachgesendet
- `tracking_uploads` bekommt neue Spalten: `upload_mode` (live/batch), `chunks_received`, `last_chunk_at`

**Vorteile**: Stats können inkrementell berechnet werden. Bei Abpfiff sind 95% der Daten bereits verarbeitet.

**Dateien**: `src/lib/football-tracker.ts`, neue Edge Function `supabase/functions/stream-tracking/index.ts`, DB-Migration

#### Teil 2: Schnelleres KI-Modell + Zwei-Tier-System

- **Schnell-Analyse**: `google/gemini-3-flash-preview` statt `gemini-2.5-pro` -- 5-10x schneller, ausreichend für Standardanalysen
- **Tiefenanalyse**: `gemini-2.5-pro` nur auf explizite Anforderung ("Detaillierte Analyse anfordern")
- `ai_reports` bekommt neue Spalte `depth` (`quick` | `deep`)
- Quick-Reports: Kompakter Prompt, weniger Struktur-Pflicht, ~15-30 Sekunden
- Deep-Reports: Voller Prompt wie bisher, aber als optionales Upgrade

**Dateien**: `supabase/functions/process-ai-queue/index.ts`, `src/components/PerformanceAnalysis.tsx`, DB-Migration

#### Teil 3: Parallele KI-Verarbeitung

- Statt sequenziell 1 Report: bis zu 3 Reports gleichzeitig verarbeiten
- `process-ai-queue` prüft: weniger als 3 aktive `generating`-Reports? Dann nächsten starten
- Automatischer Trigger: Nach `process-tracking` werden alle Spieler-Reports als `queued` angelegt und die Queue gestartet

**Dateien**: `supabase/functions/process-ai-queue/index.ts`

#### Teil 4: Inkrementelle Stats-Berechnung

- Neue Edge Function `process-tracking-chunk`: Verarbeitet einzelne Live-Chunks sofort
- Berechnet Delta-Stats (Distanz seit letztem Chunk, neue Sprints) und akkumuliert in `player_match_stats`
- Bei Spielende: Nur noch finaler Merge + Qualitätscheck statt Komplett-Neuberechnung
- `process-tracking` wird zum "Finalizer": Liest vorberechnete Stats, korrigiert Anomalien, schreibt Endergebnis

**Dateien**: Neue Edge Function `supabase/functions/process-tracking-chunk/index.ts`, Anpassung `process-tracking`

#### Teil 5: Unterbrechungsschutz

- Live-Modus: Chunks haben Sequenznummern. Bei Reconnect sendet der Client fehlende Chunks nach
- localStorage-Fallback bleibt bestehen für Offline-Phasen
- Neuer Status `partial` in `tracking_uploads` für unvollständige Streams
- UI zeigt: "12 von 15 Chunks empfangen -- 3 ausstehend"
- Manueller "Retry fehlende Chunks"-Button

**Dateien**: `src/lib/football-tracker.ts`, `src/pages/CameraTrackingPage.tsx`

#### Teil 6: UI-Anpassungen

- Upload-Modus-Auswahl im Tracking-Wizard (Schritt 2): Toggle "Live-Übertragung" / "Nach Spielende"
- Bei Live: Echtzeit-Badge "Chunks: 45/45 ✓" im Tracking-Screen
- Nach Spielende: Sofort Quick-Analyse verfügbar (statt Minuten warten)
- Button "Tiefenanalyse anfordern" für detaillierte Reports
- Parallele Fortschrittsanzeige: "3 von 11 Analysen fertig"

**Dateien**: `src/pages/CameraTrackingPage.tsx`, `src/components/PerformanceAnalysis.tsx`, `src/components/ProcessingRoadmap.tsx`

---

### Technische Details

**DB-Migration**:
```sql
ALTER TABLE tracking_uploads 
  ADD COLUMN upload_mode text NOT NULL DEFAULT 'batch',
  ADD COLUMN chunks_received integer DEFAULT 0,
  ADD COLUMN last_chunk_at timestamptz;

ALTER TABLE ai_reports 
  ADD COLUMN depth text NOT NULL DEFAULT 'quick';
```

**Geschwindigkeitsvergleich**:
- Aktuell: Upload (60s) + Processing (30-60s) + KI pro Spieler (60-120s) = **~25 Min für 11 Spieler**
- Neu: Live-Upload (0s Wartezeit) + Quick-KI parallel (10s pro 3) = **~40 Sekunden für 11 Spieler**

**Prioritätsreihenfolge**:
1. KI-Modell auf `gemini-3-flash-preview` umstellen + Zwei-Tier-System (sofortiger Effekt)
2. Parallele KI-Verarbeitung (3 gleichzeitig)
3. Live-Streaming der Tracking-Daten
4. Inkrementelle Stats-Berechnung
5. Unterbrechungsschutz + UI

