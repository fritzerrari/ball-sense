ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS processing_progress jsonb DEFAULT NULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_events;