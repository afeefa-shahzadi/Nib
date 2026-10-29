-- Fix: 20261009010000_flair_cosmetics added profiles.flair + flair_owned but not
-- the column-level SELECT grants. profiles uses per-column SELECT grants for
-- anon/authenticated (privacy: only whitelisted columns are readable), so any
-- authenticated `SELECT *` on profiles — e.g. the session/nav read on every
-- page — started failing with 42501 "permission denied for table profiles"
-- once these ungranted columns existed. Grant SELECT on them to match the
-- pattern every other readable profiles column already follows.

GRANT SELECT ("flair") ON TABLE public.profiles TO anon;
GRANT SELECT ("flair") ON TABLE public.profiles TO authenticated;
GRANT SELECT ("flair_owned") ON TABLE public.profiles TO anon;
GRANT SELECT ("flair_owned") ON TABLE public.profiles TO authenticated;
