---
name: Tracking Telemetry Persistence
description: Final analyze-match job persists per-match tracking telemetry to matches.tracking_telemetry; Admin panel "Tracking-Qualität" shows last 10 matches trend
type: feature
---

After every successful **final** analyze-match job, the function writes an aggregated telemetry payload to `matches.tracking_telemetry` (jsonb):

- `frames_total` — frames sent to Gemini
- `frames_skipped_quality` + `skipped_reasons{dark,uniform,blurry,duplicate}` — client-side filter stats
- `avg_players_detected` — Ø players[] length per frame
- `avg_adaptive_interval_sec` — observed adaptive capture interval
- `ai_model` — `google/gemini-2.5-flash` or `-flash-lite`
- `ai_tokens_total` / `prompt` / `completion` — from `aiResult.usage`
- `analysis_confidence` — Gemini-reported confidence
- `h2_simulated` — true if H2 was synthesized

Admin > Tracking-Qualität tab (`AdminTrackingQuality.tsx`) shows aggregates + last 10 matches table for trend monitoring.

Phase B (dynamic JPEG quality 0.5/0.6/0.7 based on motion) and Phase C (sharper "null instead of guess" prompt) ship together with this telemetry so future improvements are measurable against a baseline.
