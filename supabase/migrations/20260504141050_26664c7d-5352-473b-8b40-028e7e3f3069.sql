CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

DO $$
BEGIN
  PERFORM cron.unschedule('pipeline-watchdog-5min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'pipeline-watchdog-5min',
  '*/5 * * * *',
  $cron$
  SELECT extensions.http_post(
    url := 'https://jlccxvxcaqrdwraboadp.supabase.co/functions/v1/pipeline-watchdog',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsY2N4dnhjYXFyZHdyYWJvYWRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjI0NzYsImV4cCI6MjA4ODM5ODQ3Nn0.n4p25vQkDbRDPgoEcuGMNjKbmYwlettVv89eOwlUPr4'
    ),
    body := jsonb_build_object('source', 'cron', 'ts', now())
  );
  $cron$
);

DO $$
BEGIN
  PERFORM cron.unschedule('coach-inbox-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'coach-inbox-daily',
  '0 6 * * *',
  $cron$
  SELECT extensions.http_post(
    url := 'https://jlccxvxcaqrdwraboadp.supabase.co/functions/v1/coach-inbox-generate',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsY2N4dnhjYXFyZHdyYWJvYWRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjI0NzYsImV4cCI6MjA4ODM5ODQ3Nn0.n4p25vQkDbRDPgoEcuGMNjKbmYwlettVv89eOwlUPr4'
    ),
    body := jsonb_build_object('trigger', 'cron_daily')
  );
  $cron$
);

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
      AND NEW.status = 'completed'
      AND COALESCE(OLD.status, '') <> 'completed') THEN
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

DROP TRIGGER IF EXISTS trg_notify_match_completed ON public.matches;
CREATE TRIGGER trg_notify_match_completed
  AFTER UPDATE OF status ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.notify_match_completed();