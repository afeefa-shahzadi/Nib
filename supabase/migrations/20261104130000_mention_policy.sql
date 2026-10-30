-- Settings > Privacy: who can mention you. 'everyone' (default), 'following'
-- (only people you follow), or 'none'. Replies that mention someone who
-- doesn't allow it keep the text but lose the mention link.
alter table public.profiles
  add column if not exists mention_policy text not null default 'everyone'
  check (mention_policy in ('everyone', 'following', 'none'));

grant select (mention_policy) on table public.profiles to anon, authenticated;
