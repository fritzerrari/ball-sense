CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  club_id uuid REFERENCES public.clubs(id) ON DELETE SET NULL,
  match_id uuid,
  function_name text NOT NULL,
  model text NOT NULL,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  duration_ms integer,
  status text NOT NULL DEFAULT 'ok',
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_club_created ON public.ai_usage_log (club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_match ON public.ai_usage_log (match_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_function ON public.ai_usage_log (function_name, created_at DESC);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members read own usage"
  ON public.ai_usage_log FOR SELECT TO authenticated
  USING (club_id = public.get_user_club_id(auth.uid()));

CREATE POLICY "Superadmins read all usage"
  ON public.ai_usage_log FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));