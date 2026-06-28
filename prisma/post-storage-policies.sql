-- Supabase Storage policies for the private post media bucket.
--
-- Bucket:
--   post
--
-- Object layout:
--   users/{userId}/...
--   thumbnails/...
--   contents/...
--   attachments/...
--
-- The application uploads, deletes, and signs objects through the Next.js
-- server with SUPABASE_SERVICE_ROLE_KEY. Do not grant anon/public access here.

INSERT INTO storage.buckets (id, name, public)
VALUES ('post', 'post', false)
ON CONFLICT (id) DO UPDATE
SET public = false;

DROP POLICY IF EXISTS "post media select via service role" ON storage.objects;
DROP POLICY IF EXISTS "post media insert via service role" ON storage.objects;
DROP POLICY IF EXISTS "post media update via service role" ON storage.objects;
DROP POLICY IF EXISTS "post media delete via service role" ON storage.objects;

CREATE POLICY "post media select via service role"
ON storage.objects
FOR SELECT
TO service_role
USING (
  bucket_id = 'post'
  AND (storage.foldername(name))[1] IN (
    'users',
    'thumbnails',
    'contents',
    'attachments'
  )
);

CREATE POLICY "post media insert via service role"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (
  bucket_id = 'post'
  AND (storage.foldername(name))[1] IN (
    'users',
    'thumbnails',
    'contents',
    'attachments'
  )
);

CREATE POLICY "post media update via service role"
ON storage.objects
FOR UPDATE
TO service_role
USING (
  bucket_id = 'post'
  AND (storage.foldername(name))[1] IN (
    'users',
    'thumbnails',
    'contents',
    'attachments'
  )
)
WITH CHECK (
  bucket_id = 'post'
  AND (storage.foldername(name))[1] IN (
    'users',
    'thumbnails',
    'contents',
    'attachments'
  )
);

CREATE POLICY "post media delete via service role"
ON storage.objects
FOR DELETE
TO service_role
USING (
  bucket_id = 'post'
  AND (storage.foldername(name))[1] IN (
    'users',
    'thumbnails',
    'contents',
    'attachments'
  )
);
