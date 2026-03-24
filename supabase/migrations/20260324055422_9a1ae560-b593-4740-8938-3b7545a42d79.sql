ALTER TABLE tracking_uploads 
  ADD COLUMN upload_mode text NOT NULL DEFAULT 'batch',
  ADD COLUMN chunks_received integer DEFAULT 0,
  ADD COLUMN last_chunk_at timestamptz;

ALTER TABLE ai_reports 
  ADD COLUMN depth text NOT NULL DEFAULT 'quick';