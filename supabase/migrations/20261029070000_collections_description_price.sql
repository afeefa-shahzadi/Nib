-- collections.description and price_paise exist in schema.sql (and locally) but were
-- never added by a migration, so production lacks them: createCollection and every
-- collection listing that selects them failed there.
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS price_paise integer NOT NULL DEFAULT 0;
