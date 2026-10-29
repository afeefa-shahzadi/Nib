# Razorpay Payment & Legal Exposure — Risk Memo

**Subject:** Mycelium (multi-vertical publishing platform) on Razorpay, given adult/NSFW + medical content and a creator-payout / reader-pool model.
**Date:** 2026-07-18
**Status:** Internal risk assessment. **NOT legal advice.** I am not a lawyer and not a Razorpay/RBI compliance officer. Every "kill scenario" below is grounded in published policy text but must be verified with counsel and with Razorpay in writing before launch (see final checklist).

---

## Verdict

**RED.** Razorpay can and routinely does freeze accounts and withhold settlement for prohibited content, and the platform currently monetizes NSFW content on the *same* merchant account it uses for everything else. Adult/pornographic/"sexually suggestive" content is an **explicitly prohibited business** on Razorpay ([razorpay.com/terms](https://razorpay.com/terms/)); the moment tips/boosts/subscriptions flow against NSFW pieces on this merchant ID, the whole account — including clean verticals — is exposed to freeze and fund-hold. Separately, the reader-pool-to-creator payout model is textbook payment aggregation that sits under the RBI PA framework (escrow, KYC, licensing) — a second, independent freeze/compliance surface.

---

## Money map (from the code — what Razorpay actually sees)

All flows below hit **one Razorpay merchant account** (`RAZORPAY_KEY_ID`), keyed off `actions/subscriptions.ts`, `actions/monetization/payments.ts`, `actions/monetization/reader-pool.ts`, and the webhook at `app/api/webhooks/razorpay/route.ts`.

**Money IN (Razorpay-billed surface):**
- Subscriptions (Razorpay Subscriptions API): Studio ₹499/mo, Reader Pass ₹199/mo, Org ₹399/seat/mo — `actions/subscriptions.ts`.
- One-time Orders: piece/bundle purchases + **tips** (`settlePaidPurchase`), **boosts** (`createBoostOrder`), **sponsorships** ≥₹1,000 (`createSponsorshipOrder`) — `actions/monetization/payments.ts`.

**Money OUT (the aggregator surface):**
- `requestPayout` currently only **inserts a `payout_requests` row** — there is *no* RazorpayX Payout API call in the code. So creator settlement is, as written, a manual/out-of-band process. Whatever rail fills that gap (RazorpayX, bank transfer, RazorpayX Route) is the thing the RBI PA rules govern. **This is the single most important design decision still unmade.**
- **Reader pool:** `settleReaderPools` takes 85% of each Reader Pass (`POOL_BUDGET_PAISE`), splits it across clapped creators, and credits an internal `earnings_ledger`. Economically: the platform **collects reader money into its own account, keeps a 15% cut, and redistributes the rest to third-party creators.** That is aggregation/marketplace settlement regardless of what the DB table is called.

**Content model (what the platform intends to allow):**
- `content_objects.is_nsfw` boolean (migration `20260614000002_add_is_nsfw.sql`); readers opt in via `profiles.nsfw_enabled` + `date_of_birth` age gate; feeds hide NSFW unless `nsfw_enabled && isAdult` (`actions/social/feeds.ts`, `app/(main)/u/[handle]/[slug]/page.tsx`). So the platform **deliberately hosts and displays adult-flagged content** — and, critically, that content is tippable/boostable/sellable through the same Razorpay surface. The age gate protects *readers*; it does **nothing** to segregate the *money*.

---

## The kill scenarios, ranked

**1. NSFW content monetized on the Razorpay account → account freeze + fund hold (HIGH / near-certain if adult content earns money).**
Razorpay's prohibited-business list bars: *"Adult goods and services which includes pornography and other sexually suggestive materials (including literature, imagery and other media); escort or prostitution services; Website access and/or Website memberships of pornography or illegal sites."* ([razorpay.com/terms](https://razorpay.com/terms/); mirrored across processor summaries e.g. [Stripe's equivalent list](https://stripe.com/legal/restricted-businesses)). "Sexually suggestive material including literature and imagery" is broad enough to catch a lot of what `is_nsfw` is meant to flag. Enforcement is not a warning-then-review courtesy: Razorpay reserves the right to *"restrict services for transactions with high-risk scores"* and to freeze on any activity *"detrimental to the image and interests"* of the partner/acquiring bank. Because it's one merchant account, a freeze halts settlement for **all** verticals, not just the NSFW one.

**2. Marketplace/aggregator payouts without proper structure → PA-framework non-compliance (HIGH).**
Under the RBI Payment Aggregator framework, *"no entity can collect or settle digital payments without a valid RBI license,"* customer funds *"must first go into a nodal/escrow account, separated from the aggregator's business funds,"* and settlement to merchants must occur within **T+1** ([billcut PA summary](https://www.billcut.com/blogs/payment-aggregator-rules-india/); Razorpay itself holds RBI PA licences — [Razorpay newsroom](https://razorpay.com/newsroom/razorpay-pos-receives-rbi-approval-for-offline-payment-aggregator-licence/)). Collecting reader money into your account and redistributing to creators can be read as acting as an unlicensed aggregator unless you route payouts through a licensed rail (RazorpayX / RazorpayX Route split-settlement) rather than pooling in your own operating account. RazorpayX Payouts is explicitly sold for *"marketplace settlements, paying out to sellers/drivers/partners"* ([RazorpayX Payouts](https://razorpay.com/x/payouts/)) — using it correctly is the mitigation; pooling-then-manual-paying is the exposure.

**3. Medical content reclassified as pharma/telemedicine → restricted-category hold (MEDIUM).**
Educational medical writing is generally fine. The freeze risk appears if content shades into regulated pharma/telemedicine — drug sales, prescriptions, paid medical advice, supplements with health claims. Razorpay (like all Indian PAs) treats pharmaceuticals/drugs as a restricted category requiring additional licensing/underwriting. **UNCONFIRMED:** I could not retrieve Razorpay's exact pharma clause verbatim from a canonical URL (the knowledgebase page 404'd and the merchant schedule wasn't machine-readable) — verify the precise wording with Razorpay. Treat any paid medical *advice/consultation/pharma* vertical as restricted until confirmed.

**4. Chargebacks / obscenity complaints on adult content → elevated risk score → freeze (MEDIUM, compounding #1).**
Adult content carries structurally high chargeback and complaint rates, and Indian law (IT Act s.67 / obscenity provisions) adds a legal-content dimension a bank will not want exposure to. Even a compliant-looking merchant gets de-risked when the acquiring bank sees adult-adjacent MCC activity.

---

## Payout / aggregator risk (specific)

- **Does redistributing reader money to creators need a PA licence / escrow?** Very likely you cannot pool third-party funds in your own operating account and hand-pay creators. The compliant patterns are: (a) **RazorpayX Route** (split settlement — Razorpay holds funds and settles to sub-merchant creators directly, keeping funds off your books), or (b) **RazorpayX Payouts** from a properly-KYC'd RazorpayX current account, or (c) becoming/partnering-with a licensed PA. **UNCONFIRMED:** whether Mycelium's specific flow legally requires its *own* PA authorization vs. riding Razorpay's licence via Route — this is the #1 counsel question.
- **KYC:** RazorpayX and Route both require full business KYC and, for Route, sub-merchant (creator) onboarding/KYC. The current model has no creator KYC — creators just receive `earnings_ledger` credits. That gap must close before any real payout rail goes live.
- **Exposure if you ship the pool-and-manual-pay model as-is:** funds commingled in the operating account (no escrow), no T+1 settlement discipline, no creator KYC — i.e. operating like an unlicensed aggregator. Consequence range: settlement freeze, account termination, and regulatory exposure.

---

## Mitigations (in priority order)

1. **Get NSFW money off the Razorpay surface entirely.** The age gate already exists; extend it to billing: NSFW-flagged pieces must **not** be tippable/boostable/sellable/subscribable through the Razorpay merchant account. Either (a) launch NSFW as non-monetized, or (b) put adult content on a **separate merchant account with an adult-friendly processor** (specialist high-risk/adult gateways), fully segregated from the Razorpay entity. Do **not** mix them on one MID.
2. **Route creator payouts through a licensed rail** — RazorpayX Route (split settlement) is the natural fit for the reader-pool and tip/sponsorship splits, keeping third-party funds off your own books and out of PA-licence territory. Replace the "insert `payout_requests` row + manual pay" stub before launch.
3. **Add creator KYC** as a precondition to receiving any payout (required by Route/Payouts anyway).
4. **Explicit ToS + prohibited-content policy** binding creators: no illegal content, obscenity, or unlicensed pharma; platform right to demonetize/remove; clear NSFW definition matching `is_nsfw`.
5. **Launch these WITHOUT before legal review:** Reader Pass **pool payouts to creators**, **tips/sponsorship payouts**, and **all NSFW monetization**. Safe-to-launch-first on Razorpay: plain SFW subscriptions (Studio/Org/Reader read-access) and platform-retained revenue where **no money leaves to a third-party creator**.

---

## What a human must verify before launch (I am not a lawyer)

Ask **Razorpay** (in writing, keep the reply):
1. Confirm the current verbatim prohibited/restricted list and the exact clause covering "sexually suggestive material," and whether age-gated non-explicit adult writing is in or out.
2. Does hosting *any* `is_nsfw` content on the account risk the whole MID, even if those specific pieces aren't billed through Razorpay?
3. For the reader-pool + tips creator-payout model: is **RazorpayX Route** the sanctioned structure, and does it keep us outside our own PA-licensing obligation? What creator KYC is required?
4. Exact restricted-category treatment of **medical/health/pharma** content and paid consultations.
5. What triggers a hold vs. a termination, and what's the fund-release process if frozen.

Ask **counsel** (Indian fintech/payments + content):
1. Do we need our own RBI PA authorization, or does riding Razorpay's licence via Route suffice for our fund flows?
2. Escrow/nodal-account obligation on the reader pool specifically.
3. IT Act s.67 / obscenity exposure for hosting + monetizing adult content in India; age-gate sufficiency.
4. Pharma/telemedicine/health-claim regulatory line for the medical vertical.
5. Tax/TDS on creator payouts (s.194-O marketplace TDS likely applies).

---

### Sources
- Razorpay Terms & prohibited businesses — https://razorpay.com/terms/
- RazorpayX Payouts (marketplace settlements) — https://razorpay.com/x/payouts/
- RazorpayX Terms — https://razorpay.com/x/terms/
- Razorpay RBI PA licence (newsroom) — https://razorpay.com/newsroom/razorpay-pos-receives-rbi-approval-for-offline-payment-aggregator-licence/
- RBI Payment Aggregator rules (escrow, T+1, licensing) — https://www.billcut.com/blogs/payment-aggregator-rules-india/
- Cross-processor NSFW stance — https://tripleminds.co/blogs/compliance/nsfw-adult-payment-processor/ ; https://stripe.com/legal/restricted-businesses

**UNCONFIRMED flags:** exact Razorpay pharma clause wording (canonical page 404'd); whether Mycelium needs its own PA licence vs. Route; precise clause numbers in the merchant terms schedule.
