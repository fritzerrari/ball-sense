
-- Device guides table
CREATE TABLE public.device_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  model text NOT NULL,
  guide_chapters jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.device_guides ENABLE ROW LEVEL SECURITY;

-- Public can read active guides
CREATE POLICY "Anyone can view active guides"
  ON public.device_guides FOR SELECT
  USING (active = true);

-- Admins full CRUD
CREATE POLICY "Admins can manage guides"
  ON public.device_guides FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Storage bucket for guide images
INSERT INTO storage.buckets (id, name, public)
VALUES ('guide-images', 'guide-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for guide-images
CREATE POLICY "Anyone can view guide images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'guide-images');

CREATE POLICY "Admins can upload guide images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'guide-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete guide images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'guide-images' AND public.has_role(auth.uid(), 'admin'));
