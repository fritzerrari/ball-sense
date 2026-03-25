-- New tables for Match Intelligence Platform

-- Video uploads (replaces complex tracking_uploads for new flow)
CREATE TABLE IF NOT EXISTS public.match_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id),
  file_path text NOT NULL,
  duration_sec integer,
  file_size_bytes bigint,
  status text NOT NULL DEFAULT 'uploaded',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.match_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view match videos"
  ON public.match_videos FOR SELECT
  USING (club_id = get_user_club_id(auth.uid()));

CREATE POLICY "Club members can insert match videos"
  ON public.match_videos FOR INSERT
  WITH CHECK (club_id = get_user_club_id(auth.uid()));

CREATE POLICY "Admins can view all match videos"
  ON public.match_videos FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Analysis jobs
CREATE TABLE IF NOT EXISTS public.analysis_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  video_id uuid REFERENCES public.match_videos(id),
  status text NOT NULL DEFAULT 'queued',
  progress integer DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analysis_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view analysis jobs"
  ON public.analysis_jobs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM matches m WHERE m.id = analysis_jobs.match_id AND m.home_club_id = get_user_club_id(auth.uid())
  ));

CREATE POLICY "Club members can insert analysis jobs"
  ON public.analysis_jobs FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM matches m WHERE m.id = analysis_jobs.match_id AND m.home_club_id = get_user_club_id(auth.uid())
  ));

CREATE POLICY "Admins can view all analysis jobs"
  ON public.analysis_jobs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Analysis results (structured tactical data)
CREATE TABLE IF NOT EXISTS public.analysis_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  result_type text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view analysis results"
  ON public.analysis_results FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM matches m WHERE m.id = analysis_results.match_id AND m.home_club_id = get_user_club_id(auth.uid())
  ));

CREATE POLICY "Admins can view all analysis results"
  ON public.analysis_results FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Report sections (AI-generated)
CREATE TABLE IF NOT EXISTS public.report_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  section_type text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  confidence text DEFAULT 'high',
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.report_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view report sections"
  ON public.report_sections FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM matches m WHERE m.id = report_sections.match_id AND m.home_club_id = get_user_club_id(auth.uid())
  ));

CREATE POLICY "Admins can view all report sections"
  ON public.report_sections FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Training recommendations
CREATE TABLE IF NOT EXISTS public.training_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id),
  title text NOT NULL,
  description text NOT NULL,
  priority integer DEFAULT 1,
  category text,
  linked_pattern text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.training_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view training recommendations"
  ON public.training_recommendations FOR SELECT
  USING (club_id = get_user_club_id(auth.uid()));

CREATE POLICY "Admins can view all training recommendations"
  ON public.training_recommendations FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Storage bucket for match videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('match-videos', 'match-videos', false)
ON CONFLICT (id) DO NOTHING;