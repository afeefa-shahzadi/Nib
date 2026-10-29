-- Plain-text part for queued mail (optional).
ALTER TABLE public.email_outbox ADD COLUMN IF NOT EXISTS text text;

-- Atomically lease up to n due rows (send_after +15 min) so overlapping drains
-- never send the same row; the lease bounds an unmarked send to one resend.
CREATE OR REPLACE FUNCTION public.claim_email_outbox(n int)
RETURNS SETOF public.email_outbox
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE public.email_outbox
     SET send_after = now() + interval '15 minutes'
   WHERE id IN (
     SELECT id FROM public.email_outbox
      WHERE sent_at IS NULL
        AND last_error IS DISTINCT FROM 'gave up'
        AND send_after <= now()
      ORDER BY send_after, created_at
      FOR UPDATE SKIP LOCKED
      LIMIT n)
  RETURNING *;
$$;

-- Rate limit hit: push the rest of a claimed batch back an hour (no attempt used).
CREATE OR REPLACE FUNCTION public.defer_email_outbox(ids uuid[])
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE public.email_outbox
     SET send_after = now() + interval '1 hour'
   WHERE id = ANY(ids) AND sent_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.claim_email_outbox(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.defer_email_outbox(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_outbox(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.defer_email_outbox(uuid[]) TO service_role;
