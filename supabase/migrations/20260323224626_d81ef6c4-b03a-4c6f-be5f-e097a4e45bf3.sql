
CREATE TABLE public.ai_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id uuid REFERENCES public.players(id) ON DELETE CASCADE,
  report_type text NOT NULL DEFAULT 'analysis',
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'generating',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai reports"
  ON public.ai_reports FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own ai reports"
  ON public.ai_reports FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own ai reports"
  ON public.ai_reports FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own ai reports"
  ON public.ai_reports FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all ai reports"
  ON public.ai_reports FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
