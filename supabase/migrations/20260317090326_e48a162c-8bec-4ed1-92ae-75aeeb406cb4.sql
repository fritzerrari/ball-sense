
-- Allow anon and authenticated uploads to tracking bucket
CREATE POLICY "Allow tracking uploads" ON storage.objects
FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'tracking');

-- Allow reading tracking data for authenticated users
CREATE POLICY "Allow tracking reads" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'tracking');
