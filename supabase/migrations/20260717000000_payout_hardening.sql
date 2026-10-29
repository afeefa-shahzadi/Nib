-- Payout hardening.
--
-- 1. Users could UPDATE/DELETE their own payout_requests rows (RLS below),
--    letting them flip a pending request to "failed" to free up "reserved"
--    balance and request again, or otherwise tamper with amounts/status.
--    Payout rows must only be mutated by the platform (service role, which
--    bypasses RLS). Users may INSERT a request and READ their own.
-- 2. payout_requests_read used USING(true) — every user could read every
--    other user's payout history. Scope it to the owner.
-- 3. Two concurrent requestPayout calls both read the same balance and both
--    insert, draining the same funds twice. A partial unique index enforces
--    at most one open (requested/processing) payout per user at the DB level.

DROP POLICY IF EXISTS "payout_requests_update" ON public.payout_requests;
DROP POLICY IF EXISTS "payout_requests_delete" ON public.payout_requests;

DROP POLICY IF EXISTS "payout_requests_read" ON public.payout_requests;
CREATE POLICY "payout_requests_read" ON public.payout_requests
  FOR SELECT USING ( user_id = (select auth.uid()) );

CREATE UNIQUE INDEX IF NOT EXISTS payout_requests_one_open_per_user
  ON public.payout_requests (user_id)
  WHERE status IN ('requested', 'processing');
