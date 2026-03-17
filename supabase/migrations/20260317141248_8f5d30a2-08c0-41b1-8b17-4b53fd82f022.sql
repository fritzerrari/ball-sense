-- Allow anon uploads to tracking bucket (for QR-code multi-camera without login)
CREATE POLICY "Anon can upload tracking data"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'tracking');

-- Allow anon to read tracking data (for processing)
CREATE POLICY "Anon can read tracking data"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'tracking');