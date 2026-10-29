-- Atomic fixed-window counter for checkRateLimit (lib/rate-limit.server.ts).
-- The old select-then-update let concurrent requests read the same count and
-- all pass. One upsert row lock serializes them. Returns the count after this
-- hit and the window start.
create or replace function public.rate_limit_hit(
  p_bucket text,
  p_identifier text,
  p_window_seconds integer,
  p_increment integer default 1
) returns table (count integer, window_start timestamptz)
language sql
security definer
set search_path = public
as $$
  insert into public.rate_limits as r (bucket, identifier, count, window_start)
  values (p_bucket, p_identifier, p_increment, now())
  on conflict (bucket, identifier) do update set
    count = case when r.window_start < now() - make_interval(secs => p_window_seconds)
                 then excluded.count else r.count + excluded.count end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds)
                        then now() else r.window_start end
  returning r.count, r.window_start;
$$;

revoke execute on function public.rate_limit_hit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, text, integer, integer) to service_role;
