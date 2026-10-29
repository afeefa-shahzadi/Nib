/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, before, mock } from "node:test"
import assert from "node:assert/strict"
import { makeFakeClient, ResolveCtx } from "./fake-supabase"

// settlePayout builds its admin client via createAdminClient(); intercept the
// factory so requireAdmin + the update run against our fake (no creds, no
// network). The email notify path calls auth.admin.getUserById, which the fake
// lacks — settlePayout swallows that (best-effort), so no mail is sent here.
let currentFake: ReturnType<typeof makeFakeClient>
mock.module("@/lib/supabase/server", {
  namedExports: {
    createAdminClient: async () => currentFake,
    createClient: async () => currentFake,
    createServiceRoleClient: async () => currentFake,
  },
})

let admin: typeof import("@/actions/admin/payouts")
before(async () => {
  admin = await import("@/actions/admin/payouts")
})

// role = the user_roles rows requireAdmin sees; row = what the gated update resolves to.
function fake(role: string[], row: any) {
  return makeFakeClient(({ table, op }: ResolveCtx): any => {
    if (table === "user_roles") return { data: role.map((r) => ({ role: r })) }
    if (table === "payout_requests" && op === "update") return { data: row }
    return { data: [], error: null }
  })
}

const OPEN_ROW = { user_id: "u1", amount_paise: 40_000, status: "paid" }

test("settlePayout: non-admin is rejected and writes nothing", async () => {
  currentFake = fake([], OPEN_ROW)
  await assert.rejects(
    () => admin.settlePayout({ data: { id: "p1", status: "paid", reference: "UTR1" } }),
    /Unauthorized/
  )
  assert.equal(
    currentFake.calls.filter((c) => c.table === "payout_requests").length,
    0,
    "no update attempted for a non-admin"
  )
})

test("settlePayout: marking paid requires a reference", async () => {
  currentFake = fake(["admin"], OPEN_ROW)
  await assert.rejects(
    () => admin.settlePayout({ data: { id: "p1", status: "paid" } }),
    /reference/
  )
})

test("settlePayout: paid stamps status, trimmed reference, and processed_by", async () => {
  currentFake = fake(["admin"], OPEN_ROW)
  const r = await admin.settlePayout({
    data: { id: "p1", status: "paid", reference: "  UTR-123  " },
  })
  assert.deepEqual(r, { success: true })
  const upd = currentFake.calls.find(
    (c) => c.table === "payout_requests" && c.op === "update"
  ) as any
  assert.equal(upd.vals.status, "paid")
  assert.equal(upd.vals.reference, "UTR-123", "reference trimmed")
  assert.equal(upd.vals.failure_reason, null)
  assert.equal(upd.vals.processed_by, "u1")
  assert.ok(upd.vals.processed_at, "processed_at stamped")
})

test("settlePayout: paid withholds 1% TDS and records the split (Guard C)", async () => {
  currentFake = fake(["admin"], OPEN_ROW) // gross 40_000
  await admin.settlePayout({
    data: { id: "p1", status: "paid", reference: "UTR-9" },
  })
  const tds = currentFake.calls.find(
    (c) => c.table === "tds_withholdings" && c.op === "insert"
  ) as any
  assert.ok(tds, "a TDS row is recorded on paid")
  assert.equal(tds.rows.gross_paise, 40_000)
  assert.equal(tds.rows.tds_paise, 400) // 1%
  assert.equal(tds.rows.net_paise, 39_600) // creator receives net
  assert.equal(tds.rows.payout_id, "p1")
  assert.equal(tds.rows.user_id, "u1")
  assert.ok(tds.rows.quarter, "FY quarter stamped")
})

test("settlePayout: failed withholds no TDS", async () => {
  currentFake = fake(["admin"], { ...OPEN_ROW, status: "failed" })
  await admin.settlePayout({
    data: { id: "p1", status: "failed", failureReason: "bad VPA" },
  })
  assert.equal(
    currentFake.calls.filter((c) => c.table === "tds_withholdings").length,
    0,
    "no TDS on a failed payout — funds returned, nothing withheld"
  )
})

test("settlePayout: failed stores the reason and clears reference", async () => {
  currentFake = fake(["admin"], { ...OPEN_ROW, status: "failed" })
  await admin.settlePayout({
    data: { id: "p1", status: "failed", failureReason: "bad VPA" },
  })
  const upd = currentFake.calls.find(
    (c) => c.table === "payout_requests" && c.op === "update"
  ) as any
  assert.equal(upd.vals.status, "failed")
  assert.equal(upd.vals.reference, null)
  assert.equal(upd.vals.failure_reason, "bad VPA")
})

test("settlePayout: an already-settled row (no open match) is rejected", async () => {
  currentFake = fake(["admin"], null) // gated update matched nothing
  await assert.rejects(
    () => admin.settlePayout({ data: { id: "p1", status: "paid", reference: "UTR1" } }),
    /already settled/
  )
})
