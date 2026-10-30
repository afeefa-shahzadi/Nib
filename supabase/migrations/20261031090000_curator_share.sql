-- Curator referral share: an author opts a piece in; a sale made from a public
-- collection that contains it pays the curator 15% (lib/revenue-split.ts).
-- Dormant until paid piece/bundle checkout opens.
ALTER TABLE public.content_objects
  ADD COLUMN IF NOT EXISTS curator_share_enabled boolean NOT NULL DEFAULT false;

-- Stamped at order time after resolveCuratorAttribution's checks, so
-- settlement and refunds never re-derive who referred the sale.
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS collection_id uuid REFERENCES public.collections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS curator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS curator_net_paise integer;

CREATE INDEX IF NOT EXISTS idx_purchases_curator ON public.purchases (curator_id) WHERE curator_id IS NOT NULL;
