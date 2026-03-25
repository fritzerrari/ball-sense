
-- Add job_kind to analysis_jobs to distinguish final vs live_partial jobs
ALTER TABLE public.analysis_jobs ADD COLUMN IF NOT EXISTS job_kind text NOT NULL DEFAULT 'final';
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_job_kind ON public.analysis_jobs (match_id, job_kind, created_at DESC);

-- Add transfer_authorized to camera_access_sessions
ALTER TABLE public.camera_access_sessions ADD COLUMN IF NOT EXISTS transfer_authorized boolean NOT NULL DEFAULT false;
ALTER TABLE public.camera_access_sessions ADD COLUMN IF NOT EXISTS transfer_authorized_at timestamptz;
