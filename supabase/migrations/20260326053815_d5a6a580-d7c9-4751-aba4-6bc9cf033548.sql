
CREATE TABLE public.match_preparations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  opponent_name text NOT NULL,
  preparation_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.match_preparations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view own preparations"
  ON public.match_preparations FOR SELECT TO authenticated
  USING (club_id = get_user_club_id(auth.uid()));

CREATE POLICY "Club members can insert preparations"
  ON public.match_preparations FOR INSERT TO authenticated
  WITH CHECK (club_id = get_user_club_id(auth.uid()));

CREATE POLICY "Club members can delete preparations"
  ON public.match_preparations FOR DELETE TO authenticated
  USING (club_id = get_user_club_id(auth.uid()));

CREATE POLICY "Admins can view all preparations"
  ON public.match_preparations FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
