-- Supabase security advisor follow-ups (2026-10-29). Idempotent.

-- 1. post-media is a public bucket: object URLs work without any SELECT policy,
--    so the broad "read all" policy only let clients LIST every file. Owners keep
--    SELECT on their own folder (storage needs it for delete/upsert).
DROP POLICY IF EXISTS "post-media read all" ON storage.objects;
DROP POLICY IF EXISTS "post-media read own" ON storage.objects;
CREATE POLICY "post-media read own"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 2. mfa_ok() backs RESTRICTIVE policies that apply to `authenticated` only, so
--    anon never needs it. authenticated keeps EXECUTE (RLS evaluates it as the caller;
--    it must stay SECURITY DEFINER to read auth.mfa_factors and only reports on auth.uid()).
REVOKE EXECUTE ON FUNCTION public.mfa_ok() FROM anon;
