
-- Benchmark opt-in table
CREATE TABLE public.benchmark_opt_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  opted_in boolean NOT NULL DEFAULT false,
  opted_in_at timestamptz,
  league text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id)
);

ALTER TABLE public.benchmark_opt_ins ENABLE ROW LEVEL SECURITY;

-- Club members can view own opt-in
CREATE POLICY "Club members can view own benchmark opt-in"
ON public.benchmark_opt_ins FOR SELECT
TO authenticated
USING (club_id = get_user_club_id(auth.uid()));

-- Club members can insert own opt-in
CREATE POLICY "Club members can insert own benchmark opt-in"
ON public.benchmark_opt_ins FOR INSERT
TO authenticated
WITH CHECK (club_id = get_user_club_id(auth.uid()));

-- Club members can update own opt-in
CREATE POLICY "Club members can update own benchmark opt-in"
ON public.benchmark_opt_ins FOR UPDATE
TO authenticated
USING (club_id = get_user_club_id(auth.uid()));

-- Superadmins can view all
CREATE POLICY "Superadmins can view all benchmark opt-ins"
ON public.benchmark_opt_ins FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER set_benchmark_opt_ins_updated_at
  BEFORE UPDATE ON public.benchmark_opt_ins
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_timestamp();

-- Security definer function for league benchmarks
CREATE OR REPLACE FUNCTION public.get_league_benchmarks(_club_id uuid, _league text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _opted_in boolean;
  _participant_count integer;
  _result jsonb;
BEGIN
  -- Check if this club has opted in
  SELECT opted_in INTO _opted_in
  FROM public.benchmark_opt_ins
  WHERE club_id = _club_id;

  IF _opted_in IS NOT TRUE THEN
    RETURN jsonb_build_object('error', 'not_opted_in');
  END IF;

  -- Count participating clubs in this league
  SELECT count(*) INTO _participant_count
  FROM public.benchmark_opt_ins
  WHERE opted_in = true
    AND league = _league;

  IF _participant_count < 5 THEN
    RETURN jsonb_build_object('error', 'insufficient_participants', 'count', _participant_count);
  END IF;

  -- Aggregate anonymous averages from team_match_stats for opted-in clubs
  SELECT jsonb_build_object(
    'participants', _participant_count,
    'league', _league,
    'avg_possession_pct', round(avg(tms.possession_pct)::numeric, 1),
    'avg_total_distance_km', round(avg(tms.total_distance_km)::numeric, 2),
    'avg_top_speed_kmh', round(avg(tms.top_speed_kmh)::numeric, 1),
    'avg_avg_distance_km', round(avg(tms.avg_distance_km)::numeric, 2)
  ) INTO _result
  FROM public.team_match_stats tms
  JOIN public.matches m ON m.id = tms.match_id
  JOIN public.benchmark_opt_ins boi ON boi.club_id = m.home_club_id
  WHERE boi.opted_in = true
    AND boi.league = _league
    AND tms.team = 'home';

  RETURN COALESCE(_result, jsonb_build_object('error', 'no_data'));
END;
$$;
