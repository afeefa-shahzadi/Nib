-- Migration: add missing columns to content_objects
-- repost_credits_required: whether a repost of this piece must credit the author
-- reposted_from: FK pointing to the original piece if this is a repost
-- canonical_thesis: the core claim/thesis of the piece for AI summarisation

ALTER TABLE public.content_objects
  ADD COLUMN IF NOT EXISTS repost_credits_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reposted_from UUID REFERENCES public.content_objects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS canonical_thesis TEXT;

-- Index for looking up all reposts of a given piece
CREATE INDEX IF NOT EXISTS idx_content_objects_reposted_from
  ON public.content_objects(reposted_from)
  WHERE reposted_from IS NOT NULL;
