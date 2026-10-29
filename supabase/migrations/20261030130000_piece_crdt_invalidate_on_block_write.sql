-- The composer seeds from the piece_crdt snapshot whenever one exists and only
-- falls back to the blocks table for a brand-new doc. Any block write that
-- doesn't go through the composer's Y.Doc (version restore, AI rewrites,
-- imports, scripted fixes) left the snapshot stale: reopening showed the old
-- text, and the next autosave wrote it back over the newer blocks.
--
-- Blocks are the source of truth, so any write to a piece's blocks drops its
-- snapshot. The composer re-seeds from blocks on next open and re-saves a
-- fresh snapshot on the next edit; its own autosaves just recreate it.
CREATE OR REPLACE FUNCTION public.drop_stale_piece_crdt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.piece_crdt
  WHERE piece_id = CASE WHEN TG_OP = 'DELETE' THEN OLD.content_object_id
                        ELSE NEW.content_object_id END;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS blocks_drop_stale_piece_crdt ON public.blocks;
CREATE TRIGGER blocks_drop_stale_piece_crdt
AFTER INSERT OR UPDATE OR DELETE ON public.blocks
FOR EACH ROW EXECUTE FUNCTION public.drop_stale_piece_crdt();
