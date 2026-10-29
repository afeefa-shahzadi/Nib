-- Durable CRDT snapshot so a collaborative draft survives a fully-empty room.
-- The Yjs relay (use-yjs-supabase) keeps no state, so when every peer leaves the
-- in-memory doc is gone; content still survives via block autosave, but exact
-- concurrent-edit merge state did not. This stores Y.encodeStateAsUpdate(doc)
-- (base64) so reopening restores the real doc.
--
-- Service-role only (RLS on, no policies): the savePieceCrdt/loadPieceCrdt
-- actions enforce edit access, same pattern as email_unsubscribes. Clients never
-- touch this table directly.
CREATE TABLE IF NOT EXISTS public.piece_crdt (
  piece_id UUID PRIMARY KEY REFERENCES public.content_objects(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.piece_crdt ENABLE ROW LEVEL SECURITY;
