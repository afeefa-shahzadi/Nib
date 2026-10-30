-- Settings > Privacy: show the pieces you clapped on your profile (default on),
-- and leave the readers leaderboard (default off).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_claps boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS hide_from_leaderboard boolean NOT NULL DEFAULT false;
