---
name: Multi-Camera Sync-Burst Fusion
description: Frames from different cameras within ±5s are grouped into bursts; Gemini fuses them into one scene; camera_index + burst_id persisted on every frame_position
type: feature
---
- `loadFramesFromStorage` returns parallel `meta: FrameMeta[]` ({cam, ts}) for every frame.
- `detectSyncBursts(meta, 5000)` flags frames where 2+ distinct real cameras (cam>=0) fall in a 5s window.
- Prompt receives `burstNote` listing per-frame `cam=X burst=Y` and instructs Gemini to NOT double-count players.
- After analysis, every `frame_positions[]` entry is stamped with `camera_index`, `frame_ts`, optional `burst_id`.
- Telemetry persists `sync_bursts_detected` + `cameras_active` on `matches.tracking_telemetry`.
- Enables CameraCoverageMap to attribute detections accurately, and Truth Mode to flag faulty cameras.
