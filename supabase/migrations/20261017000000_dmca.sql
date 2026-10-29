-- DMCA / copyright-grievance takedown. Two evidence tables; rows are never
-- hard-deleted. The actual disable/restore reuses content_objects
-- (archived <-> published) via actions/moderation.ts — no new content state.
--
-- Service-role only (RLS enabled, no policies), same convention as rate_limits:
-- every read/write goes through a server action on the service-role client,
-- which bypasses RLS; authz is enforced in code (requireAdmin / ownership).
CREATE TABLE IF NOT EXISTS public.dmca_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  notice_type text NOT NULL CHECK (notice_type IN ('dmca','grievance')),
  target_content_object_id uuid NOT NULL REFERENCES public.content_objects(id) ON DELETE CASCADE,
  complainant_name text NOT NULL,
  complainant_email text NOT NULL,
  complainant_address text NOT NULL,
  complainant_role text NOT NULL CHECK (complainant_role IN ('owner','agent')),
  work_identification text NOT NULL,
  infringing_urls text[] NOT NULL,
  good_faith_statement boolean NOT NULL,
  accuracy_statement boolean NOT NULL,
  signature text NOT NULL,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received','actioned','rejected','withdrawn')),
  admin_note text,
  actioned_by uuid REFERENCES auth.users(id),
  actioned_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.dmca_counter_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  notice_id uuid NOT NULL REFERENCES public.dmca_notices(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  statement text NOT NULL,
  consent_jurisdiction boolean NOT NULL,
  good_faith boolean NOT NULL,
  signature text NOT NULL,
  contact text NOT NULL,
  restore_eligible_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received','forwarded','restored','rejected')),
  restored_at timestamptz
);

CREATE INDEX IF NOT EXISTS dmca_notices_status_idx
  ON public.dmca_notices(status, created_at DESC);
CREATE INDEX IF NOT EXISTS dmca_counter_notices_notice_idx
  ON public.dmca_counter_notices(notice_id);

ALTER TABLE public.dmca_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dmca_counter_notices ENABLE ROW LEVEL SECURITY;
