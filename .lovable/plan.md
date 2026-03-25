
Ziel: System zuerst stabil machen (keine Hänger/Fehler), dann Live-Flow sauber und schnell machen.

1) Sofort-Hotfix für aktuelle Fehler (Root Cause aus Logs)
- `generate-insights` reparieren: Das Tool-Schema ist aktuell ungültig (400 INVALID_ARGUMENT bei `training_recommendations.items.required`).  
  -> In `supabase/functions/generate-insights/index.ts` das Schema korrigieren (`items.type = "object"` + konsistente `properties/required`).
- Doppeltes Triggern vermeiden: `generate-insights` wird serverseitig bereits gestartet, der zusätzliche Client-Trigger in `src/pages/ProcessingPage.tsx` erzeugt Race Conditions.  
  -> Client-Trigger entfernen, Seite nur noch Status pollen.

2) „Keine Frames gefunden“ robust lösen
- Ursache: Retry/Reprocess lädt nur `${match_id}.json`, Helper-Flow schreibt aber oft `${match_id}_h1.json`, `${match_id}_h2.json`, `${match_id}_chunk_n.json`.
- Fix in `supabase/functions/analyze-match/index.ts`:
  - Fallback-Reihenfolge beim Laden:
    1. `${match_id}.json`
    2. Merge aus `_h1` + `_h2`
    3. Merge aller `_chunk_*`
  - Wenn Frames gefunden -> normal analysieren; nur dann „Keine Frames gefunden“ zurückgeben.
- Fix in `supabase/functions/camera-ops/index.ts`:
  - Bei `upload-frames` und `append-frames` zusätzlich eine kanonische Datei `${match_id}.json` fortlaufend pflegen (aggregierter Stand), damit Retry immer eine sichere Quelle hat.

3) Job-Orchestrierung stabilisieren (kein „durcheinander“)
- Live-Partial-Jobs entkoppeln, damit sie nicht den finalen Job verdrängen:
  - DB-Migration: `analysis_jobs.job_kind` (`final` | `live_partial`) + Index.
  - UI (`ProcessingPage`, `MatchReport`) zeigt/pollt nur `job_kind = 'final'`.
- Idempotenz einbauen:
  - Vor neuem finalen Job prüfen, ob bereits ein aktiver finaler Job läuft (`queued|analyzing|interpreting`), dann vorhandenen Job zurückgeben statt neu anzulegen.

4) Freigabe „Datenübertragung“ vom Hauptbildschirm
- DB-Migration: in `camera_access_sessions` `transfer_authorized boolean default false`, `transfer_authorized_at timestamptz`.
- Trainer-Flow:
  - In `src/components/CameraCodeShare.tsx` (bzw. Code-Step in `NewMatch`) aktive Helper-Session anzeigen + Schalter „Datenübertragung freigeben“.
- Helper-Flow (`src/pages/CameraTrackingPage.tsx`):
  - Nach Code-Eingabe/Kamera-Init sofort Heartbeat starten.
  - Wenn `transfer_authorized = false`: klarer Wartezustand („Warte auf Freigabe vom Trainer“), keine Aufnahme/Uploads.
  - Nach Freigabe: Aufnahme-Start sofort möglich.
- Remote-Panel (`src/components/CameraRemotePanel.tsx`):
  - Freigabestatus sichtbar, Start/Halbzeit/Stop nur bei freigegebener Session.

5) Live-Sichtbarkeit und Performance verbessern
- Kamera-Preview früher sichtbar:
  - In Setup-Phase Kamera direkt initialisieren, damit Trainer vor Spielbeginn Thumbnail sieht.
- Delta-Sync effizienter:
  - Statt nur starrem 45s-Timer: upload wenn neue Frames vorliegen + kurzer Fallback-Timer.
- Heartbeat leichter:
  - Thumbnail stärker komprimieren (kleineres Format/Qualität), Text-Heartbeat weiter regelmäßig.
- Mobiles Feedback erweitern:
  - „Erfasst / synchronisiert / ausstehend / letzter Sync“ als klare Statuszeile.

6) Technische Details (betroffene Dateien)
- Edge Functions:
  - `supabase/functions/generate-insights/index.ts`
  - `supabase/functions/analyze-match/index.ts`
  - `supabase/functions/camera-ops/index.ts`
- Frontend:
  - `src/pages/ProcessingPage.tsx`
  - `src/pages/CameraTrackingPage.tsx`
  - `src/components/CameraRemotePanel.tsx`
  - `src/components/CameraCodeShare.tsx`
  - `src/pages/NewMatch.tsx` (Code-Step Integration)
- Migrationen:
  - `analysis_jobs.job_kind` (+ Index)
  - `camera_access_sessions.transfer_authorized`, `transfer_authorized_at`

7) Abnahme-Tests (E2E)
- Kurzaufnahme (30–60s): kein Hänger, kein 85/90%-Stall, Abschluss auf `complete`.
- Retry ohne Neuaufnahme: funktioniert über Storage-Fallback.
- Halbzeit-Flow: finale Analyse nutzt beide Hälften (nicht nur H2).
- Trainer sieht Thumbnail vor Spielstart.
- Ohne Freigabe kein Upload/Start; nach Freigabe sofort live.
- Keine doppelten Insights-Jobs/keine widersprüchlichen Statusanzeigen.
