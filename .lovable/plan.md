

## Diagnose: Warum das System grundlegend nicht funktioniert

### Das Kernproblem

Das System nutzt einen **allgemeinen Chat-KI-Modell** (Gemini Flash) als Echtzeit-Spielererkennungssystem. Das ist fundamental der falsche Ansatz. Die Edge-Function-Logs zeigen es klar:

```text
[analyze-frame] google/gemini-2.5-flash error: Expected ',' or ']' after array element in JSON at position 3315
[analyze-frame] google/gemini-2.5-flash-lite error: Expected ',' or ']' after array element in JSON at position 2988
[analyze-frame] All models failed. Last error: Expected ',' or ']' ...
```

**Jeder zweite AI-Call schlägt fehl**, weil das Modell unstrukturierten Text zurückgibt statt valides JSON. Der Prompt sagt "Return ONLY valid JSON", aber Chat-Modelle halten sich nicht zuverlässig daran.

### Vergleich mit Veo/professionellen Systemen

Veo nutzt dedizierte Computer-Vision-Modelle (YOLO, etc.), die speziell auf Spielererkennung trainiert sind. Wir können kein YOLO auf Lovable laufen lassen. Aber wir **können** das vorhandene AI-System drastisch verbessern:

### Die 3 kritischen Fixes

**1. Structured Output via Tool Calling (statt freier JSON-Text)**

Das ist der wichtigste Fix. Die Lovable AI Gateway unterstützt **Tool Calling** — das zwingt das Modell, strukturierte Daten im exakten Schema zurückzugeben. Keine JSON-Parse-Fehler mehr.

Statt:
```
Prompt: "Return ONLY valid JSON..."
→ Modell gibt manchmal Markdown, manchmal kaputtes JSON
```

Neu:
```typescript
tools: [{
  type: "function",
  function: {
    name: "report_detections",
    parameters: {
      type: "object",
      properties: {
        detections: { type: "array", items: { ... } },
        field_coverage: { type: "number" },
        player_count: { type: "integer" }
      }
    }
  }
}],
tool_choice: { type: "function", function: { name: "report_detections" } }
```
→ **Garantiert valides JSON**, keine Parse-Fehler, keine Fallback-Kaskade.

**2. Frame-Rate reduzieren, Qualität erhöhen**

Aktuell: Alle 2.5s ein Frame → 24 AI-Calls pro Minute → viele Rate-Limits + Kosten.
Neu: Alle **5s** ein Frame, dafür mit `gemini-2.5-flash` (zuverlässiger).
Ergebnis: Halb so viele Calls, doppelt so stabil.

**3. Detections zwischen AI-Calls interpolieren**

Aktuell wird das letzte AI-Ergebnis nur 8s wiederverwendet. Wenn ein Call fehlschlägt, gibt es eine Lücke.
Neu: Einfache lineare Interpolation der Positionen zwischen erfolgreichen Detections. 

### Umsetzungsplan

#### A. `analyze-frame` Edge Function komplett umbauen
- Tool Calling statt JSON-Prompt
- Einzelnes zuverlässiges Modell (`google/gemini-2.5-flash`)
- Robustere Fehlerbehandlung mit leerem Fallback statt Crash

#### B. `football-tracker.ts` optimieren
- AI-Interval von 2.5s auf 5s
- Fallback-Reuse von 8s auf 15s
- Einfache Position-Interpolation zwischen Frames
- Detection-Broadcast unabhängig vom AI-Status (UI bleibt responsiv)

#### C. `process-tracking` — Tactical KPIs ehrlich machen
- `tactical_data_available` Flag konsequent nutzen
- Bei `< 10 Ball-Detections`: alle taktischen KPIs als `null` speichern (nicht 0)
- Team-Stats: `possession_pct` nur setzen wenn Ball-Daten vorhanden

#### D. `CoachSummary` + `MatchCharts` — UI-Transparenz
- Wenn `tactical_data_available === false`: Block komplett als "Nicht verfügbar" markieren
- Battle-Pulse-Karten: "Keine Daten" statt "0%"
- Expliziter Hinweis: "Tore/Karten nur über Event-Ticker"

#### E. Event-Ticker in CameraTrackingPage
- `LiveEventTicker` direkt einbinden (existiert bereits als Komponente)
- Kamera-Operatoren können Tore/Karten während der Aufnahme erfassen

### Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `supabase/functions/analyze-frame/index.ts` | Tool Calling statt JSON-Prompt |
| `src/lib/football-tracker.ts` | 5s Interval, 15s Reuse, Interpolation |
| `supabase/functions/process-tracking/index.ts` | Taktische KPIs als null statt 0 |
| `src/components/CoachSummary.tsx` | "Nicht verfügbar" bei fehlenden Daten |
| `src/components/MatchCharts.tsx` | Battle-Pulse "Keine Daten" State |
| `src/pages/CameraTrackingPage.tsx` | LiveEventTicker Integration |

### Erwartetes Ergebnis

1. **0 JSON-Parse-Fehler** — Tool Calling garantiert valides Schema
2. **Stabile Spielererkennung** — weniger, aber zuverlässigere AI-Calls
3. **Ehrliche KPIs** — kein stilles 0%, sondern klares "Nicht verfügbar"
4. **Tore im Report** — über Event-Ticker erfassbar (auch vom Kamera-Operator)
5. **Halbierte AI-Kosten** — 12 statt 24 Calls/Minute

