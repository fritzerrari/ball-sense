
-- Profiles table to link auth users to clubs
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Clubs table
CREATE TABLE public.clubs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT,
  league TEXT,
  plan TEXT NOT NULL DEFAULT 'trial',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

-- Add FK from profiles to clubs
ALTER TABLE public.profiles ADD CONSTRAINT profiles_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE SET NULL;

-- Security definer function to get user's club_id
CREATE OR REPLACE FUNCTION public.get_user_club_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT club_id FROM public.profiles WHERE user_id = _user_id LIMIT 1;
$$;

-- Players table
CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  number INTEGER,
  position TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Fields table
CREATE TABLE public.fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  width_m DOUBLE PRECISION NOT NULL DEFAULT 105,
  height_m DOUBLE PRECISION NOT NULL DEFAULT 68,
  calibration JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.fields ENABLE ROW LEVEL SECURITY;

-- Matches table
CREATE TABLE public.matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  home_club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  away_club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  away_club_name TEXT,
  field_id UUID NOT NULL REFERENCES public.fields(id) ON DELETE RESTRICT,
  date DATE NOT NULL,
  kickoff TIME,
  status TEXT NOT NULL DEFAULT 'setup',
  home_formation TEXT,
  away_formation TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Match lineups
CREATE TABLE public.match_lineups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  team TEXT NOT NULL,
  starting BOOLEAN NOT NULL DEFAULT true,
  shirt_number INTEGER,
  player_name TEXT,
  subbed_out_min INTEGER,
  subbed_in_min INTEGER
);

ALTER TABLE public.match_lineups ENABLE ROW LEVEL SECURITY;

-- Tracking uploads
CREATE TABLE public.tracking_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  camera_index INTEGER NOT NULL DEFAULT 0,
  file_path TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded',
  frames_count INTEGER,
  duration_sec INTEGER,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tracking_uploads ENABLE ROW LEVEL SECURITY;

-- Player match stats
CREATE TABLE public.player_match_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  team TEXT NOT NULL,
  distance_km DOUBLE PRECISION,
  top_speed_kmh DOUBLE PRECISION,
  avg_speed_kmh DOUBLE PRECISION,
  sprint_count INTEGER DEFAULT 0,
  sprint_distance_m DOUBLE PRECISION DEFAULT 0,
  minutes_played INTEGER,
  heatmap_grid JSONB,
  positions_raw JSONB
);

ALTER TABLE public.player_match_stats ENABLE ROW LEVEL SECURITY;

-- Team match stats
CREATE TABLE public.team_match_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team TEXT NOT NULL,
  total_distance_km DOUBLE PRECISION,
  avg_distance_km DOUBLE PRECISION,
  top_speed_kmh DOUBLE PRECISION,
  formation_heatmap JSONB,
  possession_pct DOUBLE PRECISION
);

ALTER TABLE public.team_match_stats ENABLE ROW LEVEL SECURITY;

-- =====================
-- RLS POLICIES
-- =====================

-- Profiles: users can read/update their own
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Clubs: only members can see/edit their club
CREATE POLICY "Club members can view their club" ON public.clubs FOR SELECT USING (id = public.get_user_club_id(auth.uid()));
CREATE POLICY "Club members can update their club" ON public.clubs FOR UPDATE USING (id = public.get_user_club_id(auth.uid()));
CREATE POLICY "Authenticated users can create clubs" ON public.clubs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Players: via club_id
CREATE POLICY "Club members can view players" ON public.players FOR SELECT USING (club_id = public.get_user_club_id(auth.uid()));
CREATE POLICY "Club members can insert players" ON public.players FOR INSERT WITH CHECK (club_id = public.get_user_club_id(auth.uid()));
CREATE POLICY "Club members can update players" ON public.players FOR UPDATE USING (club_id = public.get_user_club_id(auth.uid()));
CREATE POLICY "Club members can delete players" ON public.players FOR DELETE USING (club_id = public.get_user_club_id(auth.uid()));

-- Fields: via club_id
CREATE POLICY "Club members can view fields" ON public.fields FOR SELECT USING (club_id = public.get_user_club_id(auth.uid()));
CREATE POLICY "Club members can insert fields" ON public.fields FOR INSERT WITH CHECK (club_id = public.get_user_club_id(auth.uid()));
CREATE POLICY "Club members can update fields" ON public.fields FOR UPDATE USING (club_id = public.get_user_club_id(auth.uid()));
CREATE POLICY "Club members can delete fields" ON public.fields FOR DELETE USING (club_id = public.get_user_club_id(auth.uid()));

-- Matches: via home_club_id
CREATE POLICY "Club members can view matches" ON public.matches FOR SELECT USING (home_club_id = public.get_user_club_id(auth.uid()));
CREATE POLICY "Club members can insert matches" ON public.matches FOR INSERT WITH CHECK (home_club_id = public.get_user_club_id(auth.uid()));
CREATE POLICY "Club members can update matches" ON public.matches FOR UPDATE USING (home_club_id = public.get_user_club_id(auth.uid()));
CREATE POLICY "Club members can delete matches" ON public.matches FOR DELETE USING (home_club_id = public.get_user_club_id(auth.uid()));

-- Match lineups: via match -> home_club_id
CREATE POLICY "Club members can view lineups" ON public.match_lineups FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND m.home_club_id = public.get_user_club_id(auth.uid()))
);
CREATE POLICY "Club members can insert lineups" ON public.match_lineups FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND m.home_club_id = public.get_user_club_id(auth.uid()))
);
CREATE POLICY "Club members can update lineups" ON public.match_lineups FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND m.home_club_id = public.get_user_club_id(auth.uid()))
);
CREATE POLICY "Club members can delete lineups" ON public.match_lineups FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND m.home_club_id = public.get_user_club_id(auth.uid()))
);

-- Tracking uploads: via match -> home_club_id
CREATE POLICY "Club members can view uploads" ON public.tracking_uploads FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND m.home_club_id = public.get_user_club_id(auth.uid()))
);
CREATE POLICY "Club members can insert uploads" ON public.tracking_uploads FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND m.home_club_id = public.get_user_club_id(auth.uid()))
);
CREATE POLICY "Club members can update uploads" ON public.tracking_uploads FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND m.home_club_id = public.get_user_club_id(auth.uid()))
);

-- Player match stats: via match -> home_club_id
CREATE POLICY "Club members can view player stats" ON public.player_match_stats FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND m.home_club_id = public.get_user_club_id(auth.uid()))
);
CREATE POLICY "Club members can insert player stats" ON public.player_match_stats FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND m.home_club_id = public.get_user_club_id(auth.uid()))
);

-- Team match stats: via match -> home_club_id
CREATE POLICY "Club members can view team stats" ON public.team_match_stats FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND m.home_club_id = public.get_user_club_id(auth.uid()))
);
CREATE POLICY "Club members can insert team stats" ON public.team_match_stats FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND m.home_club_id = public.get_user_club_id(auth.uid()))
);

-- Trigger for auto-creating profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket for tracking data
INSERT INTO storage.buckets (id, name, public) VALUES ('tracking', 'tracking', false);

CREATE POLICY "Club members can upload tracking files" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'tracking' AND auth.uid() IS NOT NULL);

CREATE POLICY "Club members can view tracking files" ON storage.objects FOR SELECT 
USING (bucket_id = 'tracking' AND auth.uid() IS NOT NULL);
