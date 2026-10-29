-- RLS hardening: close user-writable money/authz tables and PII column leaks.
--
-- Root cause (all five): server actions correctly scope every query by
-- context.userId, but they run through the SERVICE ROLE (createAdminClient
-- bypasses RLS). RLS is therefore the ONLY wall on the direct publishable-key
-- (anon/authenticated) client path — and these tables granted users write to
-- their own rows, or world-read. The app never depends on the user-client write
-- paths dropped here (every write goes via the admin client), and every
-- user-client READ that survives is verified below, so this changes no app
-- behavior while removing the exploits.

-- 1. earnings_ledger — a user could INSERT/UPDATE/DELETE their OWN ledger rows
--    (mint withdrawable balance, then requestPayout it as real money), and read
--    was world-open (every creator's earnings). App reads/writes exclusively via
--    the admin client (getMyEarnings, settleReaderPools, settlePaidPurchase).
--    Lock to service-role writes; owner-only read.
DROP POLICY IF EXISTS "earnings_ledger_insert" ON public.earnings_ledger;
DROP POLICY IF EXISTS "earnings_ledger_update" ON public.earnings_ledger;
DROP POLICY IF EXISTS "earnings_ledger_delete" ON public.earnings_ledger;
DROP POLICY IF EXISTS "earnings_ledger_read"   ON public.earnings_ledger;
CREATE POLICY "earnings_ledger_read" ON public.earnings_ledger
  FOR SELECT USING ( user_id = (select auth.uid()) );

-- 2. user_roles — a user could self-INSERT role='admin'/'creator' (privilege
--    escalation, unlocks creator/admin surfaces for free). The legit creator
--    toggle (actions/content/profile.ts) writes via the admin client, so drop
--    user INSERT + DELETE. KEEP owner-read: app/api/export/subscribers reads the
--    caller's OWN roles via the user (RLS) client.
DROP POLICY IF EXISTS "Users can insert their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can delete their own roles" ON public.user_roles;
-- "Users can view their own roles" (SELECT own) intentionally retained.

-- 3. org_invites — a user could self-INSERT an invite for ANY org with
--    role='owner' and a known token, then acceptOrgInvite -> own any org; read
--    was world-open (leaks every live invite token). Drop the four permissive
--    auth.uid()-IS-NOT-NULL policies. The correct "Org admins can manage
--    invites" policy (FOR ALL, EXISTS owner/admin membership) remains, and app
--    inserts run via the admin client after an app-level owner/admin check
--    (actions/orgs.ts inviteToOrg/bulkInviteMembers). acceptOrgInvite reads the
--    token via the admin client, so restricting user-client read is safe.
DROP POLICY IF EXISTS "org_invites_insert" ON public.org_invites;
DROP POLICY IF EXISTS "org_invites_update" ON public.org_invites;
DROP POLICY IF EXISTS "org_invites_delete" ON public.org_invites;
DROP POLICY IF EXISTS "org_invites_read"   ON public.org_invites;

-- 4. piece_responses (comments/annotations) — RLS was NEVER enabled, so the anon
--    key could read AND write comments directly. All app access is via the admin
--    client (actions/comments.ts, pieces/public.ts). Enable RLS; keep public
--    read (comments are public content, and this preserves any realtime/client
--    read); block user writes (server-mediated).
ALTER TABLE public.piece_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "piece_responses_read" ON public.piece_responses;
CREATE POLICY "piece_responses_read" ON public.piece_responses
  FOR SELECT USING (true);

-- 5. profiles — "Public profiles are viewable by everyone" (SELECT USING(true))
--    plus the default table-level SELECT grant exposed sensitive columns (BYOK
--    key, date_of_birth, disability/health flags, Stripe id, ad balances) to any
--    user via select('*'). RLS is row-level, not column-level, so restrict the
--    column GRANT instead: revoke the blanket SELECT and re-grant only the
--    public columns. Sensitive columns become readable only through the service
--    role. Every app read of a sensitive column already uses the admin client
--    (getMyProfile, feeds age-gate, accessibility); the one user-client
--    select('*') — the data-export route — is switched to the admin client in
--    the same change (app/api/export/route.ts).
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  id, handle, display_name, bio, avatar_url, created_at, updated_at,
  ads_opt_in, ads_preferred_domains, plan, byok_provider, byok_model,
  xp, level, credits, studio_credit_until
) ON public.profiles TO anon, authenticated;

-- 6. sponsorships — any authenticated user could INSERT/UPDATE/DELETE ANY
--    sponsorship row. All writes go through the admin client (verify*Payment,
--    add/removeCreatorSponsorship, activate). Drop user writes. Sponsorships are
--    public advertising (sponsor cards), so public read is retained.
DROP POLICY IF EXISTS "sponsorships_insert" ON public.sponsorships;
DROP POLICY IF EXISTS "sponsorships_update" ON public.sponsorships;
DROP POLICY IF EXISTS "sponsorships_delete" ON public.sponsorships;

-- 7. collection_items — same over-permissive auth.uid()-IS-NOT-NULL write. All
--    writes go through the admin client, curator-gated (actions/**/collections.ts
--    check curator_id === userId before mutating). Drop user writes; public read
--    retained (public collections).
DROP POLICY IF EXISTS "collection_items_insert" ON public.collection_items;
DROP POLICY IF EXISTS "collection_items_update" ON public.collection_items;
DROP POLICY IF EXISTS "collection_items_delete" ON public.collection_items;

-- 8. memberships — memberships_insert (WITH CHECK author_id OR user_id =
--    auth.uid()) let a user self-INSERT user_id=self: grant themselves a paid
--    tier WITHOUT paying (paywall bypass — tier-gated content and debate rooms
--    check for an active membership). Memberships are created via the admin
--    client only on verified payment; cancel runs via the admin client
--    (memberships.ts, user_id-scoped in app code). Drop user writes; scope read
--    to the author or the member (was world-open, leaked who-subscribes-to-whom).
DROP POLICY IF EXISTS "memberships_insert" ON public.memberships;
DROP POLICY IF EXISTS "memberships_update" ON public.memberships;
DROP POLICY IF EXISTS "memberships_delete" ON public.memberships;
DROP POLICY IF EXISTS "memberships_read"   ON public.memberships;
CREATE POLICY "memberships_read" ON public.memberships
  FOR SELECT USING (
    author_id = (select auth.uid()) OR user_id = (select auth.uid())
  );

-- 9. org_members — read policy "Members viewable by org members" was actually
--    USING(true), leaking every org's full roster to everyone. All app reads use
--    the admin client (orgs.ts, debate room gating via canAccessRoom, org page).
--    Scope to the member's OWN rows — own-row avoids the self-referential
--    subquery that would make an org_members policy recurse. Writes already run
--    via the service role (no user write policy existed).
DROP POLICY IF EXISTS "Members viewable by org members" ON public.org_members;
CREATE POLICY "org_members_read_own" ON public.org_members
  FOR SELECT USING ( user_id = (select auth.uid()) );

-- 10. org_subscriptions — "Org subscriptions viewable by owner" was actually
--     USING(true), leaking every org's billing/plan. App reads via the admin
--     client. Scope to org owner/admin; the subquery on org_members resolves
--     under org_members' own-row policy (step 9), non-recursively.
DROP POLICY IF EXISTS "Org subscriptions viewable by owner" ON public.org_subscriptions;
CREATE POLICY "org_subscriptions_read_admin" ON public.org_subscriptions
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = (select auth.uid()) AND role IN ('owner', 'admin')
    )
  );
