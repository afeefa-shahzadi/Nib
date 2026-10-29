ALTER TABLE public.profiles
ADD COLUMN disability_visual BOOLEAN DEFAULT false,
ADD COLUMN disability_cognitive BOOLEAN DEFAULT false,
ADD COLUMN disability_hearing BOOLEAN DEFAULT false,
ADD COLUMN disability_motor BOOLEAN DEFAULT false;

-- Create verifications bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'verifications',
    'verifications',
    false,
    10485760, -- 10MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- RLS Policies for the verifications bucket
CREATE POLICY "Users can upload their own verifications"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'verifications' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read their own verifications"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'verifications' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own verifications"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'verifications' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Server actions use service_role so they will bypass RLS.
