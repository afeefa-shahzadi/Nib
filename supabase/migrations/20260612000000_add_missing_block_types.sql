-- Add missing block types to the block_type enum if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'block_type' AND e.enumlabel = 'quote') THEN
    ALTER TYPE block_type ADD VALUE 'quote';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'block_type' AND e.enumlabel = 'callout') THEN
    ALTER TYPE block_type ADD VALUE 'callout';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'block_type' AND e.enumlabel = 'citation') THEN
    ALTER TYPE block_type ADD VALUE 'citation';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'block_type' AND e.enumlabel = 'question') THEN
    ALTER TYPE block_type ADD VALUE 'question';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'block_type' AND e.enumlabel = 'chart') THEN
    ALTER TYPE block_type ADD VALUE 'chart';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'block_type' AND e.enumlabel = 'mermaid') THEN
    ALTER TYPE block_type ADD VALUE 'mermaid';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'block_type' AND e.enumlabel = 'exercise') THEN
    ALTER TYPE block_type ADD VALUE 'exercise';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'block_type' AND e.enumlabel = 'audio_note') THEN
    ALTER TYPE block_type ADD VALUE 'audio_note';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'block_type' AND e.enumlabel = 'flowchart') THEN
    ALTER TYPE block_type ADD VALUE 'flowchart';
  END IF;
END $$;
