
-- Fix infinite recursion between matches and match_lineups RLS policies
CREATE OR REPLACE FUNCTION public.player_has_match_lineup(_match_id uuid, _player_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.match_lineups
    WHERE match_id = _match_id AND player_id = _player_id
  )
$$;

DROP POLICY IF EXISTS "matches_portal_read" ON public.matches;

CREATE POLICY "matches_portal_read"
ON public.matches
FOR SELECT
TO authenticated
USING (public.player_has_match_lineup(id, current_portal_player_id()));
