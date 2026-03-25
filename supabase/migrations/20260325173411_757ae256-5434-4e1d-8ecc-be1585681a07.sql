
INSERT INTO storage.buckets (id, name, public) VALUES ('match-frames', 'match-frames', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Club members can upload match frames" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'match-frames');

CREATE POLICY "Club members can read match frames" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'match-frames');

CREATE POLICY "Service can manage match frames" ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'match-frames');
