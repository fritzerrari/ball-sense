

# Stabileres Kamera-System: Live-Sync, Thumbnail & Optimierung

## Probleme identifiziert

1. **Thumbnail erst nach Spielende sichtbar**: Der Heartbeat sendet Thumbnails nur alle 15 Sekunden, aber die `CameraRemotePanel`-Komponente zeigt "unknown" als Status. Das `status_data`-Feld wird korrekt aktualisiert, ABER der Heartbeat laeuft nur waehrend `recording`, `halftime_pause` und `ready` — nicht waehrend `setup`. Ausserdem: Das erste Thumbnail kommt erst nach 15s Recording-Delay.

2. **Delta-Upload viel zu langsam**: Aktuell alle 150 Sekunden (2.5 Min) — das ist praktisch nutzlos. Frames kommen alle 30s, der Delta-Upload sollte nach jedem neuen Frame passieren.

3. **Kein visuelles Feedback** auf dem Handy, dass Daten live synchronisiert werden.

4. **Zu viele manuelle Schritte**: Setup-Overlay → Ready → "Aufnahme starten" Button → Recording. Der Helfer muss 3x klicken. Besser: Trainer gibt beim Code-Erstellen die Aufnahme frei, Helfer muss nur Kamera positionieren.

5. **Analyse-Pipeline langsam**: Alle Frames werden erst am Ende analysiert. Mit inkrementellen Chunks koennte die Analyse schon waehrend der Aufnahme starten.

## Plan

### A. Sofortiges Thumbnail ab Kamera-Start

**`CameraTrackingPage.tsx`**:
- Heartbeat sofort nach `initCamera()` starten (nicht erst bei Recording)
- Erstes Thumbnail direkt nach Kamera-Bereitschaft senden (Phase "ready")
- Heartbeat-Intervall von 15s auf **10s** reduzieren fuer schnelleres Feedback
- Thumbnail auch in `ready`-Phase senden (nicht nur `recording`)

### B. Echtzeit Delta-Sync mit Status-Anzeige

**`CameraTrackingPage.tsx`**:
- Delta-Upload-Intervall von 150s auf **45s** reduzieren (nach jedem neuen Frame + Puffer)
- Delta-Upload auch fuer authentifizierte Trainer aktivieren (nicht nur Helper)
- Neuer State `syncedFrames` — zeigt an wie viele Frames bereits synchronisiert sind
- Visuelles Feedback auf dem Handy-Bildschirm: gruener Sync-Indikator mit "3/5 synchronisiert"

**`camera-ops/index.ts`** — `append-frames` Action:
- Nach erfolgreichem Chunk-Upload: `status_data.synced_frames` aktualisieren
- Trainer sieht in `CameraRemotePanel` den Sync-Fortschritt

### C. Vereinfachter Kamera-Flow (weniger Klicks)

**`CameraTrackingPage.tsx`**:
- Nach Code-Eingabe: Kamera-Setup-Overlay zeigen, aber Kamera SOFORT initialisieren (parallel)
- "Aufnahme starten" im Setup-Overlay startet direkt die Aufnahme (kein separater "Ready"-Screen)
- Ready-Phase wird uebersprungen wenn Trainer den Start-Befehl remote sendet
- Setup-Phase merged mit Ready: Kamera laeuft im Hintergrund, Tipps werden als Overlay gezeigt

### D. Live-Sync Anzeige auf Trainer-Dashboard

**`CameraRemotePanel.tsx`**:
- Sync-Status anzeigen: "5 Frames synchronisiert" mit Fortschrittsbalken
- Thumbnail automatisch alle 10s aktualisieren (Realtime-Subscription existiert bereits)
- Status-Text verbessern: "Aufnahme · 12 Frames · 5 synchronisiert"
- Wenn Thumbnail vorhanden: automatisch anzeigen (auch in Ready-Phase)

### E. Live-Daten-Verarbeitung waehrend der Aufnahme

**`camera-ops/index.ts`** — Neue Logik in `append-frames`:
- Nach dem Speichern eines Chunks: Pruefen ob genug Frames fuer eine Zwischen-Analyse vorhanden sind (>= 5 Frames total)
- Wenn ja: `analyze-match` fire-and-forget mit den bisherigen Chunk-Dateien triggern
- Analyse-Job mit `status: "live_partial"` markieren um Teil-Analysen von End-Analysen zu unterscheiden
- Trainer sieht auf dem Dashboard sofort erste Ergebnisse nach ~3 Minuten

**`analyze-match/index.ts`**:
- Wenn `phase === "live_partial"`: Chunk-Dateien aus Storage zusammenfuehren
- Leichteres Modell (`gemini-2.5-flash-lite`) fuer Zwischen-Analysen
- Reduzierter Prompt (nur Grundstruktur + Formationserkennung, kein vollstaendiger Report)

### F. Robustere Fehlerbehandlung

**`CameraTrackingPage.tsx`**:
- Bei Upload-Fehler: Automatischer Retry nach 30s (max 3 Versuche)
- Wenn Helfer offline geht: Frames lokal puffern, bei Reconnect automatisch nachsenden
- Toast-Nachrichten klarer: "Frame 5 synchronisiert" statt generischer Fehler

## Betroffene Dateien

| Datei | Aenderung |
|---|---|
| `src/pages/CameraTrackingPage.tsx` | Sofortiger Heartbeat, schnellerer Delta-Sync (45s), Sync-Indikator UI, vereinfachter Flow, Retry-Logik |
| `src/components/CameraRemotePanel.tsx` | Sync-Fortschritt anzeigen, Thumbnail in Ready-Phase, bessere Status-Texte |
| `src/components/CameraSetupOverlay.tsx` | Kamera parallel starten, direkter Aufnahme-Start |
| `supabase/functions/camera-ops/index.ts` | append-frames: synced_frames tracken, optionale Live-Analyse triggern |
| `supabase/functions/analyze-match/index.ts` | live_partial Modus: Chunks zusammenfuehren, leichtes Modell |

Keine DB-Migration noetig — alle Daten passen in bestehende `status_data` (jsonb) und `match-frames` Storage.

