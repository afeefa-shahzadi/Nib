-- Checks the leaderboard_*_totals functions on throwaway rows; everything rolls back.
-- Run: docker exec -i supabase_db_mycelium-next psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/leaderboard_totals.sql
begin;
set local session_replication_role = replica; -- skip FKs and triggers so fixtures can use made-up ids
delete from piece_claps; delete from piece_responses; delete from reader_highlights; delete from collection_items;
delete from collections; delete from telemetry_events; delete from follows; delete from tips; delete from earnings_ledger;
delete from insight_points; delete from user_stats; delete from content_objects;

-- a1, a2 authors; r1, r2 readers; b1, b2 public pieces, b3 a draft.
insert into content_objects (id, title, slug, author_id, workspace_id, status, visibility, published_at) values
  ('00000000-0000-0000-0000-0000000000b1', 'One', 'one', '00000000-0000-0000-0000-0000000000a1', gen_random_uuid(), 'published', 'public', now()),
  ('00000000-0000-0000-0000-0000000000b2', 'Two', 'two', '00000000-0000-0000-0000-0000000000a2', gen_random_uuid(), 'published', 'public', now() - interval '60 days'),
  ('00000000-0000-0000-0000-0000000000b3', 'Draft', 'draft', '00000000-0000-0000-0000-0000000000a1', gen_random_uuid(), 'draft', 'public', null);
insert into piece_claps (piece_id, user_id, count, updated_at) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 5, now()),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c1', 2, now() - interval '30 days'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000c2', 40, now());
insert into piece_responses (piece_id, user_id, body) values
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c1', 'x'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c2', 'x'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a2', 'author replying'); -- doesn't count
insert into reader_highlights (piece_id, user_id, text_content) values
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c1', 'x'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'x'); -- author's own
insert into collections (id, title, curator_id) values
  ('00000000-0000-0000-0000-0000000000d1', 'Reader list', '00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-0000000000d2', 'Author list', '00000000-0000-0000-0000-0000000000a1');
insert into collection_items (collection_id, content_object_id) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b1'); -- author's own save
insert into telemetry_events (piece_id, content_object_id, event_type, event, session) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1', 'x', 'full_read', 's1'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1', 'x', 'full_read', 's1'), -- same session
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1', 'x', 'full_read', 's2'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1', 'x', 'full_read', null),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1', 'x', 'view', 's3');
insert into follows (follower_id, author_id) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1');
insert into tips (author_id, recipient_id, amount_paise, net_paise, razorpay_order_id, status) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 1000, 900, 'o1', 'paid'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 1000, 900, 'o2', 'created');
insert into earnings_ledger (user_id, net_paise, source) values
  ('00000000-0000-0000-0000-0000000000c1', 50, 'curator_share'),
  ('00000000-0000-0000-0000-0000000000a1', 300, 'sale');
insert into insight_points (user_id, points, created_at) values
  ('00000000-0000-0000-0000-0000000000c1', 10, now()),
  ('00000000-0000-0000-0000-0000000000c1', 7, now() - interval '30 days');
insert into user_stats (user_id, current_streak, longest_streak) values ('00000000-0000-0000-0000-0000000000c2', 3, 9);

do $$
declare
  pieces jsonb := leaderboard_piece_totals(null);
  b1 jsonb := (select e from jsonb_array_elements(pieces) e where e->>'slug' = 'one');
  b2 jsonb := (select e from jsonb_array_elements(pieces) e where e->>'slug' = 'two');
  week jsonb := leaderboard_piece_totals(now() - interval '7 days');
  readers jsonb := leaderboard_reader_totals(null);
  c1 jsonb := (select e from jsonb_array_elements(readers) e where e->>'id' like '%c1');
  c2 jsonb := (select e from jsonb_array_elements(readers) e where e->>'id' like '%c2');
  authors jsonb := leaderboard_author_totals(null);
  a1 jsonb := (select e from jsonb_array_elements(authors) e where e->>'id' like '%a1');
  a1week jsonb := (select e from jsonb_array_elements(leaderboard_author_totals(now() - interval '7 days')) e where e->>'id' like '%a1');
begin
  assert jsonb_array_length(pieces) = 2, 'draft piece excluded: ' || pieces::text;
  assert (b1->>'reads')::int = 3, 'reads once per session, null sessions each count: ' || b1::text;
  assert (b1->>'claps')::int = 5 and (b1->>'saves')::int = 1 and (b1->>'highlights')::int = 0, 'author''s own save/highlight ignored: ' || b1::text;
  assert (b2->>'responses')::int = 2 and (b2->>'highlights')::int = 1, 'author''s own response ignored: ' || b2::text;
  assert (select (e->>'claps')::int from jsonb_array_elements(week) e where e->>'slug' = 'two') = 0, 'week window drops the 30-day-old clap: ' || week::text;

  assert (c1->>'points')::int = 17 and (c1->>'claps')::int = 7 and (c1->>'follows')::int = 1 and (c1->>'earnings')::int = 50, 'reader c1: ' || c1::text;
  assert (c2->>'longest_streak')::int = 9 and (c2->>'claps')::int = 40, 'reader c2: ' || c2::text;
  assert (select count(*) from jsonb_array_elements(leaderboard_reader_totals(now() - interval '7 days')) e where e->>'id' like '%c2') = 1, 'c2 clapped this week';

  assert (a1->>'followers')::int = 2 and (a1->>'published')::int = 1, 'author a1 counts: ' || a1::text;
  assert (a1->>'claps')::int = 45 and (a1->>'tips')::int = 900 and (a1->>'ledger')::int = 300, 'claps on drafts count, unpaid tips don''t: ' || a1::text;
  assert (a1week->>'claps')::int = 45, 'a1 this week: ' || a1week::text;
  raise notice 'leaderboard totals: all checks passed';
end $$;
rollback;
