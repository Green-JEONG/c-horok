ALTER TABLE horok_log.posts
ADD COLUMN IF NOT EXISTS thumbnail_crop JSONB;
