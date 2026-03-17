ALTER TABLE public.matches ADD COLUMN match_type text NOT NULL DEFAULT 'match';
COMMENT ON COLUMN public.matches.match_type IS 'Type: match or training';