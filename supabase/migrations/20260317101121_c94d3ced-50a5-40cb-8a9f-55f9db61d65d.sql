
-- Admin can view all fields
CREATE POLICY "Admins can view all fields"
ON public.fields
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can delete any field
CREATE POLICY "Admins can delete any field"
ON public.fields
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can delete any match
CREATE POLICY "Admins can delete any match"
ON public.matches
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
