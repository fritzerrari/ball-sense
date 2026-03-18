-- Extend legal documents with document type metadata
ALTER TABLE public.legal_documents
ADD COLUMN IF NOT EXISTS document_type text,
ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS summary text;

CREATE UNIQUE INDEX IF NOT EXISTS legal_documents_slug_key ON public.legal_documents (slug);
CREATE INDEX IF NOT EXISTS legal_documents_document_type_idx ON public.legal_documents (document_type, sort_order);

-- Tracking quality metadata on stats
ALTER TABLE public.player_match_stats
ADD COLUMN IF NOT EXISTS quality_score integer,
ADD COLUMN IF NOT EXISTS anomaly_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS suspected_cause text,
ADD COLUMN IF NOT EXISTS corrected_top_speed_kmh double precision,
ADD COLUMN IF NOT EXISTS corrected_avg_speed_kmh double precision,
ADD COLUMN IF NOT EXISTS corrected_distance_km double precision,
ADD COLUMN IF NOT EXISTS raw_metrics jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.team_match_stats
ADD COLUMN IF NOT EXISTS quality_score integer,
ADD COLUMN IF NOT EXISTS anomaly_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS suspected_cause text,
ADD COLUMN IF NOT EXISTS raw_metrics jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS player_match_stats_quality_score_idx ON public.player_match_stats (quality_score);
CREATE INDEX IF NOT EXISTS player_match_stats_anomaly_flags_idx ON public.player_match_stats USING gin (anomaly_flags);

-- Separate superadmin table to avoid enum migration issues
CREATE TABLE IF NOT EXISTS public.super_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'super_admins' AND policyname = 'Superadmins can manage super admins'
  ) THEN
    CREATE POLICY "Superadmins can manage super admins"
    ON public.super_admins
    FOR ALL
    TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.super_admins sa WHERE sa.user_id = auth.uid() AND sa.active = true
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.super_admins sa WHERE sa.user_id = auth.uid() AND sa.active = true
    ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'super_admins' AND policyname = 'Users can view own superadmin status'
  ) THEN
    CREATE POLICY "Users can view own superadmin status"
    ON public.super_admins
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.super_admins sa WHERE sa.user_id = auth.uid() AND sa.active = true
    ));
  END IF;
END $$;

DROP TRIGGER IF EXISTS set_super_admins_updated_at ON public.super_admins;
CREATE TRIGGER set_super_admins_updated_at
BEFORE UPDATE ON public.super_admins
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.super_admins
    WHERE user_id = _user_id
      AND active = true
  )
$$;

-- Module catalog
CREATE TABLE IF NOT EXISTS public.app_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.app_modules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_modules' AND policyname = 'Superadmins can manage app modules'
  ) THEN
    CREATE POLICY "Superadmins can manage app modules"
    ON public.app_modules
    FOR ALL
    TO authenticated
    USING (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_modules' AND policyname = 'Authenticated users can view active modules'
  ) THEN
    CREATE POLICY "Authenticated users can view active modules"
    ON public.app_modules
    FOR SELECT
    TO authenticated
    USING (active = true OR public.is_super_admin(auth.uid()));
  END IF;
END $$;

-- Permission matrix per plan/module/action
CREATE TABLE IF NOT EXISTS public.module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.app_modules(id) ON DELETE CASCADE,
  scope_type text NOT NULL,
  scope_id text,
  plan text,
  role app_role,
  tab_key text,
  action_key text,
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT module_permissions_scope_type_check CHECK (scope_type IN ('plan', 'club', 'user', 'role')),
  CONSTRAINT module_permissions_target_check CHECK (
    (scope_type = 'plan' AND plan IS NOT NULL AND scope_id IS NULL)
    OR (scope_type IN ('club', 'user') AND scope_id IS NOT NULL)
    OR (scope_type = 'role' AND role IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS module_permissions_lookup_idx
ON public.module_permissions (scope_type, scope_id, plan, role, module_id, tab_key, action_key);

ALTER TABLE public.module_permissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'module_permissions' AND policyname = 'Superadmins can manage module permissions'
  ) THEN
    CREATE POLICY "Superadmins can manage module permissions"
    ON public.module_permissions
    FOR ALL
    TO authenticated
    USING (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'module_permissions' AND policyname = 'Admins can view module permissions'
  ) THEN
    CREATE POLICY "Admins can view module permissions"
    ON public.module_permissions
    FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));
  END IF;
END $$;

-- Club level module enablement
CREATE TABLE IF NOT EXISTS public.club_module_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.app_modules(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  notes text,
  assigned_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (club_id, module_id)
);

CREATE INDEX IF NOT EXISTS club_module_assignments_club_idx ON public.club_module_assignments (club_id, module_id, enabled);
ALTER TABLE public.club_module_assignments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'club_module_assignments' AND policyname = 'Superadmins can manage club module assignments'
  ) THEN
    CREATE POLICY "Superadmins can manage club module assignments"
    ON public.club_module_assignments
    FOR ALL
    TO authenticated
    USING (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'club_module_assignments' AND policyname = 'Club admins can view own club module assignments'
  ) THEN
    CREATE POLICY "Club admins can view own club module assignments"
    ON public.club_module_assignments
    FOR SELECT
    TO authenticated
    USING (
      club_id = public.get_user_club_id(auth.uid())
      AND (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()))
    );
  END IF;
END $$;

-- User specific overrides
CREATE TABLE IF NOT EXISTS public.user_module_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_id uuid NOT NULL REFERENCES public.app_modules(id) ON DELETE CASCADE,
  tab_key text,
  action_key text,
  allowed boolean NOT NULL DEFAULT true,
  notes text,
  assigned_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (user_id, module_id, tab_key, action_key)
);

CREATE INDEX IF NOT EXISTS user_module_overrides_user_idx ON public.user_module_overrides (user_id, module_id, tab_key, action_key);
ALTER TABLE public.user_module_overrides ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_module_overrides' AND policyname = 'Superadmins can manage user module overrides'
  ) THEN
    CREATE POLICY "Superadmins can manage user module overrides"
    ON public.user_module_overrides
    FOR ALL
    TO authenticated
    USING (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_module_overrides' AND policyname = 'Users can view own module overrides'
  ) THEN
    CREATE POLICY "Users can view own module overrides"
    ON public.user_module_overrides
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
  END IF;
END $$;

-- Triggers
DROP TRIGGER IF EXISTS set_app_modules_updated_at ON public.app_modules;
CREATE TRIGGER set_app_modules_updated_at
BEFORE UPDATE ON public.app_modules
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_module_permissions_updated_at ON public.module_permissions;
CREATE TRIGGER set_module_permissions_updated_at
BEFORE UPDATE ON public.module_permissions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_club_module_assignments_updated_at ON public.club_module_assignments;
CREATE TRIGGER set_club_module_assignments_updated_at
BEFORE UPDATE ON public.club_module_assignments
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_user_module_overrides_updated_at ON public.user_module_overrides;
CREATE TRIGGER set_user_module_overrides_updated_at
BEFORE UPDATE ON public.user_module_overrides
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

-- Permission resolution helper
CREATE OR REPLACE FUNCTION public.can_access_module(
  _user_id uuid,
  _club_id uuid,
  _plan text,
  _module_key text,
  _tab_key text DEFAULT NULL,
  _action_key text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _module_id uuid;
  _result boolean;
BEGIN
  IF public.is_super_admin(_user_id) THEN
    RETURN true;
  END IF;

  SELECT id INTO _module_id
  FROM public.app_modules
  WHERE key = _module_key
    AND active = true
  LIMIT 1;

  IF _module_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT umo.allowed INTO _result
  FROM public.user_module_overrides umo
  WHERE umo.user_id = _user_id
    AND umo.module_id = _module_id
    AND COALESCE(umo.tab_key, '') = COALESCE(_tab_key, '')
    AND COALESCE(umo.action_key, '') = COALESCE(_action_key, '')
  LIMIT 1;

  IF _result IS NOT NULL THEN
    RETURN _result;
  END IF;

  SELECT cma.enabled INTO _result
  FROM public.club_module_assignments cma
  WHERE cma.club_id = _club_id
    AND cma.module_id = _module_id
  LIMIT 1;

  IF _result IS NOT NULL AND _result = false THEN
    RETURN false;
  END IF;

  SELECT mp.allowed INTO _result
  FROM public.module_permissions mp
  WHERE mp.module_id = _module_id
    AND (
      (mp.scope_type = 'plan' AND mp.plan = _plan)
      OR (mp.scope_type = 'club' AND mp.scope_id = _club_id::text)
      OR (mp.scope_type = 'user' AND mp.scope_id = _user_id::text)
      OR (mp.scope_type = 'role' AND public.has_role(_user_id, mp.role))
    )
    AND COALESCE(mp.tab_key, '') = COALESCE(_tab_key, '')
    AND COALESCE(mp.action_key, '') = COALESCE(_action_key, '')
  ORDER BY CASE mp.scope_type WHEN 'user' THEN 1 WHEN 'club' THEN 2 WHEN 'role' THEN 3 ELSE 4 END
  LIMIT 1;

  RETURN COALESCE(_result, true);
END;
$$;

-- Seed default module catalog
INSERT INTO public.app_modules (key, name, description, sort_order)
VALUES
  ('dashboard', 'Dashboard', 'Startseite, KPIs und Coach Guide', 10),
  ('matches', 'Spiele', 'Spiele, Matchreport und Events', 20),
  ('players', 'Spieler', 'Kader, Profile und Consent', 30),
  ('tracking', 'Tracking', 'Tracking, Uploads und Kamera-Zugänge', 40),
  ('reports', 'Berichte', 'KI-Berichte, Presse und Exporte', 50),
  ('assistant', 'Assistent', 'KI-Assistent und Analysen', 60),
  ('legal', 'Recht', 'Rechtliche Dokumente und Compliance', 70),
  ('admin', 'Administration', 'Vereins- und Systemverwaltung', 80)
ON CONFLICT (key) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

INSERT INTO public.module_permissions (module_id, scope_type, plan, tab_key, action_key, allowed)
SELECT m.id, 'plan', plan_name, NULL, NULL,
  CASE
    WHEN plan_name = 'trial' AND m.key IN ('dashboard', 'matches', 'players', 'tracking') THEN true
    WHEN plan_name = 'trial' THEN false
    WHEN plan_name = 'starter' AND m.key IN ('dashboard', 'matches', 'players', 'tracking', 'reports') THEN true
    WHEN plan_name = 'starter' THEN false
    WHEN plan_name = 'club' AND m.key IN ('dashboard', 'matches', 'players', 'tracking', 'reports', 'assistant') THEN true
    WHEN plan_name = 'club' AND m.key = 'legal' THEN false
    ELSE true
  END
FROM public.app_modules m
CROSS JOIN (VALUES ('trial'), ('starter'), ('club'), ('pro')) AS plans(plan_name)
ON CONFLICT DO NOTHING;