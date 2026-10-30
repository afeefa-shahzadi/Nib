-- Poll results counted in the database (one row per choice) instead of
-- shipping up to 10k vote rows to the app. Service role only.
create or replace function public.poll_tally(p_block uuid)
returns table (choice text, n bigint)
language sql stable security definer set search_path = ''
as $$
  select choice, count(*) from public.poll_votes where block_id = p_block group by choice;
$$;
revoke execute on function public.poll_tally(uuid) from public, anon, authenticated;
grant execute on function public.poll_tally(uuid) to service_role;
