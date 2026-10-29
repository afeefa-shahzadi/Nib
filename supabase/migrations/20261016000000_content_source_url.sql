-- Provenance for imported pieces: where the content originally came from. Set by
-- the importer (the single-URL imported, or a Medium/Substack export's canonical
-- link). Surfaced on the reader as "Originally published at <source>" and used
-- as the rel=canonical target so the original keeps its search credit (and this
-- copy doesn't take a duplicate-content penalty). Null for native pieces.
ALTER TABLE content_objects ADD COLUMN IF NOT EXISTS source_url text;
