# Review: Tracking-Optimierungs-Prompt

Ich habe den Prompt gegen den aktuellen Code abgeglichen. Ergebnis: **~60 % davon ist bereits gebaut**, ~25 % sinnvoll als Ergänzung, ~15 % entweder redundant oder riskant.

---

## Punkt-für-Punkt-Bewertung

### 1. Frame-Qualität vor Upload — ⚠️ Größtenteils schon da
**Status: bereits implementiert in `frame-capture.ts`**
- Sharpness-Check via Sobel (`MIN_SHARPNESS = 6`) ✅
- Brightness + Variance-Check ✅
- dHash-Duplicate-Detection ✅
- **Nicht da:** dynamische JPEG-Quality (aktuell fix `0.6`) und adaptive `CAPTURE_WIDTH` (fix `640px`)

**Empfehlung:** Nur die zwei fehlenden Mini-Punkte ergänzen — Quality `0.5/0.7` je nach `meanDiff` aus dem Motion-Probe. Adaptive Width überspringen (640 ist bewusster Kompromiss für AI-Token-Kosten, höher bringt Gemini Vision wenig).

### 2. Smartes Sampling — ✅ Komplett vorhanden
**Status: bereits implementiert**
- Adaptive 15–60s Intervall basierend auf `meanDiff` ✅
- Boost-Takt 5s bei Asymmetrie (Tornähe) ✅ (gerade letzte Woche gebaut)
- Smart-Selection: Best-N pro 90s-Window ✅

**Empfehlung:** Nichts tun. Der Prompt-Vorschlag (20s/60s) ist gröber als unsere aktuelle Implementierung.

### 3. Gemini-Prompt-Tuning — ✅ Tool-Calling läuft, Trikotfarben da
**Status: tool_calls bereits aktiv** (Zeile 591 + 879 in `analyze-match`), Jersey-Color-Prompting ebenfalls live.

**Sinnvoll zu ergänzen:**
- Explizites *"lieber `null` als geraten"* im System-Prompt schärfen
- Few-Shot-Beispiel für Schiri-Ausschluss (auch wenn Officials bereits gefiltert werden)

**Empfehlung:** 1 kleines Prompt-Update, ~10 Zeilen.

### 4. Multi-Frame-Konsistenz — ✅ Komplett vorhanden
**Status: bereits implementiert**
- Kalman-1D-Smoothing für Spieler X/Y und Ball (Zeile 311–387) ✅
- Server-seitig in `analyze-match`

**Empfehlung:** Nichts tun. Median-Filter wäre sogar ein Rückschritt gegenüber Kalman.

### 5. Modell-Routing — ✅ Bereits aktiv
**Status: bereits implementiert** (Zeile 566)
```ts
const modelName = isLightweight ? "google/gemini-2.5-flash-lite" : "google/gemini-2.5-flash";
```
Live/wenige Frames → Lite, Final → Flash.

**Empfehlung:** Nichts tun. ENV-Variable für A/B-Test ist Overhead ohne klaren Mehrwert.

### 6. Telemetrie — ⚠️ Teilweise da, Admin-Panel fehlt
**Status:** `FrameTelemetry` wird durch die Pipeline gemerged (Zeile 10–62 in `analyze-match`), aber **nicht persistiert pro Match** für Trend-Vergleiche. Skip-Reasons + Quality-Scores existieren clientseitig.

**Sinnvoll zu bauen:**
- Spalte `tracking_telemetry jsonb` auf `matches` (oder neue Tabelle `match_tracking_telemetry`)
- Beim Final-Job die aggregierten Werte schreiben: `frames_total`, `frames_skipped_quality`, `avg_players_detected`, `ai_tokens_used`, `boost_active_pct`
- Admin-Panel "Tracking-Qualität letzte 10 Matches" in `src/pages/Admin.tsx`

---

## Was ich umsetzen würde (klein & messbar)

**Phase A — Telemetrie-Persistenz (Pflicht, sonst sind alle weiteren Änderungen blind):**
1. Migration: `matches.tracking_telemetry jsonb`
2. `analyze-match` schreibt am Ende des Final-Jobs die Aggregate
3. Admin-Panel-Tab "Tracking-Qualität" mit Trend über letzte 10 Matches

**Phase B — Mikro-Optimierungen am Capture (kein Risiko):**
4. Dynamische JPEG-Quality (`0.5` low motion / `0.7` high motion) in `frame-capture.ts`

**Phase C — Prompt-Schärfung:**
5. System-Prompt in `analyze-match` ergänzen: *"Wenn unsicher → null statt geraten"* + 1 Few-Shot für Schiri/Linienrichter-Ausschluss

---

## Was ich NICHT umsetzen würde

| Vorschlag | Grund |
|---|---|
| Adaptive `CAPTURE_WIDTH` | 640px ist bewusst gewählt für Token-Kosten; höher bringt Gemini Vision <5 % Genauigkeit, kostet aber 30–50 % mehr Tokens |
| Median-Filter über 3 Frames | Wir haben Kalman — strikt besser |
| ENV-konfigurierbares A/B-Routing | Overhead ohne Nutzen, Routing läuft bereits sinnvoll |
| Punkte 1, 2, 4, 5 (komplett) | Bereits implementiert |

---

## Erwarteter Effekt der drei Mini-Schritte

- **Phase A** macht überhaupt erst messbar, ob künftige Änderungen wirken
- **Phase B** spart geschätzt 10–15 % Bandbreite (wichtig für 4G-Helfer)
- **Phase C** reduziert AI-Halluzinationen bei unklaren Frames um geschätzt 5–10 %

**Keine** der Änderungen berührt iOS-Safari-Stabilität, Halftime-Side-Swap oder Recording-Modi.

**Soll ich Phase A + B + C so umsetzen?**
