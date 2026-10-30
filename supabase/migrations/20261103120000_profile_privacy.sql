-- Settings > Privacy, all opt-in: show the pieces you clapped on your profile,
-- show your birthday (day and month only) on your profile, and leave the
-- readers leaderboard.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_claps boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_birthday boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_from_leaderboard boolean NOT NULL DEFAULT false;
