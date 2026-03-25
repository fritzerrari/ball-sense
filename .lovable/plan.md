

## Tiefenanalyse: Warum KPIs leer sind und Heatmaps falsch

### Identifizierte Kernprobleme (aus DB-Analyse)

**1. Alle taktischen KPIs sind 0 — Bug in `estimateTacticalStats`**

Die Funktion hat einen Guard `if (positions.length < 5 || minutesPlayed < 1) return empty`. Bei kurzen Aufnahmen (26 Sekunden) ist `minutes_played = 0` (gerundet von 0.43), daher werden ALLE taktischen Stats (Paesse, Zweikampfe, Ballkontakte, Schuesse) sofort auf 0 gesetzt — obwohl Ballpositions-Daten vorhanden sind (`ball_detections_available: true`).

**2. Fortschrittsanzeige zeigt 100% Datenqualitaet trotz "Vorlaeufig"**

`processing_progress.progress = 100` (= Verarbeitung abgeschlossen) wird als `actualProgress` an die `AnalysisStatusBanner` uebergeben. Die Banner-Logik zeigt dann "Datenqualitaet 100%" — aber das ist die PROCESSING-Fortschritt, nicht die DATEN-Qualitaet. Bei 39% Feldabdeckung sollte die Qualitaet ~39% sein, nicht 100%.

**3. `analyze-frame` Edge Function hat NULL Logs**

Das bedeutet: waehrend des Live-Trackings kommt kein einziger Frame-Analyse-Aufruf beim Server an. Moegliche Ursache: der `ANALYZE_FRAME_URL` im Client enthalt keinen API-Key/Authorization-Header. Die Edge Function erwartet das aber nicht explizit (kein Auth-Check), also ist es wahrscheinlicher ein CORS- oder URL-Problem bei der Konfiguration.

**4. Heatmaps basieren auf nur 26 Frames mit 39% Abdeckung**

Die Detections kommen zwar an (15 Tracks erkannt), aber die Dichte ist extrem gering. Dazu werden alle Tracks mit `assignment_confidence: 0.1` (minimaler Wert) zugeordnet — die Zuordnung ist also fast zufaellig.

**5. Zwei separate Konzepte werden vermischt: Processing-Progress vs. Daten-Qualitaet**

Der User sieht "100% Datenqualitaet" + "WIRD KORRIGIERT" + "39% Feld" gleichzeitig — das ist widersprüchlich und verwirrend.

---

### Loesung

#### Fix 1: `minutesPlayed`-Guard in `estimateTacticalStats` reparieren

Statt `minutesPlayed < 1` → `positions.length < 5` als einzigen Guard nutzen. Die Funktion kann auch bei Aufnahmen unter 1 Minute sinnvolle Proximity-Heuristiken berechnen, wenn genuegend Positionen vorhanden sind.

**Datei**: `supabase/functions/process-tracking/index.ts` (Zeile 332)

#### Fix 2: Datenqualitaet ≠ Processing-Progress trennen

Neue Logik: Datenqualitaet = `coverageRatio * confidence * dataDensity`. Nicht mehr `processing_progress.progress` als `actualProgress` uebergeben. Stattdessen einen separaten `dataQuality`-Wert berechnen:
- Coverage-Ratio (39% in diesem Fall)
- Durchschnittliche Assignment-Confidence
- Frame-Dichte (Frames pro Minute)

In `MatchReport.tsx`: den Progress-Balken aus coverage_ratio berechnen, NICHT aus processing_progress.

**Dateien**: `src/pages/MatchReport.tsx`, `src/components/AnalysisStatusBanner.tsx`

#### Fix 3: `analyze-frame` Aufruf debuggen und reparieren

Der `ANALYZE_FRAME_URL` in `football-tracker.ts` wird nur aufgerufen, wenn der Tracker laeuft. Aber es gibt keine Logs — das heisst der Aufruf scheitert still. Moegliche Ursachen:
- Der Aufruf hat keinen Authorization-Header → Edge Function braucht keinen (kein Auth-Check im Code), aber die Supabase-Gateway koennte ihn blocken wenn `verify_jwt` nicht auf `false` steht
- Die URL wird falsch zusammengesetzt wenn `VITE_SUPABASE_URL` leer ist

Pruefen und fixen: `verify_jwt = false` in config.toml fuer `analyze-frame` sicherstellen + Anon-Key als Authorization-Header mitsenden.

**Dateien**: `src/lib/football-tracker.ts`, `supabase/config.toml`

#### Fix 4: `minutes_played` bei kurzen Aufnahmen korrekt berechnen

Statt `Math.round(durationMs / 60000)` (= 0 bei 26s) → `Math.max(1, Math.round(durationMs / 60000))` oder Dezimalwert verwenden: `Math.round(durationMs / 6000) / 10` (= 0.4 min).

**Datei**: `supabase/functions/process-tracking/index.ts`

#### Fix 5: Datenqualitaets-Indikator richtig berechnen

Neuer Qualitaetswert im Processing-Output:
```
data_quality = min(100, round(
  coverageRatio * 40 +
  (assignedPlayers / expectedPlayers) * 30 +
  min(1, framesPerMinute / 60) * 30
))
```

Dieser Wert wird im Banner als "Datenqualitaet" angezeigt statt der Processing-Progress.

---

### Technische Details

**estimateTacticalStats Guard-Fix (process-tracking):**
```typescript
// ALT: if (positions.length < 5 || minutesPlayed < 1) return empty;
// NEU: nur Positionsanzahl pruefen, nicht Spielzeit
if (positions.length < 5) return empty;
```

**minutes_played Fix:**
```typescript
// ALT: minutes_played: Math.round(durationMs / 60000),
// NEU: Mindestens 1 Minute, damit Downstream-Logik nicht bricht
minutes_played: Math.max(1, Math.round(durationMs / 60000)),
```

**Datenqualitaet statt Processing-Progress (MatchReport.tsx):**
```typescript
const dataQuality = Math.round(
  coverageRatio * 40 +
  Math.min(1, (playerStats?.length ?? 0) / 14) * 30 +
  Math.min(1, (framesAnalyzed ?? 0) / 100) * 30
);

<AnalysisStatusBanner
  actualProgress={dataQuality}  // statt processing_progress.progress
  ...
/>
```

**analyze-frame Auth-Header (football-tracker.ts):**
```typescript
const resp = await fetch(ANALYZE_FRAME_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
  },
  body: JSON.stringify({ imageBase64, matchId, cameraIndex }),
});
```

### Dateien

| Datei | Aenderung |
|-------|-----------|
| `supabase/functions/process-tracking/index.ts` | minutesPlayed Guard fix, minutes_played min 1, dataQuality Output |
| `src/lib/football-tracker.ts` | apikey Header bei analyze-frame Aufruf |
| `src/pages/MatchReport.tsx` | dataQuality berechnen statt processing_progress |
| `src/components/AnalysisStatusBanner.tsx` | Label "Datenqualitaet" korrekt anzeigen |
| `supabase/config.toml` | verify_jwt = false fuer analyze-frame pruefen |

### Prioritaet

1. minutesPlayed Guard + minutes_played Fix (sofort — behebt leere KPIs)
2. analyze-frame Auth-Header (ohne das kommt keine echte AI-Analyse an)
3. Datenqualitaet vs Processing-Progress trennen
4. dataQuality-Formel implementieren

