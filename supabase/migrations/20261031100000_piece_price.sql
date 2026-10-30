-- Per-piece price. NULL = not for sale: gated blocks stay members-only.
-- Buying a piece unlocks that piece only (actions/content/helpers.ts).
ALTER TABLE public.content_objects
  ADD COLUMN IF NOT EXISTS price_paise integer
  CHECK (price_paise IS NULL OR price_paise BETWEEN 1000 AND 1000000);

CREATE INDEX IF NOT EXISTS idx_purchases_piece_access
  ON public.purchases (user_id, content_object_id) WHERE kind = 'piece' AND status = 'paid';
