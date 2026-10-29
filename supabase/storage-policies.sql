-- ============================================================================
-- Storage hardening: bucket limits + per-user RLS on storage.objects
-- ============================================================================
-- Apply this in the Supabase SQL editor (or `psql` against the project). It is
-- NOT a migration — it is not timestamped, so `supabase db push` won't run it.
-- Idempotent: safe to re-run (policies are dropped then recreated; bucket rows
-- are upserted).
--
-- Why: today the only size/MIME check on uploads is client-side JS
-- (image-block-editor.tsx etc.), which a direct storage call with a valid user
-- JWT bypasses — so anyone signed in can push arbitrary files of any size and,
-- without per-user RLS, potentially into another user's folder. The two gates
-- below fix that:
--   1. Bucket config  -> Supabase enforces max size + allowed MIME at upload,
--      server-side, no matter what the client sends. This is the real gate.
--   2. storage.objects RLS -> a user may only write/modify/delete under their
--      own {uid}/ folder; private buckets are readable only by their owner.
--
-- PREFLIGHT — run this first and REMOVE any pre-existing broad policy (e.g. an
-- "allow all authenticated" insert/select) or the scoped ones below won't
-- actually restrict anything (RLS is permissive — any matching policy grants):
--   select policyname, cmd, qual, with_check
--   from pg_policies where schemaname = 'storage' and tablename = 'objects';
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Bucket configuration (the server-side size + type gate)
-- ---------------------------------------------------------------------------
-- post-images: post image blocks (8 MB client cap) AND audio blocks (25 MB).
-- A bucket has one size limit, so it must be the larger of the two (25 MB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-images', 'post-images', true, 26214400,           -- 25 MB
  array['image/*', 'audio/*', 'video/mp4']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- images: sponsor / workspace logos. Small, public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'images', 'images', true, 5242880,                      -- 5 MB
  array['image/*']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- verifications: KYC docs + selfies. PRIVATE — read only via signed URLs the
-- server mints, never public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'verifications', 'verifications', false, 10485760,       -- 10 MB
  array['image/*', 'application/pdf']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- ---------------------------------------------------------------------------
-- 2. RLS on storage.objects (per-user folder isolation)
-- ---------------------------------------------------------------------------
-- RLS is already enabled on storage.objects by Supabase; this line is a no-op
-- safety net.
alter table storage.objects enable row level security;

-- ---- post-images -----------------------------------------------------------
-- Public read (post media is public content).
drop policy if exists "post-images read" on storage.objects;
create policy "post-images read" on storage.objects
  for select using (bucket_id = 'post-images');

-- Write only into your own {uid}/ folder.
drop policy if exists "post-images insert own folder" on storage.objects;
create policy "post-images insert own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Modify / delete only objects under your own {uid}/ folder.
drop policy if exists "post-images modify own" on storage.objects;
create policy "post-images modify own" on storage.objects
  for update to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "post-images delete own" on storage.objects;
create policy "post-images delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---- images (logos) --------------------------------------------------------
-- Public read.
drop policy if exists "images read" on storage.objects;
create policy "images read" on storage.objects
  for select using (bucket_id = 'images');

-- Any signed-in user may upload a logo. NOTE: the app writes these under a
-- fixed `sponsorships/` prefix (not {uid}/), so this bucket can't be folder-
-- scoped per user without a code change. Ownership still restricts edit/delete.
-- Hardening option: change the upload path in meta-dialog.tsx /
-- public-sponsor-card.tsx to `${uid}/...` and mirror the post-images policies.
drop policy if exists "images insert authenticated" on storage.objects;
create policy "images insert authenticated" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'images');

drop policy if exists "images modify own" on storage.objects;
create policy "images modify own" on storage.objects
  for update to authenticated
  using (bucket_id = 'images' and owner = (select auth.uid()))
  with check (bucket_id = 'images' and owner = (select auth.uid()));

drop policy if exists "images delete own" on storage.objects;
create policy "images delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'images' and owner = (select auth.uid()));

-- ---- verifications (private KYC) -------------------------------------------
-- No public read policy on purpose. Owner may read their own; admins/read paths
-- use the service role (bypasses RLS) or server-minted signed URLs.
drop policy if exists "verifications read own" on storage.objects;
create policy "verifications read own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'verifications'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "verifications insert own folder" on storage.objects;
create policy "verifications insert own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'verifications'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "verifications delete own" on storage.objects;
create policy "verifications delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'verifications' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- POST-CHECK: confirm the buckets and policies landed.
--   select id, public, file_size_limit, allowed_mime_types from storage.buckets
--     where id in ('post-images','images','verifications');
--   select policyname, cmd from pg_policies
--     where schemaname='storage' and tablename='objects' order by policyname;
-- ---------------------------------------------------------------------------
