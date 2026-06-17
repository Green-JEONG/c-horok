CREATE TABLE IF NOT EXISTS horok_log.post_download_counts (
  post_id BIGINT PRIMARY KEY REFERENCES horok_log.posts(id) ON DELETE CASCADE,
  markdown_count INTEGER NOT NULL DEFAULT 0,
  pdf_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
