-- Mail we couldn't send yet (SMTP daily limit, transient errors). Drained hourly
-- by /api/cron/email-outbox. Service role only: RLS on with no policies, so no
-- client access. The mfa_required restrictive policy convention is not needed
-- on a table with no permissive policies (nothing to restrict).
CREATE TABLE IF NOT EXISTS public.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  from_email text NOT NULL,
  subject text NOT NULL,
  html text NOT NULL,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  send_after timestamptz NOT NULL DEFAULT now(),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_outbox FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS email_outbox_due_idx
  ON public.email_outbox (send_after) WHERE sent_at IS NULL;
