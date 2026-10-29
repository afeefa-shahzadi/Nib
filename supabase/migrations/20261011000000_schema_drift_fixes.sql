-- Migration: reconcile columns the code already uses but the schema lacked.
-- Both were silent 400s in production (column does not exist), surfaced during QA.

-- 1. profiles.nsfw_enabled — the viewer's NSFW opt-in. Read by the feed age/NSFW
--    gate (actions/social/feeds.ts) and written by Settings (updateMyProfile).
--    The Settings form sends it on every save, so without the column every
--    profile save failed. Non-sensitive viewer preference → grant SELECT like
--    the other public-ish profile columns (writes stay system/service-role).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nsfw_enabled BOOLEAN NOT NULL DEFAULT false;
GRANT SELECT ("nsfw_enabled") ON TABLE public.profiles TO anon, authenticated;

-- 2. studio_subscriptions.current_period_end — mirrors reader_subscriptions
--    (migration 20260624160000). getMyPlan (actions/subscriptions.ts) selects it
--    to show the renewal/expiry date; without the column the plan check 400'd.
ALTER TABLE public.studio_subscriptions
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE;
