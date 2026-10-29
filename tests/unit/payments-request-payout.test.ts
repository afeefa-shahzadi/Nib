/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, before, mock } from "node:test"
import assert from "node:assert/strict"
// These tests cover paid-mode behaviour; the free-launch guard has its own test (launch-guard.test.ts).
process.env.LAUNCH_FREE = "0"
import { makeFakeClient, ResolveCtx } from "./fake-supabase"

let currentFake: ReturnType<typeof makeFakeClient>
mock.module("@/lib/supabase/server", {
  namedExports: {
    createAdminClient: async () => currentFake,
    createClient: async () => currentFake,
    createServiceRoleClient: async () => currentFake,
  },
})
mock.module("@/lib/rate-limit.server", {
  namedExports: {
    checkRateLimit: async () => ({ ok: true, remaining: 9, resetAt: new Date() }),
  },
})
mock.module("@/lib/restrictions", {
  namedExports: { assertNotRestricted: async () => {} },
})

let pay: typeof import("@/actions/monetization/payments")
before(async () => {
  pay = await import("@/actions/monetization/payments")
})

test("requestPayout with a method sets payout_method_id + derived destination", async () => {
  currentFake = makeFakeClient(({ table, op }: ResolveCtx): any => {
    if (table === "payout_methods" && op === "select")
      return { data: { id: "pm1", user_id: "u1", method_type: "vpa", vpa: "alice@okhdfc", pan: "enc:v1:x" } }
    if (table === "tips" && op === "select") return { data: [{ net_paise: 100000, created_at: null }] }
    if (table === "earnings_ledger" && op === "select") return { data: [] }
    if (table === "payout_requests" && op === "select") return { data: [] }
    return { data: null, error: null }
  })
  const r = await pay.requestPayout({ data: { amountPaise: 50000, payout_method_id: "pm1" } })
  assert.equal(r.success, true)
  const ins = currentFake.calls.find(
    (c) => c.table === "payout_requests" && c.op === "insert"
  ) as any
  assert.equal(ins.rows.payout_method_id, "pm1")
  assert.match(ins.rows.destination, /alice@okhdfc/)
})

test("requestPayout rejects a method with no PAN", async () => {
  currentFake = makeFakeClient(({ table, op }: ResolveCtx): any => {
    if (table === "payout_methods" && op === "select")
      return { data: { id: "pm1", user_id: "u1", method_type: "vpa", vpa: "a@b", pan: null } }
    if (table === "tips" && op === "select") return { data: [{ net_paise: 100000, created_at: null }] }
    if (table === "earnings_ledger" && op === "select") return { data: [] }
    if (table === "payout_requests" && op === "select") return { data: [] }
    return { data: null, error: null }
  })
  await assert.rejects(
    () => pay.requestPayout({ data: { amountPaise: 50000, payout_method_id: "pm1" } }),
    /PAN/
  )
})
