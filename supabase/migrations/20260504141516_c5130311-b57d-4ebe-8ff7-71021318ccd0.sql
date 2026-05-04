-- Trigger an realen Status koppeln
CREATE OR REPLACE FUNCTION public.notify_match_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _url text := 'https://jlccxvxcaqrdwraboadp.supabase.co';
  _anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsY2N4dnhjYXFyZHdyYWJvYWRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjI0NzYsImV4cCI6MjA4ODM5ODQ3Nn0.n4p25vQkDbRDPgoEcuGMNjKbmYwlettVv89eOwlUPr4';
BEGIN
  IF (TG_OP = 'UPDATE'
      AND NEW.status IN ('done', 'completed')
      AND COALESCE(OLD.status, '') NOT IN ('done', 'completed')) THEN
    BEGIN
      PERFORM extensions.http_post(
        url := _url || '/functions/v1/parent-notify',
        body := jsonb_build_object('match_id', NEW.id),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || _anon
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'parent-notify call failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

-- Doppelten Watchdog entfernen
DO $$
BEGIN
  PERFORM cron.unschedule('pipeline-watchdog-every-5min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;