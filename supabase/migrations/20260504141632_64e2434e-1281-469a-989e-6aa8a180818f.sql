-- 1. Idempotenz: gleiche Notification nicht 2x pro Match/Empfänger
CREATE UNIQUE INDEX IF NOT EXISTS uq_parent_notif_unique
  ON public.parent_notifications (subscription_id, match_id, title);

-- 2. Cleanup AI-Logs >90 Tage
DO $$
BEGIN
  PERFORM cron.unschedule('ai-usage-log-cleanup');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'ai-usage-log-cleanup',
  '15 3 * * *',
  $cron$ DELETE FROM public.ai_usage_log WHERE created_at < now() - interval '90 days'; $cron$
);

-- 3. Cleanup stale setup-Matches >14 Tage
DO $$
BEGIN
  PERFORM cron.unschedule('stale-setup-matches-cleanup');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'stale-setup-matches-cleanup',
  '30 3 * * *',
  $cron$
  UPDATE public.matches
     SET status = 'cancelled'
   WHERE status = 'setup'
     AND created_at < now() - interval '14 days';
  $cron$
);

-- 4. Wochen-Briefing Mo 08:00 UTC
DO $$
BEGIN
  PERFORM cron.unschedule('coach-weekly-briefing');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'coach-weekly-briefing',
  '0 8 * * 1',
  $cron$
  SELECT extensions.http_post(
    url := 'https://jlccxvxcaqrdwraboadp.supabase.co/functions/v1/coach-inbox-generate',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsY2N4dnhjYXFyZHdyYWJvYWRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjI0NzYsImV4cCI6MjA4ODM5ODQ3Nn0.n4p25vQkDbRDPgoEcuGMNjKbmYwlettVv89eOwlUPr4'
    ),
    body := jsonb_build_object('trigger', 'cron_weekly')
  );
  $cron$
);

-- 5. Health-Dashboard Reader (für Superadmins)
CREATE OR REPLACE FUNCTION public.get_system_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT jsonb_build_object(
    'crons', (
      SELECT jsonb_agg(jsonb_build_object(
        'name', jobname,
        'schedule', schedule,
        'active', active
      )) FROM cron.job
    ),
    'stuck_jobs', (
      SELECT count(*) FROM public.analysis_jobs
       WHERE status IN ('queued','analyzing','interpreting')
         AND COALESCE(started_at, created_at) < now() - interval '30 minutes'
    ),
    'ai_burn_24h', (
      SELECT jsonb_build_object(
        'calls', count(*),
        'tokens', COALESCE(sum(total_tokens),0),
        'avg_ms', COALESCE(avg(duration_ms)::int, 0)
      ) FROM public.ai_usage_log
       WHERE created_at > now() - interval '24 hours'
    ),
    'parent_notif_24h', (
      SELECT jsonb_build_object(
        'sent',   count(*) FILTER (WHERE delivery_status='sent'),
        'failed', count(*) FILTER (WHERE delivery_status='failed'),
        'expired',count(*) FILTER (WHERE delivery_status='expired')
      ) FROM public.parent_notifications
       WHERE sent_at > now() - interval '24 hours'
    ),
    'matches_by_status', (
      SELECT jsonb_object_agg(status, c) FROM (
        SELECT status, count(*) c FROM public.matches GROUP BY status
      ) s
    ),
    'generated_at', now()
  ) INTO _result;

  RETURN _result;
END;
$$;