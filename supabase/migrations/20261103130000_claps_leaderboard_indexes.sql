-- Indexes for the redesign's new read paths.

-- Profile "Clapped" tab: a reader's claps, newest first (listClappedPieces).
create index if not exists idx_piece_claps_user_updated
  on public.piece_claps (user_id, updated_at desc);

-- Weekly/monthly leaderboards filter claps and reads by time window.
create index if not exists idx_piece_claps_updated on public.piece_claps (updated_at);
create index if not exists idx_telemetry_full_read
  on public.telemetry_events (created_at, piece_id)
  where event = 'full_read';
create index if not exists idx_insight_points_created on public.insight_points (created_at);

-- readerLeaderboard loads the few readers who opted out on every run.
create index if not exists idx_profiles_hide_from_leaderboard
  on public.profiles (id) where hide_from_leaderboard;
