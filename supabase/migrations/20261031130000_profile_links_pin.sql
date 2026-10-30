-- Profile links (website + up to 5 social links) and a pinned piece.
-- Validated in lib/profile-links.ts before write; the checks here are a backstop.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS website text CHECK (website IS NULL OR (website ~ '^https://' AND length(website) <= 300)),
  ADD COLUMN IF NOT EXISTS links text[] NOT NULL DEFAULT '{}' CHECK (cardinality(links) <= 5),
  ADD COLUMN IF NOT EXISTS pinned_piece_id uuid REFERENCES public.content_objects(id) ON DELETE SET NULL;
