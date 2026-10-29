-- Per-piece composer preference: hide reading-mode and AI-variant block
-- controls for writing that doesn't use modes (fiction, essays).
ALTER TABLE public.content_objects
  ADD COLUMN IF NOT EXISTS prose_only boolean NOT NULL DEFAULT false;
