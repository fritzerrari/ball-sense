
-- API Football mapping table: links clubs/players/matches to API-Football IDs
CREATE TABLE public.api_football_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  api_team_id integer, -- API-Football team ID
  api_league_id integer, -- API-Football league ID
  api_season integer DEFAULT 2025,
  sync_enabled boolean NOT NULL DEFAULT false,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(club_id)
);

ALTER TABLE public.api_football_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view own config"
  ON public.api_football_config FOR SELECT
  TO authenticated
  USING (club_id = get_user_club_id(auth.uid()));

CREATE POLICY "Club members can manage own config"
  ON public.api_football_config FOR ALL
  TO authenticated
  USING (club_id = get_user_club_id(auth.uid()))
  WITH CHECK (club_id = get_user_club_id(auth.uid()));

CREATE POLICY "Admins can manage all configs"
  ON public.api_football_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- API Football match data (external stats from API, separate from tracking data)
CREATE TABLE public.api_football_match_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  api_fixture_id integer,
  home_goals integer,
  away_goals integer,
  possession_home numeric,
  possession_away numeric,
  shots_home integer,
  shots_away integer,
  shots_on_target_home integer,
  shots_on_target_away integer,
  corners_home integer,
  corners_away integer,
  fouls_home integer,
  fouls_away integer,
  offsides_home integer,
  offsides_away integer,
  yellow_cards_home integer,
  yellow_cards_away integer,
  red_cards_home integer,
  red_cards_away integer,
  passes_home integer,
  passes_away integer,
  pass_accuracy_home numeric,
  pass_accuracy_away numeric,
  raw_data jsonb DEFAULT '{}'::jsonb,
  data_source text NOT NULL DEFAULT 'api-football',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(api_fixture_id)
);

ALTER TABLE public.api_football_match_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view own api stats"
  ON public.api_football_match_stats FOR SELECT
  TO authenticated
  USING (club_id = get_user_club_id(auth.uid()));

CREATE POLICY "Admins can view all api stats"
  ON public.api_football_match_stats FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- API Football player data (external player stats)
CREATE TABLE public.api_football_player_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  api_player_id integer,
  api_fixture_id integer,
  player_name text,
  minutes_played integer,
  rating numeric,
  goals integer DEFAULT 0,
  assists integer DEFAULT 0,
  shots_total integer DEFAULT 0,
  shots_on_goal integer DEFAULT 0,
  passes_total integer DEFAULT 0,
  passes_accuracy numeric,
  tackles integer DEFAULT 0,
  duels_won integer DEFAULT 0,
  duels_total integer DEFAULT 0,
  dribbles_success integer DEFAULT 0,
  fouls_committed integer DEFAULT 0,
  fouls_drawn integer DEFAULT 0,
  yellow_cards integer DEFAULT 0,
  red_cards integer DEFAULT 0,
  penalty_scored integer DEFAULT 0,
  penalty_missed integer DEFAULT 0,
  raw_data jsonb DEFAULT '{}'::jsonb,
  data_source text NOT NULL DEFAULT 'api-football',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(api_fixture_id, api_player_id)
);

ALTER TABLE public.api_football_player_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view own api player stats"
  ON public.api_football_player_stats FOR SELECT
  TO authenticated
  USING (club_id = get_user_club_id(auth.uid()));

CREATE POLICY "Admins can view all api player stats"
  ON public.api_football_player_stats FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Add data_source to existing player_match_stats for deduplication clarity
ALTER TABLE public.player_match_stats
  ADD COLUMN IF NOT EXISTS data_source text NOT NULL DEFAULT 'fieldiq';

-- Add data_source to existing team_match_stats
ALTER TABLE public.team_match_stats
  ADD COLUMN IF NOT EXISTS data_source text NOT NULL DEFAULT 'fieldiq';
