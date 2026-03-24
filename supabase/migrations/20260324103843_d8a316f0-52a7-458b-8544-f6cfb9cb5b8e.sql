DROP POLICY IF EXISTS "Users can view own superadmin status" ON public.super_admins;
DROP POLICY IF EXISTS "Superadmins can manage super admins" ON public.super_admins;

CREATE POLICY "Users can view own superadmin status"
  ON public.super_admins
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Superadmins can manage super admins"
  ON public.super_admins
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));