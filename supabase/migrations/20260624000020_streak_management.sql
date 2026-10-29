-- Migration: Streak management (Snapchat-style) + User tier system
-- Adds streak restore tracking and credits balance to support gamification

-- 1. Extend user_stats with streak restore fields
ALTER TABLE public.user_stats
  ADD COLUMN IF NOT EXISTS streak_restores_used   INTEGER   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_restores_month  TEXT      DEFAULT '',   -- 'YYYY-MM' for monthly reset
  ADD COLUMN IF NOT EXISTS streak_broken_at       TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS streak_broken_value    INTEGER   DEFAULT 0;    -- streak before it broke

-- 2. Add credits balance to profiles (for future paid restores; free restores tracked in user_stats)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS credits  INTEGER DEFAULT 0;

-- 3. Index for fast user_stats streak lookups
CREATE INDEX IF NOT EXISTS idx_user_stats_streak_broken
  ON public.user_stats (streak_broken_at)
  WHERE streak_broken_at IS NOT NULL;
