/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, before, beforeEach, afterEach, mock } from "node:test"
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
// createOrg writes through a raw supabase-js service client.
mock.module("@supabase/supabase-js", {
  namedExports: { createClient: () => currentFake },
})
mock.module("next/cache", {
  namedExports: { revalidatePath: () => {}, unstable_noStore: () => {}, updateTag: () => {} },
})

function fakeWith(profile: any) {
  return makeFakeClient((ctx: ResolveCtx): any => {
    if (ctx.table === "profiles" && ctx.op === "select") return { data: profile }
    if (ctx.table === "workspace_members") return { data: { workspace_id: "w1" } }
    if (ctx.op === "insert") return { data: { id: "new1" } }
    return { data: null }
  })
}

let tiers: typeof import("@/actions/content/tiers")
let bundles: typeof import("@/actions/content/bundles")
let orgs: typeof import("@/actions/orgs")
let limits: typeof import("@/lib/ai-limits")
let quests: typeof import("@/actions/monetization/quests")
before(async () => {
  tiers = await import("@/actions/content/tiers")
  bundles = await import("@/actions/content/bundles")
  orgs = await import("@/actions/orgs")
  limits = await import("@/lib/ai-limits")
  quests = await import("@/actions/monetization/quests")
})

const saved = process.env.LAUNCH_FREE
const savedKill = process.env.AI_PLATFORM_FUNDED_OFF
beforeEach(() => {
  delete process.env.LAUNCH_FREE
  delete process.env.AI_PLATFORM_FUNDED_OFF
  currentFake = fakeWith({ plan: "free" })
})
afterEach(() => {
  if (saved === undefined) delete process.env.LAUNCH_FREE
  else process.env.LAUNCH_FREE = saved
  if (savedKill === undefined) delete process.env.AI_PLATFORM_FUNDED_OFF
  else process.env.AI_PLATFORM_FUNDED_OFF = savedKill
})

const tierData = { name: "T", price_cents: 500, perks: [] }
const bundleData = { title: "B", price_cents: 500, is_public: true }

test("createTier allowed for free profile under launch", async () => {
  await tiers.createTier({ data: tierData })
  assert.ok(currentFake.calls.some((c) => c.table === "membership_tiers" && c.op === "insert"))
})

test("createTier rejected for free profile when LAUNCH_FREE=0", async () => {
  process.env.LAUNCH_FREE = "0"
  await assert.rejects(tiers.createTier({ data: tierData }), /Studio or Organizations plan/)
})

test("createBundle allowed for free profile under launch", async () => {
  await bundles.createBundle({ data: bundleData })
  assert.ok(currentFake.calls.some((c) => c.table === "bundles" && c.op === "insert"))
})

test("createBundle rejected for free profile when LAUNCH_FREE=0", async () => {
  process.env.LAUNCH_FREE = "0"
  await assert.rejects(bundles.createBundle({ data: bundleData }), /Studio or Organizations plan/)
})

test("createOrg allowed for free profile under launch", async () => {
  await orgs.createOrg({ data: { name: "Acme" } })
  assert.ok(currentFake.calls.some((c) => c.table === "organizations" && c.op === "insert"))
})

test("createOrg rejected for free profile when LAUNCH_FREE=0", async () => {
  process.env.LAUNCH_FREE = "0"
  await assert.rejects(orgs.createOrg({ data: { name: "Acme" } }), /Organizations plan/)
})

test("aiPlanForLimit caps launch users at studio", () => {
  const lim = (p: string) => limits.aiDailyTokenLimit(limits.aiPlanForLimit(p))
  assert.equal(lim("free"), 250_000)
  assert.equal(lim("org"), 250_000)
  process.env.LAUNCH_FREE = "0"
  assert.equal(lim("free"), 50_000)
  assert.equal(lim("org"), 1_000_000)
})

test("consumeListeningCredit is free under launch", async () => {
  currentFake = fakeWith({ credits: 0, disability_visual: false })
  const res: any = await quests.consumeListeningCredit()
  assert.equal(res.success, true)
  assert.equal(currentFake.calls.some((c) => c.table === "profiles" && c.op === "update"), false)
})
