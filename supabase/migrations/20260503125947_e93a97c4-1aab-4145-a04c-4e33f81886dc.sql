-- A5: Auto-detect + confidence + verified flags on match_events
ALTER TABLE public.match_events
  ADD COLUMN IF NOT EXISTS auto_detected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confidence numeric,
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_match_events_auto_unverified
  ON public.match_events(match_id)
  WHERE auto_detected = true AND verified = false;

-- C1: Press releases table
CREATE TABLE IF NOT EXISTS public.press_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  club_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('pre_match', 'post_match')),
  language text NOT NULL DEFAULT 'de',
  headline text NOT NULL DEFAULT '',
  lead text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  quotes jsonb NOT NULL DEFAULT '[]'::jsonb,
  tone text NOT NULL DEFAULT 'neutral' CHECK (tone IN ('neutral', 'enthusiastic', 'analytical')),
  length text NOT NULL DEFAULT 'medium' CHECK (length IN ('short', 'medium', 'long')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'published')),
  generated_by_ai boolean NOT NULL DEFAULT true,
  manually_edited boolean NOT NULL DEFAULT false,
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.press_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view own press releases"
  ON public.press_releases FOR SELECT TO authenticated
  USING (club_id = public.get_user_club_id(auth.uid()));

CREATE POLICY "Club members can insert own press releases"
  ON public.press_releases FOR INSERT TO authenticated
  WITH CHECK (club_id = public.get_user_club_id(auth.uid()));

CREATE POLICY "Club members can update own press releases"
  ON public.press_releases FOR UPDATE TO authenticated
  USING (club_id = public.get_user_club_id(auth.uid()))
  WITH CHECK (club_id = public.get_user_club_id(auth.uid()));

CREATE POLICY "Club members can delete own press releases"
  ON public.press_releases FOR DELETE TO authenticated
  USING (club_id = public.get_user_club_id(auth.uid()));

CREATE POLICY "Admins can view all press releases"
  ON public.press_releases FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER press_releases_updated_at
  BEFORE UPDATE ON public.press_releases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE INDEX IF NOT EXISTS idx_press_releases_match ON public.press_releases(match_id, kind);
CREATE INDEX IF NOT EXISTS idx_press_releases_club ON public.press_releases(club_id, generated_at DESC);