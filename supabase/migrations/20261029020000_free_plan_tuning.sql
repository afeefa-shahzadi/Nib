-- Free-plan tuning from the hosted advisors (2026-10-29). Idempotent.

-- 1. Trigger function exposed as RPC: it only rewrites NEW on insert, so no role
--    needs EXECUTE (triggers fire regardless). Pin search_path.
ALTER FUNCTION public.force_subscriber_unconfirmed() SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.force_subscriber_unconfirmed() FROM PUBLIC, anon, authenticated;

-- 2. Foreign keys without a covering index (deletes on the parent scan the child).
CREATE INDEX IF NOT EXISTS idx_dmca_counter_notices_author_id ON public.dmca_counter_notices (author_id);
CREATE INDEX IF NOT EXISTS idx_dmca_notices_actioned_by ON public.dmca_notices (actioned_by);
CREATE INDEX IF NOT EXISTS idx_dmca_notices_target_content_object_id ON public.dmca_notices (target_content_object_id);
CREATE INDEX IF NOT EXISTS idx_email_unsubscribes_author_id ON public.email_unsubscribes (author_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_payout_method_id ON public.payout_requests (payout_method_id);
CREATE INDEX IF NOT EXISTS idx_restriction_appeals_reviewed_by ON public.restriction_appeals (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_tds_withholdings_user_id ON public.tds_withholdings (user_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_user_id ON public.waitlist (user_id);

-- 3. Retention for append-only logs so the 500 MB free database doesn't fill with
--    telemetry. Daily at 03:17 UTC. Skipped where pg_cron is unavailable (local dev).
DO $$
BEGIN
  PERFORM cron.schedule('prune-logs', '17 3 * * *', $job$
    DELETE FROM public.telemetry_events WHERE created_at < now() - interval '180 days';
    DELETE FROM public.error_logs WHERE created_at < now() - interval '30 days';
  $job$);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'prune-logs cron skipped: %', SQLERRM;
END
$$;
