/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, before, beforeEach, mock } from "node:test"
import assert from "node:assert/strict"
import { makeFakeClient } from "./fake-supabase"

// Every server action that would start a real money movement must refuse while
// the free launch is on, before touching the database or Razorpay.
let fake: ReturnType<typeof makeFakeClient>
mock.module("@/lib/supabase/server", {
  namedExports: {
    createAdminClient: async () => fake,
    createClient: async () => fake,
    createServiceRoleClient: async () => fake,
  },
})

let payments: typeof import("@/actions/payments")
let monetization: typeof import("@/actions/monetization/payments")
let subs: typeof import("@/actions/subscriptions")
before(async () => {
  payments = await import("@/actions/payments")
  monetization = await import("@/actions/monetization/payments")
  subs = await import("@/actions/subscriptions")
})
beforeEach(() => {
  delete process.env.LAUNCH_FREE
  fake = makeFakeClient(() => ({ data: null, error: null }), "u1", "u1@x.test")
})

const cases: [string, () => Promise<unknown>][] = [
  ["createRazorpayOrder", () => payments.createRazorpayOrder({ data: { type: "tip", amountPaise: 5000, authorId: "a1" } })],
  ["verifyRazorpayPayment", () => payments.verifyRazorpayPayment({ data: {} })],
  ["createRazorpaySubscription", () => (payments.createRazorpaySubscription as any)({ data: {} })],
  ["createSponsorshipOrder", () => monetization.createSponsorshipOrder({ data: {} })],
  ["verifySponsorshipPayment", () => monetization.verifySponsorshipPayment({ data: {} })],
  ["requestPayout", () => monetization.requestPayout({ data: { amountPaise: 50000 } })],
  ["redeemStudioFromEarnings", () => monetization.redeemStudioFromEarnings()],
  ["createStudioSubscription", () => subs.createStudioSubscription({ data: {} })],
  ["createReaderPassSubscription", () => subs.createReaderPassSubscription({ data: {} })],
  ["createOrgSubscription", () => subs.createOrgSubscription({ data: {} })],
]

for (const [name, call] of cases) {
  test(`${name} refuses during the free launch and touches nothing`, async () => {
    await assert.rejects(call, /Payments are paused during the free launch/)
    assert.equal(fake.calls.filter((c: any) => c.op !== "getUser").length, 0, "no DB calls")
  })
}
