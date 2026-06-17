ALTER TABLE horok_tech.posts
ADD COLUMN IF NOT EXISTS quoted_post_id BIGINT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'posts_quoted_post_id_fkey'
      AND conrelid = 'horok_tech.posts'::regclass
  ) THEN
    ALTER TABLE horok_tech.posts
    ADD CONSTRAINT posts_quoted_post_id_fkey
    FOREIGN KEY (quoted_post_id)
    REFERENCES horok_tech.posts(id)
    ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_posts_quoted_post_id
ON horok_tech.posts (quoted_post_id);
