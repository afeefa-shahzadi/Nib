# Mycelium Content-Moderation Plan

Status: draft for launch. Scope: enabling **NSFW-flagged** and **medical** content across
the platform's verticals. Grounded in the code as it exists on 2026-07-18.

This is an engineering plan, not a legal opinion. Every India-law claim below is marked
**[human-legal-verify]** and must be reviewed by counsel before launch.

---

## 1. What exists today vs what's missing

The platform already has the *skeleton* of moderation: a report table, an NSFW flag, and an
age gate. What it lacks is the **consumption side** — nothing reads reports, no one can take
content down as a moderator, and only pieces (not comments/profiles/media) are reportable.

| Surface | Current control | Gap |
|---|---|---|
| Pieces (`content_objects`) | `is_nsfw` flag (`20260614000002_add_is_nsfw.sql:1`); report button (`components/report-button.tsx:37`); age/NSFW gate on read (`app/(main)/u/[handle]/[slug]/page.tsx:94`, `actions/social/feeds.ts:47`) | No takedown by moderator; no classifier; report reasons don't cover NSFW/medical/CSAM |
| Blocks (within a piece) | Per-block `is_nsfw` gate (`components/block-renderer.tsx:222`); set in composer (`components/composer/inspector-pane.tsx:137`, `block-card.tsx:351`) | Same as pieces — no moderator control |
| Comments (`piece_responses`) | DOMPurify sanitize on post (`actions/comments.ts:73`); delete by comment-author or piece-author (`actions/comments.ts:124`); pin by piece-author (`actions/comments.ts:165`) | **Not reportable**; no moderator delete; no NSFW/medical handling |
| Profiles | none | No report, no moderation, no takedown of bio/handle/avatar |
| Collections | none | No report/moderation |
| Org / edu content | RLS + org-admin role (`20260614000008_edu_institutions.sql:46`) | No platform-level takedown |
| Uploaded media / images (`cover_image_url`, block images) | none | **No image moderation at all** — highest CSAM/NSFW risk surface |
| AI-generated content (composer uses `@ai-sdk/*`) | none | No moderation of model output before publish |

### Reusable primitives that already exist

- **`content_reports` table** — `20260614000006_reports_and_feedback.sql:3`. Columns:
  `content_object_id`, `user_id` (nullable, allows anon), `reason` (free text),
  `status IN ('pending','reviewed','resolved','dismissed')`. RLS: anyone inserts, users read
  only their own (`:15`, `:20`). **No moderator SELECT policy exists** and **nothing reads
  this table** — `grep content_reports` finds only the insert path (`actions/reports.ts:9`)
  and generated types (`lib/database.types.ts:830`).
- **`reportContent(contentObjectId, reason)`** — `actions/reports.ts:5`. Insert-only.
- **`admin` role already in the schema** — `user_roles` CHECK is
  `('reader','creator','admin')` (`supabase/schema.sql:1249`), and role resolution already
  computes a primary role of `admin` (`actions/content/profile.ts:30`). **No code gates
  anything on `admin` today** — it's defined but unused. This is the hook for a moderator.
- **`content_status` enum already has terminal states** — `('draft','scheduled','published',
  'archived','deleted')` (`supabase/schema.sql:101`). A takedown = flip `status` to
  `archived` (reversible) or `deleted` (hard). No new column needed; the read-path RLS already
  hides non-`published` rows (`supabase/schema.sql:3064`).
- **Age gate** — `nsfw_enabled` + `date_of_birth` on `profiles`, age computed at read time
  (`actions/social/feeds.ts:29-35`). Self-declared DoB only.

---

## 2. Content classes & rules

### A. Legal-but-restricted (NSFW)
Adult/explicit content that is lawful. Already partially wired via `is_nsfw`.
- **Rule:** age-gate (18+, `date_of_birth` present and ≥18) **and** viewer opt-in
  (`nsfw_enabled`) — both already enforced at `feeds.ts:47` and `block-renderer.tsx:222`.
- **Extend:** exclude NSFW from *all* discovery surfaces (search, trending, public feeds, RSS,
  OG previews), not just the followed-authors feed. Grep shows the gate is applied per-query,
  so each new discovery query must repeat `.neq("is_nsfw", true)` — centralize this.
- **Billing:** do **not** surface NSFW on any Razorpay-billed/promoted placement. Keep NSFW
  out of paid recommendation slots until payment-processor NSFW policy is confirmed
  **[human-legal-verify]** (card networks/Razorpay commonly restrict adult content).

### B. Disallowed (hard block)
CSAM, other illegal content, non-consensual intimate imagery, real-violence/gore, content
that sexualizes minors even if "fictional."
- **Rule:** immediate hard block — `status → 'deleted'`, author flagged, report row retained
  as evidence. **Not** an age-gate decision; NSFW opt-in never unlocks these.
- **Obligation:** CSAM must be preserved-then-reported per Indian law **[human-legal-verify]**
  (IT Rules / POCSO reporting duties). Do not silently delete without the legal-hold step.

### C. Medical
Medical/health content across verticals. Misinformation and liability risk, not obscenity risk.
- **Rule:** every medical-tagged piece carries a non-dismissable **"Not medical advice"**
  disclaimer (render-time banner, same mechanism as the NSFW overlay in
  `block-renderer.tsx:226`).
- **Expert-review path:** optional `medical_reviewed_by` attribution; unreviewed medical content
  is allowed but visibly labelled "not expert-reviewed." Keep human-review optional at launch;
  the disclaimer is the mandatory piece.
- **No personalized advice / no drug-purchase facilitation** — treat as disallowed if a piece
  crosses into prescribing or selling scheduled drugs **[human-legal-verify]**.

---

## 3. Minimum viable moderation for launch

The smallest defensible system = **reportable content + a moderator queue + a takedown action +
NSFW gating (already have) + an audit trail.** Each maps to a concrete change reusing the
primitives above.

1. **Broaden reports to more surfaces + better reasons.**
   `content_reports.content_object_id` is typed to `content_objects` only. Either (a) add a
   nullable `target_type TEXT` + `target_id UUID` pair so comments/profiles are reportable, or
   (b) launch with pieces-only and defer the rest. Add reasons `nsfw_unflagged`, `csam`,
   `medical_misinformation`, `illegal` to `report-button.tsx:104` and reuse the button on
   comments. *Sketch:* one migration (nullable columns), one enum-ish reason list, reuse
   `reportContent`.

2. **Moderator queue (reads the table nothing reads today).**
   New route `app/admin/moderation/page.tsx`, gated on the existing `admin` role via
   `getMyRoles().primary === "admin"` (`actions/content/profile.ts:30`). Lists
   `content_reports WHERE status='pending'` ordered by count-per-content. *Sketch:* one page +
   one server action `listReports()` using the admin client (which already bypasses RLS, so no
   new SELECT policy strictly needed — but add a moderator SELECT policy if any non-admin path
   ever reads it).

3. **Takedown action.**
   New `actions/moderation.ts` → `takedownContent(contentObjectId, resolution)`:
   assert caller is `admin`, set `content_objects.status = 'archived'` (reversible) or
   `'deleted'` (CSAM/illegal), then set the report `status`. Reuses the existing `content_status`
   enum — **no schema change to content_objects.** *Sketch:* ~30 lines, one action.

4. **Audit trail.**
   New table `moderation_actions (id, moderator_id, content_object_id, action, reason,
   created_at)`. Every takedown/dismiss writes one row. Non-negotiable for launch — needed for
   grievance response and dispute defense. *Sketch:* one migration + one insert in the takedown
   action.

5. **NSFW gating hardening (mostly done).**
   Audit every discovery/query path for the `.neq("is_nsfw", true)` guard and centralize it into
   one helper so a new feed can't forget it. Add the guard to search + any OG/RSS output.

That is the whole launch surface: **2 migrations, 1 admin page, 2 server actions, a reason-list
edit, and one centralization refactor.** Everything else reuses what's built.

---

## 4. Automated vs human

Keep automation minimal at launch — one cheap classifier as a *pre-filter*, humans decide.

- **Automated (pre-publish, on the publish action):** run text through a moderation classifier
  using an already-installed `@ai-sdk/*` provider (e.g. `@ai-sdk/openai` /
  `@ai-sdk/anthropic`, both in `package.json`). Purpose: **auto-suggest** `is_nsfw`, and
  **auto-queue** (not auto-delete) anything scoring high for CSAM/illegal/medical-misinfo. Never
  hard-delete on a classifier alone — false positives on medical content especially.
- **Images:** highest-risk surface with zero controls today. At minimum route uploaded images
  through a hash-match / CSAM-detection service before they're publicly served
  **[human-legal-verify on provider choice]**. If that can't ship for launch, **do not enable
  user image uploads on NSFW-flagged content** — text-only NSFW first.
- **Human (the queue):** all reports, all classifier-flagged items, all CSAM/illegal
  determinations, all medical takedowns. Humans make every removal decision at launch.

`ponytail:` classifier is a naive per-publish call, no batching/caching — fine at launch volume;
add a queue + caching if publish throughput makes the API cost bite.

---

## 5. India-specific obligations — [human-legal-verify] all of this

The platform is INR/Razorpay/India-first, so it is an "intermediary" under the **IT Act 2000**
and the **IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021**. These
duties *exist*; the exact thresholds below are indicative and **must be confirmed by counsel** —
do not treat these numbers as authoritative:

- **Grievance Officer:** publish a named India-based grievance officer + contact; acknowledge
  complaints (commonly cited: ~24–72h) and resolve within a bounded window (commonly cited:
  ~15 days). Needs a public page + an inbox that routes into the moderator queue.
- **Takedown timelines:** act on court/government takedown orders and on certain complaints
  within statutory windows; non-consensual sexual imagery has a stricter (commonly cited ~24h)
  removal expectation.
- **CSAM:** detection, removal, preservation, and reporting duties (IT Rules + POCSO). Build the
  preserve-then-report hold into the takedown path (§2.B) — never silent-delete.
- **Traceability / records:** retain report and action records (the `moderation_actions` audit
  table covers this) for the statutory retention period.
- **Age/adult content:** confirm whether self-declared DoB is sufficient or whether stronger age
  verification is required for adult content under Indian norms — current gate is self-declared
  only (`feeds.ts:31`).

Do not overstate compliance in marketing or ToS until counsel signs off. The engineering hooks
(grievance inbox → queue, audit table, takedown timeline tracking) are what we build; the
legal sufficiency is what counsel confirms.

---

## 6. Phased rollout

**Phase 0 — MUST exist before ANY NSFW or medical content is enabled:**
1. **Moderator queue + takedown action + audit trail** (§3.2–3.4). Without a way to *remove*
   content and *prove* we did, we cannot defensibly host restricted content. The report table
   that nothing reads (today's state) is not moderation.
2. **CSAM/illegal hard-block path** with legal-hold, plus image handling decision (§4) — either
   image CSAM-scanning is live, or user image uploads stay disabled on NSFW content.
3. **Grievance officer + intake routing into the queue** (§5) — the one India-law item that is a
   hard gate for operating as an intermediary at all.

**Phase 1 — enable NSFW (text-first):** broadened reports + reasons (§3.1); centralized NSFW
discovery exclusion (§3.5); keep NSFW off Razorpay-billed placements. Ship the "Not medical
advice" disclaimer here too.

**Phase 2 — enable richer content:** NSFW image uploads (once image scanning is proven), medical
expert-review attribution path, reports on comments/profiles/collections, the AI pre-filter
classifier auto-suggesting `is_nsfw` and auto-queuing high-risk items.

**Phase 3 — scale:** classifier batching/caching, appeals flow, repeat-offender/author-ban
tooling, per-vertical policy tuning.

---

## The three things that MUST exist before launching NSFW/medical content

1. **A moderator queue + takedown action + audit trail** — reuse the unread `content_reports`
   table (`20260614000006_reports_and_feedback.sql:3`), the unused `admin` role
   (`supabase/schema.sql:1249`, `actions/content/profile.ts:30`), and the existing
   `content_status` `archived`/`deleted` states (`supabase/schema.sql:101`). Today nothing reads
   reports and no one can take content down as a moderator.
2. **A CSAM/illegal hard-block path with preserve-then-report legal hold, and an image-handling
   decision** — images are the highest-risk surface and have zero controls today; if scanning
   isn't ready, keep image uploads off NSFW content and go text-first.
3. **A grievance officer with intake routing into the queue** (IT Rules 2021 intermediary duty,
   **[human-legal-verify]**) — required to operate as an intermediary hosting restricted content
   in India at all.
