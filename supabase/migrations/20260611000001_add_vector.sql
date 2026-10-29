-- Enable the pgvector extension to work with embedding vectors
CREATE EXTENSION IF NOT EXISTS vector;

-- Add a vector column to the blocks table. 
-- Mistral embeddings are 1024 dimensions.
ALTER TABLE public.blocks ADD COLUMN IF NOT EXISTS embedding vector(1024);

-- Create a function to search for blocks
CREATE OR REPLACE FUNCTION match_blocks (
  query_embedding vector(1024),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  content_object_id uuid,
  type text,
  content jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    blocks.id,
    blocks.content_object_id,
    blocks.type,
    blocks.content,
    1 - (blocks.embedding <=> query_embedding) AS similarity
  FROM blocks
  WHERE 1 - (blocks.embedding <=> query_embedding) > match_threshold
  ORDER BY blocks.embedding <=> query_embedding
  LIMIT match_count;
$$;
