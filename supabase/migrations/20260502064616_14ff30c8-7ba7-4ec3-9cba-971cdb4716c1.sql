ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS home_jersey_color text,
  ADD COLUMN IF NOT EXISTS away_jersey_color text,
  ADD COLUMN IF NOT EXISTS home_jersey_secondary text,
  ADD COLUMN IF NOT EXISTS away_jersey_secondary text;