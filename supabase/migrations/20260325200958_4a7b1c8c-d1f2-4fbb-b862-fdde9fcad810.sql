
ALTER TABLE public.camera_access_sessions
  ADD COLUMN IF NOT EXISTS command text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS status_data jsonb DEFAULT '{}'::jsonb;

ALTER PUBLICATION supabase_realtime ADD TABLE public.camera_access_sessions;
