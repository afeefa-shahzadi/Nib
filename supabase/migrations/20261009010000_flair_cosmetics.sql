-- Migration: Flair cosmetics — the first Insight Points sink.
-- Readers/authors spend non-cashable IP on a profile name colour. Ownership is
-- permanent (flair_owned); equipping an owned flair is free. Purchases are
-- recorded as negative insight_points rows, so the IP balance (SUM(points))
-- and leaderboard rank both fall by the amount spent.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS flair       TEXT,                 -- equipped flair id, null = none
  ADD COLUMN IF NOT EXISTS flair_owned TEXT[] DEFAULT '{}';  -- ids the user has bought

-- profiles uses per-column SELECT grants for anon/authenticated (only
-- whitelisted columns are readable). New columns must be granted explicitly or
-- any authenticated `SELECT *` on profiles fails with 42501. See the follow-up
-- migration 20261010000000_flair_column_grants.sql (kept separate so it also
-- applies to databases where this migration already ran).
GRANT SELECT ("flair") ON TABLE public.profiles TO anon, authenticated;
GRANT SELECT ("flair_owned") ON TABLE public.profiles TO anon, authenticated;
