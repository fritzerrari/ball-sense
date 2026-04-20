ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS team_identity text,
  ADD COLUMN IF NOT EXISTS cockpit_cache jsonb;