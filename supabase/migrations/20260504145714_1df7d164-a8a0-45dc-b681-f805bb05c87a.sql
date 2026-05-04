
-- ============================================================
-- club_teams: Mannschaften eines Vereins
-- ============================================================
CREATE TABLE public.club_teams (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id uuid NOT NULL,
  name text NOT NULL,
  age_group text,
  league text,
  spielklasse text,
  logo_url text,
  external_source text DEFAULT 'fussball.de',
  external_team_id text,
  external_url text,
  table_position integer,
  points integer,
  goal_difference text,
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  last_synced_at timestamp with time zone,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (club_id, external_team_id)
);

CREATE INDEX idx_club_teams_club ON public.club_teams(club_id);
CREATE INDEX idx_club_teams_default ON public.club_teams(club_id, is_default) WHERE is_default = true;

ALTER TABLE public.club_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "club_teams_select" ON public.club_teams FOR SELECT
  USING (club_id = public.get_user_club_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "club_teams_insert" ON public.club_teams FOR INSERT
  WITH CHECK (club_id = public.get_user_club_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "club_teams_update" ON public.club_teams FOR UPDATE
  USING (club_id = public.get_user_club_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "club_teams_delete" ON public.club_teams FOR DELETE
  USING (club_id = public.get_user_club_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_club_teams_updated_at
  BEFORE UPDATE ON public.club_teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- ============================================================
-- team_fixtures: Spielplan / Ergebnisse
-- ============================================================
CREATE TABLE public.team_fixtures (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.club_teams(id) ON DELETE CASCADE,
  club_id uuid NOT NULL,
  match_date date NOT NULL,
  kickoff_time time,
  competition text,
  home_team_name text NOT NULL,
  away_team_name text NOT NULL,
  is_home boolean NOT NULL DEFAULT true,
  home_score integer,
  away_score integer,
  status text NOT NULL DEFAULT 'scheduled',
  external_match_id text,
  used_for_match_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (team_id, external_match_id)
);

CREATE INDEX idx_team_fixtures_team ON public.team_fixtures(team_id, match_date);
CREATE INDEX idx_team_fixtures_club_upcoming ON public.team_fixtures(club_id, match_date)
  WHERE status = 'scheduled';

ALTER TABLE public.team_fixtures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_fixtures_select" ON public.team_fixtures FOR SELECT
  USING (club_id = public.get_user_club_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "team_fixtures_insert" ON public.team_fixtures FOR INSERT
  WITH CHECK (club_id = public.get_user_club_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "team_fixtures_update" ON public.team_fixtures FOR UPDATE
  USING (club_id = public.get_user_club_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "team_fixtures_delete" ON public.team_fixtures FOR DELETE
  USING (club_id = public.get_user_club_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_team_fixtures_updated_at
  BEFORE UPDATE ON public.team_fixtures
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- ============================================================
-- team_players: Kader + Saison-Stats
-- ============================================================
CREATE TABLE public.team_players (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.club_teams(id) ON DELETE CASCADE,
  club_id uuid NOT NULL,
  player_name text NOT NULL,
  shirt_number integer,
  position text,
  age integer,
  matches_played integer DEFAULT 0,
  goals integer DEFAULT 0,
  assists integer DEFAULT 0,
  yellow_cards integer DEFAULT 0,
  red_cards integer DEFAULT 0,
  minutes_played integer DEFAULT 0,
  external_player_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (team_id, external_player_id),
  UNIQUE (team_id, player_name, shirt_number)
);

CREATE INDEX idx_team_players_team ON public.team_players(team_id);

ALTER TABLE public.team_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_players_select" ON public.team_players FOR SELECT
  USING (club_id = public.get_user_club_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "team_players_insert" ON public.team_players FOR INSERT
  WITH CHECK (club_id = public.get_user_club_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "team_players_update" ON public.team_players FOR UPDATE
  USING (club_id = public.get_user_club_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "team_players_delete" ON public.team_players FOR DELETE
  USING (club_id = public.get_user_club_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_team_players_updated_at
  BEFORE UPDATE ON public.team_players
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- ============================================================
-- team_standings: Tabelle pro Mannschaft
-- ============================================================
CREATE TABLE public.team_standings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.club_teams(id) ON DELETE CASCADE,
  club_id uuid NOT NULL,
  position integer,
  team_name text NOT NULL,
  played integer DEFAULT 0,
  wins integer DEFAULT 0,
  draws integer DEFAULT 0,
  losses integer DEFAULT 0,
  goals_for integer DEFAULT 0,
  goals_against integer DEFAULT 0,
  points integer DEFAULT 0,
  is_own boolean NOT NULL DEFAULT false,
  fetched_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (team_id, team_name)
);

CREATE INDEX idx_team_standings_team ON public.team_standings(team_id, position);

ALTER TABLE public.team_standings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_standings_select" ON public.team_standings FOR SELECT
  USING (club_id = public.get_user_club_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "team_standings_modify" ON public.team_standings FOR ALL
  USING (club_id = public.get_user_club_id(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (club_id = public.get_user_club_id(auth.uid()) OR public.is_super_admin(auth.uid()));

-- ============================================================
-- Trigger: nur 1 Default-Team pro Club
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_single_default_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.club_teams
       SET is_default = false
     WHERE club_id = NEW.club_id
       AND id <> NEW.id
       AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_club_teams_single_default
  BEFORE INSERT OR UPDATE OF is_default ON public.club_teams
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION public.enforce_single_default_team();
