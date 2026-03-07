-- Add logo_url column to clubs
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS logo_url text;

-- Create public bucket for club logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('club-logos', 'club-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to club-logos bucket
CREATE POLICY "Authenticated users can upload club logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'club-logos');

-- Allow public read access to club logos
CREATE POLICY "Public read access for club logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'club-logos');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update club logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'club-logos');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete club logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'club-logos');