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
mock.module("@/lib/rate-limit.server", {
  namedExports: {
    checkRateLimit: async () => ({ ok: true, remaining: 9, resetAt: new Date() }),
  },
})
// Real lib/crypto with no key would pass plaintext through, defeating the
// encryption assertion. Force a key so the enc:v1: prefix is produced.
process.env.BYOK_ENCRYPTION_KEY =
  "45db38c4fa670bf1abdd26c4a8f75d234c236e0415ed149b4e14a231b04e79db"

let pm: typeof import("@/actions/monetization/payout-methods")
before(async () => {
  pm = await import("@/actions/monetization/payout-methods")
})

test("addPayoutMethod encrypts account_number and pan before insert", async () => {
  currentFake = makeFakeClient((): any => ({ data: null, error: null }))
  const r = await pm.addPayoutMethod({
    data: {
      method_type: "bank_account", account_name: "Alice",
      account_number: "12345678901", ifsc: "HDFC0001234", pan: "ABCDE1234F",
    },
  })
  assert.equal(r.success, true)
  const ins = currentFake.calls.find(
    (c) => c.table === "payout_methods" && c.op === "insert"
  ) as any
  assert.ok(ins.rows.account_number.startsWith("enc:v1:"), "account_number encrypted")
  assert.ok(ins.rows.pan.startsWith("enc:v1:"), "pan encrypted")
  assert.equal(ins.rows.ifsc, "HDFC0001234", "ifsc plain")
})

test("addPayoutMethod rejects invalid input, no insert", async () => {
  currentFake = makeFakeClient((): any => ({ data: null }))
  const r = await pm.addPayoutMethod({
    data: { method_type: "vpa", vpa: "nope", pan: "ABCDE1234F" },
  })
  assert.equal(r.success, false)
  assert.equal(currentFake.calls.length, 0)
})

test("listMyPayoutMethods returns masked only, never raw", async () => {
  const { encryptSecret } = await import("@/lib/crypto")
  currentFake = makeFakeClient(({ table, op }: ResolveCtx): any => {
    if (table === "payout_methods" && op === "select")
      return {
        data: [
          {
            id: "pm1", method_type: "bank_account", account_name: "Alice",
            account_number: encryptSecret("12345678901"), ifsc: "HDFC0001234",
            vpa: null, pan: encryptSecret("ABCDE1234F"),
            status: "unverified", is_default: true,
          },
        ],
      }
    return { data: null }
  })
  const list = await pm.listMyPayoutMethods()
  assert.equal(list[0].pan_last4, "234F")
  assert.equal((list[0] as any).account_number, undefined, "no raw account_number leaked")
})

test("deletePayoutMethod blocked while an open payout references it", async () => {
  currentFake = makeFakeClient(({ table, op }: ResolveCtx): any => {
    if (table === "payout_requests" && op === "select")
      return { data: [{ id: "p1", status: "requested" }] }
    return { data: null }
  })
  const r = await pm.deletePayoutMethod({ data: { id: "pm1" } })
  assert.equal(r.success, false)
  assert.equal(currentFake.calls.find((c) => c.op === "delete"), undefined, "no delete issued")
})
