/* eslint-disable @typescript-eslint/no-explicit-any */
// The four places money could leak out of Nib: membership charges never
// reaching authors, estimated (not actual) gateway fees, refunds leaving the
// lost processing fee with Nib, and payout transfer fees.
import { test, before, mock } from "node:test"
import assert from "node:assert/strict"
process.env.LAUNCH_FREE = "0"
import { makeFakeClient, ResolveCtx } from "./fake-supabase"
import { splitSale } from "@/lib/revenue-split"
import { payoutNetPaise, PAYOUT_FEE_PAISE, tdsOnPayoutPaise } from "@/lib/tax"

mock.module("@/lib/supabase/server", {
  namedExports: {
    createAdminClient: async () => makeFakeClient(() => ({ data: [] })),
    createClient: async () => makeFakeClient(() => ({ data: [] })),
    createServiceRoleClient: async () => makeFakeClient(() => ({ data: [] })),
  },
})

let payments: typeof import("@/actions/monetization/payments")
before(async () => {
  payments = await import("@/actions/monetization/payments")
})

const ledgerInserts = (fake: any) =>
  fake.calls.filter((c: any) => c.table === "earnings_ledger" && c.op === "insert")

test("splitSale uses Razorpay's actual fee when given (e.g. an international card)", () => {
  const s = splitSale({ grossPaise: 10_000, kind: "purchase", isStudio: false, studioMonthGmvPaise: 0, curated: false, processingPaise: 400 })
  assert.equal(s.processing, 400)
  assert.equal(s.author, Math.floor(9_600 * 0.93))
  assert.ok(s.platform >= 0)
  const capped = splitSale({ grossPaise: 100, kind: "tip", isStudio: false, studioMonthGmvPaise: 0, curated: false, processingPaise: 500 })
  assert.deepEqual(capped, { processing: 100, author: 0, curator: 0, platform: 0 })
})

test("settlePaidPurchase stores the actual processing fee it split on", async () => {
  const fake = makeFakeClient(({ table, op }: ResolveCtx): any => {
    if (table === "purchases" && op === "update")
      return { data: { author_id: "a1", user_id: "b1", amount_paise: 10_000, kind: "piece" } }
    if (table === "profiles") return { data: { plan: "free" } }
    return { data: [], error: null }
  })
  await payments.settlePaidPurchase(fake as any, "order_1", "pay_1", 400)
  const stamp = fake.calls.find((c: any) => c.table === "purchases" && c.op === "update" && "net_paise" in (c.vals ?? {})) as any
  assert.equal(stamp.vals.processing_paise, 400)
  assert.equal(stamp.vals.net_paise, Math.floor(9_600 * 0.93))
})

test("refund claws back the author's net plus the processing fee Razorpay keeps", async () => {
  const fake = makeFakeClient(({ table, op }: ResolveCtx): any => {
    if (table === "purchases" && op === "update")
      return { data: { author_id: "a1", net_paise: 9_080, processing_paise: 236, amount_paise: 10_000 } }
    return { data: [], error: null }
  })
  assert.equal(await payments.reversePaidPurchase(fake as any, "order_1"), true)
  assert.equal(ledgerInserts(fake)[0].rows.net_paise, -(9_080 + 236))
})

test("refund of a purchase settled before processing was stored reverses the net only", async () => {
  const fake = makeFakeClient(({ table, op }: ResolveCtx): any => {
    if (table === "purchases" && op === "update")
      return { data: { author_id: "a1", net_paise: 900, processing_paise: null, amount_paise: 1_000 } }
    return { data: [], error: null }
  })
  await payments.reversePaidPurchase(fake as any, "order_1")
  assert.equal(ledgerInserts(fake)[0].rows.net_paise, -900)
})

test("a membership charge credits the author through the same split", async () => {
  const fake = makeFakeClient(({ table, op }: ResolveCtx): any => {
    if (table === "payment_subscriptions") return { data: { author_id: "a1", user_id: "b1" } }
    if (table === "profiles") return { data: { plan: "free" } }
    if (table === "purchases" && op === "insert") return { data: null, error: null }
    return { data: [], error: null }
  })
  const ok = await payments.settleMembershipCharge(fake as any, "sub_1", {
    id: "pay_1", order_id: "order_1", amount: 10_000, fee: 236,
  })
  assert.equal(ok, true)
  const purchase = fake.calls.find((c: any) => c.table === "purchases" && c.op === "insert") as any
  assert.equal(purchase.rows.kind, "membership")
  assert.equal(purchase.rows.razorpay_payment_id, "pay_1")
  assert.equal(purchase.rows.processing_paise, 236)
  const credit = ledgerInserts(fake)[0].rows
  assert.equal(credit.user_id, "a1")
  assert.equal(credit.source, "membership")
  assert.equal(credit.net_paise, Math.floor(9_764 * 0.93))
})

test("a replayed membership charge (same payment id) credits nothing", async () => {
  const fake = makeFakeClient(({ table, op }: ResolveCtx): any => {
    if (table === "payment_subscriptions") return { data: { author_id: "a1", user_id: "b1" } }
    if (table === "profiles") return { data: { plan: "free" } }
    if (table === "purchases" && op === "insert") return { data: null, error: { code: "23505" } }
    return { data: [], error: null }
  })
  const ok = await payments.settleMembershipCharge(fake as any, "sub_1", {
    id: "pay_1", order_id: "order_1", amount: 10_000, fee: 236,
  })
  assert.equal(ok, false)
  assert.equal(ledgerInserts(fake).length, 0)
})

test("a charge on a subscription that isn't a membership credits nothing", async () => {
  const fake = makeFakeClient(({ table }: ResolveCtx): any => {
    if (table === "payment_subscriptions") return { data: null }
    return { data: [], error: null }
  })
  assert.equal(await payments.settleMembershipCharge(fake as any, "sub_x", { id: "p", amount: 100 }), false)
  assert.equal(ledgerInserts(fake).length, 0)
})

test("payout sends gross minus 1% TDS minus the transfer fee", () => {
  assert.equal(payoutNetPaise(40_000), 40_000 - tdsOnPayoutPaise(40_000) - PAYOUT_FEE_PAISE)
  assert.equal(payoutNetPaise(100), 0)
})
