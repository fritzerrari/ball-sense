-- 1. Match-Tabelle: Gegner-Anreicherung
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS opponent_logo_url text,
  ADD COLUMN IF NOT EXISTS opponent_api_team_id integer,
  ADD COLUMN IF NOT EXISTS opponent_recent_form jsonb;

-- 2. Live-Coaching-Empfehlungen
CREATE TABLE IF NOT EXISTS public.live_coaching_advice (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  minute integer NOT NULL,
  half integer NOT NULL DEFAULT 1,
  headline text NOT NULL,
  reasoning text,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  urgency text NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low','medium','high')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.live_coaching_advice ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_live_coaching_match ON public.live_coaching_advice(match_id, minute);

CREATE POLICY "club members read live coaching"
ON public.live_coaching_advice FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    JOIN public.profiles p ON p.club_id = m.home_club_id
    WHERE m.id = live_coaching_advice.match_id AND p.user_id = auth.uid()
  )
);

-- 3. Schiri-Assist: Foul-Wahrscheinlichkeiten
CREATE TABLE IF NOT EXISTS public.foul_probability_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  minute integer NOT NULL,
  frame_ts numeric,
  probability numeric NOT NULL CHECK (probability >= 0 AND probability <= 1),
  severity text CHECK (severity IN ('none','foul','yellow','red')),
  team text CHECK (team IN ('home','away','unknown')),
  zone text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.foul_probability_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_foul_match_min ON public.foul_probability_events(match_id, minute);

CREATE POLICY "club members read foul probabilities"
ON public.foul_probability_events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    JOIN public.profiles p ON p.club_id = m.home_club_id
    WHERE m.id = foul_probability_events.match_id AND p.user_id = auth.uid()
  )
);

-- 4. Highlight-Reels (Social-Media-Clips)
CREATE TABLE IF NOT EXISTS public.highlight_reels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  format text NOT NULL DEFAULT 'square' CHECK (format IN ('square','portrait','landscape')),
  duration_sec integer NOT NULL DEFAULT 60,
  storyboard jsonb NOT NULL,
  share_url text,
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('processing','ready','failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.highlight_reels ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_reels_match ON public.highlight_reels(match_id);

CREATE POLICY "club members read reels"
ON public.highlight_reels FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    JOIN public.profiles p ON p.club_id = m.home_club_id
    WHERE m.id = highlight_reels.match_id AND p.user_id = auth.uid()
  )
);

-- 5. Pre-Match Briefings
CREATE TABLE IF NOT EXISTS public.prematch_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  briefing jsonb NOT NULL,
  pdf_url text,
  generated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.prematch_briefings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_briefings_match ON public.prematch_briefings(match_id);

CREATE POLICY "club members read briefings"
ON public.prematch_briefings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    JOIN public.profiles p ON p.club_id = m.home_club_id
    WHERE m.id = prematch_briefings.match_id AND p.user_id = auth.uid()
  )
);