-- Add a structured per-player tracking consent status so the UI can clearly show
-- whether a player may be tracked.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'tracking_consent_status'
  ) THEN
    CREATE TYPE public.tracking_consent_status AS ENUM ('unknown', 'granted', 'denied');
  END IF;
END $$;

ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS tracking_consent_status public.tracking_consent_status NOT NULL DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS tracking_consent_updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS tracking_consent_notes TEXT;