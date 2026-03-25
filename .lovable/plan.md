

# Fix: Analyse haengt bei 85% + Geschwindigkeitsoptimierung

## Diagnose

### 1. Analyse bleibt bei 85% haengen — ROOT CAUSE gefunden
`analyze-match` setzt bei Zeile 406 den Status auf `"interpreting"` mit `progress: 85`. Danach ist die Edge Function FERTIG und gibt Response zurueck.

Die `generate-insights` Funktion wird NICHT vom Server aufgerufen, sondern vom **Client** in `ProcessingPage.tsx` (Zeile 46-50): Wenn der Polling-Interval `status === "interpreting"` erkennt, ruft er `supabase.functions.invoke("generate-insights")` auf.

**Problem**: `generate-insights` hat KEINE Logs — wurde nie aufgerufen. Moegliche Gruende:
- Der Kamera-Helfer sieht die ProcessingPage nie (er ist auf der CameraTrackingPage)
- Der Trainer hat die ProcessingPage vielleicht nicht offen
- Der Client-seitige Trigger ist fragil (Browser-Tab geschlossen, Navigation weg, etc.)

### 2. Analyse dauert zu lange fuer 45-Minuten-Spiele
Aktueller Flow: ALLE Frames werden NACH dem Stoppen in einem Batch hochgeladen und analysiert. Bei 45 Min = ~90 Frames → Upload von ~4.5MB + ein grosser AI-Call mit 20 Bildern + ein zweiter AI-Call fuer Insights = potenziell 5-10 Minuten Wartezeit.

### 3. Wenige Daten (1 Minute = 2-3 Frames)
Bei nur 2-3 Frames ist die AI-Analyse trotzdem moeglich, aber der Payload ist winzig. Das Problem ist eher, dass `generate-insights` nie getriggert wird (siehe Punkt 1).

## Loesung

### A. KRITISCH: Server-seitige Verkettung (Fix 85%-Bug)

**`analyze-match/index.ts`** — Am Ende (nach dem Speichern der Ergebnisse) direkt `generate-insights` server-seitig aufrufen statt auf den Client zu warten:

```
// Statt: status = "interpreting" setzen und auf Client warten
// Neu: Direkt generate-insights aufrufen (fire-and-forget via fetch)
fetch(`${supabaseUrl}/functions/v1/generate-insights`, {
  method: "POST",
  headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({ match_id, job_id }),
}).catch(err => console.error("generate-insights trigger error:", err));
```

Status-Flow wird: `queued → analyzing → interpreting → complete` (alles server-seitig).

**`ProcessingPage.tsx`** — Client-seitigen Trigger als Fallback beibehalten, aber nicht mehr als primaeren Mechanismus.

### B. Inkrementeller Frame-Upload waehrend der Aufnahme

Statt alle Frames am Ende hochzuladen, werden Frames waehrend der Aufnahme in Batches gesendet:

**`CameraTrackingPage.tsx`** — Neuer Interval (alle 5 Frames / ~2.5 Min):
- Snapshot der neuen Frames seit letztem Upload
- Upload via `camera-ops` mit `action: "append-frames"` (neue Action)
- Server haengt Frames an bestehende Datei an oder erstellt Chunk-Dateien

**`camera-ops/index.ts`** — Neue Action `"append-frames"`:
- Empfaengt nur die NEUEN Frames seit letztem Upload (Delta)
- Speichert als `{matchId}_chunk_{n}.json` im Storage
- Aktualisiert Session-Status mit aktuellem Frame-Count

**Vorteil**: Am Ende der Aufnahme muessen nur die letzten paar Frames hochgeladen werden statt aller 90. Upload-Zeit sinkt von Minuten auf Sekunden.

### C. Schnelle Analyse bei wenigen Frames

**`analyze-match/index.ts`** — Wenn < 5 Frames:
- Leichtgewichtigeres Modell verwenden (`gemini-2.5-flash-lite` statt `gemini-2.5-flash`)
- Reduzierter Prompt (keine Pressing-/Transitions-Analyse, nur Grundstruktur)
- Ergebnis in < 30 Sekunden statt Minuten

### D. Live-Thumbnail fuer Trainer (leichtgewichtig)

Kein volles Video-Streaming (zu teuer/komplex), sondern ein aktuelles Standbild alle 30 Sekunden:

**`CameraTrackingPage.tsx`** — Im Heartbeat den aktuellsten Frame als Base64-Thumbnail mitsenden (stark komprimiert, ~10KB).

**`camera-ops/index.ts`** — Heartbeat speichert Thumbnail in `status_data.thumbnail`.

**`CameraRemotePanel.tsx`** — Zeigt das letzte Thumbnail als Live-Vorschau an.

## Betroffene Dateien

| Datei | Aenderung |
|---|---|
| `supabase/functions/analyze-match/index.ts` | Server-seitig generate-insights aufrufen statt Client-Trigger; leichtgewichtiger Modus fuer < 5 Frames |
| `supabase/functions/camera-ops/index.ts` | Neue Action `append-frames`; Thumbnail im Heartbeat speichern |
| `src/pages/CameraTrackingPage.tsx` | Inkrementeller Frame-Upload alle 5 Frames; Thumbnail im Heartbeat |
| `src/pages/ProcessingPage.tsx` | Client-Trigger als Fallback beibehalten, nicht primaer |
| `src/components/CameraRemotePanel.tsx` | Live-Thumbnail-Vorschau anzeigen |
| `src/lib/frame-capture.ts` | `getNewFramesSince(index)` Methode hinzufuegen fuer Delta-Upload |

Keine DB-Migration noetig — `status_data` (jsonb) kann Thumbnail direkt speichern.

