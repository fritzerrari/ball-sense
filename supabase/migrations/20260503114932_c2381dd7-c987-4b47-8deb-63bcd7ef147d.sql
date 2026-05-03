-- Revoke direct EXECUTE from authenticated/anon for SECURITY DEFINER helpers.
-- They remain callable internally from RLS policies and other DB functions.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_club_id(uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.can_access_module(uuid, uuid, text, text, text, text) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.get_league_benchmarks(uuid, text) FROM authenticated, anon, public;