-- Leaderboard totals summed in the database instead of pulling every raw row
-- into the app. Each function returns one jsonb array (a single value, so
-- PostgREST's row cap doesn't apply) with one object per user or piece.
-- p_start null means all time. Called only by the service-role client.

create or replace function public.leaderboard_reader_totals(p_start timestamptz)
returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  notes jsonb := '{}'::jsonb;
begin
  -- block_annotations isn't in every environment yet; count notes only where it exists.
  if to_regclass('public.block_annotations') is not null then
    execute 'select coalesce(jsonb_object_agg(user_id, n), ''{}'') from (
               select user_id, count(*) n from public.block_annotations
               where user_id is not null and ($1 is null or created_at >= $1) group by user_id) t'
      into notes using p_start;
  end if;

  return (
    with pts as (
      select user_id, sum(points)::bigint v from insight_points
      where p_start is null or created_at >= p_start group by user_id
    ), cl as (
      select user_id, sum(count)::bigint v from piece_claps
      where p_start is null or updated_at >= p_start group by user_id
    ), an as (
      select key::uuid user_id, value::bigint v from jsonb_each_text(notes)
    ), cu as (
      select user_id, sum(net_paise)::bigint v from earnings_ledger
      where source = 'curator_share' and (p_start is null or created_at >= p_start) group by user_id
    ), fo as (
      select follower_id user_id, count(*)::bigint v from follows group by follower_id
    ), ids as (
      select user_id from pts union select user_id from cl union select user_id from an union select user_id from cu
      union select user_id from fo where p_start is null
      union select user_id from user_stats where p_start is null
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', ids.user_id,
      'points', coalesce(pts.v, 0),
      'claps', coalesce(cl.v, 0),
      'annotations', coalesce(an.v, 0),
      'follows', coalesce(fo.v, 0),
      'earnings', coalesce(cu.v, 0),
      'current_streak', coalesce(st.current_streak, 0),
      'longest_streak', coalesce(st.longest_streak, 0)
    )), '[]'::jsonb)
    from ids
    left join pts on pts.user_id = ids.user_id
    left join cl on cl.user_id = ids.user_id
    left join an on an.user_id = ids.user_id
    left join cu on cu.user_id = ids.user_id
    left join fo on fo.user_id = ids.user_id
    left join user_stats st on st.user_id = ids.user_id
    where ids.user_id is not null
  );
end;
$$;

create or replace function public.leaderboard_author_totals(p_start timestamptz)
returns jsonb
language sql stable
set search_path = public
as $$
  with fo as (
    select author_id, count(*)::bigint v from follows group by author_id
  ), pub as (
    select author_id, count(*)::bigint v from content_objects
    where status = 'published' and visibility = 'public' and (p_start is null or published_at >= p_start)
    group by author_id
  ), cl as (
    select co.author_id, sum(c.count)::bigint v from piece_claps c join content_objects co on co.id = c.piece_id
    where p_start is null or c.updated_at >= p_start group by co.author_id
  ), tp as (
    select author_id, sum(coalesce(net_paise, 0))::bigint v from tips
    where status = 'paid' and (p_start is null or created_at >= p_start) group by author_id
  ), led as (
    select user_id author_id, sum(net_paise)::bigint v from earnings_ledger
    where p_start is null or created_at >= p_start group by user_id
  ), ids as (
    select author_id from fo union select author_id from pub union select author_id from cl
    union select author_id from tp union select author_id from led
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ids.author_id,
    'followers', coalesce(fo.v, 0),
    'published', coalesce(pub.v, 0),
    'claps', coalesce(cl.v, 0),
    'tips', coalesce(tp.v, 0),
    'ledger', coalesce(led.v, 0)
  )), '[]'::jsonb)
  from ids
  left join fo on fo.author_id = ids.author_id
  left join pub on pub.author_id = ids.author_id
  left join cl on cl.author_id = ids.author_id
  left join tp on tp.author_id = ids.author_id
  left join led on led.author_id = ids.author_id
  where ids.author_id is not null
$$;

-- Public, published pieces with what readers did with them in the window.
-- The author's own responses, highlights and saves don't count; reads count
-- once per browser session (authors' own reads are never recorded).
create or replace function public.leaderboard_piece_totals(p_start timestamptz)
returns jsonb
language sql stable
set search_path = public
as $$
  with p as (
    select id, title, slug, author_id from content_objects where status = 'published' and visibility = 'public'
  ), cl as (
    select piece_id, sum(count)::bigint v from piece_claps
    where p_start is null or updated_at >= p_start group by piece_id
  ), rs as (
    select r.piece_id, count(*)::bigint v from piece_responses r join p on p.id = r.piece_id
    where r.user_id is distinct from p.author_id and (p_start is null or r.created_at >= p_start) group by r.piece_id
  ), hl as (
    select h.piece_id, count(*)::bigint v from reader_highlights h join p on p.id = h.piece_id
    where h.user_id is distinct from p.author_id and (p_start is null or h.created_at >= p_start) group by h.piece_id
  ), sv as (
    select i.content_object_id piece_id, count(*)::bigint v from collection_items i
    join p on p.id = i.content_object_id left join collections c on c.id = i.collection_id
    where c.curator_id is distinct from p.author_id and (p_start is null or i.created_at >= p_start)
    group by i.content_object_id
  ), rd as (
    -- A null session can't be deduped, so each such event counts once.
    select piece_id, (count(distinct session) + count(*) filter (where session is null))::bigint v from telemetry_events
    where event = 'full_read' and (p_start is null or created_at >= p_start) group by piece_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'title', p.title, 'slug', p.slug, 'author_id', p.author_id,
    'reads', coalesce(rd.v, 0), 'claps', coalesce(cl.v, 0), 'responses', coalesce(rs.v, 0),
    'highlights', coalesce(hl.v, 0), 'saves', coalesce(sv.v, 0)
  )), '[]'::jsonb)
  from p
  left join cl on cl.piece_id = p.id
  left join rs on rs.piece_id = p.id
  left join hl on hl.piece_id = p.id
  left join sv on sv.piece_id = p.id
  left join rd on rd.piece_id = p.id
  where coalesce(rd.v, cl.v, rs.v, hl.v, sv.v) is not null
$$;

revoke all on function public.leaderboard_reader_totals(timestamptz) from public, anon, authenticated;
revoke all on function public.leaderboard_author_totals(timestamptz) from public, anon, authenticated;
revoke all on function public.leaderboard_piece_totals(timestamptz) from public, anon, authenticated;
grant execute on function public.leaderboard_reader_totals(timestamptz) to service_role;
grant execute on function public.leaderboard_author_totals(timestamptz) to service_role;
grant execute on function public.leaderboard_piece_totals(timestamptz) to service_role;
