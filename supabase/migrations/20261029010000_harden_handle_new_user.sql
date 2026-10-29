-- handle_new_user() trusted client-controlled raw_user_meta_data:
--  * role was copied into user_roles verbatim, so signUp({ data: { role: 'admin' } })
--    granted admin. Now only 'reader' / 'creator' are honoured; admin is granted by hand.
--  * role 'organization' (offered by /signup) violated user_roles_role_check and
--    failed the whole signup. Org owners now get 'creator' plus their organization.
--  * an org_type outside organizations_type_check ("other" free text) failed signup;
--    unknown types fall back to 'standard'.
--  * a taken handle failed signup (profiles_username_unique); it now falls back to
--    user_<id8>.
-- Idempotent: CREATE OR REPLACE, no data changes.
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
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, display_name, handle, avatar_url, bio, date_of_birth)
    VALUES (
      new.id,
      COALESCE(meta->>'display_name', new.email),
      COALESCE(NULLIF(meta->>'handle', ''), fallback_handle),
      meta->>'avatar_url',
      meta->>'bio',
      (meta->>'date_of_birth')::date
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN unique_violation THEN
    INSERT INTO public.profiles (id, display_name, handle, avatar_url, bio, date_of_birth)
    VALUES (
      new.id,
      COALESCE(meta->>'display_name', new.email),
      fallback_handle,
      meta->>'avatar_url',
      meta->>'bio',
      (meta->>'date_of_birth')::date
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
