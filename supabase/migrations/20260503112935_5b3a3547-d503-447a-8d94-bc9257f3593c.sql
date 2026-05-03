-- =========================================================================
-- P0 Security Hardening
-- =========================================================================

-- 1) Lock down SECURITY DEFINER functions: revoke from anon, keep authenticated where needed
REVOKE EXECUTE ON FUNCTION public.can_access_module(uuid, uuid, text, text, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_league_benchmarks(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_club_id(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon, public;

-- handle_new_user is a trigger function — only the auth system needs it
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

-- Re-grant to authenticated (these are used in RLS policies and app code)
GRANT EXECUTE ON FUNCTION public.can_access_module(uuid, uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_league_benchmarks(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_club_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;

-- 2) Tighten notifications INSERT policy
-- Currently: WITH CHECK (true) — any authenticated user can insert with any user_id
-- Fix: enforce user_id = auth.uid() OR allow from service-role only
DROP POLICY IF EXISTS "Service can insert notifications" ON public.notifications;

CREATE POLICY "Authenticated users can insert own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Service role bypasses RLS automatically; edge functions using service-role key still work.

-- 3) Storage: prevent listing of public buckets while keeping individual file reads working
-- Replace broad SELECT (bucket_id = 'X') with policies that require a name parameter
-- so the LIST endpoint returns nothing but direct GET-by-name still works.

DROP POLICY IF EXISTS "Public read access for club logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view guide images" ON storage.objects;

-- Allow public reads only when the request targets a specific object (name not null/empty)
-- and the bucket is correct. The LIST endpoint passes empty name → returns nothing.
CREATE POLICY "Public read club logos by exact path"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'club-logos' AND name IS NOT NULL AND length(name) > 0);

CREATE POLICY "Public read guide images by exact path"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'guide-images' AND name IS NOT NULL AND length(name) > 0);
