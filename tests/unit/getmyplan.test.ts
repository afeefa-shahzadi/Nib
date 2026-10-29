/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, before, beforeEach, mock } from "node:test"
import assert from "node:assert/strict"
import { makeFakeClient, ResolveCtx } from "./fake-supabase"

let currentFake: ReturnType<typeof makeFakeClient>
let tablesQueried: string[] = []

mock.module("@/lib/supabase/server", {
  namedExports: {
    createAdminClient: async () => currentFake,
    createClient: async () => currentFake,
    createServiceRoleClient: async () => currentFake,
  },
})

// Track every table a SELECT touches so we can assert the broken
// studio_subscriptions read is gone.
function fakeFor(resolve: (c: ResolveCtx) => any, userId = "u1") {
  return makeFakeClient((ctx: ResolveCtx) => {
    if (ctx.op === "select") tablesQueried.push(ctx.table)
    return resolve(ctx)
  }, userId)
}

let subs: typeof import("@/actions/subscriptions")
before(async () => {
  subs = await import("@/actions/subscriptions")
})
beforeEach(() => {
  tablesQueried = []
  process.env.LAUNCH_FREE = "0"
})

test("getMyPlan grants studio from live credit without reading studio_subscriptions", async () => {
  const future = new Date(Date.now() + 86_400_000).toISOString()
  currentFake = fakeFor((ctx): any => {
    if (ctx.table === "profiles" && ctx.op === "select")
      return { data: { plan: "studio", studio_credit_until: future } }
    if (ctx.table === "reader_subscriptions") return { data: null }
    return { data: null }
  })
  const res = await subs.getMyPlan()
  assert.equal(res.plan, "studio")
  assert.equal(
    tablesQueried.includes("studio_subscriptions"),
    false,
    "studio_subscriptions must no longer be queried (it is the tier table, wrong shape)"
  )
  const downgrade = currentFake.calls.find(
    (c) => c.table === "profiles" && c.op === "update"
  )
  assert.equal(downgrade, undefined, "a credited studio user must not be downgraded")
})

test("getMyPlan lazily downgrades a studio profile whose credit has lapsed", async () => {
  currentFake = fakeFor((ctx): any => {
    if (ctx.table === "profiles" && ctx.op === "select")
      return { data: { plan: "studio", studio_credit_until: null } }
    return { data: null }
  })
  const res = await subs.getMyPlan()
  assert.equal(res.plan, "free")
  const downgrade = currentFake.calls.find(
    (c) => c.table === "profiles" && c.op === "update"
  ) as any
  assert.ok(downgrade, "lapsed studio profile should be persisted as free")
  assert.equal(downgrade.vals.plan, "free")
})

test("getMyPlan leaves a free profile free and writes nothing", async () => {
  currentFake = fakeFor((ctx): any => {
    if (ctx.table === "profiles" && ctx.op === "select")
      return { data: { plan: "free", studio_credit_until: null } }
    return { data: null }
  })
  const res = await subs.getMyPlan()
  assert.equal(res.plan, "free")
  assert.equal(
    currentFake.calls.find((c) => c.op === "update"),
    undefined,
    "no write on a plain free read"
  )
})

test("getMyPlan returns org with no writes under launch", async () => {
  process.env.LAUNCH_FREE = "1"
  currentFake = fakeFor((ctx): any => {
    if (ctx.table === "profiles" && ctx.op === "select")
      return { data: { plan: "studio", studio_credit_until: null } }
    return { data: null }
  })
  const res = await subs.getMyPlan()
  assert.equal(res.plan, "org")
  assert.equal(res.launchFree, true)
  assert.equal(currentFake.calls.find((c) => c.op === "update"), undefined)
})
