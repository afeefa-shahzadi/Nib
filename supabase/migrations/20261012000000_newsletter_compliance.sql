-- Newsletter compliance: double opt-in for guest subscribers + a suppression
-- (unsubscribe) list honored by recipient resolution. Required before bulk mail
-- (CAN-SPAM + Gmail/Yahoo 2024 bulk-sender rules): every recipient needs a
-- working one-click unsubscribe, and raw guest emails must confirm before they
-- receive anything (today subscribeToAuthor stores an unverified address that
-- immediately gets mail — spam/abuse vector).

-- Double opt-in: guest subscribers are pending until they click the confirm
-- link. confirmed_at NULL = pending (excluded from dispatches).
ALTER TABLE public.author_subscribers
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- Grandfather everyone who subscribed under the old (no-confirm) flow so this
-- migration doesn't silently drop current subscribers from dispatches.
UPDATE public.author_subscribers
  SET confirmed_at = created_at
  WHERE confirmed_at IS NULL;

-- Suppression list. A row hides an email from one author's dispatches
-- (author_id set) or from ALL Mycelium mail (author_id NULL). Written by the
-- unsubscribe route and read by recipient resolution — both run as the service
-- role server-side, so no anon/authenticated access is granted (RLS on, no
-- policies = clients can't read who unsubscribed).
CREATE TABLE IF NOT EXISTS public.email_unsubscribes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A plain UNIQUE treats NULLs as distinct, so split into two partial indexes:
-- one per-author suppression per email, one global suppression per email.
CREATE UNIQUE INDEX IF NOT EXISTS email_unsubscribes_email_author_uq
  ON public.email_unsubscribes (email, author_id) WHERE author_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS email_unsubscribes_email_global_uq
  ON public.email_unsubscribes (email) WHERE author_id IS NULL;

CREATE INDEX IF NOT EXISTS email_unsubscribes_email_idx
  ON public.email_unsubscribes (email);

ALTER TABLE public.email_unsubscribes ENABLE ROW LEVEL SECURITY;

-- Enforce double opt-in at the trust boundary: the "Anyone can subscribe"
-- INSERT policy is WITH CHECK (true), so a direct API insert could self-set
-- confirmed_at and skip confirmation. Force every non-service-role insert to
-- pending; only the server action (service role) may pre-confirm (a signed-in
-- user subscribing with their own verified account email).
CREATE OR REPLACE FUNCTION public.force_subscriber_unconfirmed()
RETURNS trigger AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    NEW.confirmed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS author_subscribers_force_unconfirmed ON public.author_subscribers;
CREATE TRIGGER author_subscribers_force_unconfirmed
  BEFORE INSERT ON public.author_subscribers
  FOR EACH ROW EXECUTE FUNCTION public.force_subscriber_unconfirmed();
