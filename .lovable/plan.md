

# Komplette Überarbeitung: Match-Erstellung & Kamera-Tracking UX

## Problem

Aktuell gibt es zwei getrennte, unklare User-Journeys:

1. **Trainer/Admin** (Desktop/App): Erstellt Spiel in `NewMatch.tsx` (2 Steps: Info → Upload), kann dort auch direkt aufnehmen. Kamera-Codes werden separat in Settings verwaltet. Es fehlt der Zusammenhang zwischen "Spiel anlegen" und "Code an Helfer weitergeben".

2. **Kamera-Helfer** (PWA auf Handy): Gibt Code auf Login-Seite ein → wird zu `CameraTrackingPage` weitergeleitet. Aber: Die `camera-access` Edge Function existiert noch gar nicht, d.h. der Code-Lookup schlägt fehl. Der Camera-Setup-Overlay zeigt nur Tipps, aber keinen Code-Eingabe-Schritt.

## Lösung: Zwei klar getrennte, idiotensichere Flows

### Flow A: Trainer erstellt Spiel (NewMatch Wizard)

Neuer 4-Step-Wizard mit großen, klaren Buttons und visuellen Fortschrittsbalken:

**Step 1 — "Gegner & Datum"** (wie bisher, vereinfacht)
- Nur 3 Felder: Gegner (optional), Datum (vorausgefüllt), Platz (auto-select wenn nur 1)
- Kein Kickoff-Feld (unnötig für Analyse)
- Großer "Weiter"-Button

**Step 2 — "Wie willst du aufnehmen?"** (NEU — zentraler Entscheidungsscreen)
- 3 große Kacheln zum Antippen:
  - **"Ich filme selbst"** → Icon: Smartphone mit Play → geht direkt zu Step 4 (Kamera)
  - **"Helfer filmt (Code senden)"** → Icon: QR/Schlüssel → geht zu Step 3 (Code generieren)
  - **"Video nachträglich hochladen"** → Icon: Upload → zeigt File-Upload-Bereich
- Jede Kachel hat 1-Zeilen-Beschreibung

**Step 3 — "Kamera-Code"** (NEU — nur bei "Helfer filmt")
- Automatisch wird ein 6-stelliger Code generiert und angezeigt (riesige Schrift)
- "Per WhatsApp teilen" / "Kopieren" Buttons
- Visuelle Anleitung: "Dein Helfer öffnet FieldIQ → gibt diesen Code ein → Kamera startet automatisch"
- "Weiteren Code erzeugen" für 2./3. Kamera
- "Fertig"-Button → zurück zum Match-Detail

**Step 4 — "Aufnahme"** (nur bei "Ich filme selbst")
- Direkt zur Kamera mit Tipps-Overlay (wie bisher)

### Flow B: Kamera-Helfer (PWA — Code-Eingabe)

Komplett neuer `CameraCodeEntry`-Fullscreen als erste Phase in `CameraTrackingPage`:

**Phase 1 — Code eingeben** (ersetzt den Login-Page-Camera-Tab)
- Fullscreen, kein Login nötig (das ist der Punkt!)
- Großes FieldIQ-Logo oben
- 6 einzelne Ziffernfelder (wie OTP-Input, nicht ein Textfeld)
- Auto-Submit bei 6. Ziffer
- Haptisches Feedback bei jeder Ziffer
- Fehlermeldung inline ("Code ungültig — frag deinen Trainer")
- Keine ablenkenden Tabs (Login/Register)

**Phase 2 — Kamera-Tipps** (wie bisher, CameraSetupOverlay)
- 3 antippbare Tipps
- "Aufnahme starten"-Button

**Phase 3 — Aufnahme** (wie bisher, aber vereinfacht)
- Großer roter REC-Indikator
- Frame-Counter
- Halbzeit-Button
- Stop-Button mit Bestätigung

### Neue Seite: `/camera` (ohne Match-ID)

Eigenständige Route für den Kamera-Helfer-Einstieg — kein Login nötig, kein Match-ID in der URL. Der Code bestimmt alles.

### Edge Function: `camera-access`

Neue Edge Function die den Code-Lookup, Session-Erstellung und Validierung übernimmt:
- `POST { action: "lookup", code: "123456" }` → hasht den Code, sucht in `camera_access_codes`, erstellt Session, gibt `matchId`, `cameraIndex`, `sessionToken` zurück
- Verify JWT = false (kein Login nötig)

## Betroffene Dateien

| Datei | Aktion |
|---|---|
| `src/pages/NewMatch.tsx` | Komplett überarbeiten: 4-Step-Wizard mit Entscheidungsscreen |
| `src/pages/CameraTrackingPage.tsx` | Code-Eingabe-Phase hinzufügen (OTP-Style), Login-Tab entfernen |
| `src/pages/Login.tsx` | Camera-Tab entfernen, stattdessen Link zu `/camera` |
| `src/components/CameraSetupOverlay.tsx` | Kleinere Optimierungen (größere Touch-Targets) |
| `src/components/CameraCodeEntry.tsx` | NEU — Fullscreen OTP-Code-Eingabe-Komponente |
| `src/components/MatchRecordingChoice.tsx` | NEU — 3-Kacheln-Entscheidungsscreen |
| `src/components/CameraCodeShare.tsx` | NEU — Code-Anzeige + WhatsApp/Copy-Sharing |
| `supabase/functions/camera-access/index.ts` | NEU — Edge Function für Code-Lookup |
| `src/App.tsx` | Route `/camera` hinzufügen (ohne `:id`) |

## Design-Prinzipien

- **Große Touch-Targets** (min. 48px) auf allen interaktiven Elementen
- **Maximal 1 Entscheidung pro Screen** — kein Scrollen nötig
- **Automatische Aktionen** wo möglich (Auto-Submit, Auto-Select, Auto-Focus)
- **Klare Fehlermeldungen** in einfacher Sprache ("Code falsch" statt "Hash-Validierung fehlgeschlagen")
- **Haptisches Feedback** bei allen wichtigen Interaktionen
- **Kein Text-Overload** — Icons + 1 Satz pro Element

