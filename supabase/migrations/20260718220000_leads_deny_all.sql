-- leads: enabled RLS with no policy = implicit deny-all (fails closed, correct).
-- The only writer is app/api/contact/route.ts via the admin (service-role) client,
-- which bypasses RLS. No anon/authenticated path should ever read or write leads
-- (they hold PII: name, email, phone). Make the deny-all EXPLICIT so the intent is
-- documented and the rls_enabled_no_policy linter stops flagging it. Service role
-- still bypasses this policy, so the contact form is unaffected.
DROP POLICY IF EXISTS "leads_no_client_access" ON public.leads;
CREATE POLICY "leads_no_client_access" ON public.leads
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
