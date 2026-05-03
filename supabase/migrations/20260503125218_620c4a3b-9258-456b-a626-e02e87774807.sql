CREATE TABLE public.season_hub_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL UNIQUE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'unknown',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '72 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.season_hub_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view own season hub cache"
  ON public.season_hub_cache FOR SELECT
  TO authenticated
  USING (club_id = public.get_user_club_id(auth.uid()));

CREATE POLICY "Club members can insert own season hub cache"
  ON public.season_hub_cache FOR INSERT
  TO authenticated
  WITH CHECK (club_id = public.get_user_club_id(auth.uid()));

CREATE POLICY "Club members can update own season hub cache"
  ON public.season_hub_cache FOR UPDATE
  TO authenticated
  USING (club_id = public.get_user_club_id(auth.uid()))
  WITH CHECK (club_id = public.get_user_club_id(auth.uid()));

CREATE POLICY "Admins can view all season hub caches"
  ON public.season_hub_cache FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER season_hub_cache_updated_at
  BEFORE UPDATE ON public.season_hub_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE INDEX idx_season_hub_cache_club_expires ON public.season_hub_cache(club_id, expires_at);