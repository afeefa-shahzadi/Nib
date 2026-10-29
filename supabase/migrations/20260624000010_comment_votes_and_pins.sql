-- Add is_pinned column to piece_responses
ALTER TABLE public.piece_responses ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;

-- Create votes table
CREATE TABLE IF NOT EXISTS public.piece_response_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES public.piece_responses(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vote_type   SMALLINT NOT NULL CHECK (vote_type IN (1, -1)),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT piece_response_votes_unique UNIQUE (response_id, user_id)
);

CREATE INDEX IF NOT EXISTS piece_response_votes_response_id_idx ON public.piece_response_votes(response_id);
CREATE INDEX IF NOT EXISTS piece_response_votes_user_id_idx ON public.piece_response_votes(user_id);

ALTER TABLE public.piece_response_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all votes" ON public.piece_response_votes FOR SELECT USING (true);
CREATE POLICY "Users can manage their own votes" ON public.piece_response_votes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);