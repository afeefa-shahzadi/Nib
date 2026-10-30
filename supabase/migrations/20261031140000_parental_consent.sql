-- Parental consent for users aged 13-17 (DPDP Act s.9: verifiable consent of a parent).
-- Under-18 sign-ups give a parent's email; the account is read-only (no publishing,
-- comments or debate posts) until the parent approves from the emailed link.
-- New columns are NOT in the public column grant (see 20260718200000_rls_hardening),
-- so parent_email stays service-role only.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS parent_email text,
  ADD COLUMN IF NOT EXISTS parental_consent text NOT NULL DEFAULT 'not_required'
    CHECK (parental_consent IN ('not_required', 'pending', 'granted')),
  ADD COLUMN IF NOT EXISTS parental_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS parental_consent_sent_at timestamptz;

-- The consent record: who approved, when, from where. Kept after approval as evidence.
CREATE TABLE IF NOT EXISTS public.parental_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_email text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text
);
ALTER TABLE public.parental_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.parental_consents FROM anon, authenticated;

-- Not granted to anon/authenticated: whether an account belongs to a minor is
-- private. The app reads a user's own status through the service role.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  meta jsonb := COALESCE(new.raw_user_meta_data, '{}'::jsonb);
  req_role text := meta->>'role';
  fallback_handle text := 'user_' || substr(new.id::text, 1, 8);
  org_type text := meta->>'org_type';
  dob date := NULLIF(meta->>'date_of_birth', '')::date;
  minor boolean := dob IS NOT NULL AND dob > (current_date - interval '18 years');
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, display_name, handle, avatar_url, bio, date_of_birth, parent_email, parental_consent)
    VALUES (
      new.id,
      COALESCE(meta->>'display_name', new.email),
      COALESCE(NULLIF(meta->>'handle', ''), fallback_handle),
      meta->>'avatar_url',
      meta->>'bio',
      dob,
      CASE WHEN minor THEN lower(NULLIF(meta->>'parent_email', '')) END,
      CASE WHEN minor THEN 'pending' ELSE 'not_required' END
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN unique_violation THEN
    INSERT INTO public.profiles (id, display_name, handle, avatar_url, bio, date_of_birth, parent_email, parental_consent)
    VALUES (
      new.id,
      COALESCE(meta->>'display_name', new.email),
      fallback_handle,
      meta->>'avatar_url',
      meta->>'bio',
      dob,
      CASE WHEN minor THEN lower(NULLIF(meta->>'parent_email', '')) END,
      CASE WHEN minor THEN 'pending' ELSE 'not_required' END
    )
    ON CONFLICT DO NOTHING;
  END;

  IF req_role IN ('reader', 'creator') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, req_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF req_role = 'organization' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'creator')
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.organizations (slug, name, type, owner_id)
    VALUES (
      COALESCE(NULLIF(meta->>'handle', ''), 'org_' || substr(new.id::text, 1, 8)),
      COALESCE(meta->>'org_name', meta->>'display_name', 'My Organization'),
      CASE WHEN org_type IN ('standard', 'educational_institution', 'business') THEN org_type ELSE 'standard' END,
      new.id
    )
    ON CONFLICT (slug) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
