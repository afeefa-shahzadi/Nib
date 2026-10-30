/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, before, mock } from "node:test"
import assert from "node:assert/strict"
// These tests cover paid-mode behaviour; the free-launch guard has its own test (launch-guard.test.ts).
process.env.LAUNCH_FREE = "0"
import { makeFakeClient, ResolveCtx } from "./fake-supabase"

// requestPayout and redeemStudioFromEarnings build their own admin client via
// createAdminClient() (which needs Supabase creds and would network). Intercept
// that factory so both run against our fake — no creds, no network. mock.module
// must be registered before payments.ts is first imported, so we do the import
// inside before() after installing the mock.
let currentFake: ReturnType<typeof makeFakeClient>
mock.module("@/lib/supabase/server", {
  namedExports: {
    createAdminClient: async () => currentFake,
    createClient: async () => currentFake,
    createServiceRoleClient: async () => currentFake,
  },
})

let payments: typeof import("@/actions/monetization/payments")
let orders: typeof import("@/actions/payments")
before(async () => {
  payments = await import("@/actions/monetization/payments")
  orders = await import("@/actions/payments")
})

const DAY = 24 * 60 * 60 * 1000

// ---------- computeWithdrawableBalancePaise: available = net - reserved ----------

test("computeWithdrawableBalancePaise: available = lifetime net minus reserved (paid+open, not failed)", async () => {
  const resolve = ({ table }: ResolveCtx): any => {
    if (table === "tips") return { data: [{ net_paise: 5000 }] }
    if (table === "earnings_ledger")
      return { data: [{ net_paise: 90000 }, { net_paise: -49900 }] }
    if (table === "payout_requests")
      return {
        data: [
          { amount_paise: 40000, status: "paid" },
          { amount_paise: 10000, status: "failed" }, // failed does NOT reserve
          { amount_paise: 20000, status: "requested" }, // open reserves
        ],
      }
    return { data: [] }
  }
  const fake = makeFakeClient(resolve)
  const r = await payments.computeWithdrawableBalancePaise(fake as any, "u1")

  assert.equal(r.lifetimeNet, 5000 + (90000 - 49900)) // 45100
  assert.equal(r.reservedPaise, 40000 + 20000) // 60000 (failed excluded)
  assert.equal(r.availablePaise, 45100 - 60000) // -14900
  assert.equal(r.hasOpenRequest, true)
})

test("computeWithdrawableBalancePaise: earnings inside the 7-day hold are held, not available; fresh debits apply immediately", async () => {
  const fresh = new Date(Date.now() - 1 * DAY).toISOString()
  const old = new Date(Date.now() - 8 * DAY).toISOString()
  const resolve = ({ table }: ResolveCtx): any => {
    if (table === "tips")
      return { data: [{ net_paise: 5000, created_at: fresh }] } // held
    if (table === "earnings_ledger")
      return {
        data: [
          { net_paise: 90000, created_at: old }, // matured
          { net_paise: 10000, created_at: fresh }, // held
          { net_paise: -49900, created_at: fresh }, // fresh debit must hit NOW (no double-spend window)
        ],
      }
    if (table === "payout_requests") return { data: [] }
    return { data: [] }
  }
  const fake = makeFakeClient(resolve)
  const r = await payments.computeWithdrawableBalancePaise(fake as any, "u1")

  assert.equal(r.heldPaise, 5000 + 10000)
  assert.equal(r.availablePaise, 90000 - 49900) // held excluded, debit applied immediately
  assert.equal(r.lifetimeNet, 90000 + 10000 + 5000 - 49900) // held still counts toward lifetime
})

// ---------- reversePaidPurchase: chargeback clawback ----------

test("reversePaidPurchase: reverses the stored net once as a negative chargeback row", async () => {
  const fake = makeFakeClient(({ table, op }: ResolveCtx): any => {
    if (table === "purchases" && op === "update")
      return { data: { author_id: "a1", net_paise: 900, amount_paise: 1000 } }
    if (table === "earnings_ledger" && op === "insert") return { error: null }
    return { data: [], error: null }
  })
  const ok = await payments.reversePaidPurchase(fake as any, "order_1")
  assert.equal(ok, true)
  const claw = fake.calls.find(
    (c) => c.table === "earnings_ledger" && c.op === "insert"
  ) as any
  assert.equal(claw.rows.source, "chargeback")
  assert.equal(claw.rows.net_paise, -900)
  assert.equal(claw.rows.gross_paise, -900)
  assert.equal(claw.rows.user_id, "a1")
})

test("reversePaidPurchase: no-op when the gated paid->reversed update matches nothing (replay / never paid)", async () => {
  const fake = makeFakeClient(({ table, op }: ResolveCtx): any => {
    if (table === "purchases" && op === "update") return { data: null }
    return { data: [], error: null }
  })
  const ok = await payments.reversePaidPurchase(fake as any, "order_1")
  assert.equal(ok, false)
  assert.equal(
    fake.calls.filter((c) => c.table === "earnings_ledger" && c.op === "insert").length,
    0,
    "no clawback row written"
  )
})

test("reversePaidPurchase: legacy purchase without stored net credits nothing (manual review)", async () => {
  const fake = makeFakeClient(({ table, op }: ResolveCtx): any => {
    if (table === "purchases" && op === "update")
      return { data: { author_id: "a1", net_paise: null, amount_paise: 1000 } }
    return { data: [], error: null }
  })
  const ok = await payments.reversePaidPurchase(fake as any, "order_1")
  assert.equal(ok, false)
  assert.equal(
    fake.calls.filter((c) => c.table === "earnings_ledger" && c.op === "insert").length,
    0,
    "unknown credit is never guessed"
  )
})

// ---------- createRazorpayOrder: tip floor (Guard E) ----------

test("createRazorpayOrder rejects a tip below the ₹20 floor and creates no order", async () => {
  currentFake = makeFakeClient(() => ({ data: [] }))
  await assert.rejects(
    () =>
      orders.createRazorpayOrder({
        data: { kind: "tip", authorId: "a1", amountPaise: 1_000 },
      }),
    /Minimum tip is ₹20/
  )
  assert.equal(
    currentFake.calls.filter((c) => c.table === "purchases").length,
    0,
    "no purchase row inserted below the floor"
  )
})

// ---------- createRazorpayOrder: server-authoritative pricing (P0-1) ----------

test("createRazorpayOrder rejects a piece purchase (unpriced hole) and creates no order", async () => {
  currentFake = makeFakeClient(() => ({ data: [] }))
  await assert.rejects(
    () =>
      orders.createRazorpayOrder({
        data: { kind: "piece", contentObjectId: "c1", amountPaise: 100 },
      }),
    /isn't available for purchase/
  )
  assert.equal(
    currentFake.calls.filter((c) => c.table === "purchases").length,
    0,
    "no purchase row for a piece order"
  )
})

test("createRazorpayOrder is rate-limited: a maxed-out window rejects and creates no order", async () => {
  currentFake = makeFakeClient(({ table, op }: ResolveCtx): any => {
    if (table === "rate_limit_hit" && op === "rpc")
      return { data: { count: 21, window_start: new Date().toISOString() } }
    return { data: [], error: null }
  })
  await assert.rejects(
    () =>
      orders.createRazorpayOrder({
        data: { kind: "tip", authorId: "a1", amountPaise: 5_000 },
      }),
    /Too many payment attempts/
  )
  assert.equal(
    currentFake.calls.filter((c) => c.table === "purchases").length,
    0,
    "no order created once the limit is hit"
  )
})

// ---------- requestPayout: min / above-available / open-request guards ----------

// Balance backed by ledger net only; payouts drive reserved/open state.
function payoutFake(ledgerNet: number, payouts: any[] = []) {
  return makeFakeClient(({ table }: ResolveCtx): any => {
    if (table === "tips") return { data: [] }
    if (table === "earnings_ledger") return { data: [{ net_paise: ledgerNet }] }
    if (table === "payout_requests") return { data: payouts }
    return { data: [] }
  })
}

test("requestPayout rejects below the ₹400 minimum", async () => {
  currentFake = payoutFake(1_000_000)
  await assert.rejects(
    () => payments.requestPayout({ data: { amountPaise: 39_999 } }),
    /Minimum payout/
  )
  assert.equal(
    currentFake.calls.filter((c) => c.table === "payout_requests").length,
    0,
    "no payout row inserted on rejection"
  )
})

test("requestPayout rejects amount above available", async () => {
  currentFake = payoutFake(45_100) // available 45100
  await assert.rejects(
    () => payments.requestPayout({ data: { amountPaise: 100_000 } }),
    /available/
  )
})

test("requestPayout rejects a second request while one is open", async () => {
  currentFake = payoutFake(200_000, [{ amount_paise: 10_000, status: "requested" }])
  await assert.rejects(
    () =>
      payments.requestPayout({
        data: { amountPaise: 40_000, destination: "a@upi" },
      }),
    /pending payout/
  )
})

test("requestPayout inserts a requested row when valid", async () => {
  currentFake = payoutFake(50_000)
  const r = await payments.requestPayout({
    data: { amountPaise: 40_000, destination: "  creator@upi  " },
  })
  assert.deepEqual(r, { success: true })
  const inserts = currentFake.calls.filter(
    (c) => c.table === "payout_requests" && c.op === "insert"
  ) as any[]
  assert.equal(inserts.length, 1)
  assert.equal(inserts[0].rows.amount_paise, 40_000)
  assert.equal(inserts[0].rows.status, "requested")
  assert.equal(inserts[0].rows.user_id, "u1")
  assert.equal(inserts[0].rows.destination, "creator@upi", "destination trimmed + stored")
})

test("requestPayout rejects when the creator is restricted", async () => {
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  currentFake = makeFakeClient(({ table }: ResolveCtx): any => {
    if (table === "profiles")
      return { data: { restricted_until: future, restricted_reason: "violation" } }
    if (table === "earnings_ledger") return { data: [{ net_paise: 5_000_000 }] }
    if (table === "tips") return { data: [] }
    if (table === "payout_requests") return { data: [] }
    return { data: [] }
  })
  await assert.rejects(
    () =>
      payments.requestPayout({ data: { amountPaise: 40_000, destination: "a@upi" } }),
    /restricted/i
  )
  assert.equal(
    currentFake.calls.filter((c) => c.table === "payout_requests" && c.op === "insert").length,
    0,
    "no payout inserted while restricted"
  )
})

test("requestPayout rejects when destination is missing", async () => {
  currentFake = payoutFake(50_000)
  await assert.rejects(
    () => payments.requestPayout({ data: { amountPaise: 40_000 } }),
    /UPI ID or bank account/
  )
  assert.equal(
    currentFake.calls.filter((c) => c.table === "payout_requests" && c.op === "insert").length,
    0,
    "no row inserted when destination missing"
  )
})

// ---------- redeemStudioFromEarnings: stacking, debit sign, coverage guard ----------

// available = ledgerNet; profile controls plan + existing credit window.
function redeemFake(ledgerNet: number, profile: any) {
  return makeFakeClient(({ table, op }: ResolveCtx): any => {
    if (table === "profiles" && op === "select") return { data: profile }
    if (table === "profiles" && op === "update") return { error: null }
    if (table === "tips") return { data: [] }
    if (table === "earnings_ledger" && op === "select") return { data: [{ net_paise: ledgerNet }] }
    if (table === "earnings_ledger" && op === "insert") return { data: { id: "led1" }, error: null }
    return { data: [], error: null }
  })
}

test("redeemStudioFromEarnings: unused future credit stacks from its existing end", async () => {
  const existing = new Date(Date.now() + 10 * DAY) // credit still active
  currentFake = redeemFake(90_000, {
    plan: "studio",
    studio_credit_until: existing.toISOString(),
  })
  const r = await payments.redeemStudioFromEarnings()
  // base = existing (it's in the future) -> until = existing + 30d, exactly.
  assert.equal(
    new Date(r.studioUntil).getTime(),
    existing.getTime() + 30 * DAY,
    "stacks 30d onto the unused credit window"
  )
  const update = currentFake.calls.find(
    (c) => c.table === "profiles" && c.op === "update"
  ) as any
  assert.equal(update.vals.plan, "studio")
})

test("redeemStudioFromEarnings: lapsed credit restarts from now", async () => {
  const lapsed = new Date(Date.now() - 5 * DAY) // expired
  currentFake = redeemFake(90_000, {
    plan: "free",
    studio_credit_until: lapsed.toISOString(),
  })
  const r = await payments.redeemStudioFromEarnings()
  // base = now (existing is in the past) -> until ≈ now + 30d.
  const drift = Math.abs(new Date(r.studioUntil).getTime() - (Date.now() + 30 * DAY))
  assert.ok(drift < 5000, `restarts from now, not backward (drift ${drift}ms)`)
})

test("redeemStudioFromEarnings: writes a NEGATIVE studio_credit debit (stays cash)", async () => {
  currentFake = redeemFake(90_000, { plan: "free", studio_credit_until: null })
  await payments.redeemStudioFromEarnings()
  const debit = currentFake.calls.find(
    (c) => c.table === "earnings_ledger" && c.op === "insert"
  ) as any
  assert.equal(debit.rows.source, "studio_credit")
  assert.equal(debit.rows.net_paise, -49_900)
  assert.equal(debit.rows.gross_paise, -49_900)
  assert.equal(debit.rows.status, "available")
})

test("redeemStudioFromEarnings: rolls back its debit if the balance goes negative between check and write (race, P0-2)", async () => {
  // 1st balance read (pre-check) is healthy so the debit is inserted; the 2nd
  // read (post-insert recompute) sees the balance drained by a concurrent op, so
  // the just-inserted row must be deleted and the redeem rejected.
  let ledgerSelects = 0
  currentFake = makeFakeClient(({ table, op }: ResolveCtx): any => {
    if (table === "profiles" && op === "select")
      return { data: { plan: "free", studio_credit_until: null } }
    if (table === "profiles" && op === "update") return { error: null }
    if (table === "tips") return { data: [] }
    if (table === "earnings_ledger" && op === "select") {
      ledgerSelects++
      return { data: [{ net_paise: ledgerSelects === 1 ? 90_000 : -1 }] }
    }
    if (table === "earnings_ledger" && op === "insert")
      return { data: { id: "led1" }, error: null }
    if (table === "earnings_ledger" && op === "delete") return { error: null }
    return { data: [], error: null }
  })
  await assert.rejects(() => payments.redeemStudioFromEarnings(), /try again/)
  const del = currentFake.calls.find(
    (c) => c.table === "earnings_ledger" && c.op === "delete"
  )
  assert.ok(del, "the inserted debit is rolled back")
  assert.equal(
    currentFake.calls.filter((c) => c.table === "profiles" && c.op === "update").length,
    0,
    "no Studio credit granted when the debit is rolled back"
  )
})

test("redeemStudioFromEarnings: rejects when available < ₹499 and writes nothing", async () => {
  currentFake = redeemFake(40_000, { plan: "free", studio_credit_until: null }) // ₹400 < ₹499
  await assert.rejects(() => payments.redeemStudioFromEarnings(), /available earnings/)
  assert.equal(
    currentFake.calls.filter((c) => c.table === "earnings_ledger").length,
    0,
    "no debit written when coverage guard fails"
  )
})

// ---------- createRazorpayOrder: bundle parked; piece priced from the DB ----------

test("createRazorpayOrder rejects bundle kind", async () => {
  currentFake = makeFakeClient(() => ({ data: null }), "u1")
  await assert.rejects(
    orders.createRazorpayOrder({ data: { kind: "bundle", bundleId: "b1", amountPaise: 100 } }),
    /isn't available for purchase/
  )
})

function pieceFake(piece: any, owned: any[] = []) {
  return makeFakeClient(({ table }: ResolveCtx): any => {
    if (table === "content_objects") return { data: piece }
    if (table === "purchases") return { data: owned }
    return { data: null }
  }, "u1")
}

test("createRazorpayOrder rejects an unpriced or unpublished piece", async () => {
  for (const piece of [
    { author_id: "a1", price_paise: null, status: "published" },
    { author_id: "a1", price_paise: 4_900, status: "draft" },
    null,
  ]) {
    currentFake = pieceFake(piece)
    await assert.rejects(
      orders.createRazorpayOrder({ data: { kind: "piece", contentObjectId: "c1", amountPaise: 1 } }),
      /isn't available for purchase/
    )
  }
})

test("createRazorpayOrder rejects buying your own piece, or one you already own", async () => {
  currentFake = pieceFake({ author_id: "u1", price_paise: 4_900, status: "published" })
  await assert.rejects(
    orders.createRazorpayOrder({ data: { kind: "piece", contentObjectId: "c1", amountPaise: 1 } }),
    /your own piece/
  )
  currentFake = pieceFake({ author_id: "a1", price_paise: 4_900, status: "published", is_nsfw: false }, [{ id: "p" }])
  await assert.rejects(
    orders.createRazorpayOrder({ data: { kind: "piece", contentObjectId: "c1", amountPaise: 1 } }),
    /already own/
  )
})
