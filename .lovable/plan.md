

# Fix-Plan: Preview, 2. Halbzeit, System-Hardening + Tennis-Remix-Prompt

## Probleme identifiziert

1. **Preview fehlt sporadisch**: `registerSW({ immediate: true })` in `main.tsx` registriert aggressiv einen Service Worker, der im Preview-Host stale Content cached und 401er auf `manifest.json` verursacht.

2. **2. Halbzeit geht verloren** (2 Root Causes):
   - **Root Cause A**: `generate-insights` setzt nach JEDER Analyse (auch H1-Zwischenanalyse) den Match-Status auf `"done"` (Zeile 444) und löscht Frames, Sessions und Codes (Zeilen 465-499). Wenn H1 die Pipeline triggert, wird alles aufgeräumt bevor H2 überhaupt starten kann.
   - **Root Cause B**: `uploadDirect` (authentifizierter User) schreibt `_h1.json` / `_h2.json` separat, aktualisiert aber NICHT die kanonische `${matchId}.json`. Wenn `analyze-match` für H2 läuft, fehlt H1 in den Inline-Frames und die kanonische Datei existiert nicht → nur H2 wird analysiert.

3. **`uploadDirect` sendet Inline-Frames**: Statt `analyze-match` die kanonische Datei laden zu lassen, werden Frames inline gesendet. Das ist inkonsistent mit dem Helper-Flow (camera-ops), der seit dem letzten Fix keine Inline-Frames mehr sendet.

---

## Umsetzung

### Schritt 1: Preview-Stabilität (`src/main.tsx`)
- PWA-Registrierung nur ausführen wenn NICHT im Preview-Host (`id-preview--` in hostname).
- Verhindert SW-Interferenz in der Lovable-Preview.

### Schritt 2: Cleanup nur bei Final-Analyse (`supabase/functions/generate-insights/index.ts`)
- **Job-Kind prüfen**: Vor dem Cleanup den `job_kind` des aktuellen Jobs laden. Nur bei `job_kind = 'final'` oder wenn `recording_ended_at` gesetzt ist:
  - Match auf `"done"` setzen
  - Frames löschen
  - Sessions/Codes aufräumen
- Bei `live_partial` oder H1-Zwischenanalyse (kein `recording_ended_at`):
  - Job auf `complete` setzen
  - Match-Status NICHT auf `"done"` → bleibt auf `"processing"`
  - KEIN Cleanup

### Schritt 3: `uploadDirect` kanonische Datei pflegen (`src/pages/CameraTrackingPage.tsx`)
- Nach dem Upload von `_h1.json` oder `_h2.json`: auch die kanonische `${matchId}.json` aktualisieren (bestehende Frames laden + neue anhängen, analog zu `updateCanonicalFrameFile` in camera-ops).
- Inline-Frames NICHT mehr an `analyze-match` senden (wie im Helper-Flow). `analyze-match` lädt automatisch aus Storage.
- `job_kind: "final"` nur bei Stop (Ende Spiel) setzen, bei H1 als Zwischenanalyse kennzeichnen.

### Schritt 4: Job-Kind-Konsistenz
- `uploadDirect` bei H1-Upload: `job_kind` auf `"h1_intermediate"` setzen (nicht `"final"`).
- `uploadDirect` bei finalem Stop: `job_kind` auf `"final"` setzen.
- `generate-insights` prüft `job_kind` und entscheidet Cleanup-Verhalten.

---

## Technische Details

### `src/main.tsx`
```text
if (!window.location.hostname.includes("id-preview--")) {
  registerSW({ immediate: true, ... });
}
```

### `generate-insights/index.ts` (Zeilen 436-499)
```text
// Job-Kind laden
const { data: currentJob } = await supabase
  .from("analysis_jobs")
  .select("job_kind")
  .eq("id", job_id)
  .single();

const isFinalJob = currentJob?.job_kind === "final";
const { data: matchTiming } = await supabase
  .from("matches")
  .select("recording_ended_at")
  .eq("id", match_id)
  .single();
const isMatchFinished = !!matchTiming?.recording_ended_at;
const shouldCleanup = isFinalJob || isMatchFinished;

// Match-Status nur bei Final
if (shouldCleanup) {
  await supabase.from("matches").update({ status: "done" }).eq("id", match_id);
  // ... Cleanup Frames, Sessions, Codes
} else {
  // Zwischenanalyse: Match bleibt auf "processing"
}
```

### `CameraTrackingPage.tsx` — `uploadDirect`
```text
// 1. Upload phase-spezifische Datei (_h1, _h2, full)
// 2. Kanonische Datei aktualisieren (merge)
// 3. analyze-match OHNE inline frames aufrufen
// 4. job_kind = phaseStr === "h1" ? "h1_intermediate" : "final"
```

---

## Tennis-Remix-Prompt

Hier ist der Prompt, den du in einem Remix des Projekts verwenden kannst:

> **Prompt für Lovable (Tennis-Umbau):**
>
> Dieses Projekt ist ein KI-gestütztes Fußball-Analyse-Tool (FieldIQ). Ich möchte es komplett auf **Tennis** umbauen. Bitte folgende Änderungen durchführen:
>
> 1. **Branding**: App-Name von "FieldIQ" auf "CourtIQ" (oder ähnlich) ändern. Alle Referenzen in Landing Page, Manifest, Meta-Tags, Footer anpassen. Farbschema auf Tennis-typisch (Grün/Weiß/Gelb) umstellen.
>
> 2. **Spiellogik**: Matches haben keine Halbzeiten sondern **Sätze** (Sets) und **Games**. Ersetze `h1_started_at/h1_ended_at/h2_started_at/h2_ended_at` durch `sets`-Array mit Start/End-Zeiten. Ein Match hat 2-3 Sätze (Best of 3) oder 3-5 (Best of 5). Spielstand-Tracking: Games und Punkte (0, 15, 30, 40, Deuce, Advantage).
>
> 3. **Event-Typen**: Ersetze Fußball-Events (goal, card, foul, corner, offside, freekick, substitution, penalty) durch Tennis-Events: **ace, double_fault, winner, unforced_error, break_point, break, set_won, challenge, medical_timeout**. Passe `MatchEventQuickBar` entsprechend an.
>
> 4. **Analyse-Prompts**: Alle KI-Prompts in `analyze-match` und `generate-insights` Edge Functions auf Tennis umschreiben. Statt Formationen/Pressing/Ballbesitz analysiere: **Aufschlagquote, Return-Qualität, Netzangriffe, Laufwege, Platzabdeckung, Fehlerverteilung (Vorhand/Rückhand), Serve-and-Volley-Frequenz, Breakpoint-Conversion**. Taktische Grades: serve, return, net_play, baseline, mental_strength, fitness statt pressing/build_up/etc.
>
> 5. **Spielfeld-Visualisierung**: Ersetze das Fußballfeld (grünes Rechteck mit Mittelkreis/Strafraum) durch ein **Tennisfeld** (Court-Linien, Netz, Service-Boxen, Grundlinie). Passe `TacticalReplayField`, `HeatmapField`, `PassDirectionMap` an Tennis-Court-Geometrie an. Nur 2 Spieler (Singles) oder 4 (Doubles) statt 22.
>
> 6. **Formations entfernen**: Tennis hat keine Formationen. Entferne `FormationTimeline`, `formation_timeline` aus der Analyse. Ersetze durch **Positionierungs-Analyse**: Grundlinienposition, Netzposition, Aufschlagposition.
>
> 7. **Trainingsempfehlungen**: Statt Mannschaftstaktik → individuelle Trainingseinheiten: Aufschlagtraining, Return-Drills, Netzspiel-Übungen, Kondition, mentale Stärke.
>
> 8. **Gegner-DNA**: Statt possession_control/pressing_intensity → **serve_power, return_depth, net_approach_frequency, baseline_consistency, mental_resilience, fitness_level**.
>
> 9. **Datenbank**: Passe die `matches`-Tabelle an (Satz-Ergebnisse statt Halbzeiten, `sport_type = 'tennis'`). `players`-Tabelle: Position-Feld entfernen (oder auf "Singles"/"Doubles" ändern). Team-Konzept optional entfernen oder auf "Spieler" umstellen.
>
> 10. **Kamera-Tracking**: Aufnahme-Flow beibehalten, aber Satz-Pausen statt Halbzeit-Pause. Frame-Analyse soll Spielerposition auf dem Court erkennen (nur 2-4 Personen + Schiedsrichter).
>
> 11. **Landing Page**: Alle Fußball-Bilder und -Texte durch Tennis-Inhalte ersetzen. Features beschreiben: "Analysiere dein Tennismatch mit KI", "Aufschlag-Statistiken", "Gegner-Scouting für Tennis".
>
> 12. **Sprache**: Alle deutschen UI-Texte beibehalten, aber Fußball-Terminologie durch Tennis ersetzen (z.B. "Tor" → "Ass", "Ecke" → "Breakball", "Trainer" → "Coach/Spieler").

---

## Zusammenfassung Dateien

| Datei | Änderung |
|---|---|
| `src/main.tsx` | PWA nur außerhalb Preview registrieren |
| `supabase/functions/generate-insights/index.ts` | Cleanup nur bei `final` Job / Match beendet |
| `src/pages/CameraTrackingPage.tsx` | Kanonische Datei pflegen, keine Inline-Frames, job_kind differenzieren |

