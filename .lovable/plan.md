

# FieldIQ Rebuild: Von Tracking-App zu Match Intelligence Platform

## Analyse des Ist-Zustands

**Was funktioniert und bleibt:**
- Auth, Clubs, Profiles, User Roles → stabil, wiederverwendbar
- Landing Page, AppLayout, Navigation → gutes Design, bleibt
- Matches-Tabelle, Fields, Players → Grundstruktur passt
- Supabase Storage, Edge Functions Infrastruktur → bleibt
- i18n, ThemeToggle, UI-Komponenten → bleiben

**Was raus muss (kaputte Tracking-Schicht):**
- `football-tracker.ts` (765 Zeilen Echtzeit-Frame-Analyse) → **löschen**
- `analyze-frame` Edge Function → **löschen**
- `stream-tracking` Edge Function → **löschen**
- `CameraTrackingPage.tsx` (1370 Zeilen) → **radikal vereinfachen** zu reinem Video-Recorder/Uploader
- `TrackingPage.tsx` → **entfernen**
- `TrackingOverlay.tsx`, `PitchVisualization.tsx` → **entfernen**
- `live-stats-engine.ts`, `highlight-recorder.ts` → **entfernen**
- Alle "63 Spieler erkannt"-Logik in `process-tracking` → **komplett neu**

## Neues Produktmodell

```text
┌─────────┐    ┌──────────┐    ┌───────────────┐    ┌────────────┐
│ CAPTURE  │───▶│  ANALYZE  │───▶│  INTERPRET    │───▶│   ACTION   │
│          │    │           │    │               │    │            │
│ Video +  │    │ Gemini    │    │ GPT/Gemini    │    │ Training   │
│ Matchinfo│    │ Vision    │    │ Coaching AI   │    │ Empfehlung │
└─────────┘    └──────────┘    └───────────────┘    └────────────┘
```

**Analyse fokussiert auf Match-Level:**
- Angriffsrichtungen & Gefährdungszonen
- Druckphasen & Momentum
- Ballverlust-Muster
- Chancen & Abschlüsse
- Taktische Grundordnung (Formation-Erkennung)

**Keine fake Spieler-Metriken mehr.** Stattdessen: verständliche Coaching-Insights.

## Umsetzung in 5 Phasen

### Phase A — Aufräumen & neue Seitenstruktur
**Dateien löschen/entfernen:**
- `src/lib/football-tracker.ts`
- `src/lib/live-stats-engine.ts`
- `src/lib/highlight-recorder.ts`
- `src/components/TrackingOverlay.tsx`
- `src/components/PitchVisualization.tsx`
- `src/pages/TrackingPage.tsx`
- `supabase/functions/analyze-frame/`
- `supabase/functions/stream-tracking/`

**Seiten anpassen:**
- `CameraTrackingPage.tsx` → wird zu `RecordMatchPage.tsx` (nur Video aufnehmen + hochladen)
- `NewMatch.tsx` → vereinfachen (Team, Gegner, Datum, Altersklasse — fertig in 30 Sekunden)
- Neue Seite: `ProcessingPage.tsx` (Premium-Wartescreen mit Roadmap)
- `MatchReport.tsx` → komplett neu als Coaching-Report (keine Spieler-Tracking-KPIs)

**Navigation aktualisieren:**
- Hauptnav: Dashboard, Spiele, Neues Spiel, Verlauf
- Entfernen: Fields-Kalibrierung, Camera-Tracking-Komplexität

### Phase B — Neues Datenmodell (Migration)

Neue Tabellen:
```sql
-- Video-Uploads (ersetzt das komplizierte tracking_uploads)
CREATE TABLE match_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  club_id uuid NOT NULL,
  file_path text NOT NULL,
  duration_sec integer,
  file_size_bytes bigint,
  status text NOT NULL DEFAULT 'uploaded', -- uploaded, processing, ready, error
  created_at timestamptz DEFAULT now()
);

-- Analyse-Jobs
CREATE TABLE analysis_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  video_id uuid REFERENCES match_videos(id),
  status text NOT NULL DEFAULT 'queued', -- queued, analyzing, interpreting, complete, failed
  progress integer DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Analyse-Ergebnisse (strukturiert, nicht rohe Detections)
CREATE TABLE analysis_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES analysis_jobs(id) ON DELETE CASCADE,
  match_id uuid NOT NULL,
  result_type text NOT NULL, -- 'match_structure', 'danger_zones', 'momentum', 'chances'
  data jsonb NOT NULL DEFAULT '{}',
  confidence numeric, -- 0-1
  created_at timestamptz DEFAULT now()
);

-- Report-Sektionen (AI-generiert)
CREATE TABLE report_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  section_type text NOT NULL, -- 'summary', 'insights', 'patterns', 'coaching', 'training'
  title text NOT NULL,
  content text NOT NULL,
  confidence text DEFAULT 'high', -- high, medium, estimated
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Trainingsempfehlungen
CREATE TABLE training_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  club_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  priority integer DEFAULT 1, -- 1=hoch, 3=niedrig
  category text, -- 'offense', 'defense', 'transition', 'set_piece'
  linked_pattern text, -- Referenz auf erkanntes Muster
  created_at timestamptz DEFAULT now()
);
```

RLS-Policies für alle neuen Tabellen (Club-basiert wie bestehende Tabellen).

### Phase C — Upload & Analyse-Flow

**Neuer Upload-Flow (simpel):**
1. Match anlegen (30 Sekunden: Team, Gegner, Datum)
2. Video hochladen ODER mit Handy aufnehmen → Supabase Storage `match-videos` Bucket
3. `match_videos` Eintrag erstellen
4. `analysis_jobs` Job erstellen → Status `queued`

**Neue Edge Function: `analyze-match`**
- Nimmt Video aus Storage
- Sampelt 1 Frame alle 30 Sekunden (statt 2.5s Echtzeit)
- Sendet Batch an Gemini 2.5 Flash mit strukturiertem Tool Calling
- Prompt fokussiert auf Match-Struktur, nicht Spieler-IDs:
  - "Wo wird angegriffen?"
  - "Wo entstehen Chancen?"
  - "Wo gehen Bälle verloren?"
  - "Momentum-Verlauf?"
- Speichert `analysis_results` nach Typ

**Neue Edge Function: `generate-insights`**
- Liest `analysis_results`
- Sendet an GPT-5 / Gemini Pro mit Coaching-Prompt
- Generiert: Executive Summary, 3-5 Key Insights, Coaching Conclusions, Training Recommendations
- Speichert in `report_sections` + `training_recommendations`

### Phase D — Neuer Match Report

**Report-Seite komplett neu:**
1. **Match-Header** (Teams, Datum, Ergebnis)
2. **Executive Summary** (1 Absatz, AI-generiert)
3. **Key Insights** (3-5 Karten mit Icons)
4. **Visuelle Muster** (Angriffsrichtung-Grafik, Gefährdungszonen-Heatmap — einfach, nicht fake-präzise)
5. **Coaching-Schlussfolgerungen** (was bedeutet das für den Trainer?)
6. **Trainingsempfehlungen** (konkrete Übungen/Schwerpunkte)
7. **Confidence-Hinweis** (transparent: "Analyse basiert auf Video-Sampling, nicht GPS-Tracking")

Jede Sektion zeigt Confidence-Level. Bei niedrigem Vertrauen: "Geschätzt" Badge.

### Phase E — Dashboard & B2B

**Dashboard neu:**
- Willkommen + Quick Action "Neues Spiel"
- Letzte 3 Matches mit Status
- Aktuelle Trainingsempfehlungen (aggregiert)
- Trend über letzte 5 Spiele (einfacher Fortschritts-Indikator)

**Club Admin (bestehend, anpassen):**
- Team-Verwaltung bleibt
- Matches-Übersicht mit Analyse-Status
- Abo-Verwaltung (Pricing-Seite existiert bereits)

## Betroffene Dateien (Zusammenfassung)

| Aktion | Dateien |
|--------|---------|
| Löschen | `football-tracker.ts`, `live-stats-engine.ts`, `highlight-recorder.ts`, `TrackingOverlay.tsx`, `PitchVisualization.tsx`, `TrackingPage.tsx`, `analyze-frame/`, `stream-tracking/` |
| Stark vereinfachen | `CameraTrackingPage.tsx` → `RecordMatchPage.tsx`, `NewMatch.tsx`, `MatchReport.tsx` |
| Neu erstellen | `ProcessingPage.tsx`, `analyze-match/index.ts`, `generate-insights/index.ts` |
| Anpassen | `Dashboard.tsx`, `AppLayout.tsx`, `App.tsx` (Routen), `CoachSummary.tsx`, `MatchCharts.tsx` |
| Migration | 1 SQL-Migration für neue Tabellen + RLS |
| Entfernen (Edge Fn) | `analyze-frame`, `stream-tracking`, `process-tracking` (ersetzt durch `analyze-match`) |

## Erwartetes Ergebnis

- **30 Sekunden** bis zum gestarteten Upload
- **Keine fake Spieler-Tracking-Metriken**
- **Vertrauenswürdige Match-Level-Insights**
- **Sofort nützliche Trainingsempfehlungen**
- **Premium-Look, brutal einfach**

## Empfehlung zur Umsetzung

Ich empfehle **Phase A + B zusammen** (Aufräumen + neues Datenmodell), dann **Phase C** (Upload-Flow), dann **Phase D** (Report). Das gibt nach 3 Runden ein funktionierendes MVP.

