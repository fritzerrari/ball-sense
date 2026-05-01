ALTER TABLE public.documentation
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'user';

ALTER TABLE public.documentation
  ADD CONSTRAINT documentation_audience_check
  CHECK (audience IN ('user', 'admin', 'dev'));

CREATE UNIQUE INDEX IF NOT EXISTS changelog_version_title_uq
  ON public.changelog (version, title);
