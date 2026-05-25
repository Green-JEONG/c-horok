-- Move horok-tech domain tables from public to horok_tech.
-- Keep shared auth/account tables such as public.users in public.
-- Run this only after verifying backups and checking app downtime window.

BEGIN;

CREATE SCHEMA IF NOT EXISTS horok_tech;

ALTER TABLE IF EXISTS public.categories SET SCHEMA horok_tech;
ALTER TABLE IF EXISTS public.posts SET SCHEMA horok_tech;
ALTER TABLE IF EXISTS public.comments SET SCHEMA horok_tech;
ALTER TABLE IF EXISTS public.post_likes SET SCHEMA horok_tech;
ALTER TABLE IF EXISTS public.post_views SET SCHEMA horok_tech;
ALTER TABLE IF EXISTS public.stop_words SET SCHEMA horok_tech;

COMMIT;

ALTER TABLE IF EXISTS horok_tech.comments
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS horok_tech.post_categories (
  post_id BIGINT NOT NULL REFERENCES horok_tech.posts(id) ON DELETE CASCADE,
  category_id BIGINT NOT NULL REFERENCES horok_tech.categories(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, category_id)
);

ALTER TABLE horok_tech.post_categories
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_post_categories_category_id
  ON horok_tech.post_categories (category_id);

INSERT INTO horok_tech.post_categories (post_id, category_id)
SELECT id, category_id
FROM horok_tech.posts
WHERE category_id IS NOT NULL
ON CONFLICT (post_id, category_id) DO NOTHING;

-- Tables intentionally left in public by default:
-- public.users
-- public.verification_tokens
--
-- Tables below need a product decision before moving because they may be shared
-- across platforms depending on your roadmap:
-- public.friends
-- public.notifications
-- public.chat_threads
-- public.chat_messages
