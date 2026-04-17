ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS h2_sides_swapped boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.matches.h2_sides_swapped IS 'Whether teams switched sides at halftime (default true, as is standard in football). Used by analysis pipeline to mirror H2 player positions.';