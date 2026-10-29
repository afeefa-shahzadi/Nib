-- Author-declared AI content label, shown to readers on the piece.
ALTER TABLE public.content_objects
  ADD COLUMN IF NOT EXISTS is_ai_generated boolean NOT NULL DEFAULT false;
