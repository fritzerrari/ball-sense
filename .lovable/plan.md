

## Video Highlight-Clips (paketabhängig)

### Status: Implementiert ✅

### Funktionsweise

- **Ring-Buffer Recording**: `HighlightRecorder` nutzt MediaRecorder mit 15s Ringpuffer + 5s Post-Event = 20s Clips
- **Highlight-Erkennung**: Ball in Torzone = Goal-Clip, Spieler-Speed > Threshold = Sprint-Clip
- **Max 20 Clips/Spiel** bei 480p ≈ 100-200 MB
- **Paketabhängig**: Prüfung via `can_access_module('video_highlights')` — nur aktiv wenn Modul freigeschaltet

### Auto-Löschung

- **Cron-Job** läuft täglich um 03:00 Uhr
- Löscht Highlight-Clips wenn:
  - 7 Tage seit dem Spiel vergangen sind ODER
  - Das nächste Spiel des Vereins bereits stattgefunden hat (auch wenn < 7 Tage)

### Dateien

- `src/lib/highlight-recorder.ts` — Ring-Buffer + Clip-Aufnahme + Upload
- `src/lib/football-tracker.ts` — Integration der Highlight-Erkennung
- `src/pages/CameraTrackingPage.tsx` — Modulprüfung + UI-Badge
- `supabase/functions/cleanup-highlights/index.ts` — Auto-Löschung
- `app_modules` Eintrag: `video_highlights`
