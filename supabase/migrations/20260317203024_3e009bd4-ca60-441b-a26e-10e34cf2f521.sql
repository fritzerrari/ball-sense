-- Create match event types for tracking-aware lineup automation
DO $$ BEGIN
  CREATE TYPE public.match_event_type AS ENUM ('substitution', 'red_card', 'yellow_red_card', 'player_deactivated');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create match_events table for timeline-based player availability
CREATE TABLE IF NOT EXISTS public.match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team TEXT NOT NULL,
  minute INTEGER NOT NULL,
  event_type public.match_event_type NOT NULL,
  player_id UUID NULL REFERENCES public.players(id) ON DELETE SET NULL,
  related_player_id UUID NULL REFERENCES public.players(id) ON DELETE SET NULL,
  player_name TEXT NULL,
  related_player_name TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;

-- Club members for the home club can view events for their own matches
CREATE POLICY "Club members can view match events"
ON public.match_events
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = match_events.match_id
      AND m.home_club_id = public.get_user_club_id(auth.uid())
  )
);

-- Club members for the home club can insert events for their own matches
CREATE POLICY "Club members can insert match events"
ON public.match_events
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = match_events.match_id
      AND m.home_club_id = public.get_user_club_id(auth.uid())
  )
);

-- Club members for the home club can update events for their own matches
CREATE POLICY "Club members can update match events"
ON public.match_events
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = match_events.match_id
      AND m.home_club_id = public.get_user_club_id(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = match_events.match_id
      AND m.home_club_id = public.get_user_club_id(auth.uid())
  )
);

-- Club members for the home club can delete events for their own matches
CREATE POLICY "Club members can delete match events"
ON public.match_events
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = match_events.match_id
      AND m.home_club_id = public.get_user_club_id(auth.uid())
  )
);

-- Helpful indexes for timeline queries
CREATE INDEX IF NOT EXISTS idx_match_events_match_minute
  ON public.match_events (match_id, minute);

CREATE INDEX IF NOT EXISTS idx_match_events_match_type
  ON public.match_events (match_id, event_type);

CREATE INDEX IF NOT EXISTS idx_match_events_player_id
  ON public.match_events (player_id);

CREATE INDEX IF NOT EXISTS idx_match_events_related_player_id
  ON public.match_events (related_player_id);