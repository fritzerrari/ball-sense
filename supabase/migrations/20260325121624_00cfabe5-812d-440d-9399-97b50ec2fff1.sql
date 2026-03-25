CREATE UNIQUE INDEX IF NOT EXISTS tracking_uploads_match_cam_mode_uniq ON public.tracking_uploads (match_id, camera_index, upload_mode);

-- Clean up existing duplicates first (keep newest per group)
DELETE FROM public.tracking_uploads t1
USING public.tracking_uploads t2
WHERE t1.match_id = t2.match_id
  AND t1.camera_index = t2.camera_index
  AND t1.upload_mode = t2.upload_mode
  AND t1.uploaded_at < t2.uploaded_at;