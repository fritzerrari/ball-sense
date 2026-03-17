CREATE POLICY "Authenticated users can upload tracking data"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'tracking');

CREATE POLICY "Authenticated users can read tracking data"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'tracking');

CREATE POLICY "Authenticated users can update tracking data"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'tracking');