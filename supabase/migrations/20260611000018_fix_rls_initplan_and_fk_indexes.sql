-- Migration: fix auth_rls_initplan warnings and add missing FK indexes

-- ============================================================
-- 1. Fix RLS initplan on recommendations
-- ============================================================
DROP POLICY IF EXISTS "Users can create their own recommendations" ON public.recommendations;
CREATE POLICY "Users can create their own recommendations"
  ON public.recommendations FOR INSERT
  WITH CHECK ((select auth.uid()) = recommender_id);

DROP POLICY IF EXISTS "Users can delete their own recommendations" ON public.recommendations;
CREATE POLICY "Users can delete their own recommendations"
  ON public.recommendations FOR DELETE
  USING ((select auth.uid()) = recommender_id);

-- ============================================================
-- 2. Fix RLS initplan on newsletter_dispatches
-- ============================================================
DROP POLICY IF EXISTS "Users can view their own dispatches" ON public.newsletter_dispatches;
CREATE POLICY "Users can view their own dispatches"
  ON public.newsletter_dispatches FOR SELECT
  USING ((select auth.uid()) = author_id);

DROP POLICY IF EXISTS "Users can insert their own dispatches" ON public.newsletter_dispatches;
CREATE POLICY "Users can insert their own dispatches"
  ON public.newsletter_dispatches FOR INSERT
  WITH CHECK ((select auth.uid()) = author_id);

-- ============================================================
-- 3. Add missing FK indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_newsletter_dispatches_author_id
  ON public.newsletter_dispatches(author_id);

CREATE INDEX IF NOT EXISTS idx_newsletter_dispatches_piece_id
  ON public.newsletter_dispatches(piece_id);

CREATE INDEX IF NOT EXISTS idx_recommendations_recommended_id
  ON public.recommendations(recommended_id);
