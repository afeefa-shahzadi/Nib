-- Atomic per-user stat counter (pieces_read / tips_received). Replaces a
-- read-modify-write in lib/quests.server.ts that could lose concurrent bumps.
-- Idempotent; service_role only.
CREATE OR REPLACE FUNCTION public.bump_user_stat(p_user_id uuid, p_stat text, p_delta integer DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_stat = 'pieces_read' THEN
    INSERT INTO public.user_stats (user_id, pieces_read, updated_at)
    VALUES (p_user_id, p_delta, now())
    ON CONFLICT (user_id) DO UPDATE
      SET pieces_read = COALESCE(public.user_stats.pieces_read, 0) + p_delta, updated_at = now();
  ELSIF p_stat = 'tips_received' THEN
    INSERT INTO public.user_stats (user_id, tips_received, updated_at)
    VALUES (p_user_id, p_delta, now())
    ON CONFLICT (user_id) DO UPDATE
      SET tips_received = COALESCE(public.user_stats.tips_received, 0) + p_delta, updated_at = now();
  ELSE
    RAISE EXCEPTION 'bump_user_stat: unknown stat %', p_stat;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bump_user_stat(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_user_stat(uuid, text, integer) TO service_role;
