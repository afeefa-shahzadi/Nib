-- DMCA review fixes.
--
-- (#2) External rightsholders file by URL, not the internal content object id.
--      When the piece can't be auto-resolved from the infringing URL, the notice
--      is still captured (null target) for admin triage rather than rejected, so
--      a valid §512 notice is never lost. Allow NULL.
ALTER TABLE public.dmca_notices
  ALTER COLUMN target_content_object_id DROP NOT NULL;

-- (#3) One counter-notice per notice, enforced in the DB. The app-level
--      select-then-insert was a TOCTOU race under concurrent submits. The unique
--      constraint supplies its own index, so the plain index is now redundant.
DROP INDEX IF EXISTS public.dmca_counter_notices_notice_idx;
ALTER TABLE public.dmca_counter_notices
  ADD CONSTRAINT dmca_counter_notices_notice_key UNIQUE (notice_id);
