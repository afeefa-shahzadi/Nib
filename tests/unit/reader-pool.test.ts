/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  distributePool,
  settleReaderPools,
  POOL_BUDGET_PAISE,
} from "@/lib/reader-pool"
import { makeFakeClient, ResolveCtx } from "./fake-supabase"

// ---------- distributePool: pure integer-paise split ----------

test("distributePool splits full budget, last creator absorbs remainder", () => {
  const out = distributePool(100, [
    { creatorId: "a", weight: 1 },
    { creatorId: "b", weight: 1 },
    { creatorId: "c", weight: 1 },
  ])
  // equal weights, id-ascending order; 100/3 -> 33,33, last gets the rest
  assert.deepEqual(
    out.map((o) => o.amount),
    [33, 33, 34]
  )
  assert.equal(
    out.reduce((s, o) => s + o.amount, 0),
    100,
    "sum of shares must equal budget exactly"
  )
})

test("distributePool orders heaviest-first with id tiebreak", () => {
  const out = distributePool(100, [
    { creatorId: "z", weight: 2 },
    { creatorId: "a", weight: 2 },
    { creatorId: "m", weight: 5 },
  ])
  // weight desc: m(5) first; then z & a tie on weight -> id asc a,z
  assert.deepEqual(
    out.map((o) => o.creatorId),
    ["m", "a", "z"]
  )
  assert.deepEqual(
    out.map((o) => o.amount),
    [55, 22, 23]
  ) // floor(100*5/9), floor(100*2/9), remainder
  assert.equal(out.reduce((s, o) => s + o.amount, 0), 100)
})

test("distributePool never leaks paise on messy ratios", () => {
  const out = distributePool(POOL_BUDGET_PAISE, [
    { creatorId: "x", weight: 3 },
    { creatorId: "y", weight: 4 },
    { creatorId: "z", weight: 5 },
  ])
  assert.equal(
    out.reduce((s, o) => s + o.amount, 0),
    POOL_BUDGET_PAISE,
    "full budget distributed, none lost to rounding"
  )
})

test("distributePool returns [] when no positive weight or no budget", () => {
  assert.deepEqual(
    distributePool(100, [
      { creatorId: "a", weight: 0 },
      { creatorId: "b", weight: -5 },
    ]),
    []
  )
  assert.deepEqual(distributePool(0, [{ creatorId: "a", weight: 5 }]), [])
})

test("distributePool: single creator absorbs the whole budget", () => {
  assert.deepEqual(distributePool(500, [{ creatorId: "solo", weight: 7 }]), [
    { creatorId: "solo", amount: 500, weight: 7 },
  ])
})

// ---------- settleReaderPools: settle-once + clap weighting + writes ----------

test("settleReaderPools: idempotent claim, self/null-author excluded, writes ledger + distributions", async () => {
  const periodStart = "2026-07-01"
  const periodEnd = "2026-08-01"

  // subA is fresh (claim succeeds); subB is already settled (claim returns null).
  const candidates = [
    { id: "subA", user_id: "reader1", pool_settled_until: null, created_at: "2026-06-01" },
    { id: "subB", user_id: "reader2", pool_settled_until: "2026-08-01", created_at: "2026-06-01" },
  ]
  // reader1's claps: self-clap (reader1) and null-author must be excluded.
  const claps = [
    { count: 3, piece: { author_id: "creatorX" } },
    { count: 5, piece: { author_id: "reader1" } }, // self-clap -> excluded
    { count: 2, piece: { author_id: null } }, // null author -> excluded
    { count: 4, piece: { author_id: "creatorY" } },
  ]

  const resolve = ({ table, op, filters }: ResolveCtx) => {
    if (table === "reader_subscriptions" && op === "select") return { data: candidates }
    if (table === "reader_subscriptions" && op === "update") {
      // Model the atomic claim: subB's period is already settled -> 0 rows.
      const id = filters.find((f) => f[0] === "id")?.[1]
      return { data: id === "subA" ? { id: "subA" } : null }
    }
    if (table === "piece_claps") return { data: claps }
    if (table === "earnings_ledger" && op === "insert") return { error: null }
    if (table === "reader_pool_distributions" && op === "insert") return { error: null }
    return { data: null, error: null }
  }
  const fake = makeFakeClient(resolve)

  const res = await settleReaderPools(fake as any, periodStart, periodEnd)

  // Only subA was paid; subB's already-settled month is not paid again.
  assert.equal(res.settled, 1, "settle-once: only the unsettled sub is claimed")

  const ledgerInserts = fake.calls.filter(
    (c) => c.table === "earnings_ledger" && c.op === "insert"
  ) as any[]
  assert.equal(ledgerInserts.length, 1, "exactly one ledger credit (for subA)")
  const ledgerRows = ledgerInserts[0].rows as any[]
  assert.ok(
    ledgerRows.every((r) => r.source === "reader_pool"),
    "ledger rows tagged source='reader_pool'"
  )
  // Self-clap (reader1) and null author never earn.
  const paidCreators = ledgerRows.map((r) => r.user_id).sort()
  assert.deepEqual(paidCreators, ["creatorX", "creatorY"])
  assert.ok(!paidCreators.includes("reader1"), "self-clap excluded")
  // net == gross (pool cut already removed at budget level) and full budget spent.
  assert.ok(ledgerRows.every((r) => r.net_paise === r.gross_paise))
  assert.equal(
    ledgerRows.reduce((s, r) => s + r.net_paise, 0),
    POOL_BUDGET_PAISE,
    "credited exactly the pool budget"
  )

  const distInserts = fake.calls.filter(
    (c) => c.table === "reader_pool_distributions" && c.op === "insert"
  ) as any[]
  assert.equal(distInserts.length, 1, "transparency rows written")
  const distRows = distInserts[0].rows as any[]
  assert.ok(distRows.every((r) => r.reader_id === "reader1"))
  assert.deepEqual(
    distRows.map((r) => r.creator_id).sort(),
    ["creatorX", "creatorY"]
  )
  assert.equal(
    distRows.reduce((s, r) => s + r.amount_paise, 0),
    POOL_BUDGET_PAISE
  )
  assert.equal(res.distributedPaise, POOL_BUDGET_PAISE)
})

test("settleReaderPools: reader with no qualifying claps pays nobody", async () => {
  const resolve = ({ table, op, filters }: ResolveCtx) => {
    if (table === "reader_subscriptions" && op === "select")
      return {
        data: [
          { id: "s1", user_id: "reader1", pool_settled_until: null, created_at: "2026-06-01" },
        ],
      }
    if (table === "reader_subscriptions" && op === "update")
      return { data: { id: filters.find((f) => f[0] === "id")?.[1] } }
    // Only a self-clap -> weight map empty -> distributePool returns [].
    if (table === "piece_claps")
      return { data: [{ count: 9, piece: { author_id: "reader1" } }] }
    return { data: null, error: null }
  }
  const fake = makeFakeClient(resolve)
  const res = await settleReaderPools(fake as any, "2026-07-01", "2026-08-01")

  assert.equal(res.settled, 1)
  assert.equal(res.readersWithNoClaps, 1)
  assert.equal(res.distributedPaise, 0)
  assert.equal(
    fake.calls.filter((c) => c.table === "earnings_ledger").length,
    0,
    "no ledger credit when budget stays with platform"
  )
})

// The pool is 85% of what Nib actually keeps from a ₹199 pass: after the 18%
// GST inside the price and the gateway fee. Nib's 15% must stay positive.
test("pool budget is computed from net receipts, never the sticker price", async () => {
  const { poolBudgetPaise } = await import("@/lib/reader-pool")
  const { GST_RATE } = await import("@/lib/tax")
  const { processingFeePaise } = await import("@/lib/revenue-split")
  for (const price of [19_900, 16_500, 100]) {
    const net = Math.floor(price / (1 + GST_RATE)) - processingFeePaise(price)
    assert.equal(poolBudgetPaise(price), Math.floor(net * 0.85))
    assert.ok(net - poolBudgetPaise(price) >= 0)
  }
  assert.equal(POOL_BUDGET_PAISE, poolBudgetPaise(19_900))
})
