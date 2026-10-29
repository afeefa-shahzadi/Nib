-- Vercel Hobby only runs daily crons, so the frequent jobs run from Supabase:
-- pg_cron fires, pg_net calls the app route with the CRON_SECRET bearer.
-- Needs Vault secrets `cron_secret` and `app_url` (see docs/deploy/vercel.md).
-- Every step is guarded so local dev without the extensions/secrets still migrates.
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    CREATE EXTENSION IF NOT EXISTS pg_net;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron/pg_net unavailable (%); skipping cron jobs', SQLERRM;
    RETURN;
  END;

  -- Secrets are read at run time, so jobs can be scheduled before they're set.
  PERFORM cron.schedule('publish-scheduled', '*/5 * * * *', $job$
    SELECT net.http_get(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_url') || '/api/cron/publish',
      headers := jsonb_build_object('Authorization', 'Bearer ' ||
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret'))
    )
    WHERE EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cron_secret')
      AND EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'app_url')
  $job$);

  PERFORM cron.schedule('email-outbox', '7 * * * *', $job$
    SELECT net.http_get(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_url') || '/api/cron/email-outbox',
      headers := jsonb_build_object('Authorization', 'Bearer ' ||
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret'))
    )
    WHERE EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cron_secret')
      AND EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'app_url')
  $job$);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron job scheduling skipped: %', SQLERRM;
END
$$;
