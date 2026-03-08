
-- Allow admins to view ALL clubs
CREATE POLICY "Admins can view all clubs"
ON public.clubs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update ALL clubs (e.g. change plan)
CREATE POLICY "Admins can update all clubs"
ON public.clubs FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view ALL profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view ALL players
CREATE POLICY "Admins can view all players"
ON public.players FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view ALL matches
CREATE POLICY "Admins can view all matches"
ON public.matches FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view ALL player_match_stats
CREATE POLICY "Admins can view all player stats"
ON public.player_match_stats FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view ALL team_match_stats
CREATE POLICY "Admins can view all team stats"
ON public.team_match_stats FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to manage all user_roles (already exists but let's ensure)
-- The existing policy uses ALL command, so it should work
