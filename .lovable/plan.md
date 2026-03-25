

# Video-Highlights Feature — Implementierungsplan

## Überblick

Parallele Video-Aufnahme via MediaRecorder während des Frame-Captures. Bei Match-Events (Tor, Karte, Chance) werden 20s-Highlight-Clips extrahiert und in den `match-videos` Bucket gespeichert. Das Feature wird über das bestehende `app_modules`-System gesteuert — nur Admins können es per Modul "video_highlights" für Vereine freischalten.

## Datenbank-Änderungen

1. **`match_videos` Tabelle erweitern**: Neue Spalten `event_type text`, `event_minute integer`, `video_type text DEFAULT 'highlight'` um Highlights von vollen Videos zu unterscheiden
2. **`app_modules` Insert**: Neuen Modul-Eintrag `video_highlights` einfügen (standardmäßig inaktiv)
3. **RLS für `match_videos`**: DELETE-Policy für Club-Mitglieder hinzufügen (Cleanup)

## Neue Dateien

### `src/lib/video-recorder.ts`
Ring-Buffer-basierter Video-Recorder:
- `MediaRecorder` mit `video/webm;codecs=vp9` (Fallback `video/mp4`)
- 10s-Chunks via `ondataavailable` in Ring-Buffer (letzte 30s = 3 Chunks)
- `extractHighlight(eventType, minute)` → nimmt Buffer-Inhalt, erstellt 15-20s Blob
- `stop()` → räumt auf, gibt nichts zurück (kein Full-Game-Video)
- Max 20 Highlights, 480p Auflösung

### `src/components/MatchEventQuickBar.tsx`
Floating Action Bar während der Aufnahme:
- Nur sichtbar wenn `video_highlights` Modul aktiv
- Quick-Buttons: ⚽ Tor, 🟡 Karte, 📐 Ecke, ⚡ Chance
- Bei Tap: Event in `match_events` speichern + Highlight aus Ring-Buffer extrahieren + Upload nach `match-videos/{matchId}/highlight_{type}_{minute}.webm`
- Haptic Feedback + Toast "Highlight gespeichert ✓"

### `src/components/HighlightGallery.tsx`
Galerie-Komponente für Match-Report:
- Listet alle Highlights eines Spiels aus `match_videos` WHERE `video_type = 'highlight'`
- Video-Player inline, Download-Button
- Nur sichtbar wenn Modul aktiv

## Geänderte Dateien

### `src/pages/CameraTrackingPage.tsx`
- Ring-Buffer-Recorder parallel zu Frame-Capture starten
- `MatchEventQuickBar` einbinden (nur wenn Modul aktiv)
- Bei Stop: Recorder cleanup

### `src/pages/NewMatch.tsx`
- Gleiche Integration für den Record-Modus

### `src/pages/MatchReport.tsx`
- `HighlightGallery` als neuen Abschnitt nach Tactical Replay einfügen
- Modul-Check: nur anzeigen wenn `video_highlights` aktiv

## Admin-Steuerung

Das `app_modules`-System ist bereits vollständig implementiert mit `can_access_module()` DB-Funktion. Der Admin kann im Admin-Panel unter dem bestehenden Modul-Management das Feature "Video-Highlights" pro Verein oder Plan aktivieren/deaktivieren. Es wird lediglich ein neuer Datensatz in `app_modules` eingefügt — kein neues Admin-UI nötig.

## Technische Details

- **Browser-Support**: `MediaRecorder` ist in allen modernen Browsern verfügbar; MIME-Type-Check mit Fallback
- **RAM**: Ring-Buffer hält ~30s bei 480p ≈ 5-10MB — kein Problem
- **Storage**: ~20 Clips × 5-10MB = 100-200MB pro Spiel im `match-videos` Bucket
- **Cleanup**: Bestehende `cleanup-highlights` Edge Function (bereits in config.toml) kann für 7-Tage-Policy genutzt werden

