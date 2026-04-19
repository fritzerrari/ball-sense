UPDATE public.matches
SET status = 'done',
    home_score = 2,
    away_score = 0,
    h2_started_at = COALESCE(h2_started_at, '2026-04-19 11:05:00+00'::timestamptz),
    h2_ended_at = COALESCE(h2_ended_at, now()),
    recording_ended_at = COALESCE(recording_ended_at, now())
WHERE id = '92606052-d636-4780-9e40-bcf3f6ad3096';