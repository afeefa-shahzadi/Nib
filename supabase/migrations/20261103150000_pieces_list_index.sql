-- Studio Pieces screen: per-status counts and the newest-edited page for one author.
CREATE INDEX IF NOT EXISTS idx_content_objects_author_status_updated
  ON public.content_objects (author_id, status, updated_at DESC);
