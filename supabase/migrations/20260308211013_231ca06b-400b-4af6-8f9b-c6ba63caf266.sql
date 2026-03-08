
-- Legal documents table
CREATE TABLE public.legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  html_content text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage legal documents"
ON public.legal_documents FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view active legal documents"
ON public.legal_documents FOR SELECT TO anon, authenticated
USING (active = true);

-- Audit logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete audit logs"
ON public.audit_logs FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Report generations rate limiting table
CREATE TABLE public.report_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  report_type text NOT NULL DEFAULT 'match',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.report_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own report generations"
ON public.report_generations FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert report generations"
ON public.report_generations FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all report generations"
ON public.report_generations FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin RLS for tracking_uploads
CREATE POLICY "Admins can view all uploads"
ON public.tracking_uploads FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all uploads"
ON public.tracking_uploads FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete uploads"
ON public.tracking_uploads FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
