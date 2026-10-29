-- Dedicated public bucket for audio + video uploads. Audio notes previously
-- reused the post-images bucket (works, but wrong mime/size limits and muddled
-- ownership); this gives media its own bucket with proper limits, and unlocks
-- first-class video upload (not just the mp4-as-audio hack).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-media',
  'post-media',
  true,
  209715200, -- 200 MB (video)
  ARRAY[
    'audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/mp4','audio/aac',
    'audio/ogg','audio/webm','audio/x-m4a','audio/flac',
    'video/mp4','video/webm','video/ogg','video/quicktime'
  ]
) ON CONFLICT (id) DO NOTHING;

-- Authenticated users upload into their own <uid>/… folder; anyone may read
-- (public bucket, URLs are shared in published pieces).
DROP POLICY IF EXISTS "post-media upload own" ON storage.objects;
CREATE POLICY "post-media upload own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "post-media read all" ON storage.objects;
CREATE POLICY "post-media read all"
ON storage.objects FOR SELECT
USING (bucket_id = 'post-media');

DROP POLICY IF EXISTS "post-media delete own" ON storage.objects;
CREATE POLICY "post-media delete own"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text);
