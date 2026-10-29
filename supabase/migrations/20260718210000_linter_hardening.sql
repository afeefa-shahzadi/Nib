-- Supabase database-linter remediation: function search_path, RPC-exposed
-- SECURITY DEFINER trigger functions, over-permissive INSERT policies, per-row
-- auth.uid() re-evaluation, duplicate permissive SELECT policies, and unindexed
-- foreign keys. All DB-only; no application code depends on these changes.

-- ==================== SECURITY ====================

-- 1. Pin search_path on the SECURITY DEFINER trigger functions. A mutable
--    search_path lets a caller shadow unqualified names with attacker-owned
--    objects. All four bodies already schema-qualify every table (public.*) and
--    use only pg_catalog builtins, so an empty search_path is safe.
ALTER FUNCTION public.handle_new_user()       SET search_path = '';
ALTER FUNCTION public.handle_new_user_stats() SET search_path = '';
ALTER FUNCTION public.handle_piece_written()  SET search_path = '';
ALTER FUNCTION public.handle_follow_stats()   SET search_path = '';

-- 2. These are trigger functions (fire on table events); they are not meant to
--    be callable as PostgREST RPC. Revoke EXECUTE so anon/authenticated cannot
--    invoke them via /rest/v1/rpc to forge stats or fan-out. Triggers still fire
--    normally — Postgres does not check EXECUTE on a trigger function for the
--    statement's invoker; it runs as the table owner.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_stats() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_piece_written()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_follow_stats()   FROM PUBLIC, anon, authenticated;

-- 3. content_reports "Anyone can submit reports" (WITH CHECK true) let anyone
--    insert arbitrary reports (any user_id, spam). reportContent() inserts via
--    the admin client, so no user-client path needs this policy. Drop it; the
--    "Users can read own reports" SELECT policy is retained.
DROP POLICY IF EXISTS "Anyone can submit reports" ON public.content_reports;

-- 4. author_subscribers "Anyone can subscribe" (WITH CHECK true) is a deliberate
--    public newsletter capture: subscribeToAuthor runs via the USER client and
--    supports anonymous email-only subscriptions (subscriber_id NULL). Keep it
--    public, but stop a caller from inserting a row that impersonates another
--    signed-in user's subscriber_id.
DROP POLICY IF EXISTS "Anyone can subscribe" ON public.author_subscribers;
CREATE POLICY "Anyone can subscribe" ON public.author_subscribers
  FOR INSERT WITH CHECK (
    subscriber_id IS NULL OR subscriber_id = (select auth.uid())
  );

-- ============ PERFORMANCE: per-row auth.uid() re-evaluation ============
-- Wrap auth.uid() in (select ...) so the planner evaluates it once per query
-- (initplan) instead of once per row.

-- author_subscribers
DROP POLICY IF EXISTS "Subscribers can unsubscribe" ON public.author_subscribers;
CREATE POLICY "Subscribers can unsubscribe" ON public.author_subscribers
  FOR DELETE USING (
    (((select auth.uid()) IS NOT NULL) AND ((select auth.uid()) = subscriber_id))
    OR ((select auth.uid()) = author_id)
  );

DROP POLICY IF EXISTS "Users can view their own subscribers" ON public.author_subscribers;
CREATE POLICY "Users can view their own subscribers" ON public.author_subscribers
  FOR SELECT USING ((select auth.uid()) = author_id);

-- piece_versions
DROP POLICY IF EXISTS "Users can create versions of pieces they own" ON public.piece_versions;
CREATE POLICY "Users can create versions of pieces they own" ON public.piece_versions
  FOR INSERT WITH CHECK (
    author_id = (select auth.uid())
    OR piece_id IN (
      SELECT piece_coauthors.piece_id FROM public.piece_coauthors
      WHERE piece_coauthors.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own versions" ON public.piece_versions;
CREATE POLICY "Users can delete their own versions" ON public.piece_versions
  FOR DELETE USING (author_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view versions of pieces they own" ON public.piece_versions;
CREATE POLICY "Users can view versions of pieces they own" ON public.piece_versions
  FOR SELECT USING (
    author_id = (select auth.uid())
    OR piece_id IN (
      SELECT piece_coauthors.piece_id FROM public.piece_coauthors
      WHERE piece_coauthors.user_id = (select auth.uid())
    )
  );

-- user_reward_claims
DROP POLICY IF EXISTS "Users can claim rewards" ON public.user_reward_claims;
CREATE POLICY "Users can claim rewards" ON public.user_reward_claims
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own claims" ON public.user_reward_claims;
CREATE POLICY "Users can view their own claims" ON public.user_reward_claims
  FOR SELECT USING ((select auth.uid()) = user_id);

-- ============ PERFORMANCE: duplicate permissive SELECT policies ============
-- piece_claps and piece_response_votes each had a public SELECT policy AND a
-- FOR ALL "manage their own" policy — two permissive SELECT policies evaluated
-- per read. Split each manage policy into write-only commands so exactly one
-- SELECT policy (the public one) remains. Public read is unchanged.

DROP POLICY IF EXISTS "Users can manage their own claps" ON public.piece_claps;
CREATE POLICY "Users can insert their own claps" ON public.piece_claps
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update their own claps" ON public.piece_claps
  FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete their own claps" ON public.piece_claps
  FOR DELETE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage their own votes" ON public.piece_response_votes;
CREATE POLICY "Users can insert their own votes" ON public.piece_response_votes
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update their own votes" ON public.piece_response_votes
  FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete their own votes" ON public.piece_response_votes
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ============ PERFORMANCE: unindexed foreign keys ============
CREATE INDEX IF NOT EXISTS author_subscribers_subscriber_id_idx ON public.author_subscribers (subscriber_id);
CREATE INDEX IF NOT EXISTS content_reports_user_id_idx          ON public.content_reports (user_id);
CREATE INDEX IF NOT EXISTS piece_responses_piece_id_idx         ON public.piece_responses (piece_id);
CREATE INDEX IF NOT EXISTS piece_responses_user_id_idx          ON public.piece_responses (user_id);
CREATE INDEX IF NOT EXISTS reader_annotations_user_id_idx       ON public.reader_annotations (user_id);
CREATE INDEX IF NOT EXISTS reader_subscriptions_user_id_idx     ON public.reader_subscriptions (user_id);
