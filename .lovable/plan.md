

# Diagnose: Was fehlt und was falsch läuft

## Problem 1: Video wird hochgeladen, aber NIE benutzt

Das ist der größte Fehler. Der aktuelle Flow:

1. User nimmt Video auf oder lädt Datei hoch → **gesamtes Video geht in Supabase Storage** (ein 90-Min-Spiel = ~1.5 GB)
2. `analyze-match` Edge Function wird aufgerufen → **liest das Video NICHT**
3. Stattdessen schickt sie nur den Text "Match: Heim vs FC Musterstadt, Datum: 2026-03-25" an Gemini
4. Gemini **halluziniert** eine Analyse aus diesem Text — ohne je einen Frame gesehen zu haben

**Das Video wird also für nichts gebraucht.** Die gesamte "Analyse" ist eine Text-Halluzination.

## Problem 2: Analyse wird nach Upload nie gestartet

In `NewMatch.tsx` wird nach dem Upload ein `analysis_jobs`-Eintrag mit Status `queued` erstellt — aber `analyze-match` wird **nie aufgerufen**. Die Edge Function wird nur beim manuellen "Analyse starten"-Button im `MatchReport.tsx` getriggert. Der User wartet also auf der Processing-Seite ewig.

## Problem 3: Kein Speicher-Management

Jedes hochgeladene Video bleibt permanent in Storage. Keine Lösch-Policy, keine Größenbeschränkung.

---

## Was tatsächlich gebaut werden muss

### Architektur-Entscheidung: Kein Video-Upload nötig

Da Gemini Vision keine Videos aus Supabase Storage lesen kann (Edge Functions haben kein ffmpeg, kein Video-Decoder), gibt es zwei realistische Optionen:

**Option A — Frame-Capture im Browser (empfohlen)**
- Statt Video hochzuladen: im Browser alle 30s einen Screenshot vom `<video>`-Element capturen (via Canvas → JPEG, ~50KB pro Frame)
- 90 Minuten = ~180 Frames = ~9 MB statt 1.5 GB
- Diese Frames als Base64-Array an `analyze-match` senden
- Gemini Vision kann Base64-Bilder direkt analysieren

**Option B — Video hochladen + externe Verarbeitung**
- Braucht einen externen Worker (nicht Lovable) für ffmpeg → Frame-Extraktion
- Teurer, komplexer, langsamer

### Umsetzungsplan (Option A)

#### 1. NewMatch Upload-Flow umbauen
- **Kein ganzes Video mehr hochladen**
- Bei "Datei hochladen": Video lokal im Browser abspielen, alle 30s Frame capturen
- Bei "Aufnehmen": während der Aufnahme alle 30s Frame capturen
- Frames als JPEG-Array sammeln (max 200 Frames)
- Nach Ende: Frames + Matchdaten an `analyze-match` senden
- Optional: kurzen 10s-Highlight-Clip speichern (für Preview), nicht das ganze Video

#### 2. `analyze-match` Edge Function: echte Vision-Analyse
- Empfängt Base64-Frames statt nur Text
- Sendet Frames an Gemini Vision (`google/gemini-2.5-flash`) als Multi-Image-Prompt
- Gemini sieht tatsächlich das Spielfeld und kann reale Muster erkennen
- Strukturiertes Tool Calling bleibt (funktioniert gut)

#### 3. `analyze-match` nach Upload automatisch aufrufen
- In `NewMatch.tsx` nach Frame-Capture direkt `supabase.functions.invoke("analyze-match", ...)` aufrufen
- Kein manueller Trigger mehr nötig

#### 4. Storage-Cleanup
- Kein `match-videos` Bucket mehr für Vollvideos nötig
- Optional: Frames temporär in Storage für Retry speichern, nach 24h löschen

#### 5. CameraTrackingPage gleich anpassen
- Auch hier: Frame-Capture statt Video-Upload
- Deutlich weniger Datenvolumen für mobile Nutzer

### Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `src/pages/NewMatch.tsx` | Frame-Capture statt Video-Upload, auto-trigger analyze-match |
| `src/pages/CameraTrackingPage.tsx` | Frame-Capture statt Video-Upload |
| `supabase/functions/analyze-match/index.ts` | Base64-Frames empfangen, Gemini Vision mit Bildern |
| `src/pages/ProcessingPage.tsx` | Retry-Button der analyze-match aufruft |

### Erwartetes Ergebnis

- **~9 MB statt ~1.5 GB** pro Spiel
- **Echte visuelle Analyse** statt Text-Halluzination
- **Automatischer Start** nach Upload
- **Sofort funktionsfähig** — keine externen Services nötig

