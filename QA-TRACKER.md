# Nib — Exhaustive QA Tracker

Date: 2026-10-10 · Branch: `fix/gamification-economy` · Target: dev (localhost:3000) → **remote** Supabase (ywaqihuivcsdfugeibga)
Test users (password `TestPassword123!`): `test_free@` (free), `test_reader@` (reader), `test_studio@` (studio), `test_org@` (org)

Severity: 🔴 critical · 🟠 high · 🟡 medium · 🔵 low/cosmetic
Category: BUG · ISSUE · OVERENG · ENHANCE · REMOVE · CORRECT · SUGGEST · COMBO
Status: ✅ fixed (this pass) · ⏳ deferred · 🔎 flagged (needs decision/own fix)

---

## Headline

The single most important finding is **#1**: `createAdminClient` is **not** the service-role client inside a logged-in request — it forwards the user's cookies, so Postgres runs as the `authenticated` role. Because `profiles` uses per-column SELECT grants and the gamification tables (`insight_points`, `daily_quests`, `user_stats`) have no `authenticated` write policy, a large swath of "admin" reads/writes **silently fail** for real users. This one root cause explains the app-wide 42501 console error, broken Follow, and an IP/quest/streak economy that awarded **nothing** at runtime. I fixed the gamification slice + my own flair bugs and verified them; the broader read paths need a deliberate refactor.

---

## Findings

| # | Sev | Cat | Area | Finding | Status |
|---|-----|-----|------|---------|--------|
| 1 | 🔴 | BUG·ARCH | lib/supabase/server.ts | `createAdminClient` builds an `@supabase/ssr` client WITH user cookies → PostgREST runs as `authenticated`, not `service_role`. Every "admin" read/write touching an ungranted profiles column or a system-only table silently failed (42501, mostly swallowed). Fixed the full class surgically: routed each privileged self-scoped op through `createServiceRoleClient` (auth still via the cookie client's `getUser`), scoped to the verified id — no global flip (callers depend on `createAdminClient.auth.getUser`), so no cross-user exposure. `createAdminClient` left unchanged. | ✅ fixed (`5d0cb81`) |
| 2 | 🟠 | BUG | actions/monetization·lib/quests.server | IP/quest/streak awards written via `createAdminClient` (authenticated) were RLS-denied → **no IP/quests/streaks ever persisted** for logged-in users. The whole gamification economy was runtime-dead. | ✅ fixed |
| 3 | 🟠 | BUG | actions/cosmetics.ts (mine) | Flair "purchase" wrote the negative `insight_points` spend as the authenticated user (RLS-blocked), then recorded ownership anyway → **free flair**. | ✅ fixed |
| 4 | 🟠 | BUG | profiles grants (mine) | Flair migration added `flair`/`flair_owned` without column SELECT grants → broke authenticated `SELECT *` on profiles. | ✅ fixed |
| 5 | 🟠 | BUG | actions/social/follows.ts | **Follow does not persist** (verified 0 rows after clicking). Insert's follower-count trigger writes profiles → grant-denied under `authenticated` → rollback. Fixed: insert/delete routed through service role (scoped to verified follower_id). | ✅ fixed (`5d0cb81`) |
| 6 | 🟡 | CORRECT | Landing hero | "0% PLATFORM CUT ON TIPS" overstates — only Studio is 0%; Free tier takes 10% (per /earn & /pricing). | 🔎 |
| 7 | 🟡 | ISSUE·ENHANCE | /login | Role-step ("I'm a reader / author") gates the login form. Returning users already have a role; adds a click and shows no org option. Skip to form. | 🔎 |
| 8 | 🟡 | REMOVE·OVERENG | streak-break-banner, restoreStreak | `StreakBreakBanner` is rendered nowhere; `restoreStreak` has no caller and never writes the `streak_restores_*` columns. Dead pay-to-restore feature. Remove, or wire it. | 🔎 |
| 9 | 🔵 | CORRECT | /earn, /pricing, /me/earnings | IP shown with ₹-equivalents (≈₹5.8/day, "100 IP = ₹1", "10,000 IP = ₹…") next to "not cashable" — mixed message. Drop the ₹ equivalence for IP. | 🔎 |
| 10 | 🔵 | SUGGEST | Landing | "Field notes" testimonials have no real attribution ("— ESSAYIST, PUBLIC-POLICY") — reads as placeholder/fabricated social proof. | 🔎 |
| 11 | 🔵 | ISSUE | Feed card | Piece title `<heading>` inside the card link didn't navigate on direct click (only the card wrapper is the link). Hit-target/keyboard nuance. | 🔎 |
| 12 | 🔵 | ISSUE | /me/earnings | IP stat card stale after a flair purchase (shop shows 300, top card still 500 until reload — separate query not refetched). | 🔎 |
| 13 | 🔵 | ISSUE | /leaderboard | Ranks users with 0 IP (reader shown "#8 of 10 · 0 insight pts"). Consider excluding zero-activity users. | 🔎 |
| 14 | 🟠 | BUG·DRIFT | lib/quests.server.ts | `daily_quests` has a legacy NOT-NULL `quest_type` column the code stopped using (writes `quest_key`). `tickQuest` never set it → **every completion insert 400'd** → quest row never written → its once-per-day cap never applied, so the IP award was re-earnable. Fixed: set `quest_type = quest_key`. **Runtime-verified**: follow_1 insert went 400 → 201. | ✅ fixed (`db3e613`) |
| 15 | 🔴 | BUG·DRIFT | profiles.nsfw_enabled (phantom) | Code (`updateMyProfile` patch, `feeds` select, Settings switch) references `profiles.nsfw_enabled`, which exists in **no migration, no generated types, and not in the remote schema**. The Settings form sends it on every save → **every profile save 400s** (`column nsfw_enabled does not exist`). Also breaks the NSFW viewer opt-in in feeds. Chosen: add the column. Migration `20261011000000_schema_drift_fixes.sql` adds `nsfw_enabled BOOLEAN NOT NULL DEFAULT false` + SELECT grant; types updated. | ✅ fixed (`5e5631e`, applied+verified on remote) |
| 17 | 🔴 | BUG·DRIFT·REMOVE | profiles.custom_domain (dead) | `custom_domain` is referenced by `updateMyProfile` + the Settings form but exists in no migration, no types, no schema, and **nothing consumes it** (no domain routing anywhere). The form sent it on every save → PATCH hit a missing column (PGRST204) → **every profile save threw**. Removed the dead field from the action allowlist/types and the Settings UI (vs. cargo-culting a column nothing reads). **Runtime-verified**: save now persists. | ✅ fixed (`dd2971d`) |
| 16 | 🟠 | BUG·DRIFT | studio_subscriptions.current_period_end | `getMyPlan` selects `studio_subscriptions.current_period_end`; the column is in the generated types but **no migration adds it to that table** (only `reader_subscriptions` has it) → the query 400s on every plan check. Fixed in the same migration `20261011000000` (adds the timestamptz column). | ✅ fixed (`5e5631e`, applied+verified on remote) |
| 18 | 🟠 | SECURITY·CONFIG | lib/crypto.ts / env | `BYOK_ENCRYPTION_KEY` was unset in every env file, so `encryptSecret` fell back to its dev branch and stored BYOK API keys **in plaintext at rest**. Generated a 64-hex key and set it in `.env.local`; re-verified a saved key is now stored `enc:v1:…` (encrypted). **Still TODO: set the same key in production env (Vercel)** — without it prod keeps storing plaintext (and existing plaintext rows stay readable via decrypt's legacy pass-through). | ✅ local (⏳ prod env) |
| 19 | 🔴 | SECURITY·DRIFT | public.rate_limits (missing) + lib/rate-limit.server.ts | The `rate_limits` table exists in **no migration** and is absent from the remote schema (`GET/POST rest/v1/rate_limits 404`). `checkRateLimit` reads it with `maybeSingle` (null on 404), swallows the error, and returns `{ ok: true }` → **rate limiting is fail-open / disabled app-wide**: AI token caps, payout-attempt caps, disability-verify brute-force cap (5/day on a paid-feature unlock), and the contact form all have no limit. Found via the composer AI test. Also note `checkRateLimit` uses `createAdminClient` (authenticated), so even with the table it would need the service-role treatment. Fix = create the table (migration) + switch to `createServiceRoleClient`. | 🔎 (needs table + fix) |
| 20 | 🔵 | CONFIG | MISTRAL_API_KEY | Platform AI (Mistral) key is out of quota — `x-ratelimit-limit-req-minute: 0` → every AI call returns 429 (`AI_RetryError` after 3 retries → 500). The AI code path is correct (BYOK read, retries, graceful UI error); the key just has no quota. Rotate/upgrade the Mistral key for platform AI to work (BYOK users bypass it). | 🔎 (user config) |

---

## Fixes applied this pass (committed on `fix/gamification-economy`)

- `84c230a` grant SELECT on `profiles.flair` / `flair_owned` (+ migration `20261010000000_flair_column_grants.sql`, pushed to remote). Fixes #4.
- `1526bf9` award IP/streaks via true service role (`quests.server.ts` → service-role; `monetization/quests.ts` → auth client for `getUser`, service-role for reads/writes). Fixes #2. **Verified**: opening `/studio` now writes `user_stats.current_streak=1` (was 0).
- `13e96fb` charge IP for flair via service role before granting ownership (`cosmetics.ts`). Fixes #3. **Verified**: buying Sage Green drops balance 500→300 and equips.
- `5d0cb81` run all sensitive-column / system-table ops as true service role (8 files). Fixes #1 + #5, and three further latent bugs the trace surfaced:
  - **Profile settings save was fully broken** — the form always sends `nsfw_enabled` (ungranted), so every `updateMyProfile` save hit a grant-denied column and threw. Now writes via service role.
  - **Reputation gate silently bypassed** — `assertNotRestricted` (publish + payout) read `restricted_until` via the cookie client → null → a restricted creator could still publish/withdraw. Now reads via service role.
  - **BYOK, NSFW age-gate, disability entitlement, appeals** all read/wrote ungranted columns via `authenticated` and silently no-op'd. Now service role.
  - Audited for leak risk (subagent): all new service-role queries stay narrowed to the verified caller's own id; no global flip, so no cross-user exposure introduced. Pre-existing `listPublicCollections` (missing `is_public` filter) and the two leaderboards' cross-user reads are **only** a concern under a global flip — not touched here. Typecheck clean; unit tests unchanged (same 3 pre-existing `mock.module` Node-v25 failures). Not yet runtime-verified against the live app.

## Runtime re-QA (2026-10-10, remote Supabase, test_reader)

Drove the live app against remote after the ISSUE-1 fixes:

- ✅ **Follow persists** (#5) — `POST follows 201`, the follower-count trigger no longer rolls it back. notification + subscription email fire. Unfollow `DELETE 204`.
- ✅ **Economy awards** (#2) — `insight_points 201`, `user_stats 201` (streak), and after the #14 fix `daily_quests 201`. Quests are now recorded (idempotent).
- ✅ **Restriction gate** — with `restricted_until` set in the future, the service-role read (used by `getRestriction`/`assertNotRestricted`) returns `restricted=true`; pre-fix the cookie client read null and the gate opened. Mechanism verified (publish not driven to completion).
- ✅ **Profile settings save** — after adding `nsfw_enabled` (#15) and removing the dead `custom_domain` field (#17), saving display name + NSFW toggle persists (`PATCH 204`, verified in DB). Was fully broken before (every save threw).
- Not driven end-to-end (friction / blocked by #15): composer→publish, BYOK AI generate, disability verify, NSFW feed opt-in, org/admin.

### Pass 2 — author / gate flows (2026-10-10, test_studio)

- ✅ **Profile settings save end-to-end** — display name + NSFW toggle persist (`PATCH 204`, DB-confirmed). Found + removed dead `custom_domain` (#17) in the process.
- ✅ **Publish gate, both directions** — restricted creator's publish throws server-side (`assertNotRestricted` at lib/restrictions.ts:83, POST 500); after clearing the restriction the same publish succeeds (`content_objects PATCH 204` + `daily_quests 201` publish_1 + `insight_points 201`). The reputation-gate fix (#1 slice) works. Payout gate shares the identical `assertNotRestricted(payout)` path.
- ✅ **Author mode enable → composer → create/publish** — `toggleAuthorMode` inserts the creator role; the author studio (drafts/earnings/tiers/org…) renders; create piece + publish works; publish awards the quest + IP.
- ✅ **Restriction appeal UI** — the restricted creator sees the appeal box in the composer (getMyRestriction/submitAppeal via service role, #1 slice).
- ✅ **BYOK write + encryption** (#18) — saving a key persists via service role; after setting `BYOK_ENCRYPTION_KEY` it's stored `enc:v1:…` (encrypted), verified in DB.
- ✅ **Admin moderation** — with an admin role granted (user-approved), `/admin/moderation` loads: `requireAdmin` user-roles check + `content_reports`/`restriction_appeals` reads all 200 (service-role, no 42501). Queues empty (no seeded reports/appeals). Write paths (strike/appeal-resolve) share the same service-role client.
- ✅ **Org workspace** — Free user gets the correct "Organizations plan required" gate; the org-plan user creates an org (`organizations 201` + `org_members 201`) and the workspace renders members/seats/invite-by-email/bulk-invite via `getOrgDetail` (all 200). `createOrg` service-role writes work.
- Still not driven: BYOK AI generate (needs a real provider key), disability verify (needs document images), tip/Razorpay, debates, bundles, boosts, annotations, member-invite send (avoided the email side-effect).

### Pass 3 — composer editor, exhaustive (2026-10-10, test_studio)

Opened a draft and exercised the whole editor. **All working** unless noted:

- ✅ **Text editing + autosave** — typing persists via `saveBlocks` (full block upsert) + `updatePiece` (PATCH 204).
- ✅ **Slash menu + block creation** (type `/` in a focused block; 19 kinds, filterable).
- ✅ **Every specialized block editor renders** — paragraph, **code** (editor + language picker + Run), **chart** (type/labels/series), **mermaid** (syntax + caption), **flowchart** (node toolbox + canvas), **image** (dropzone/URL/alt/caption/credit), **exercise** (type/prompt/hint/answer), **embed** (URL/caption), **citation** (+ "Add details" dialog: source/URL/page/quote), **audio** (dropzone/transcript/caption). Block-type change dropdown works.
- ✅ **Block ops** — move up/down, **delete + Undo** (restores), Redo, drag handle, add-below, mode-visibility checkboxes, semantic role, supporters-only, per-block NSFW/explicit, preview.
- ✅ **Header/panels** — Meta dialog (summary/thesis/tags/monetization/sponsors), Minimap (block graph + mode legend), Schedule dialog (calendar + auto-publish), Archive/retrieval panel (searches own drafts to cite), Synthesis (Analyze Themes / Find Links), Outline + History panels, **Save version** (`createPieceVersion` → `piece_versions 201`, shows in History), reader **Preview** toggle (clean render), **Heatmap** toggle, preview-mode select, explicit **Save**.
- ⚠️ **AI variant generation** — the code path is correct (wand → mode picker → `generateModeVariant` → BYOK read via the fix → AI call) but fails on two infra issues, handled gracefully (error toast, no crash): the Mistral key is out of quota (#20, 429) and `rate_limits` is missing (#19).
- Note: `saveBlocks` deletes all of a piece's blocks not in the payload and re-inserts on every save (full rewrite). Works; a per-block diff would be lighter at scale (efficiency, not a bug).

### Pass 3b — composer deep audit + fixes (2026-10-10)

The Pass-3 "all working" claim above was **wrong** — it mixed live clicks with
code-reading and missed real defects. A full static sweep of all 33 composer
files (every pane, top-bar control, block kind, dialog) found ~25 defects.
Fixed this pass (commit `f76f733`), static+tsc+lint confirmed:

**Crashers**
1. Version **restore** pushed raw `encodeBlock` rows into Yjs (no decode) → next render crashed. Decode first; removed the premature flush that persisted pre-restore blocks.
2. **Citation** footer `source ?? new URL(url!)` crashed the canvas on `""` source / malformed URL. `||` + guarded parse; show footer for url-only.

**Data-loss / silent drops**
3. Block-level **NSFW** never saved — `saveBlocks` row() omitted `is_nsfw`. Added. (blocks table has no per-column grant, so no migration needed.)
4. Piece-level **NSFW** dropped every autosave — missing from `updatePiece` allowlist. Added `is_nsfw`.
5. **Image credit/creditUrl** not passed to the editor → reset per keystroke. Passed through.
6. **Flowchart** autosave write-loop (onChange in effect deps re-armed the 500ms timer forever → continuous writes). Latest-onChange ref + `[nodes, edges]` deps; per-variant remount key.

**Dead features — now wired (not removed, per request)**
7. AI variant **Apply** was a no-op → now writes the variant into the block.
8. **Heatmap** toggle dead → CanvasArea now forwards `heatmapEnabled` to BlockCard.
9. **Jump-to-block** (synthesis/inspector) used `getElementById("block-…")` vs the cards' `data-block-uid` → fixed selector.
10. Reader **preview** blanked chart/mermaid/flowchart/exercise/audio_note/embed → added to passthrough.
11. Voice **Stop** didn't stop the mic → recognizer held in a ref, `.stop()` called.

Also fixed earlier this pass (commit `3edfeb9`): voice-dictation block loss (setBlocks clobbered by Yjs sync → routed via `insertReadyBlock`); dead **inline-comments** toggle (added `allow_inline_comments` to `CO_COLS`, flushMeta, load).

**Deferred (flagged, not yet fixed)** — need product calls or more plumbing:
- Broken links (404): reader-page / archive-cite / auto-link URLs use `/u/_/…` or `/${slug}`; need the author handle returned from `searchMyArchive` / `suggestAutoLinks`.
- Newsletter "Send via Email": false "sent to undefined followers" success, no confirm, no in-flight guard, can email subscribers from an **unpublished** draft (server checks only authorship).
- Schedule / Clear show success even when the write failed (flushMeta swallows errors).
- Delete-piece with an empty title deletes on one click (typed-confirm guard bypassed).
- Comment **Enter** submits instead of selecting the highlighted mention → posts partial `@handle`.
- ~10 🟡/🔵: `javascript:` link filter dropped at parse (reader still DOMPurified), unescaped text→HTML in a few spots, Firefox drag `dataTransfer`, code-tab index off-by-one, stale memo comparator, drag-ref never cleared, server restore not atomic, etc.

Not yet live-verified against remote (static+tsc only): the NSFW persistence and restore paths — a live click-through needs the dev server re-pointed at remote.

## Pass 4 — deferred batch fixed (commit `4999575`)

All items from the "Deferred" list above fixed, tsc + lint clean:

- **404 links**: `searchMyArchive` returns the author's own handle → citation uses `/u/{handle}/{slug}`. `suggestAutoLinks` joins the target author's handle → synthesis-pane link uses `/u/{handle}/{slug}` (was `/{slug}`).
- **Newsletter**: server gates on `status === "published"` (all callers); client checks `res.success` (no more "sent to undefined"), confirm dialog, disabled off-published / while sending.
- **Schedule / Clear**: `flushMeta` returns a success boolean; `togglePublish`, schedule submit/clear and the dialog only claim success when the write landed.
- **Delete piece**: empty title falls back to typing `delete` (guard no longer bypassed).
- **Comment Enter**: picks the highlighted @mention when the suggestion popup is open (detects the suggestion plugin by its state shape — mention registers an unnamed `PluginKey`).
- **Rich-text links**: `applyLink` rejects `javascript:`/`data:` schemes and escapes link text (defense-in-depth; reader already DOMPurifies).
- **Drag reorder**: dragstart writes `dataTransfer` (Firefox); `onDragEnd` clears the drag ref on a cancelled drag.
- **Code-block tabs**: closing a tab before the active one now shifts the active index.
- **Version restore**: verifies piece ownership, validates the snapshot before the destructive delete, carries `is_nsfw`; non-atomic delete→insert ceiling flagged inline (upgrade: Postgres function).
- Also: seed the collaboration fragment on editor create so opening a saved block no longer blanks its stored text.

**Reviewed, not a bug:** "stale memo comparator" (`block-card.tsx`) — the comparator is correct for its props; block changes arrive as new `block` object refs via the Yjs resync, and the excluded callbacks close over stable `uid` + stable Yjs mutators.

**Remote harness re-stood (schema probes, all pass):** `blocks.is_nsfw`; `blocks.mode_visibility/monetization_eligible/semantic_role`; `content_objects.allow_inline_comments`; `content_objects.is_nsfw/status/author_id`; `profiles.handle`; `content_objects → profiles(handle)` embed; `piece_versions.blocks_snapshot/piece_id/message`. Confirms every column/relation the new server code depends on exists on remote (service-role, schema only).

Still needs a logged-in browser click-through (drag, tabs, toasts, confirm dialogs, NSFW-persist-across-reload, restore round-trip) — blocked on remote (prod) auth, which is a user handoff.

## What works (verified)

- Marketing: landing, /earn, /pricing render; my earlier copy fixes are live and consistent ("not cashable", "Curated collections", "Creator payouts after 7-day clearing", recognition-framed leaderboard).
- Cookie consent: privacy-preserving options, dismisses cleanly, no console errors.
- Login: invalid creds show a clear toast; valid login redirects to /feed.
- Feed: empty-state ("Your feed is empty → Explore Discover") and Discover (pieces, filters, trending tags) render.
- Reader page: modes, Listen, Save, Responses, ELI5, Repost, Share, Report, TOC, author card, tip jar with the point-of-sale consent note all render.
- Flair shop: all 6 tiers render; buy→spend→equip works end-to-end after the fix.

## Not reached this pass (document as untested)

Composer / publish flow, Studio author dashboard, Settings (incl. author-mode toggle), Org workspace, Admin, clap, tip (Razorpay test), annotations/highlights, debate rooms, bundles, memberships, boosts. Reasons: account-switch friction (sign-out button fell outside the captured viewport), the app window went behind another (screenshots began timing out), and #1 degrades most authenticated interactions — better retested once #1 is fixed.

## Recommended order

1. **Fix #1 properly** (unblocks #5 Follow + the swallowed 42501 on every page + NSFW/accessibility/restriction/BYOK). This is the gate for meaningful re-QA of all authenticated flows.
2. Re-run QA on the "not reached" list above.
3. Clear the copy items (#6, #9, #10) and the login friction (#7).
4. Decide on dead code #8 (remove vs wire).
