-- One private "Saved" list per reader. Two saves at once used to create two.
-- Keep the oldest if duplicates already exist, moving their items across first.
WITH ranked AS (
  SELECT id, curator_id, row_number() OVER (PARTITION BY curator_id ORDER BY created_at, id) AS rn
  FROM public.collections WHERE is_personal
), keep AS (SELECT curator_id, id AS keep_id FROM ranked WHERE rn = 1),
dupes AS (SELECT r.id, k.keep_id FROM ranked r JOIN keep k USING (curator_id) WHERE r.rn > 1)
UPDATE public.saves s SET collection_id = d.keep_id FROM dupes d WHERE s.collection_id = d.id;

WITH ranked AS (
  SELECT id, curator_id, row_number() OVER (PARTITION BY curator_id ORDER BY created_at, id) AS rn
  FROM public.collections WHERE is_personal
), keep AS (SELECT curator_id, id AS keep_id FROM ranked WHERE rn = 1),
dupes AS (SELECT r.id, k.keep_id FROM ranked r JOIN keep k USING (curator_id) WHERE r.rn > 1)
UPDATE public.collection_items i SET collection_id = d.keep_id FROM dupes d WHERE i.collection_id = d.id;

DELETE FROM public.collections c
USING (
  SELECT id, row_number() OVER (PARTITION BY curator_id ORDER BY created_at, id) AS rn
  FROM public.collections WHERE is_personal
) r
WHERE c.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS collections_one_personal_per_curator
  ON public.collections (curator_id) WHERE is_personal;
