-- Settings > Notifications: notification types a person turned off.
-- Empty means everything is on.
alter table public.profiles
  add column if not exists muted_notifications text[] not null default '{}';
