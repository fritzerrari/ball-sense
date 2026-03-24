

## Live-Inkrementelle Analyse & Teilfeld-Hochrechnung

### Problem 1: Analyse startet erst nach Spielende

Aktuell wird `process-tracking` erst nach Upload-Ende aufgerufen. Waehrend des Live-Trackings passiert keine Analyse. Der Coach wartet nach Spielende mehrere Minuten auf erste Ergebnisse.

### Problem 2: Teilfeld-Kameras liefern verzerrte Statistiken

Wenn eine Kamera nur die linke Haelfte filmt, werden Distanzen und Heatmaps nur fuer diesen Bereich berechnet. Die Gesamtstatistiken (Team-Distanz, Sprints) sind dann systematisch zu niedrig. Es fehlt eine Hochrechnungslogik.

---

### Loesung

```text
LIVE-TRACKING (Spiel laeuft)
│
├── Alle 5 Min: Chunk-Upload → process-tracking (inkrementell)
│   ├── Berechne Stats fuer DIESEN Chunk
│   ├── Merge mit bisherigen Ergebnissen
│   ├── Speichere Zwischenstand in player_match_stats (period='partial')
│   └── Trigger Sofort-Fazit wenn Halbzeit erkannt
│
├── Frontend: MatchReport zeigt Live-Stats mit "Live"-Badge
│   ├── Physis-Karten aktualisieren sich alle 30s (Realtime)
│   └── "Analyse laeuft..." Fortschritts-Module
│
SPIELENDE
│
├── Finaler process-tracking Run (konsolidiert alle Chunks)
├── Teilfeld-Hochrechnung wenn field_rect < 100%
└── Auto-Trigger: Sofort-Fazit + Schnell-Analyse
```

---

### Teil 1: Inkrementelle Live-Verarbeitung

**Backend** (`process-tracking`):
- Neuer `action: "incremental"` Modus, aufgerufen vom Kamera-Client alle 5 Minuten
- Verarbeitet nur den neuesten Chunk (nicht alle Uploads)
- Speichert Zwischenergebnisse mit `period = 'partial'` in `player_match_stats`
- Aktualisiert `processing_progress` mit Live-Stats-Zusammenfassung
- Bei finalem Upload (`action: "finalize"`): konsolidiert alle Chunks, ueberschreibt mit `period = 'full'`

**Frontend** (`CameraTrackingPage.tsx`):
- Alle 5 Minuten: Upload des aktuellen Chunks + Aufruf von `process-tracking` mit `action: "incremental"`
- Bestehende `handleUpload`-Logik wird erweitert um periodischen Auto-Upload

**Dateien**: `supabase/functions/process-tracking/index.ts`, `src/pages/CameraTrackingPage.tsx`

### Teil 2: Live-Stats im MatchReport

**Frontend** (`MatchReport.tsx`, `use-match-stats.ts`):
- Query fuer `player_match_stats` schliesst `period IN ('partial', 'full')` ein
- Wenn `period = 'partial'`: Daten mit "Live"-Badge und Puls-Animation anzeigen
- Realtime-Subscription auf `player_match_stats` fuer automatische UI-Updates
- Jedes Analyse-Modul (Physis, Ballarbeit, Duelle etc.) zeigt eigenen Fortschrittsbalken
- Module die schon Daten haben: gruener Haken + Daten
- Module ohne Daten: grauer Platzhalter mit "Wird beim naechsten Update verfuegbar"

**Dateien**: `src/pages/MatchReport.tsx`, `src/hooks/use-match-stats.ts`

### Teil 3: Auto-Trigger KI-Analyse bei Halbzeit/Spielende

**Backend** (`process-tracking`):
- Halbzeit-Erkennung: Wenn `totalDurationSec > 40*60` und noch nicht als Halbzeit markiert
- Auto-Insert eines `ai_reports`-Eintrags mit `depth: "instant"` + Trigger `process-ai-queue`
- Bei `action: "finalize"`: Auto-Insert `depth: "instant"` + `depth: "quick"`
- Benachrichtigung: "Halbzeit-Analyse verfuegbar" / "Erste Ergebnisse verfuegbar"

**Dateien**: `supabase/functions/process-tracking/index.ts`

### Teil 4: Teilfeld-Hochrechnung

**Problem**: Kamera filmt nur 50% des Feldes → Spieler sind nur 50% der Zeit sichtbar → Distanz wird halbiert.

**Loesung im Backend** (`process-tracking`):
- Nach Stats-Berechnung: Pruefen ob `field_rect` vorhanden und < 100% Abdeckung
- Hochrechnungsfaktor: `coverageRatio = field_rect.w * field_rect.h`
- Wenn `coverageRatio < 0.9`:
  - `distance_km = distance_km / coverageRatio` (Spieler laeuft auch ausserhalb des Sichtfelds)
  - `sprint_count = sprint_count / coverageRatio`
  - `minutes_played` bleibt unveraendert (kommt aus Lineup, nicht aus Sichtbarkeit)
  - Heatmap: Nur der sichtbare Bereich ist valide, Rest wird als "keine Daten" markiert (nicht hochgerechnet)
  - `raw_metrics.coverage_ratio` wird gespeichert fuer Transparenz
  - `raw_metrics.extrapolated = true` Flag setzen

- Multi-Kamera-Fusion: Wenn 2 Kameras je 50% abdecken und sich ueberlappen:
  - Ueberlappungszone: Tracks werden dedupliziert (bestehende Logik)
  - Effektive Abdeckung berechnen: `union(field_rect_1, field_rect_2)`
  - Hochrechnungsfaktor basiert auf effektiver Gesamtabdeckung
  - Wenn Gesamtabdeckung >= 90%: keine Hochrechnung noetig

- Qualitaetswarnung im Frontend: "Daten basieren auf ~60% Feldabdeckung — Werte wurden hochgerechnet"

**Dateien**: `supabase/functions/process-tracking/index.ts`, `src/components/DataQualityPanel.tsx`

### Teil 5: Frontend Fortschritts-Module

**MatchReport** bekommt eine neue Sektion ueber den bestehenden Tabs:

```text
┌─────────────────────────────────────────┐
│ ⚡ Live-Analyse                    LIVE │
├──────┬──────┬──────┬──────┬──────┬──────┤
│Physis│Paesse│Duelle│Tore  │Taktik│  KI  │
│  ✓   │  ✓   │  ⏳  │  ✓   │  —   │  ⏳  │
└──────┴──────┴──────┴──────┴──────┴──────┘
```

- Jedes Modul hat 3 Zustaende: leer (—), wird geladen (⏳), fertig (✓)
- Fertige Module zeigen sofort die Daten
- Gesamtfortschritt als Balken oben

**Dateien**: `src/pages/MatchReport.tsx`

---

### Technische Details

**Inkrementeller Upload-Timer** (CameraTrackingPage):
```typescript
// Alle 5 Min waehrend Live-Tracking
useEffect(() => {
  if (phase !== "tracking" || !isTracking) return;
  const interval = setInterval(() => uploadIncrementalChunk(), 5 * 60 * 1000);
  return () => clearInterval(interval);
}, [phase, isTracking]);
```

**Hochrechnungsformel**:
```text
coverage = field_rect.w * field_rect.h  // z.B. 0.5 fuer linke Haelfte
if coverage < 0.9:
  distance_km_corrected = distance_km / coverage
  sprint_count_corrected = sprint_count / coverage
  quality_note = "Hochgerechnet (${Math.round(coverage*100)}% Abdeckung)"
```

**Multi-Kamera Gesamtabdeckung**:
```text
// Vereinfachte Union-Berechnung fuer axis-aligned Rects
union_x = max(r1.x+r1.w, r2.x+r2.w) - min(r1.x, r2.x)
union_y = max(r1.y+r1.h, r2.y+r2.h) - min(r1.y, r2.y)
overlap_x = max(0, min(r1.x+r1.w, r2.x+r2.w) - max(r1.x, r2.x))
overlap_y = max(0, min(r1.y+r1.h, r2.y+r2.h) - max(r1.y, r2.y))
union_area = r1.w*r1.h + r2.w*r2.h - overlap_x*overlap_y
```

**Keine DB-Migration noetig**: `period` Spalte existiert bereits, `raw_metrics` ist JSONB und kann `extrapolated`/`coverage_ratio` aufnehmen.

---

### Prioritaetsreihenfolge

1. Inkrementeller 5-Min Upload + Backend-Verarbeitung (groesster Geschwindigkeitsgewinn)
2. Live-Stats im MatchReport mit Realtime-Updates
3. Teilfeld-Hochrechnung im Backend
4. Auto-Trigger KI bei Halbzeit/Spielende
5. Fortschritts-Module UI
6. Multi-Kamera Union-Abdeckungsberechnung

