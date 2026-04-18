---
name: Frame Orchestration & Merging
description: Per-camera _cam{i}.json with timestamps, time-sorted interleave into global {matchId}.json. Trainer = cam0, helpers = cam1+. Both paths use identical merge logic.
type: feature
---

Multi-camera frame pipeline:

- Each frame carries a wall-clock timestamp (ms) captured client-side in `frame-capture.ts`.
- Trainer self-recording writes to `_cam0.json` (NOT `_h1`/`_h2`/global directly anymore).
- Helpers write to `_cam{session.camera_index}.json` via `camera-ops`.
- Phase snapshots `_cam{i}_h1.json` / `_cam{i}_h2.json` are kept for audit only.
- After every upload (trainer or helper), all `_cam*.json` files are loaded, frames+timestamps tagged per camera, sorted by timestamp, and written as the global `{matchId}.json`.
- `analyze-match` reads global `{matchId}.json` first; if absent, re-merges per-cam files time-sorted; falls back to halves and chunks.
- Legacy frames without timestamps get synthetic order-based timestamps (cam offset prevents collisions).

Result: trainer + 1-3 helpers contribute frames in true chronological order to the AI analysis, no overwrites, no concatenated cam blocks.
