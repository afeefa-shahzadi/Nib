-- Reader-directed distribution pool (Phase 2).
-- Each active Reader Pass's monthly budget (85% of ₹199) is split among the
-- creators the reader actually clapped for that month, credited to
-- earnings_ledger (source='reader_pool') so it flows through the normal
-- withdrawable-balance + payout path.

-- Idempotency marker: highest calendar-month period_end already settled for
-- this subscription. Advanced atomically before crediting, exactly like the
-- ip_granted_until Reader Pass grant — a re-run of the settlement job for an
-- already-settled month claims zero rows and credits nothing.
ALTER TABLE public.reader_subscriptions
  ADD COLUMN IF NOT EXISTS pool_settled_until TIMESTAMP WITH TIME ZONE;

-- Audit + transparency ledger: one row per (reader, period, creator).
-- Powers "your ₹X went to N creators" for the reader and is the paper trail
-- behind each reader_pool earnings_ledger credit.
CREATE TABLE IF NOT EXISTS public.reader_pool_distributions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reader_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  creator_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_end  TIMESTAMP WITH TIME ZONE NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (amount_paise >= 0),
  weight      NUMERIC NOT NULL DEFAULT 0,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.reader_pool_distributions ENABLE ROW LEVEL SECURITY;

-- Reader sees where their money went; creator sees who valued them.
CREATE POLICY "Pool distributions visible to reader and creator"
  ON public.reader_pool_distributions FOR SELECT
  USING (reader_id = (select auth.uid()) OR creator_id = (select auth.uid()));

CREATE INDEX IF NOT EXISTS idx_reader_pool_dist_reader
  ON public.reader_pool_distributions (reader_id, period_end);
CREATE INDEX IF NOT EXISTS idx_reader_pool_dist_creator
  ON public.reader_pool_distributions (creator_id, period_end);
