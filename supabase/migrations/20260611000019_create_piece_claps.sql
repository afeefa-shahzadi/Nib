-- Migration: create piece_claps table for reader applause feature

CREATE TABLE IF NOT EXISTS public.piece_claps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  piece_id    UUID NOT NULL REFERENCES public.content_objects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  count       INTEGER NOT NULL DEFAULT 1 CHECK (count BETWEEN 1 AND 50),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (piece_id, user_id)
);

ALTER TABLE public.piece_claps ENABLE ROW LEVEL SECURITY;

-- Anyone can read clap counts (for totals display)
CREATE POLICY "Claps are publicly readable"
  ON public.piece_claps FOR SELECT
  USING (true);

-- Only the clapper can upsert/delete their own claps
CREATE POLICY "Users can manage their own claps"
  ON public.piece_claps FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Performance index
CREATE INDEX IF NOT EXISTS idx_piece_claps_piece_id ON public.piece_claps(piece_id);
CREATE INDEX IF NOT EXISTS idx_piece_claps_user_id  ON public.piece_claps(user_id);
