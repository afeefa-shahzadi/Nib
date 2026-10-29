-- Real payout settlement rail. Before this, requestPayout inserted a
-- payout_requests row and stopped — nothing recorded WHERE to pay the creator,
-- WHO settled it, or the bank reference, and no code ever moved the row off
-- 'requested'. Add the columns a human needs to actually pay a creator and leave
-- an audit trail.
--
-- Balance accounting is intentionally unchanged: computeWithdrawableBalancePaise
-- already reserves requested/processing/paid and releases only failed, so no
-- earnings_ledger debit happens on settlement — the status transition IS the
-- whole state machine (requested -> paid | failed). Writes go through the admin
-- (service-role) client, so no RLS policy change is needed.
ALTER TABLE public.payout_requests
  ADD COLUMN IF NOT EXISTS destination    text,
  ADD COLUMN IF NOT EXISTS reference      text,
  ADD COLUMN IF NOT EXISTS processed_by   uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS processed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS failure_reason text;

-- Index the new FK — the Supabase linter flags unindexed foreign keys.
CREATE INDEX IF NOT EXISTS payout_requests_processed_by_idx
  ON public.payout_requests (processed_by);
