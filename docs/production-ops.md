# Production Ops Readiness

Next.js 16 + Supabase + Razorpay on Vercel. Grounded in the actual code as of
this audit. All `file:line` refs are real.

---

## Top 5 ops must-do before launch

1. **Set `CRON_SECRET` in Vercel prod.** Both cron routes gate on
   `if (cronSecret && authHeader !== ...)` — an *unset* secret means the guard
   is skipped and the route is **public and unauthenticated**
   (`app/api/cron/reader-pool/route.ts:12-15`, `app/api/cron/publish/route.ts:12-17`).
   `reader-pool` settles money (credits `earnings_ledger`), so an unset secret
   lets anyone on the internet trigger a payout settlement run. Not optional.
2. **Set `RAZORPAY_WEBHOOK_SECRET` in Vercel prod.** The webhook fails closed
   (returns 500 if unset — `app/api/webhooks/razorpay/route.ts:10-11`), so a
   missing secret means **every payment webhook is rejected** → no ledger
   credits, no subscription state updates, silent revenue loss. Configure the
   same value in the Razorpay dashboard webhook config.
3. **Set `BYOK_ENCRYPTION_KEY` (32-byte hex).** `lib/crypto.ts:10` — unset
   stores users' bring-your-own-key API secrets **in plaintext** (`.env.example:19-21`
   admits this). A secrets-at-rest leak waiting to happen.
4. **Add error alerting on the money paths.** Webhook handler errors, reader-pool
   ledger-credit failures, and cron failures currently only `console.error` into
   Vercel logs — nobody is paged. See [Part B](#part-b--observability).
5. **Add a reconciliation cron** to catch webhook/settlement drift. There is **no
   `razorpay_event_id` dedupe table**; idempotency rests entirely on DB state
   transitions, so a missed webhook leaves a purchase stuck in `created` with the
   money already captured at Razorpay and the creator never credited. See
   [Part C](#part-c--payment-reconciliation).

---

## Part A — Prod env config

### A1. Every `process.env.*` referenced in code

| Var | Public/Secret | Where used (representative) | Breaks if unset |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | `lib/supabase/server.ts:8`, `client.ts:5`, `proxy.ts:11` | **App dead** — no DB/auth client anywhere. `!`-asserted, so undefined → runtime crash. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | `lib/supabase/server.ts:9`, `client.ts:6`, `proxy.ts:12` | Browser + SSR anon client can't init → app dead. `!`-asserted. |
| `SUPABASE_SECRET_KEY` | **secret** | `lib/supabase/server.ts:43,67`, `actions/orgs.ts:98`, `actions/payments.ts:101` | Admin/service-role client dead → all webhooks, crons, settlement, payouts fail. `!`-asserted. |
| `RAZORPAY_KEY_ID` | **secret** | `actions/monetization/payments.ts:12,95`, `actions/payments.ts:11`, `actions/subscriptions.ts:11` | No orders/subscriptions created; `rzAuth()` throws "Razorpay not configured". |
| `RAZORPAY_KEY_SECRET` | **secret** | `actions/monetization/payments.ts:13,128`, `actions/payments.ts:170` | Order creation + checkout signature verify (`verifyRazorpayPayment`) fail. |
| `RAZORPAY_WEBHOOK_SECRET` | **secret** | `app/api/webhooks/razorpay/route.ts:10` | Webhook returns 500 for every event → no ledger credits, no sub state sync. |
| `CRON_SECRET` | **secret** | `app/api/cron/reader-pool/route.ts:12`, `app/api/cron/publish/route.ts:12` | **Routes become public** (guard is conditional) — money settlement unauthenticated. |
| `MISTRAL_API_KEY` | **secret** | `actions/ai.ts:25,405`, `actions/accessibility.ts:20`, `actions/search.ts:105` | AI features (composer assist, accessibility, semantic search) fail. Non-money. |
| `BYOK_ENCRYPTION_KEY` | **secret** | `lib/crypto.ts:10` | BYOK secrets stored **plaintext** (dev-only fallback). Security defect in prod. |
| `NEXT_PUBLIC_APP_URL` | public | `lib/email.ts:37`, `app/layout.tsx:29`, `app/sitemap.ts:16`, `app/feed.xml/route.ts:18`, `actions/newsletter.ts:40` | Falls back to `http://localhost:3000` → broken email/RSS/sitemap/OG links in prod. |
| `NEXT_PUBLIC_SITE_URL` | public | `proxy.ts:47-48` | Subdomain/custom-domain routing host resolution degrades (used for rootDomain). |
| `EMAIL_FROM` | config | `lib/email.ts:38`, `actions/newsletter.ts:76` | Falls back to `CONTACT_EMAIL` (`lib/brand.ts`). |
| `SMTP_HOST` | config | `lib/email.ts:10,13`, `lib/email/mailer.ts:6`, `app/api/contact/route.ts:39` | Unset → dev uses Ethereal test mail; **prod sends no real email**. |
| `SMTP_PORT` | config | `lib/email.ts:11`, `lib/email/mailer.ts:7`, `app/api/contact/route.ts:40` | Defaults 587. |
| `SMTP_USER` | **secret** | `lib/email.ts:16`, `lib/email/mailer.ts:10`, `app/api/contact/route.ts:43` | No SMTP auth → mail send fails / contact-form leads lost. |
| `SMTP_PASS` | **secret** | `lib/email.ts:17`, `lib/email/mailer.ts:11`, `app/api/contact/route.ts:44` | Same as above. |
| `SMTP_SECURE` | config | `lib/email/mailer.ts:8`, `app/api/contact/route.ts:41` | Defaults false (STARTTLS on 587). Set `true` for port 465. |
| `SMTP_FROM` | config | `lib/email/mailer.ts:24` | Stale: mailer.ts was merged into `lib/email.ts`; sender falls back to `EMAIL_FROM` then `CONTACT_EMAIL`. |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** | `lib/db/seed.ts:4`, `scripts/check-blocks-schema.ts:7` | **Seed/maintenance scripts only.** Note: this is the *same key* as `SUPABASE_SECRET_KEY` but under a different name — see A2. |
| `SUPABASE_ACCESS_TOKEN` | **secret** | *(none in app code)* | Supabase CLI only. In `.env.example` but not referenced by the app. |
| `NODE_ENV` | (auto) | docs only | Set by Vercel automatically. |
| `CI` | (auto) | `playwright.config.ts:6-8,31` | Test-runner only. |
| `PISTON_API_URL` | config | `actions/code.ts:17` | Falls back to `http://localhost:2000` — **there is no localhost on Vercel**, so code execution is broken in prod until this points at a deployed Piston container. See A6. |
| `PISTON_AUTH_TOKEN` | **secret** | `actions/code.ts:19` | Optional. If set, sent as `Authorization: Bearer` to Piston. Set it (and require it on Piston) once the container is reachable over the public internet. |

### A2. Declared (templates) vs referenced (code)

`.env.example` declares: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SECRET_KEY`, `SUPABASE_ACCESS_TOKEN`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
`RAZORPAY_WEBHOOK_SECRET`, `SMTP_HOST/PORT/USER/PASS`, `EMAIL_FROM`, `BYOK_ENCRYPTION_KEY`,
`MISTRAL_API_KEY`, `NEXT_PUBLIC_APP_URL`.

**Referenced in code but MISSING from `.env.example`:**

| Var | Severity | Note |
|---|---|---|
| `CRON_SECRET` | **critical** | Money-settlement auth. Not in template → easy to forget → public settlement route. |
| `NEXT_PUBLIC_SITE_URL` | medium | Subdomain routing (`proxy.ts`). Distinct from `NEXT_PUBLIC_APP_URL`. |
| `SMTP_SECURE` | low | Needed if using port 465. |
| `SMTP_FROM` | low | `lib/email/mailer.ts` uses a *different* from-var than `EMAIL_FROM`. Two mailer implementations exist. |
| `SUPABASE_SERVICE_ROLE_KEY` | **naming trap** | Seed scripts read this name; the app reads `SUPABASE_SECRET_KEY`. Same underlying key, two names. A dev who sets only one will have either the app or the seed scripts silently mis-keyed. Standardize on one name. |

**Declared but unused in app code:** `SUPABASE_ACCESS_TOKEN` (CLI-only — fine, just note it).

### A3. `tests/verify-env.ts` gives false confidence

It only checks **Supabase, Mistral, Razorpay KEY_ID/SECRET** (`tests/verify-env.ts:18-107`).
It does **not** check the three that most directly cause silent money/security
failures: `RAZORPAY_WEBHOOK_SECRET`, `CRON_SECRET`, `BYOK_ENCRYPTION_KEY` (nor SMTP).
A green run here does not mean launch-ready. Either extend it to assert those, or
don't treat it as a launch gate.

### A4. Cron auth cross-check (`vercel.json`)

```
/api/cron/publish       */5 * * * *   (every 5 min)
/api/cron/reader-pool   0 3 1 * *     (03:00 UTC, 1st of month — money settlement)
```

Both routes use the **same conditional guard**:
```ts
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) return 401
```
Vercel Cron automatically attaches `Authorization: Bearer <CRON_SECRET>` when the
env var is set. The trap: **if `CRON_SECRET` is unset, the `&&` short-circuits and
the check is skipped entirely** — the route answers any anonymous GET.

- `reader-pool` unset → anyone can trigger reader-pool settlement (idempotent per
  month via `pool_settled_until`, so mostly a nuisance not a double-pay, but it is
  an unauthenticated money-path endpoint).
- `publish` unset → anyone can force-publish scheduled pieces early and fan out
  notification emails.

Webhook (`app/api/webhooks/razorpay/route.ts`) requires `RAZORPAY_WEBHOOK_SECRET`
and **fails closed** (500) — correct. It also HMAC-verifies the signature
(`verifyRazorpaySignature`, line 14) before touching the DB.

### A5. Launch env checklist

**Must-have before launch (app breaks or money/security fails without them):**

| Var | Required | Secret | Consequence if missing |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | no | App dead (crash on client init). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | no | App dead. |
| `SUPABASE_SECRET_KEY` | ✅ | ✅ | All admin ops (webhooks/crons/settlement/payouts) dead. |
| `RAZORPAY_KEY_ID` | ✅ | ✅ | No orders/subscriptions. |
| `RAZORPAY_KEY_SECRET` | ✅ | ✅ | Order + checkout-signature verify fail. |
| `RAZORPAY_WEBHOOK_SECRET` | ✅ | ✅ | Every webhook 500s → no ledger credits, sub state never syncs. |
| `CRON_SECRET` | ✅ | ✅ | Settlement + publish crons become **public**. |
| `BYOK_ENCRYPTION_KEY` | ✅ | ✅ | BYOK secrets stored plaintext. |
| `NEXT_PUBLIC_APP_URL` | ✅ | no | Broken links in emails/RSS/sitemap/OG. |
| `SMTP_HOST`+`SMTP_USER`+`SMTP_PASS` | ✅ | ✅ | No real email in prod (publish notifs, newsletters, contact leads). |

**Optional / has-safe-default:**

| Var | Required | Secret | Consequence if missing |
|---|---|---|---|
| `MISTRAL_API_KEY` | ⚠️ (feature) | ✅ | AI features fail; core app works. |
| `NEXT_PUBLIC_SITE_URL` | ⚠️ | no | Only if using subdomain/custom-domain routing. |
| `EMAIL_FROM` / `SMTP_FROM` | optional | no | Cosmetic sender identity. |
| `SMTP_PORT` / `SMTP_SECURE` | optional | no | Defaults 587/STARTTLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | build/ops | ✅ | Seed scripts only (reconcile name with `SUPABASE_SECRET_KEY`). |
| `SUPABASE_ACCESS_TOKEN` | ops | ✅ | Supabase CLI only. |

### A6. Code execution (Piston) is a separate service — not bundleable into Next

> Superseded: code blocks now run in the reader's browser with `@browserrun/sandrun` (`lib/run-code.ts`). The Piston notes below apply only if the server path is revived.

`actions/code.ts` runs user-submitted code by POSTing to a **Piston** engine
(`piston-engine/`, a Docker container). Piston sandboxes untrusted code with Linux
isolation (namespaces, cgroups, seccomp, chroot) and holds multi-GB of installed
compilers. **It cannot run inside the Next app or on Vercel serverless** — no
privileged Linux, no persistent disk, no long-lived container there. Bundling it
in-process would also put attacker-controlled code in the same process as
`SUPABASE_SECRET_KEY`, `RAZORPAY_KEY_SECRET`, and `BYOK_ENCRYPTION_KEY`. The separate
container **is** the security boundary; keep it separate.

Deploy options (best first):
1. **Deploy the existing `piston-engine` container to Fly.io / Railway / a VPS.** Zero
   code rewrite — set `PISTON_API_URL` to its address. Fly Machines can scale-to-zero
   so idle cost ≈ 0.
2. Managed **Judge0** (RapidAPI) — no infra, but rewrites the `actions/code.ts` request
   shape + per-call cost.
3. **E2B** — only if the product moves to AI-generated / agent code sandboxes.

Do **not** use the public `emkc.org` Piston API in prod (rate-limited, shared, no SLA).

Once Piston is internet-reachable, set `PISTON_AUTH_TOKEN` on both sides so only this
app can reach `/execute`. Until any of this is done, the "Run" feature 500s in prod.

---

## Part B — Observability

### B1. What exists today

- **No Sentry, no APM, no structured logging.** Grep for
  `sentry|datadog|newrelic|opentelemetry|pino|winston` → nothing in `package.json`
  or app code.
- **`console.error` everywhere** — 173 occurrences across 72 files. In prod these
  land in Vercel function logs and **alert nobody**.
- **One in-house error sink:** `actions/errors.ts` `logError()` writes a row to a
  Supabase `error_logs` table. But it is fed **only by client-side React error
  boundaries** (`app/global-error.tsx:16`, `app/error.tsx`). Server-side money-path
  failures never reach it.

**Where the money-path failures currently go (all `console.error`, no alert):**

| Failure | Location | Current handling |
|---|---|---|
| Webhook handler exception | `app/api/webhooks/razorpay/route.ts:192` | `console.error` + 500 (Razorpay will retry — good) but no human alert. |
| Reader-pool ledger credit failed *after* month claimed | `actions/monetization/reader-pool.ts:156-159` | `console.error` "LEDGER CREDIT FAILED", loop continues. **Creators silently underpaid.** |
| Reader-pool cron top-level failure | `app/api/cron/reader-pool/route.ts:39` | `console.error` + 500. Nobody notified. |
| Cron publish DB/update/email failures | `app/api/cron/publish/route.ts:33,68,110,123` | `console.error`, loop continues. |

### B2. Minimum viable observability (ranked, do not over-engineer)

1. **Error tracking with alerting — `@sentry/nextjs`.** One package, wizard-generated
   config, covers server actions, route handlers (webhook + crons), and the client
   boundaries already calling `logError`. This is the single highest-leverage add:
   it turns all 173 blind `console.error`s into searchable, alertable events. Wire a
   Slack/email alert rule. *Skipped alternative: hand-rolled log shipping — Sentry's
   free tier covers a launch-stage app, add self-hosted only if volume/cost bites.*
2. **Alert specifically on the three money strings.** Even before/without Sentry,
   add a Sentry `captureMessage` (or a 2-line webhook-to-Slack) at exactly these
   three sites so a failure pages someone:
   - `razorpay/route.ts:192` (webhook handler error → Razorpay retrying)
   - `reader-pool.ts:157` (LEDGER CREDIT FAILED → manual reconcile needed)
   - `reader-pool/route.ts:39` (settlement run crashed)
3. **Cron success/failure visibility.** Vercel surfaces cron invocation status in the
   dashboard; enable Vercel's cron failure notifications (native, zero code). For the
   monthly settlement, that plus #2 is enough — a missed monthly run is the scenario
   the reconciliation check ([Part C](#part-c--payment-reconciliation)) also catches.

That's it. No tracing, no metrics pipeline, no log aggregation platform at launch —
error tracking + three targeted money-path alerts + native cron notifications cover
the real risk surface for a payments app this size.

---

## Part C — Payment reconciliation

### C1. How settlement records money today

Money enters the ledger through **two paths that both call the same idempotent
helper**, plus the webhook for subscriptions/pools:

- One-time purchases (piece/bundle/tip): `settlePaidPurchase()`
  (`actions/monetization/payments.ts:654-692`). Called by **both** the client confirm
  (`actions/payments.ts:186 verifyRazorpayPayment`) and the webhook
  (`app/api/webhooks/razorpay/route.ts:65`). Idempotency is the gated
  `.update(status:'paid').eq('status','created')` transition (line 661-663): only the
  first caller flips `created→paid` and inserts the `earnings_ledger` row.
- Sponsorships: `verifySponsorshipPayment` — gated `pending→active` transition
  (`payments.ts:487-535`).
- Subscriptions + reader-pool IP grants: webhook, gated by status maps and the
  `ip_granted_until` / `pool_settled_until` advance-claims.
- Reader pool payout: monthly cron → `settleReaderPools`, gated by `pool_settled_until`.

**The finding:** idempotency is enforced **only by DB state transitions**. There is
**no `razorpay_event_id` dedupe table** — a replayed webhook is safe *only because*
every handler happens to gate on a status column. Any future handler that forgets the
`.eq("status", ...)` guard double-credits, and there is no second line of defense.
Reconciliation is that missing safety net.

### C2. Drift scenarios (Razorpay truth vs app ledger)

| # | Scenario | Result | Who's hurt |
|---|---|---|---|
| 1 | Webhook missed **and** client confirm missed (user closed tab, both fail) | `purchases` row stuck `created`, money captured at Razorpay, no ledger credit | Creator underpaid |
| 2 | Reader-pool crash *after* `pool_settled_until` claim, *before* credit (`reader-pool.ts` at-most-once, line 64 comment) | Month marked settled, no distribution written | Creators underpaid, budget silently kept by platform |
| 3 | `payment.failed` webhook missed | `purchases` stuck `created` though actually failed | Cosmetic / stuck state |
| 4 | Replayed/duplicate webhook hits a handler missing its status guard | Double `earnings_ledger` insert | Platform overpays |
| 5 | `subscription.*` webhook missed | `profiles.plan` stale (paid user shows `free`, or churned user keeps `studio`) | User access wrong, revenue mismatch |

### C3. Reconciliation check — sketch

Reuse the existing patterns: a **monthly Vercel cron** (add to `vercel.json`, guarded
by `CRON_SECRET` like the other two) backed by a script in `scripts/` (the repo
already has `scripts/razorpay-e2e-smoke.mjs` as a Razorpay-API precedent). Read-only —
it **surfaces** mismatches, it does not auto-correct (auto-crediting off a
reconciliation job is how you turn one bug into a double-pay).

```
// app/api/cron/reconcile/route.ts  (CRON_SECRET-guarded, same guard as the others)
// vercel.json: { "path": "/api/cron/reconcile", "schedule": "0 4 * * *" }  // daily 04:00 UTC
//
// For the trailing window (e.g. last 48h, overlap so nothing falls between runs):
// 1. Pull Razorpay captured payments:  GET /v1/payments?from=&to=&count=100 (paginate)
//    (Basic auth = same rzAuth() as actions/monetization/payments.ts:11)
// 2. For each captured payment, look up the local record by razorpay_order_id /
//    razorpay_payment_id across: purchases, sponsorships, boosts, *_subscriptions.
// 3. Flag mismatches:
//    a. Razorpay=captured  but local status still 'created'/'pending'  -> MISSED CREDIT (scenario 1/2)
//    b. Razorpay=captured  but NO earnings_ledger row for that order   -> MISSING LEDGER
//    c. local 'paid'/'active' but Razorpay has no matching capture     -> PHANTOM CREDIT (scenario 4)
//    d. two earnings_ledger rows for one razorpay_payment_id            -> DOUBLE CREDIT
// 4. Also verify settlements: sum(earnings_ledger.net_paise for a period) reconciles
//    against Razorpay settlements API for the same window (drift tolerance = 0).
// 5. Emit findings to the Part-B alert sink (Sentry captureMessage / Slack). Do NOT
//    mutate — a human reviews and replays the specific payment.
//
// ponytail: read-only diff + alert. No auto-heal, no reversal table. Add a
// razorpay_event_id dedupe table only if scenario-4 findings actually show up —
// this check is the cheaper detector until then.
```

Minimal self-check for the diff logic (no framework — matches repo style, cf.
`distributePool`'s inline self-check): assert that a captured-payment / no-ledger-row
pair produces a `MISSING LEDGER` finding and that a matched pair produces none.

This one daily job closes the loop on all five drift scenarios **and** substitutes for
the absent event-dedupe table (scenario 4), which is why it earns a spot in the
launch top-5.
