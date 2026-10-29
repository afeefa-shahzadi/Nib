-- Gamification race fixes. Idempotent, add-only. All functions are called only
-- via the service-role client from server actions.

-- 1. Daily-quest completions: one row per (user, quest_key, UTC day).
--    Dedupe first (keep the earliest row) so the index builds on live data.
DELETE FROM public.daily_quests d
USING (
  SELECT id, row_number() OVER (
    PARTITION BY user_id, quest_key, ((completed_at AT TIME ZONE 'utc')::date)
    ORDER BY completed_at, id) AS rn
  FROM public.daily_quests WHERE quest_key IS NOT NULL
) x
WHERE d.id = x.id AND x.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS daily_quests_user_key_day_uidx
  ON public.daily_quests (user_id, quest_key, ((completed_at AT TIME ZONE 'utc')::date))
  WHERE quest_key IS NOT NULL;

-- 2. Generated daily quests ("... (YYYY-MM-DD)"): unique per title. Drop unclaimed
--    duplicates only; claimed ones are kept (index then skipped with a notice).
DELETE FROM public.quests q
USING (
  SELECT id, row_number() OVER (
    PARTITION BY title
    ORDER BY (EXISTS (SELECT 1 FROM public.user_reward_claims c WHERE c.item_id = quests.id)) DESC,
             created_at, id) AS rn
  FROM public.quests WHERE quest_type = 'daily'
) x
WHERE q.id = x.id AND x.rn > 1
  AND NOT EXISTS (SELECT 1 FROM public.user_reward_claims c WHERE c.item_id = q.id);

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS quests_daily_title_uidx
    ON public.quests (title) WHERE quest_type = 'daily';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'quests_daily_title_uidx skipped: claimed duplicate daily quests remain';
END $$;

-- 3. Atomic XP/credits award; returns levels before/after (1000 XP per level).
CREATE OR REPLACE FUNCTION public.claim_award(p_user uuid, p_xp int, p_credits int)
RETURNS TABLE (old_level int, new_level int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH old AS (
    SELECT p.id, COALESCE(p.level, 1) AS lvl FROM public.profiles p WHERE p.id = p_user FOR UPDATE
  ), upd AS (
    UPDATE public.profiles p SET
      xp = COALESCE(p.xp, 0) + COALESCE(p_xp, 0),
      credits = COALESCE(p.credits, 0) + COALESCE(p_credits, 0),
      level = (COALESCE(p.xp, 0) + COALESCE(p_xp, 0)) / 1000 + 1
    FROM old WHERE p.id = old.id
    RETURNING p.level AS lvl
  )
  SELECT old.lvl, upd.lvl FROM old, upd;
END $$;

-- 4. Atomic quest tick: completion row + IP award only if this call won the day.
CREATE OR REPLACE FUNCTION public.tick_quest(p_user uuid, p_key text, p_points int)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE won uuid;
BEGIN
  INSERT INTO public.daily_quests (user_id, quest_type, quest_key, points_awarded)
  VALUES (p_user, p_key, p_key, p_points)
  ON CONFLICT (user_id, quest_key, ((completed_at AT TIME ZONE 'utc')::date))
    WHERE quest_key IS NOT NULL DO NOTHING
  RETURNING id INTO won;
  IF won IS NULL THEN RETURN false; END IF;
  INSERT INTO public.insight_points (user_id, points, reason) VALUES (p_user, p_points, 'daily_quest');
  RETURN true;
END $$;

-- 5. Atomic flair purchase. The profile row lock serialises a user's buys, so the
--    IP balance can never go negative. Returns 'ok' | 'owned' | 'insufficient' | 'missing'.
CREATE OR REPLACE FUNCTION public.buy_flair(p_user uuid, p_flair text, p_cost int)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE owned text[]; bal bigint;
BEGIN
  IF p_cost IS NULL OR p_cost <= 0 THEN RETURN 'missing'; END IF;
  SELECT COALESCE(flair_owned, '{}') INTO owned FROM public.profiles WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN RETURN 'missing'; END IF;
  IF p_flair = ANY (owned) THEN
    UPDATE public.profiles SET flair = p_flair WHERE id = p_user;
    RETURN 'owned';
  END IF;
  SELECT COALESCE(SUM(points), 0) INTO bal FROM public.insight_points WHERE user_id = p_user;
  IF bal < p_cost THEN RETURN 'insufficient'; END IF;
  INSERT INTO public.insight_points (user_id, points, reason) VALUES (p_user, -p_cost, 'flair_' || p_flair);
  UPDATE public.profiles SET flair = p_flair, flair_owned = owned || p_flair WHERE id = p_user;
  RETURN 'ok';
END $$;

REVOKE EXECUTE ON FUNCTION public.claim_award(uuid, int, int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tick_quest(uuid, text, int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.buy_flair(uuid, text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_award(uuid, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.tick_quest(uuid, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.buy_flair(uuid, text, int) TO service_role;
