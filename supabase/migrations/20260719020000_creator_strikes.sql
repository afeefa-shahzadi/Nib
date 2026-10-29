-- Migration: creator strike & reputation gate (docs/superpowers/specs/2026-07-18-creator-strike-gate-design.md)
-- Author-level penalty state + an appeal channel. Written at moderation time
-- (takedownContent), read at publish/payout time.

-- Penalty state on the author's profile.
--   strikes           cumulative confirmed violations (drives the ladder rung)
--   restricted_until  NULL = free · future ts = temp freeze · 'infinity' = permanent ban
--   restricted_reason human-readable, shown to the creator + in the appeal form
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS strikes           integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS restricted_until  timestamptz,
  ADD COLUMN IF NOT EXISTS restricted_reason text;

-- Appeal channel. One row per appeal; one pending row per user at a time
-- (enforced in submitAppeal, plus the partial unique index below as a backstop).
CREATE TABLE IF NOT EXISTS public.restriction_appeals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id),
  reason      text NOT NULL,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'lifted', 'denied')),
  created_at  timestamptz DEFAULT now(),
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz
);

-- Service-role only: reads/writes go through admin-client server actions, same as
-- moderation_actions. RLS on with no policy = no client (anon/authenticated) access.
ALTER TABLE public.restriction_appeals ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS restriction_appeals_status_idx
  ON public.restriction_appeals (status);

-- Backstop for "one open appeal per user"; the app checks first, this prevents a race.
CREATE UNIQUE INDEX IF NOT EXISTS restriction_appeals_one_pending_per_user
  ON public.restriction_appeals (user_id)
  WHERE status = 'pending';

-- Extend the moderation audit vocabulary for strike + lift events.
ALTER TABLE public.moderation_actions
  DROP CONSTRAINT IF EXISTS moderation_actions_action_check;
ALTER TABLE public.moderation_actions
  ADD CONSTRAINT moderation_actions_action_check
  CHECK (action IN ('takedown_archived', 'takedown_deleted', 'dismissed', 'restored', 'strike', 'restriction_lifted'));
