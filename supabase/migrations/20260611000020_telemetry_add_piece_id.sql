-- Migration: add piece_id and viewer_id to telemetry_events (was in schema.sql but never migrated)

ALTER TABLE public.telemetry_events
  ADD COLUMN IF NOT EXISTS piece_id UUID REFERENCES public.content_objects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS viewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Backfill: rows without piece_id get deleted (telemetry data is ephemeral)
DELETE FROM public.telemetry_events WHERE piece_id IS NULL;

-- Now enforce NOT NULL on piece_id
ALTER TABLE public.telemetry_events
  ALTER COLUMN piece_id SET NOT NULL;

-- Index (may already exist from migration 15 attempt, using IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_telemetry_events_piece_id
  ON public.telemetry_events(piece_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_viewer_id
  ON public.telemetry_events(viewer_id);

