-- Migration: Add 'sources' JSONB column to support Citations
-- Adds to content_objects, blocks, and piece_responses

ALTER TABLE public.content_objects ADD COLUMN IF NOT EXISTS sources JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.blocks ADD COLUMN IF NOT EXISTS sources JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.piece_responses ADD COLUMN IF NOT EXISTS sources JSONB DEFAULT '[]'::jsonb;
