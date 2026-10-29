/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, before, mock } from "node:test"
import assert from "node:assert/strict"
import { makeFakeClient } from "./fake-supabase"

const paid: string[] = []
const failed: string[] = []
let paidSettled = true
let failedSettled = true
mock.module("@/actions/admin/payouts", {
  namedExports: {
    markPayoutPaid: async (_s: any, id: string) => { paid.push(id); return { settled: paidSettled } },
    markPayoutFailed: async (_s: any, id: string) => { failed.push(id); return { settled: failedSettled } },
  },
})
const alerts: string[] = []
mock.module("@/lib/alerts", {
  namedExports: { alertOps: async (m: string) => { alerts.push(m) } },
})
mock.module("@/lib/supabase/server", {
  namedExports: {
    createServiceRoleClient: async () => makeFakeClient((): any => ({ data: null })),
  },
})

let wh: typeof import("@/app/api/webhooks/razorpayx/route")
before(async () => {
  wh = await import("@/app/api/webhooks/razorpayx/route")
})

function svc() {
  return makeFakeClient((): any => ({ data: null }))
}

test("payout.processed settles paid", async () => {
  paid.length = 0; paidSettled = true
  await wh.handleRazorpayxEvent(svc() as any, "payout.processed", { id: "pout_1", reference_id: "p1", status: "processed" })
  assert.deepEqual(paid, ["p1"])
})

test("payout.failed settles failed", async () => {
  failed.length = 0; failedSettled = true
  await wh.handleRazorpayxEvent(svc() as any, "payout.failed", { id: "pout_1", reference_id: "p1", status: "failed" })
  assert.deepEqual(failed, ["p1"])
})

test("payout.reversed after paid alerts, does not re-settle", async () => {
  failed.length = 0; alerts.length = 0; failedSettled = false
  await wh.handleRazorpayxEvent(svc() as any, "payout.reversed", { id: "pout_1", reference_id: "p1", status: "reversed" })
  assert.ok(alerts.length >= 1, "ops alerted for manual clawback")
})

test("missing reference_id alerts, settles nothing", async () => {
  paid.length = 0; failed.length = 0; alerts.length = 0
  await wh.handleRazorpayxEvent(svc() as any, "payout.processed", { id: "pout_1", status: "processed" } as any)
  assert.equal(paid.length, 0)
  assert.ok(alerts.length >= 1)
})
