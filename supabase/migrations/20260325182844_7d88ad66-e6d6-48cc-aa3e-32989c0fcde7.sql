
-- Add highlight columns to match_videos
ALTER TABLE public.match_videos
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS event_minute integer,
  ADD COLUMN IF NOT EXISTS video_type text NOT NULL DEFAULT 'highlight';

-- DELETE policy for club members
CREATE POLICY "Club members can delete match videos"
  ON public.match_videos
  FOR DELETE
  TO public
  USING (club_id = get_user_club_id(auth.uid()));
