-- Buckets the app uploads to but no migration created: `avatars` (profile
-- settings) and `images` (sponsor logos in the composer meta dialog). They
-- existed only on local stacks, so prod uploads failed with "Bucket not found".
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 5242880,
   ARRAY['image/png','image/jpeg','image/webp','image/gif','image/avif']),
  ('images', 'images', true, 5242880,
   ARRAY['image/png','image/jpeg','image/webp','image/gif','image/avif','image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- Avatars: users write into their own <uid>/… folder (upload uses upsert, so
-- UPDATE is needed too); anyone may read.
DROP POLICY IF EXISTS "avatars upload own" ON storage.objects;
CREATE POLICY "avatars upload own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars update own" ON storage.objects;
CREATE POLICY "avatars update own"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars read all" ON storage.objects;
CREATE POLICY "avatars read all"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Images: sponsor logos go under sponsorships/<uuid>-name, so any signed-in
-- user may insert; anyone may read.
DROP POLICY IF EXISTS "images upload authenticated" ON storage.objects;
CREATE POLICY "images upload authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'images');

DROP POLICY IF EXISTS "images read all" ON storage.objects;
CREATE POLICY "images read all"
ON storage.objects FOR SELECT
USING (bucket_id = 'images');
