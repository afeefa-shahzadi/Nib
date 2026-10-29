# Deploying to Vercel (*.vercel.app)

## 1. Supabase cloud

1. Create a project. Link it: `supabase link --project-ref <ref>`.
2. Apply every file in `supabase/migrations`, in order: `supabase db push`.
3. **RLS note.** `20261028120000_mfa_required_rls.sql` adds a RESTRICTIVE
   `mfa_required` policy to every RLS-enabled `public` table through a DO loop.
   The loop only covers tables that exist when it runs. Any table created
   later needs that loop re-run, or its own `mfa_required` policy.
4. Auth settings: enable TOTP MFA (Authentication > Multi-Factor).
5. Auth > URL Configuration: set the Site URL to
   `https://<project>.vercel.app` and add the same domain (plus `/**`) to the
   redirect URLs. Update both when you buy a custom domain.

## 2. Environment variables (Vercel project settings)

Never commit real values. Generate keys with `openssl rand -hex 32`.

| Var | Required | Effect if missing |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | App cannot reach Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | App cannot reach Supabase |
| `SUPABASE_SECRET_KEY` | yes | Server-side admin operations fail. The app reads only this name; `SUPABASE_SERVICE_ROLE_KEY` is accepted by the seed scripts only |
| `NEXT_PUBLIC_APP_URL` | yes | Emails and links point at localhost |
| `NEXT_PUBLIC_SITE_URL` | yes | Subdomain/custom-domain routing breaks |
| `BYOK_ENCRYPTION_KEY` (64 hex chars) | yes | Saving a user AI key fails closed (no plaintext storage) |
| `CRON_SECRET` | yes | Cron routes return 500 |
| `EMAIL_TOKEN_SECRET` | yes | Unsubscribe/confirm links cannot be signed |
| `MISTRAL_API_KEY` | yes | Platform-funded AI unavailable |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | yes | No email is sent; in production there is no test-mailbox fallback, sends are skipped with a warning |
| `LAUNCH_FREE` | no | Unset = free launch ON. Only the exact value `0` turns it off |
| `PISTON_API_URL`, `PISTON_AUTH_TOKEN` | no | Code execution off; Run buttons hidden |
| `CONTACT_EMAIL` | no | Contact form recipient, legal/DMCA contact and default email sender (`lib/brand.ts`). Defaults to `writeson.nib@gmail.com` |
| `NEXT_PUBLIC_SOCIAL_X`, `NEXT_PUBLIC_SOCIAL_GITHUB`, `NEXT_PUBLIC_SOCIAL_LINKEDIN`, `NEXT_PUBLIC_SOCIAL_INSTAGRAM`, `NEXT_PUBLIC_SOCIAL_YOUTUBE` | no | Full profile URL each; the footer shows an icon only for those set |
| `SMTP_SECURE` | no | Set `true` for implicit TLS on port 465; default is STARTTLS on 587 |
| `AI_PLATFORM_FUNDED_OFF` | no | Set to `1` to stop platform-funded AI (kill switch) |
| `OFFICIAL_ACCOUNT_EMAIL` | no | Needed only for `pnpm seed:blog` |
| `ALERT_WEBHOOK_URL` | no | No ops alerts |
| `RAZORPAY_*`, `RAZORPAYX_*` | no | Payments and payouts disabled (not needed for free launch) |

On boot in production, `instrumentation.ts` logs a `[env]` warning for each
missing var that `lib/env-check.ts` checks (the Supabase vars, site/app URLs,
`BYOK_ENCRYPTION_KEY`, SMTP, `CRON_SECRET`, `MISTRAL_API_KEY`,
`EMAIL_TOKEN_SECRET`, plus an info line for `PISTON_API_URL`).

## 3. Crons

`vercel.json` holds only daily-safe crons (`reader-pool`, `reconcile`), since
Vercel Hobby rejects anything more frequent. Vercel sends `CRON_SECRET` as a
Bearer token; without it the routes return 500.

The frequent jobs run from Supabase `pg_cron` + `pg_net` (migration
`20261028130100_pg_cron_jobs.sql`): `publish` every 5 minutes and
`email-outbox` hourly (sends mail queued when the SMTP daily limit was hit).
One-time setup in the Supabase dashboard:

1. Database → Extensions: enable `pg_cron` and `pg_net`. If they weren't enabled
   when the migration ran, paste the migration's `DO $$ … $$;` block into the
   SQL editor and run it (re-running is safe: jobs upsert by name).
2. SQL editor, set the Vault secrets the jobs read:

   ```sql
   select vault.create_secret('<same value as CRON_SECRET>', 'cron_secret');
   select vault.create_secret('https://your-app.vercel.app', 'app_url');
   ```

3. Check: `select * from cron.job;` lists `publish-scheduled` and
   `email-outbox`; `select * from net._http_response order by id desc limit 5;`
   shows 200s.

## 4. Before launch

- Set a hard monthly spend limit at the AI provider. Platform-funded AI is
  free to users during launch.

## 5. Code execution (optional)

Off unless `PISTON_API_URL` is set. Leaving it unset is supported: code
blocks are display-only and Run buttons are hidden. Most free VM hosts
require a card. If you do host Piston, it needs Docker with `--privileged`
and should sit behind an authenticated reverse proxy; then set
`PISTON_API_URL` and `PISTON_AUTH_TOKEN`.

## 6. Official blog (later)

After the first deploy, seed it with `pnpm seed:blog` (script lands separately)
with `OFFICIAL_ACCOUNT_EMAIL` set.
