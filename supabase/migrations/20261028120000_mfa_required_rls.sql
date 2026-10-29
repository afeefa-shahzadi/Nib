-- Enforce 2FA at the database, not just in proxy.ts.
--
-- A password-only (AAL1) session of a user with a verified TOTP factor could
-- use its JWT directly against PostgREST (or through any server action /
-- API route that forwards it) and read or write everything RLS allows. The
-- proxy redirect is only an optimistic gate, so add a RESTRICTIVE policy on
-- every RLS-enabled public table: rows are visible/writable to
-- `authenticated` only when the session is AAL2 or the user has no verified
-- factor. Service role bypasses RLS and is unaffected; anon is unaffected.
--
-- Idempotent: the function is replaced and each policy dropped/recreated.
-- Tables created later need the policy too — rerun the DO block below.

create or replace function public.mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      or not exists (
        select 1
        from auth.mfa_factors f
        where f.user_id = auth.uid()
          and f.status = 'verified'
      )
$$;

revoke all on function public.mfa_ok() from public;
grant execute on function public.mfa_ok() to authenticated, anon, service_role;

do $$
declare
  t record;
begin
  for t in
    select c.relname as name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity
  loop
    execute format('drop policy if exists mfa_required on public.%I', t.name);
    execute format(
      'create policy mfa_required on public.%I as restrictive for all to authenticated '
      'using ((select public.mfa_ok())) with check ((select public.mfa_ok()))',
      t.name
    );
  end loop;
end
$$;
