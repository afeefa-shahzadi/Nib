create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid references auth.users(id) on delete set null,
  item text not null,      -- 'studio' | 'reader_pass' | 'org' | 'tip' | 'membership' | 'sponsorship'
  source text,             -- page/component that captured it
  created_at timestamptz not null default now(),
  unique (email, item)
);
alter table public.waitlist enable row level security;
create policy "waitlist_no_client_access" on public.waitlist
  for all to anon, authenticated using (false) with check (false);
