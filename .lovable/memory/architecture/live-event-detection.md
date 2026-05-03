---
name: Live Event Detection
description: 30s-trigger Edge Function for auto-detecting events with confidence scores during live tracking
type: architecture
---
**Edge Function `live-event-detector`:** Akzeptiert match_id + half + minute + frames[] (URL oder Base64). Schickt 4-6 Frames an Gemini 2.5 Flash-Lite mit Tool-Call für strukturierte Event-Liste.

**Erkannte Event-Typen:** goal, shot_on_target/off_target, big_chance, corner, throw_in, free_kick, penalty, header_duel, tackle_won/lost, foul, offside, save, missed_pass, pressing_action.

**Persistenz:** Insert in `match_events` mit `auto_detected=true`, `confidence` (0-1), `verified=false`. Filter: nur events mit confidence >= 0.5 werden gespeichert.

**Schema-Erweiterung `match_events`:** auto_detected (bool default false), confidence (numeric), verified (bool default false). Partial Index auf (match_id) WHERE auto_detected=true AND verified=false für schnellen Editor-Filter.

**UX-Regel:** confidence < 0.7 → "Bitte prüfen"-Badge im LiveEventTicker und priorisiert im PostMatchEventEditor (Ground Truth via manual verify).
