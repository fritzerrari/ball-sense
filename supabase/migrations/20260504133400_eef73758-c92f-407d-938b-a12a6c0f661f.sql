-- Player Portal Invites
CREATE TABLE IF NOT EXISTS public.player_portal_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid NOT NULL,
  user_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked')),
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  notes text,
  UNIQUE (player_id, email)
);

CREATE INDEX IF NOT EXISTS idx_ppi_email ON public.player_portal_invites (lower(email));
CREATE INDEX IF NOT EXISTS idx_ppi_user_id ON public.player_portal_invites (user_id);
CREATE INDEX IF NOT EXISTS idx_ppi_club_id ON public.player_portal_invites (club_id);

ALTER TABLE public.player_portal_invites ENABLE ROW LEVEL SECURITY;

-- Trainer/Admin des eigenen Clubs darf alles
CREATE POLICY "ppi_club_admin_all" ON public.player_portal_invites
  FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR club_id = public.get_user_club_id(auth.uid())
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR club_id = public.get_user_club_id(auth.uid())
  );

-- Eingeladener Nutzer darf seine eigene Einladung sehen
CREATE POLICY "ppi_invitee_read" ON public.player_portal_invites
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );

-- Markiere Profile als Spieler-Portal-Profile (Read-Only)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS player_portal_player_id uuid REFERENCES public.players(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_portal_player ON public.profiles (player_portal_player_id);

-- Trigger: bei Signup/Login Einladung auto-verknüpfen
CREATE OR REPLACE FUNCTION public.link_player_portal_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _invite_id uuid;
  _player_id uuid;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = NEW.user_id;
  IF _email IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, player_id INTO _invite_id, _player_id
  FROM public.player_portal_invites
  WHERE lower(email) = lower(_email)
    AND status = 'pending'
  ORDER BY invited_at DESC
  LIMIT 1;

  IF _invite_id IS NOT NULL THEN
    UPDATE public.player_portal_invites
       SET status = 'accepted',
           user_id = NEW.user_id,
           accepted_at = now()
     WHERE id = _invite_id;

    NEW.player_portal_player_id := _player_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_player_portal_invite ON public.profiles;
CREATE TRIGGER trg_link_player_portal_invite
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.link_player_portal_invite();

-- Helper: prüfen ob aktueller User ein verlinkter Spieler ist
CREATE OR REPLACE FUNCTION public.current_portal_player_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT player_portal_player_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Erweitere RLS: Spieler-Portal-User darf eigene Stats lesen
CREATE POLICY "player_match_stats_portal_read" ON public.player_match_stats
  FOR SELECT TO authenticated
  USING (player_id = public.current_portal_player_id());

CREATE POLICY "matches_portal_read" ON public.matches
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.match_lineups ml
      WHERE ml.match_id = matches.id
        AND ml.player_id = public.current_portal_player_id()
    )
  );

CREATE POLICY "players_portal_read" ON public.players
  FOR SELECT TO authenticated
  USING (id = public.current_portal_player_id());