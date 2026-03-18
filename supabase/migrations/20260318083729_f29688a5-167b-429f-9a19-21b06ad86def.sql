-- Expand match event modeling to support richer conceded-goal and weakness analysis.
ALTER TYPE public.match_event_type ADD VALUE IF NOT EXISTS 'goal';
ALTER TYPE public.match_event_type ADD VALUE IF NOT EXISTS 'conceded_goal';
ALTER TYPE public.match_event_type ADD VALUE IF NOT EXISTS 'yellow_card';
ALTER TYPE public.match_event_type ADD VALUE IF NOT EXISTS 'foul';
ALTER TYPE public.match_event_type ADD VALUE IF NOT EXISTS 'assist';
ALTER TYPE public.match_event_type ADD VALUE IF NOT EXISTS 'shot';
ALTER TYPE public.match_event_type ADD VALUE IF NOT EXISTS 'shot_on_target';
ALTER TYPE public.match_event_type ADD VALUE IF NOT EXISTS 'corner';
ALTER TYPE public.match_event_type ADD VALUE IF NOT EXISTS 'penalty';
ALTER TYPE public.match_event_type ADD VALUE IF NOT EXISTS 'counter_attack';
ALTER TYPE public.match_event_type ADD VALUE IF NOT EXISTS 'set_piece';

ALTER TABLE public.match_events
ADD COLUMN IF NOT EXISTS event_zone text,
ADD COLUMN IF NOT EXISTS event_cause text,
ADD COLUMN IF NOT EXISTS event_pattern text,
ADD COLUMN IF NOT EXISTS affected_line text,
ADD COLUMN IF NOT EXISTS severity integer,
ADD COLUMN IF NOT EXISTS possession_phase text;