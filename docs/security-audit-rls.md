# Security Audit — Row-Level Security & Service-Role Usage

**Scope:** RLS coverage + `createAdminClient()`/service-role usage across `actions/**` and `app/api/**`.
**Method:** static read of `supabase/schema.sql`, `supabase/migrations/**`, and every service-role caller. AUDIT ONLY — no code or policy changed. Cited as `file:line`.
**Date:** 2026-07-18

> Threat model that makes RLS load-bearing: the browser holds `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and a logged-in user JWT, so a user can call `supabase.from(...).insert/update/select(...)` **directly**, bypassing every server action. Server actions look correctly scoped; RLS is the *only* thing standing between a crafted browser request and the raw tables. Several money/authz tables have RLS that permits the user to write their own rows.

---

## TOP 3 — MUST FIX BEFORE LAUNCH

1. **`earnings_ledger` is user-writable → mint money and withdraw it.**
   `earnings_ledger_write ... FOR ALL USING (user_id = auth.uid())` (`supabase/schema.sql:3370`, origin `supabase/migrations/20260611000005_massive_rls_refactor.sql:62`) lets any authenticated user INSERT/UPDATE/DELETE their **own** ledger rows via the publishable-key client. `computeWithdrawableBalancePaise()` sums `earnings_ledger.net_paise` for the user (`actions/monetization/payments.ts:717-720`) and `requestPayout()` pays that out as real money. Exploit: browser console `supabase.from('earnings_ledger').insert({user_id:<me>,source:'x',gross_paise:0,net_paise:100000000,status:'available'})` → `requestPayout({amountPaise: 100000000})`. This is the exact bug fixed for `payout_requests` in `20260717000000_payout_hardening.sql` but **never applied to its sibling `earnings_ledger`**. (Also `earnings_ledger_read USING(true)` at `schema.sql:3374` leaks every creator's earnings to any user.)

2. **Org takeover via self-issued invite.**
   `org_invites_insert ... WITH CHECK ((select auth.uid()) IS NOT NULL)` (`supabase/schema.sql:3429`) lets any authenticated user INSERT an invite row for **any** `org_id` with `role='owner'` and a token of their choosing (`org_invites` has `org_id`, `role`, `token` columns — `schema.sql:784-792`). `acceptOrgInvite()` then looks the token up and inserts the caller into `org_members` with `inv.role` (`actions/orgs.ts:329-343`) — no check that the invite was legitimately created and no check that the invited `email` matches the accepting user. Exploit: insert `{org_id:<victim org>, email:'x', role:'owner', token:'x'}`, then `acceptOrgInvite({token:'x'})` → owner of any organization. Compounded by `org_invites_read USING(true)` (`schema.sql:3433`) which also exposes every real pending token to every user.

3. **Self-assign `admin`/`creator` role → privilege escalation.**
   `"Users can insert their own roles" ... WITH CHECK (user_id = auth.uid())` (`supabase/schema.sql:3122`); the role CHECK constraint permits `'admin'` (`schema.sql:1249`). `getMyRole()` derives the app role from this table (`actions/content/profile.ts:22-34`) and it gates Studio/creator surfaces (`app/studio/page.tsx:52`, `app/studio/settings/page.tsx:122`). Exploit: `supabase.from('user_roles').insert({user_id:<me>,role:'admin'})` → creator/admin access without paying or approval.

All three are direct-client RLS bypasses; the server actions themselves are written correctly. Fixes must be decided by a human (a wrong RLS tightening can lock out real users) — suggested directions are given per finding, not applied.

---

## RLS Coverage Matrix

Legend: **W=world** (`USING(true)`), **own** (`user_id = auth.uid()` or similar), **any-auth** (`auth.uid() IS NOT NULL`), **none** (no policy → service-role only), **role** (org/ownership function).
Write columns cover INSERT/UPDATE/DELETE. "svc-only" = no write policy, writes go through service role (safe by default).

| Table | RLS on? | SELECT | Writes | Verdict |
|---|---|---|---|---|
| **earnings_ledger** | yes | **W** (3374) | **own** ALL (3370) | **HIGH — user can mint & read all earnings** |
| **org_invites** | yes | **W** (3433) | **any-auth** (3429/3437/3425) | **HIGH — any user forges owner invites; tokens world-readable** |
| **user_roles** | yes | own (3206) | **own** insert (3122)/delete (3098) | **HIGH — self-assign admin/creator** |
| **piece_responses** | **NO** | — | — | **HIGH — RLS never enabled; full anon read/write** |
| profiles | yes | **W** (3000) | own update (3158) | **MED — `select('*')` leaks DOB, disability_*, stripe_customer_id, byok_api_key, ad_revenue_balance** |
| sponsorships | yes | W (3561) | **any-auth** (3557/3565/3553) | **MED — any user inserts/deletes any sponsorship** |
| collection_items | yes | W (3264) | **any-auth** (3260/3268/3256) | MED — any user mutates any collection's items |
| org_subscriptions | yes | **W** (2927, mislabeled "by owner") | none | MED — billing status/seats leak org-wide |
| org_members | yes | **W** (2909) | none | MED — full org membership graph leaks |
| memberships | yes | **W** (3408) | own (3404/3400/3412) | MED — subscriber↔author graph leaks |
| saves | yes | **W** (3542) | own (3538/3546/3534) | LOW/MED — reading habits leak |
| earnings via ad_payout_requests | yes | own (3186) | own insert (3114) | LOW — insert own only; no update/delete (ok) |
| payout_requests | yes | own (3463) | own insert (3459); no upd/del | OK — hardened in 20260717000000 |
| tips | yes | sender-only (3054) | none | OK — svc-only writes |
| purchases | yes | own (3011) | none | OK — svc-only writes |
| bundle_purchases | yes | owner/purchaser (3004) | none | OK |
| subscriptions | yes | subscriber/tier-owner (3043) | none | OK |
| payment_subscriptions | yes | own (2986) | none | OK |
| reader_subscriptions | yes | own (3019) | none | OK |
| studio_subscriptions | yes | own (3035) | none | OK |
| reader_pool_distributions | yes | reader/creator (2990) | none | OK — svc-only credit |
| leads | yes | none | none | OK — svc-only (contact form writes via admin client) |
| boosts | yes | W (2869) | none | OK — public marketing, svc writes |
| notifications | yes | own (3202) | own update (3162); no insert | OK |
| newsletter_dispatches | yes | own (3194) | own insert (3118) | OK |
| error_logs | yes | own (3198) | none | OK |
| audit_logs | yes | workspace-scoped (3174) | none | OK |
| content_objects | yes | published/author/org (3064) | author/org (3058/3070) | OK |
| blocks / branches / branch_merge_requests | yes | author-or-public | author-scoped | OK |
| comments | yes | W read | own author | OK (public comments) |
| piece_versions / piece_coauthors | yes | owner/coauthor | is_piece_author() | OK |
| piece_claps / reader_annotations / reader_highlights / collection_progress / piece_response_votes | yes | scoped/own | own manage | OK |
| collections | yes | W read | curator_id (3278-3290) | OK |
| debate_rooms / debate_messages / debate_room_invites | yes | W read | own/creator | OK (public debate; read-all acceptable) |
| follows / relationships / recommendations / recommendation_feedback | yes | W/own | own | OK |
| content_reports | yes | own read (3150) | insert `WITH CHECK(true)` (2783) | LOW — anyone can submit reports (spam), no read leak |
| author_subscribers | yes | author-only (3210) | insert `WITH CHECK(true)` (2787) | LOW — anyone can insert a subscriber row |
| reader_telemetry / telemetry_events | yes | author-of-content (2851/2857) | insert gated by piece existence | OK |
| workspaces / workspace_members / org_workspaces | yes | owner/member | owner-scoped | OK |
| achievements / quests / daily_quests / membership_tiers / bundles / bundle_items / user_stats / insight_points / reading_streaks / user_reward_claims / organizations | yes | public or own | own/none | OK |

Every `public` table has `ENABLE ROW LEVEL SECURITY` **except `piece_responses`** (defined `schema.sql:917`, absent from all `ENABLE ROW LEVEL SECURITY` statements and from every migration — Finding H4).

---

## Findings (ranked)

### HIGH

**H1 — `earnings_ledger` self-credit → real payout.**
`supabase/schema.sql:3370` (policy `earnings_ledger_write FOR ALL USING (user_id = auth.uid())`); reachable balance math at `actions/monetization/payments.ts:717-720` and `604-648`.
*Exploit:* direct-client `insert` of a large `net_paise` row for yourself, then `requestPayout`. Withdrawable balance is `sum(earnings_ledger.net_paise) + sum(paid tips) − reserved`; ledger is user-writable, so the balance is attacker-controlled.
*Suggested fix (not applied):* drop the `FOR ALL` write policy — ledger must be service-role-write-only like `tips`/`purchases`. Scope `earnings_ledger_read` to `user_id = auth.uid()`. Mirror the `20260717000000` treatment.

**H2 — Org takeover via forged invite.**
`supabase/schema.sql:3429` (`org_invites_insert WITH CHECK (auth.uid() IS NOT NULL)`), accept flow `actions/orgs.ts:313-343`, invite columns `schema.sql:784-792`.
*Exploit:* insert `{org_id:<any>, role:'owner', token:'t', email:'x'}` directly, then `acceptOrgInvite({token:'t'})` → inserted into `org_members` as owner of any org. `acceptOrgInvite` never verifies the invite was issued by an org admin nor that `email` matches the caller.
*Suggested fix:* restrict `org_invites` writes to org owner/admin (a `SECURITY DEFINER` helper like `is_org_admin(org_id)`), scope `org_invites_read` to the invitee/admins, and in `acceptOrgInvite` require the authenticated user's email to equal `inv.email`.

**H3 — Self-assign `admin`/`creator`.**
`supabase/schema.sql:3122` (`user_roles` insert `WITH CHECK (user_id = auth.uid())`), constraint `schema.sql:1249`, consumer `actions/content/profile.ts:8-38`.
*Exploit:* `insert {user_id:<me>, role:'admin'}` → `getMyRole().primary === 'admin'` unlocks Studio/creator UI. Note `enableAuthorMode` (`profile.ts:216-219`) already self-grants `'creator'` by design, so the intended trust model treats creator as self-serve — but `'admin'` was never meant to be self-granted, and any future admin-gated action inherits this hole.
*Suggested fix:* remove the self-insert policy; assign roles only via service role / a definer function that forbids `'admin'`. Decide explicitly whether `'creator'` stays self-serve.

**H4 — `piece_responses` has RLS disabled.**
Table `supabase/schema.sql:917`; no `ENABLE ROW LEVEL SECURITY` anywhere (`schema.sql` or migrations).
*Exploit:* with RLS off, the anon/publishable key reads and writes every row directly (insert/edit/delete any response).
*Suggested fix:* `ALTER TABLE public.piece_responses ENABLE ROW LEVEL SECURITY;` plus SELECT/INSERT/UPDATE/DELETE policies matching the sibling `piece_response_votes` (author-scoped writes, public read if responses are public).

### MED

**M1 — `profiles` leaks sensitive columns.**
`supabase/schema.sql:3000` (`SELECT USING(true)`) combined with `select('*')` (e.g. `actions/content/profile.ts:52-54`, `app/api/export/route.ts:56-60`). Columns `schema.sql:948-975` include `date_of_birth`, `disability_visual/cognitive/hearing/motor` (special-category data), `stripe_customer_id`, `byok_api_key` (ciphertext + provider/model), `ad_revenue_balance_cents`.
*Exploit:* `supabase.from('profiles').select('*')` from any browser returns these for **all** users.
*Suggested fix:* move sensitive columns to a private, owner-only table or a `profiles_public` view, and grant column-level SELECT only on public columns. Do not weaken the existing public-profile read for handle/display_name/bio/avatar.

**M2 — `sponsorships` / `collection_items` writable by any authenticated user.**
`schema.sql:3557` (sponsorships), `schema.sql:3260` (collection_items) — `WITH CHECK (auth.uid() IS NOT NULL)` on insert/update/delete.
*Exploit:* any user can insert a fake sponsorship on any piece, delete another creator's sponsorship, or edit items in any collection — the server actions check ownership (`actions/monetization/payments.ts:293-301`, `351-359`) but the direct client bypasses them.
*Suggested fix:* scope writes to the owning creator/curator (join to `content_objects.author_id` / `collections.curator_id`).

**M3 — `org_subscriptions` / `org_members` / `memberships` read `USING(true)`.**
`schema.sql:2927`, `2909`, `3408`. Leaks billing status & seat counts, full org membership graphs, and the subscriber↔author relationship across all orgs/users.
*Suggested fix:* scope each SELECT to org membership / the owning user.

**M4 — SSRF in `/api/link-preview`.**
`app/api/link-preview/route.ts:4-17` — unauthenticated GET fetches an arbitrary user-supplied `url` server-side with no scheme/host allowlist or private-IP block, and reflects parsed content.
*Exploit:* `/api/link-preview?url=http://169.254.169.254/latest/meta-data/` or internal service URLs.
*Suggested fix:* require auth, block private/link-local ranges and non-http(s) schemes, and cap size/timeout.

### LOW / notes

- **L1 — Cron guards are fail-open.** `app/api/cron/publish/route.ts:15` and `app/api/cron/reader-pool/route.ts:13` use `if (cronSecret && authHeader !== ...)`. If `CRON_SECRET` is unset in production, the check is skipped and anyone can trigger publish and **reader-pool money settlement**. *Fix:* fail closed (401 when the secret is unconfigured).
- **L2 — `/api/format`** (`app/api/format/route.ts:10-41`) is unauthenticated and shells out to formatter binaries on arbitrary input (`execAsync`). Filename is server-generated (no shell injection of the path), but it is an unauthenticated process-spawn / DoS surface. *Fix:* require auth, add rate limiting; consider dropping server-side shelling entirely.
- **L3 — `/api/contact`** (`app/api/contact/route.ts`) is intentionally public (writes `leads`, which is correctly service-role-locked). No rate limiting (spam), and user input is interpolated unescaped into the internal notification email HTML (`route.ts:48-57`). LOW.
- **L4 — `content_reports` / `author_subscribers`** allow `INSERT WITH CHECK(true)` (`schema.sql:2783`, `2787`) — anyone (incl. anon) can insert report/subscriber rows. Spam vector, no data leak.

---

## Service-Role Caller Inventory

`createAdminClient()` / `createServiceRoleClient()` bypass RLS entirely (`lib/supabase/server.ts:33-75`). "Scoped?" = does every DB op verify the caller owns the row / has the role.

| Handler | File | Scoped? | Risk |
|---|---|---|---|
| razorpay webhook | `app/api/webhooks/razorpay/route.ts` | signature-verified (14) | Intended svc use |
| cron publish | `app/api/cron/publish/route.ts` | CRON_SECRET (fail-open) | Intended; see L1 |
| cron reader-pool | `app/api/cron/reader-pool/route.ts` | CRON_SECRET (fail-open) | Intended; see L1 |
| contact→leads | `app/api/contact/route.ts` | public by design | leads locked; see L3 |
| `settleReaderPools` | `actions/monetization/reader-pool.ts:66` | cron-only entry, deterministic | Intended svc credit |
| `settlePaidPurchase` | `actions/monetization/payments.ts:654` | keyed on order_id + gated created→paid | OK (idempotent) |
| `verifyBoostPayment` / `verifySponsorshipPayment` / `createBoostOrder` / `togglePieceMonetization` | `actions/monetization/payments.ts:64,141,227` | verifies `author_id === userId` before mutate | OK |
| `requestPayout` / `getMyEarnings` / `redeemStudioFromEarnings` | `actions/monetization/payments.ts:604,553,816` | filters by `context.userId` | Scoped, **but** depends on H1 ledger integrity |
| `createStudioSubscription` / `createReaderPassSubscription` / `cancelStudioSubscription` / `cancelReaderSubscription` / `getMyPlan` | `actions/subscriptions.ts` | all keyed on `context.userId` | OK |
| `createOrgSubscription` | `actions/subscriptions.ts:234` | checks `org_members` role owner/admin (250-258) | OK |
| `acceptOrgInvite` | `actions/orgs.ts:313` | token-only, **no issuer/email check** | See H2 |
| `removeOrgMember` | `actions/orgs.ts:351` | checks caller role owner/admin (376-388) | OK |
| `getMyRole` / `getMyProfile` / `enableAuthorMode` | `actions/content/profile.ts` | keyed on `context.userId` | Scoped; role table itself is the hole (H3) |
| export / export-subscribers | `app/api/export/*` | use **RLS user client** + plan/role check | OK (not service role) |

No service-role handler was found taking a user-supplied `id` into a **mutation** without an ownership/role check *within the action code*. The exposure is at the RLS layer (direct-client bypass), which the findings above address. `acceptOrgInvite` (H2) is the one action whose own logic is insufficient (trusts a token that any user can create).

---

## What is already good

- `payout_requests` was correctly hardened (`20260717000000`): user-write removed, read scoped, partial unique index against double-drain.
- `tips`, `purchases`, `subscriptions`, `reader_subscriptions`, `studio_subscriptions`, `reader_pool_distributions`, `leads` are read-scoped with **no** write policy — writes only via service role. This is the pattern `earnings_ledger` should follow.
- Razorpay webhook verifies HMAC signature; payment verify actions use `timingSafeEqual`.
- Settlement paths are idempotent via gated status transitions / `pool_settled_until` / `ip_granted_until` claims.
