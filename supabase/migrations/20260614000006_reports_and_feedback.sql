-- Migration: reports and feedback tables for Phase 1 reader engagement

CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_object_id UUID NOT NULL REFERENCES public.content_objects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- allow anonymous if they just have session but no full profile
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a report (even anonymous, depending on auth rules, but let's say authenticated users)
CREATE POLICY "Anyone can submit reports"
  ON public.content_reports FOR INSERT
  WITH CHECK (true);

-- Users can read their own reports
CREATE POLICY "Users can read own reports"
  ON public.content_reports FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_content_reports_content_object_id ON public.content_reports(content_object_id);


CREATE TABLE IF NOT EXISTS public.recommendation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  piece_id UUID NOT NULL REFERENCES public.content_objects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_like BOOLEAN NOT NULL, -- true for thumbs up, false for thumbs down
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (piece_id, user_id)
);

ALTER TABLE public.recommendation_feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert own feedback"
  ON public.recommendation_feedback FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

-- Users can update their own feedback
CREATE POLICY "Users can update own feedback"
  ON public.recommendation_feedback FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Users can read their own feedback (to show highlighted thumbs up/down state)
CREATE POLICY "Users can read own feedback"
  ON public.recommendation_feedback FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_rec_feedback_piece_id ON public.recommendation_feedback(piece_id);
CREATE INDEX IF NOT EXISTS idx_rec_feedback_user_id ON public.recommendation_feedback(user_id);
