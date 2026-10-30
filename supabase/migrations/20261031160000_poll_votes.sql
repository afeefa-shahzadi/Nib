-- Reader votes on poll exercise blocks, so a poll can show how everyone voted.
-- One vote per voter per poll (a signed-in user id, or an anonymous browser id
-- prefixed 'anon:'). Written and read only through server actions.
CREATE TABLE IF NOT EXISTS public.poll_votes (
  block_id uuid NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
  voter text NOT NULL CHECK (length(voter) <= 80),
  choice text NOT NULL CHECK (length(choice) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (block_id, voter)
);
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.poll_votes FROM anon, authenticated;
