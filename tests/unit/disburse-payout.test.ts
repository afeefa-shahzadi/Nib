/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, before, mock } from "node:test"
import assert from "node:assert/strict"
import { makeFakeClient, ResolveCtx } from "./fake-supabase"

let currentFake: ReturnType<typeof makeFakeClient>
mock.module("@/lib/supabase/server", {
  namedExports: {
    createAdminClient: async () => currentFake,
    createClient: async () => currentFake,
    createServiceRoleClient: async () => currentFake,
  },
})
mock.module("@/lib/email", {
  namedExports: { sendEmail: async () => ({ ok: true }) },
})

// user_roles must contain admin for requireAdmin.
function adminFake(resolve: (c: ResolveCtx) => any) {
  return makeFakeClient((ctx: ResolveCtx) => {
    if (ctx.table === "user_roles") return { data: [{ role: "admin" }] }
    return resolve(ctx)
  }, "admin1")
}

let created: any[] = []
let rzxOn = true
mock.module("@/lib/razorpayx/client", {
  namedExports: {
    razorpayxConfigured: () => rzxOn,
    payoutModeFor: (t: string) => (t === "vpa" ? "UPI" : "IMPS"),
    createContact: async () => { created.push("contact"); return { id: "cont_1" } },
    createFundAccount: async () => { created.push("fund"); return { id: "fa_1" } },
    createPayout: async (a: any) => { created.push(a); return { id: "pout_1", status: "processing" } },
  },
})

let adm: typeof import("@/actions/admin/payouts")
before(async () => {
  adm = await import("@/actions/admin/payouts")
})

test("disbursePayout refuses when RazorpayX unconfigured", async () => {
  rzxOn = false
  currentFake = adminFake(() => ({ data: null }))
  const r = await adm.disbursePayout({ data: { id: "p1" } })
  assert.equal(r.success, false)
  assert.match(r.error!, /not configured/i)
  rzxOn = true
})

test("disbursePayout creates beneficiary, calls payout with idempotency key, sets processing", async () => {
  created = []
  currentFake = adminFake(({ table, op }: ResolveCtx): any => {
    if (table === "payout_requests" && op === "select")
      return { data: { id: "p1", user_id: "u1", amount_paise: 50000, status: "requested", payout_method_id: "pm1" } }
    if (table === "payout_methods" && op === "select")
      return { data: { id: "pm1", method_type: "vpa", vpa: "alice@okhdfc", account_name: null, ifsc: null, account_number: null, pan: "enc:v1:x", razorpayx_contact_id: null, razorpayx_fund_account_id: null } }
    if (table === "payout_requests" && op === "update") return { data: { id: "p1" } }
    return { data: null, error: null }
  })
  const r = await adm.disbursePayout({ data: { id: "p1" } })
  assert.equal(r.success, true)
  const payoutCall = created.find((c) => c && c.idempotencyKey)
  assert.equal(payoutCall.idempotencyKey, "p1", "idempotency key = request id")
  const upd = currentFake.calls.find(
    (c) => c.table === "payout_requests" && c.op === "update"
  ) as any
  assert.equal(upd.vals.status, "processing")
  assert.equal(upd.vals.reference, "pout_1")
})

test("disbursePayout sends NET (gross minus 1% TDS and the transfer fee) and records processed_by", async () => {
  created = []
  currentFake = adminFake(({ table, op }: ResolveCtx): any => {
    if (table === "payout_requests" && op === "select")
      return { data: { id: "p1", user_id: "u1", amount_paise: 50000, status: "requested", payout_method_id: "pm1" } }
    if (table === "payout_methods" && op === "select")
      return { data: { id: "pm1", method_type: "vpa", vpa: "alice@okhdfc", account_name: null, ifsc: null, account_number: null, pan: "enc:v1:x", razorpayx_contact_id: "cont_1", razorpayx_fund_account_id: "fa_1" } }
    if (table === "payout_requests" && op === "update") return { data: { id: "p1" } }
    return { data: null, error: null }
  })
  await adm.disbursePayout({ data: { id: "p1" } })
  const payoutCall = created.find((c) => c && c.idempotencyKey)
  assert.equal(payoutCall.amountPaise, 48910, "RazorpayX receives net (50000 - 1% TDS - ₹5.90 transfer fee)")
  const upd = currentFake.calls.find(
    (c) => c.table === "payout_requests" && c.op === "update"
  ) as any
  assert.equal(upd.vals.processed_by, "admin1", "disbursing admin recorded for audit")
})

test("disbursePayout skips beneficiary creation when ids are cached", async () => {
  created = []
  currentFake = adminFake(({ table, op }: ResolveCtx): any => {
    if (table === "payout_requests" && op === "select")
      return { data: { id: "p1", user_id: "u1", amount_paise: 50000, status: "requested", payout_method_id: "pm1" } }
    if (table === "payout_methods" && op === "select")
      return { data: { id: "pm1", method_type: "vpa", vpa: "a@b", pan: "enc:v1:x", razorpayx_contact_id: "cont_1", razorpayx_fund_account_id: "fa_1" } }
    if (table === "payout_requests" && op === "update") return { data: { id: "p1" } }
    return { data: null, error: null }
  })
  await adm.disbursePayout({ data: { id: "p1" } })
  assert.equal(created.includes("contact"), false, "no contact re-created")
  assert.equal(created.includes("fund"), false, "no fund_account re-created")
})
