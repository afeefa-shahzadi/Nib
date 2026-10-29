-- Indexes for the hottest read paths (checked against prod pg index stats,
-- 2026-10-30). Plain CREATE INDEX locks writes on the table while it builds;
-- tables are small today, so that is milliseconds.

-- Reader /u/[handle]/[slug]: every view looks a piece up by slug, and only
-- content_objects.id/author_id/org_id were indexed.
create index if not exists idx_content_objects_slug on public.content_objects (slug);

-- Discover feed, landing "Reading now", sitemap, RSS: newest published public pieces.
create index if not exists idx_content_objects_public_recent
  on public.content_objects (published_at desc)
  where status = 'published' and visibility = 'public';

-- Author profile: an author's published pieces, newest first.
create index if not exists idx_content_objects_author_published
  on public.content_objects (author_id, published_at desc)
  where status = 'published';

-- Discover tag filter uses tags @> array[...].
create index if not exists idx_content_objects_tags on public.content_objects using gin (tags);

-- Notifications list (newest first) and unread badge per user.
create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);
create index if not exists idx_notifications_user_unread
  on public.notifications (user_id) where read_at is null;

