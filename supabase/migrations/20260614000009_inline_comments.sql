-- Add inline comments support to piece_responses
ALTER TABLE public.piece_responses ADD COLUMN IF NOT EXISTS quoted_text TEXT;
ALTER TABLE public.piece_responses ADD COLUMN IF NOT EXISTS serialized_range JSONB;

-- Add toggle to content_objects to enable/disable inline comments per piece
ALTER TABLE public.content_objects ADD COLUMN IF NOT EXISTS allow_inline_comments BOOLEAN DEFAULT true;
