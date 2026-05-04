-- Function to recompute scores from match_events
CREATE OR REPLACE FUNCTION public.recompute_match_scores(_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _home int;
  _away int;
BEGIN
  SELECT
    COALESCE(SUM(CASE
      WHEN event_type = 'goal' AND team = 'home' THEN 1
      WHEN event_type = 'own_goal' AND team = 'away' THEN 1
      ELSE 0 END), 0),
    COALESCE(SUM(CASE
      WHEN event_type = 'goal' AND team = 'away' THEN 1
      WHEN event_type = 'own_goal' AND team = 'home' THEN 1
      ELSE 0 END), 0)
  INTO _home, _away
  FROM public.match_events
  WHERE match_id = _match_id;

  UPDATE public.matches
  SET home_score = _home,
      away_score = _away
  WHERE id = _match_id;
END;
$$;

-- Trigger function
CREATE OR REPLACE FUNCTION public.trg_match_events_score_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_match_scores(OLD.match_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND OLD.match_id <> NEW.match_id THEN
    PERFORM public.recompute_match_scores(OLD.match_id);
    PERFORM public.recompute_match_scores(NEW.match_id);
    RETURN NEW;
  ELSE
    PERFORM public.recompute_match_scores(NEW.match_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS match_events_score_sync ON public.match_events;
CREATE TRIGGER match_events_score_sync
AFTER INSERT OR UPDATE OR DELETE ON public.match_events
FOR EACH ROW
EXECUTE FUNCTION public.trg_match_events_score_sync();

-- Backfill existing matches
DO $$
DECLARE
  _m record;
BEGIN
  FOR _m IN SELECT DISTINCT match_id FROM public.match_events LOOP
    PERFORM public.recompute_match_scores(_m.match_id);
  END LOOP;
END $$;