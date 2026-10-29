# 13 — Revenue Strategy & Packaging Decisions

**Status:** Decided (packaging), pending pilot validation (wedge)
**Date:** 2026-07-18
**Supersedes / extends:** [08-monetization-model.md](08-monetization-model.md)

This is a decision record, not implementation. It captures the strategy
conclusions behind the reader-pool (Phase 2) work and the free-vs-Studio
packaging. Numbers come from two models kept in the repo's analysis history
(pool payout + company break-even); assumptions are stated inline so they can
be re-run when reality differs.

---

## 1. The core reframe

**The platform is a SaaS company (Studio) with a reader marketplace attached —
not a reader-subscription company.**

Per-unit monthly contribution to the company:

| Unit | Price | Company keeps/mo | Note |
|---|--:|--:|---|
| Reader Pass | ₹199 | **₹25.15** | after 85% pool payout + ~2.36% processing |
| Studio | ₹499 | **₹487.22** | pure SaaS, minus processing |
| Org seat | ₹399 | **₹389.58** | |

One Studio creator ≈ **19 paying readers** in value. Survival runs on Studio,
not on the pool cut.

**The Reader Pass pool is marketing spend, not a revenue line.** After the 85%
payout it is ~break-even. Its job is acquisition + differentiation (transparent
pay vs Medium's black box), budgeted as CAC, never counted as margin.

---

## 2. Break-even (does the company survive?)

Monthly members needed to cover burn (Studio-only path is by far the cheapest):

| Burn | Studio-only break-even | Reader-only path (the trap) |
|---|--:|--:|
| Bootstrap ₹2L/mo (2–3 ppl) | **~414 creators** | ~9,000 readers |
| Small team ₹8L/mo (5–6 ppl) | ~1,653 creators | ~36,000 readers |
| Funded ₹25L/mo (12–15 ppl) | ~5,163 creators | ~113,000 readers |

**Conclusion:** economics are survivable and cheap to clear (414 Studio creators
for a lean team). Every scary number in the analysis is a *distribution*
number, not an *economics* number. **The trap to avoid: scaling readers without
Studio conversion** — that grows cost (pool payout + infra) against a ₹25/head
margin.

---

## 3. The reader-pool payout is winner-take-most

Modelled with Zipf-distributed clap concentration (income is power-law, not
even). Median creator earns coffee money until very large scale:

| Scale (paying readers / creators) | Pool/mo | Top creator | **Median** | ≥₹5k/mo |
|---|--:|--:|--:|--:|
| 1,000 / 200 | ₹1.7L | ₹28,777 | **₹285** | 5 |
| 10,000 / 1,000 | ₹16.9L | ₹2.26L | **₹451** | 45 |
| 100,000 / 5,000 | ₹1.69Cr | ₹18.6L | **₹744** | 371 |

Biggest lever is **readers-per-creator**, not total size:

| readers/creator | median creator/mo |
|--:|--:|
| 5 | ₹186 |
| 20 | ₹744 |
| 100 | ₹3,718 |

**Decisions:**
- **Never market "creators earn from Reader Pass" as breadth.** Median is a
  trickle; that framing repeats Medium Partner Program's trust collapse. Market
  the *ceiling* ("top creators earn like top Substackers"), true from Traction on.
- **Guard the reader:creator ratio (~20:1 paying floor).** More creators dilute
  the pool per-head — supply must be throttled, not maximised.
- The pool retains *stars*; it cannot retain the long tail. That needs
  switching-cost, not payout (see §6).

---

## 4. The wedge (positioning) — pending pilot

The platform's real 10x is **cited, thesis-driven analytical writing** (real
features: block- and comment-level citations, `canonical_thesis`,
`challenging_count`/debates, RAG composer, knowledge graph). Not prose (Medium),
not threads (Reddit), not Q&A (Stack Overflow).

**Chosen wedge:** *rising analytical writers in one evidence-heavy niche who have
no audience yet, need discovery + fair monetization Substack can't give them,
and whose credibility is signalled by rigorous citation.* Substack's true
weakness is **discovery** (closed garden); the feed + pool + leaderboard +
citation-credibility is a discovery engine for people Substack can't help.

Leading niche candidate: independent equity/markets research (watch SEBI
advice liability) or geopolitics/policy as the lower-risk backup.

**Avoid as launch wedge:** medical (liability + moderation burden) and anything
using the **NSFW flag — adult content is a high-risk merchant category that can
get Razorpay to drop payments. Verify Razorpay ToS before relying on it.**

**Validation gate (do this before building more):** hand-recruit **10 rising
analysts**, drive readers to them via feed/pool for 60 days, measure whether they
got readers they couldn't get elsewhere and whether any money materialised. If 10
can't feel "discovered here", 400 never will.

---

## 5. Free vs Studio packaging

**Boundary rule:** *Platform pays you → Free. You charge your readers → Studio.*
Plus: real compute (managed AI) and pro/business workflow → Studio. Never gate
accessibility or the citation DNA.

### FREE — forever, everyone (supply engine + pool liquidity + moat)
- **Authoring (generous):** full block composer — text, headings, image, code,
  embed, quote, flowchart, mermaid, charts, outline, minimap.
- **Wedge DNA:** citations / sources / inline-citation (magnet + builds the
  cited corpus that becomes switching-cost).
- **Discovery:** feed, profile, followers, leaderboards, reposts.
- **Receive money:** reader-pool payouts, tips received, earnings view, payout
  request.
- **Engagement received:** claps, highlights, annotations, comments, debates /
  thesis-challenge.
- **Graph:** view knowledge graph of own work (basic).
- **AI (BYOK):** RAG assistant + synthesis using the creator's own key.
- **Accessibility:** voice dictation, transcripts — never gated.

### STUDIO ₹499 — you're running a business here
- **Charge your audience (core):** memberships, paid tiers, bundles, paid
  pieces, sponsorship management.
- **Managed AI:** RAG/synthesis on platform-provided keys (bundled compute).
- **Pro workflow:** branches / versioning / diff / commit, scheduling,
  co-authors / collaboration.
- **Depth:** advanced analytics, full knowledge-graph tooling.
- **Scale:** higher limits (drafts, storage), priority.

### Org / seats
Org ₹399/seat stays a separate plan (teams/institutions), outside the individual
free-vs-Studio line.

### Resolved judgment calls
1. **RAG AI** → free with BYOK, paid with managed keys (cost-aligned, no
   arbitrary gate).
2. **Advanced blocks (flowchart/mermaid/charts)** → free (rendering is cheap;
   generous authoring = more supply). Don't nickel-and-dime craft.
3. **Scheduling** → Studio (pro business workflow).

### Why this structure has no bad tail
- Free tier *receives* money, so no one churns "after a payout" — they were never
  paying.
- Long tail freeloads only cheap-to-serve authoring, which *is* the supply and
  pool liquidity.
- Conversion self-selects: the upgrade trigger is "I want to charge my own
  subscribers" — a moment the creator walks into once they're already earning.

---

## 6. Trial, conversion, retention, withdrawal

- **Seed 100 creators:** not a self-serve trial — comp Studio free ~6 months,
  hand-picked, no card, "Founding Creator" status. Concierge, not a funnel.
- **Self-serve trial (later):** card required; length ≥ first pool settlement.
  Because settlement is monthly, a 7/14-day trial ends before the creator sees
  any pool money — do **not** use short trials with a pool model. Prefer
  "free until first payout" or convert-on-profit.
- **Conversion trigger:** pay-when-you-profit (creator upgrades when they want
  to charge their own audience), **not** an earnings milestone — a milestone
  gate is adversely selected (fast earners churn at the gate; slow earners never
  reach it and freeload).
- **Retention = switching cost**, not payout: the creator's cited corpus,
  audience, and subscriber relationships must live here and be painful to leave
  (the same lock-in Substack has via email). The payout is acquisition only.
- **Withdrawal is sacred — one clean click, never gated, never defaulted away
  from cash.** Friction here turns us into the cashout gauntlet we're beating.
  - ✅ Opt-in beside Withdraw: "apply earnings to your Studio renewal"
    (win-win, self-funds retention); optional cashable-balance-with-bonus.
  - ❌ **Never** convert earned cash → non-cashable Insight Points. It re-blurs
    the money/IP separation (Phase 0) and destroys user value; converting an
    owed cash liability into a non-redeemable token is consumer-protection
    dicey.

---

## 7. Enforcement — deferred (do NOT build yet)

The free-vs-Studio gate is **not** built. Deliberately deferred:
- Packaging boundary is unvalidated (pilot will move lines).
- No paying users yet to gate.
- Gate is cheap to add later, expensive to thrash now.

**When both are true, build it:** (1) pilot validated the wedge and the boundary
stopped moving; (2) first real paid feature ships. Route all checks through a
single `isStudio(userId)` helper reading existing subscription tables — never
scattered inline checks. Whole enforcement is ~1 file at that point.

---

## 8. Immediate action items (non-code)
1. Verify Razorpay ToS re: NSFW / adult-content merchant risk **now**.
2. Pick the one launch niche (equity research vs geopolitics/policy).
3. Run the 60-day, 10-analyst discovery pilot (§4) before building more.
4. Name the cold-start answer in one sentence: how the first 1,000 returning
   weekly readers arrive.
