-- moderation_actions: clear two Supabase linters on the audit table.

-- 1) rls_enabled_no_policy (INFO). RLS is on with zero policies = implicit
-- deny-all, which is the intent (only the service-role client writes audit rows,
-- and it bypasses RLS). Make the deny-all EXPLICIT so the linter stops flagging
-- and the intent is documented. Service role is unaffected.
DROP POLICY IF EXISTS "moderation_actions_no_client_access" ON public.moderation_actions;
CREATE POLICY "moderation_actions_no_client_access" ON public.moderation_actions
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- 2) unindexed_foreign_keys (perf). Cover each FK so joins / cascade lookups
-- don't seq-scan. Small table, but the linter is right and the indexes are cheap.
CREATE INDEX IF NOT EXISTS moderation_actions_moderator_id_idx
  ON public.moderation_actions (moderator_id);
CREATE INDEX IF NOT EXISTS moderation_actions_content_object_id_idx
  ON public.moderation_actions (content_object_id);
CREATE INDEX IF NOT EXISTS moderation_actions_report_id_idx
  ON public.moderation_actions (report_id);
