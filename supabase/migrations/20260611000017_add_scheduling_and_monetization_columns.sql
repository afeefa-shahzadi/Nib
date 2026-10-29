-- Migration: add all missing columns to content_objects that are referenced in code
-- These columns were added to the codebase but never migrated to the database.

ALTER TABLE public.content_objects
  ADD COLUMN IF NOT EXISTS scheduled_for        TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS tips_enabled          BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sponsorship_enabled   BOOLEAN DEFAULT false;

-- Index to efficiently query scheduled pieces
CREATE INDEX IF NOT EXISTS idx_content_objects_scheduled_for
  ON public.content_objects(scheduled_for)
  WHERE scheduled_for IS NOT NULL;
