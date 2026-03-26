ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS h1_started_at timestamptz,
ADD COLUMN IF NOT EXISTS h1_ended_at timestamptz,
ADD COLUMN IF NOT EXISTS h2_started_at timestamptz,
ADD COLUMN IF NOT EXISTS h2_ended_at timestamptz,
ADD COLUMN IF NOT EXISTS recording_started_at timestamptz,
ADD COLUMN IF NOT EXISTS recording_ended_at timestamptz;