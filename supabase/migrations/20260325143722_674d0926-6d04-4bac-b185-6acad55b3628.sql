-- Clean up duplicate tracking_uploads: keep newest per (match_id, camera_index, upload_mode)
DELETE FROM public.tracking_uploads
WHERE id NOT IN (
  SELECT DISTINCT ON (match_id, camera_index, upload_mode) id
  FROM public.tracking_uploads
  ORDER BY match_id, camera_index, upload_mode, uploaded_at DESC
);

-- Create unique index to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS uq_tracking_uploads_match_cam_mode 
ON public.tracking_uploads (match_id, camera_index, upload_mode);