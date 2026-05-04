-- Enable pg_net for async HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger function: fires parent-notify when match becomes completed
CREATE OR REPLACE FUNCTION public.notify_match_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _url text;
  _key text;
BEGIN
  IF (TG_OP = 'UPDATE'
      AND NEW.status = 'completed'
      AND COALESCE(OLD.status, '') <> 'completed') THEN

    _url := current_setting('app.settings.supabase_url', true);
    _key := current_setting('app.settings.service_role_key', true);

    -- Fallback to env-based URL if settings missing
    IF _url IS NULL OR _url = '' THEN
      _url := 'https://jlccxvxcaqrdwraboadp.supabase.co';
    END IF;

    BEGIN
      PERFORM extensions.http_post(
        url := _url || '/functions/v1/parent-notify',
        body := jsonb_build_object('match_id', NEW.id),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(_key, '')
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'parent-notify call failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_match_completed ON public.matches;
CREATE TRIGGER trg_notify_match_completed
  AFTER UPDATE OF status ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_match_completed();

-- Public token-based lookup for parent self-service
CREATE OR REPLACE FUNCTION public.get_parent_subscription_by_token(_token text)
RETURNS TABLE (
  id uuid,
  player_id uuid,
  parent_email text,
  parent_name text,
  notify_on jsonb,
  active boolean,
  has_push boolean,
  player_name text,
  club_name text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ps.id,
    ps.player_id,
    ps.parent_email,
    ps.parent_name,
    ps.notify_on,
    ps.active,
    (ps.push_endpoint IS NOT NULL) AS has_push,
    p.name AS player_name,
    c.name AS club_name
  FROM public.parent_subscriptions ps
  LEFT JOIN public.players p ON p.id = ps.player_id
  LEFT JOIN public.clubs c ON c.id = ps.club_id
  WHERE ps.manage_token = _token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_parent_subscription_by_token(text) TO anon, authenticated;

-- Public token-based update
CREATE OR REPLACE FUNCTION public.update_parent_subscription_by_token(
  _token text,
  _push_endpoint text DEFAULT NULL,
  _push_p256dh text DEFAULT NULL,
  _push_auth text DEFAULT NULL,
  _notify_on jsonb DEFAULT NULL,
  _active boolean DEFAULT NULL,
  _parent_name text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  SELECT id INTO _id FROM public.parent_subscriptions WHERE manage_token = _token;
  IF _id IS NULL THEN RETURN false; END IF;

  UPDATE public.parent_subscriptions SET
    push_endpoint = COALESCE(_push_endpoint, push_endpoint),
    push_p256dh   = COALESCE(_push_p256dh,   push_p256dh),
    push_auth     = COALESCE(_push_auth,     push_auth),
    notify_on     = COALESCE(_notify_on,     notify_on),
    active        = COALESCE(_active,        active),
    parent_name   = COALESCE(_parent_name,   parent_name),
    confirmed_at  = COALESCE(confirmed_at, CASE WHEN _push_endpoint IS NOT NULL THEN now() ELSE confirmed_at END),
    updated_at    = now()
  WHERE id = _id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_parent_subscription_by_token(text, text, text, text, jsonb, boolean, text) TO anon, authenticated;