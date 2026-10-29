/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, before, mock } from "node:test"
import assert from "node:assert/strict"
import { makeFakeClient, ResolveCtx } from "./fake-supabase"
import {
  restrictionForStrike,
  getRestriction,
  assertNotRestricted,
  applyStrike,
  WARN_LIMIT,
} from "@/lib/restrictions"

// moderation + restriction server actions build admin clients via
// createAdminClient(); intercept the factory so they run against our fake.
let currentFake: ReturnType<typeof makeFakeClient>
mock.module("@/lib/supabase/server", {
  namedExports: {
    createAdminClient: async () => currentFake,
    createClient: async () => currentFake,
    createServiceRoleClient: async () => currentFake,
  },
})

let moderation: typeof import("@/actions/moderation")
let restrictions: typeof import("@/actions/restrictions")
before(async () => {
  moderation = await import("@/actions/moderation")
  restrictions = await import("@/actions/restrictions")
})

const DAY = 24 * 60 * 60 * 1000

// ---------- restrictionForStrike: the ladder (pure) ----------

test("restrictionForStrike: first WARN_LIMIT strikes are warnings (no freeze)", () => {
  const now = new Date("2026-01-01T00:00:00.000Z")
  for (let n = 1; n <= WARN_LIMIT; n++)
    assert.equal(restrictionForStrike(n, now).until, null, `strike ${n} is a warning`)
})

test("restrictionForStrike: escalates 7d, 30d, then permanent ban", () => {
  const now = new Date("2026-01-01T00:00:00.000Z")
  assert.equal(
    restrictionForStrike(WARN_LIMIT + 1, now).until,
    new Date(now.getTime() + 7 * DAY).toISOString()
  )
  assert.equal(
    restrictionForStrike(WARN_LIMIT + 2, now).until,
    new Date(now.getTime() + 30 * DAY).toISOString()
  )
  assert.equal(restrictionForStrike(WARN_LIMIT + 3, now).until, "infinity")
  assert.equal(restrictionForStrike(99, now).until, "infinity")
})

// ---------- getRestriction / assertNotRestricted ----------

function profileFake(restricted_until: string | null, restricted_reason: string | null = "bad") {
  return makeFakeClient(({ table }: ResolveCtx): any => {
    if (table === "profiles") return { data: { restricted_until, restricted_reason } }
    return { data: [] }
  })
}

test("getRestriction: future timestamp = temporary restriction", async () => {
  const until = new Date(Date.now() + 7 * DAY).toISOString()
  const r = await getRestriction(profileFake(until) as any, "u1")
  assert.equal(r.restricted, true)
  assert.equal(r.permanent, false)
  assert.equal(r.reason, "bad")
})

test("getRestriction: past timestamp = not restricted, reason hidden", async () => {
  const until = new Date(Date.now() - DAY).toISOString()
  const r = await getRestriction(profileFake(until) as any, "u1")
  assert.equal(r.restricted, false)
  assert.equal(r.reason, null)
})

test("getRestriction: 'infinity' = permanent ban", async () => {
  const r = await getRestriction(profileFake("infinity") as any, "u1")
  assert.equal(r.restricted, true)
  assert.equal(r.permanent, true)
})

test("getRestriction: null = clear", async () => {
  const r = await getRestriction(profileFake(null) as any, "u1")
  assert.equal(r.restricted, false)
})

test("assertNotRestricted: throws while restricted, passes when clear", async () => {
  const future = new Date(Date.now() + DAY).toISOString()
  await assert.rejects(
    () => assertNotRestricted(profileFake(future) as any, "u1", "publish"),
    /restricted/i
  )
  await assert.rejects(
    () => assertNotRestricted(profileFake("infinity") as any, "u1", "payout"),
    /restricted/i
  )
  // null profile -> not restricted -> resolves
  await assertNotRestricted(profileFake(null) as any, "u1", "publish")
})

// ---------- applyStrike ----------

// resolve strikes on select; capture the update in .calls.
function strikeFake(currentStrikes: number) {
  return makeFakeClient(({ table, op }: ResolveCtx): any => {
    if (table === "profiles" && op === "select") return { data: { strikes: currentStrikes } }
    return { data: null }
  })
}

test("applyStrike: a warning increments strikes and sets no freeze", async () => {
  const fake = strikeFake(0)
  const r = await applyStrike(fake as any, { authorId: "a1", moderatorId: "m1" })
  assert.equal(r.strikes, 1)
  assert.equal(r.until, null)
  const upd = fake.calls.find((c) => c.table === "profiles" && c.op === "update") as any
  assert.equal(upd.vals.strikes, 1)
  assert.equal(upd.vals.restricted_until, null)
})

test("applyStrike: the 4th strike freezes the account", async () => {
  const fake = strikeFake(WARN_LIMIT) // next = WARN_LIMIT + 1
  const r = await applyStrike(fake as any, { authorId: "a1", moderatorId: "m1" })
  assert.equal(r.strikes, WARN_LIMIT + 1)
  assert.ok(r.until && r.until !== "infinity", "temporary freeze timestamp")
  const upd = fake.calls.find((c) => c.table === "profiles" && c.op === "update") as any
  assert.ok(upd.vals.restricted_until, "restricted_until set")
})

// ---------- resolveAppeal (admin) ----------

// role = user_roles rows; appealRow = gated appeal update result.
function adminFake(role: string[], appealRow: any) {
  return makeFakeClient(({ table, op }: ResolveCtx): any => {
    if (table === "user_roles") return { data: role.map((r) => ({ role: r })) }
    if (table === "restriction_appeals" && op === "update") return { data: appealRow }
    if (table === "profiles" && op === "select") return { data: { strikes: 5 } }
    return { data: [], error: null }
  })
}

test("resolveAppeal: non-admin rejected", async () => {
  currentFake = adminFake([], { user_id: "u1" })
  await assert.rejects(
    () => moderation.resolveAppeal({ data: { id: "ap1", decision: "lift" } }),
    /Unauthorized/
  )
})

test("resolveAppeal: lift clears the restriction and resets strikes", async () => {
  currentFake = adminFake(["admin"], { user_id: "u1" })
  const r = await moderation.resolveAppeal({ data: { id: "ap1", decision: "lift" } })
  assert.deepEqual(r, { success: true })
  const upd = currentFake.calls.find(
    (c) => c.table === "profiles" && c.op === "update"
  ) as any
  assert.equal(upd.vals.restricted_until, null)
  assert.equal(upd.vals.strikes, 0)
})

test("resolveAppeal: deny leaves the restriction (no profile update)", async () => {
  currentFake = adminFake(["admin"], { user_id: "u1" })
  await moderation.resolveAppeal({ data: { id: "ap1", decision: "deny" } })
  const profileUpdate = currentFake.calls.find(
    (c) => c.table === "profiles" && c.op === "update"
  )
  assert.equal(profileUpdate, undefined, "deny must not clear the restriction")
})

test("resolveAppeal: already-resolved appeal rejected", async () => {
  currentFake = adminFake(["admin"], null) // gated update matched nothing
  await assert.rejects(
    () => moderation.resolveAppeal({ data: { id: "ap1", decision: "lift" } }),
    /already resolved/
  )
})

// ---------- submitAppeal (creator) ----------

// restriction_until drives restricted state; pending = an existing open appeal.
function appealFake(restricted_until: string | null, pending: any) {
  return makeFakeClient(({ table, op }: ResolveCtx): any => {
    if (table === "profiles") return { data: { restricted_until, restricted_reason: "bad" } }
    if (table === "restriction_appeals" && op === "select") return { data: pending }
    return { data: null, error: null }
  })
}

test("submitAppeal: rejected when not restricted", async () => {
  currentFake = appealFake(null, null)
  await assert.rejects(
    () => restrictions.submitAppeal({ data: { reason: "please" } }),
    /no active restriction/
  )
})

test("submitAppeal: rejected when a pending appeal already exists", async () => {
  currentFake = appealFake("infinity", { id: "existing" })
  await assert.rejects(
    () => restrictions.submitAppeal({ data: { reason: "please" } }),
    /already under review/
  )
})

test("submitAppeal: inserts one row when restricted and no open appeal", async () => {
  const future = new Date(Date.now() + DAY).toISOString()
  currentFake = appealFake(future, null)
  const r = await restrictions.submitAppeal({ data: { reason: "  I fixed it  " } })
  assert.deepEqual(r, { success: true })
  const ins = currentFake.calls.filter(
    (c) => c.table === "restriction_appeals" && c.op === "insert"
  ) as any[]
  assert.equal(ins.length, 1)
  assert.equal(ins[0].rows.reason, "I fixed it", "reason trimmed")
  assert.equal(ins[0].rows.user_id, "u1")
})

test("submitAppeal: rejects an empty reason", async () => {
  const future = new Date(Date.now() + DAY).toISOString()
  currentFake = appealFake(future, null)
  await assert.rejects(
    () => restrictions.submitAppeal({ data: { reason: "   " } }),
    /explanation/
  )
})
