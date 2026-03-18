-- Match consent flags for legal confirmation during setup
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS consent_players_confirmed boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS consent_minors_confirmed boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS track_opponent boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS opponent_consent_confirmed boolean NOT NULL DEFAULT false;

-- Allow excluding individual lineup entries from tracking
ALTER TABLE public.match_lineups
ADD COLUMN IF NOT EXISTS excluded_from_tracking boolean NOT NULL DEFAULT false;

-- Camera access codes for simplified tracking device access
CREATE TABLE IF NOT EXISTS public.camera_access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  label text NOT NULL,
  code_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by_user_id uuid NOT NULL,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.camera_access_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view own camera access codes"
ON public.camera_access_codes
FOR SELECT
TO authenticated
USING (club_id = public.get_user_club_id(auth.uid()));

CREATE POLICY "Club members can insert own camera access codes"
ON public.camera_access_codes
FOR INSERT
TO authenticated
WITH CHECK (
  club_id = public.get_user_club_id(auth.uid())
  AND created_by_user_id = auth.uid()
);

CREATE POLICY "Club members can update own camera access codes"
ON public.camera_access_codes
FOR UPDATE
TO authenticated
USING (club_id = public.get_user_club_id(auth.uid()))
WITH CHECK (club_id = public.get_user_club_id(auth.uid()));

CREATE POLICY "Club members can delete own camera access codes"
ON public.camera_access_codes
FOR DELETE
TO authenticated
USING (club_id = public.get_user_club_id(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_camera_access_codes_club_id
  ON public.camera_access_codes (club_id);

CREATE INDEX IF NOT EXISTS idx_camera_access_codes_active_club
  ON public.camera_access_codes (club_id, active);

-- Short-lived sessions for public tracking devices
CREATE TABLE IF NOT EXISTS public.camera_access_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  code_id uuid NOT NULL REFERENCES public.camera_access_codes(id) ON DELETE CASCADE,
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE,
  camera_index integer,
  session_token_hash text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.camera_access_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view own camera sessions"
ON public.camera_access_sessions
FOR SELECT
TO authenticated
USING (club_id = public.get_user_club_id(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_camera_access_sessions_club_id
  ON public.camera_access_sessions (club_id);

CREATE INDEX IF NOT EXISTS idx_camera_access_sessions_match_id
  ON public.camera_access_sessions (match_id);

CREATE INDEX IF NOT EXISTS idx_camera_access_sessions_expires_at
  ON public.camera_access_sessions (expires_at);

-- Keep camera code timestamps current
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_camera_access_codes_updated_at ON public.camera_access_codes;
CREATE TRIGGER set_camera_access_codes_updated_at
BEFORE UPDATE ON public.camera_access_codes
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

-- Enforce a maximum of 3 active camera codes per club
CREATE OR REPLACE FUNCTION public.enforce_camera_code_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  active_count integer;
BEGIN
  IF NEW.active IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  SELECT count(*)
  INTO active_count
  FROM public.camera_access_codes
  WHERE club_id = NEW.club_id
    AND active = true
    AND id <> COALESCE(NEW.id, gen_random_uuid());

  IF active_count >= 3 THEN
    RAISE EXCEPTION 'A club can only have up to 3 active camera access codes';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_camera_code_limit_trigger ON public.camera_access_codes;
CREATE TRIGGER enforce_camera_code_limit_trigger
BEFORE INSERT OR UPDATE ON public.camera_access_codes
FOR EACH ROW
EXECUTE FUNCTION public.enforce_camera_code_limit();