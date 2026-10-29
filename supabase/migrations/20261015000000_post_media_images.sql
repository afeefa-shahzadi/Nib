-- Allow images in post-media too, so the importer can rehost article images
-- (download from the source CDN, re-upload here, rewrite the block URL) instead
-- of hotlinking a URL that can rot. post-media becomes the general imported/
-- composer media bucket for audio, video, and now images.
UPDATE storage.buckets
SET allowed_mime_types = allowed_mime_types || ARRAY[
  'image/jpeg','image/png','image/webp','image/gif','image/avif','image/svg+xml'
]
WHERE id = 'post-media';
