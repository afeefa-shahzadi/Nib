-- 1. Move mfa_ok() out of the API-exposed `public` schema so it is no longer an
--    RPC endpoint (advisor 0029). RLS policies can still call it from `private`.
--    Same body; policies recreated on every RLS-enabled public table. Idempotent.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.mfa_ok()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      OR NOT EXISTS (
        SELECT 1 FROM auth.mfa_factors f
        WHERE f.user_id = auth.uid() AND f.status = 'verified'
      )
$$;
REVOKE ALL ON FUNCTION private.mfa_ok() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.mfa_ok() TO authenticated, service_role;

DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname AS name
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relrowsecurity
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS mfa_required ON public.%I', t.name);
    EXECUTE format(
      'CREATE POLICY mfa_required ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING ((SELECT private.mfa_ok())) WITH CHECK ((SELECT private.mfa_ok()))',
      t.name
    );
  END LOOP;
END
$$;

DROP FUNCTION IF EXISTS public.mfa_ok();

-- 2. email_outbox is service-role only. An explicit deny-all policy documents that
--    (advisor 0008) without granting anything.
DROP POLICY IF EXISTS "email_outbox service role only" ON public.email_outbox;
CREATE POLICY "email_outbox service role only" ON public.email_outbox
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 3. Semantic search orders by cosine distance (match_blocks). HNSW keeps it fast as
--    blocks grow; tiny at today's size.
CREATE INDEX IF NOT EXISTS idx_blocks_embedding_hnsw
  ON public.blocks USING hnsw (embedding extensions.vector_cosine_ops);
