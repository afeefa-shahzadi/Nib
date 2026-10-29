/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, before, mock } from "node:test"
import assert from "node:assert/strict"
import { makeFakeClient } from "./fake-supabase"

let fake: ReturnType<typeof makeFakeClient>
let role = "reader"

mock.module("@/lib/supabase/server", {
  namedExports: {
    createAdminClient: async () => fake,
    createClient: async () => fake,
    createServiceRoleClient: async () => fake,
  },
})
mock.module("@/actions/content/profile", {
  namedExports: { getMyRole: async () => ({ primary: role }) },
})

let limited = false
const limitCalls: string[] = []
mock.module("@/lib/rate-limit.server", {
  namedExports: {
    checkRateLimit: async (bucket: string, id: string) => {
      limitCalls.push(`${bucket}:${id}`)
      return { ok: !limited, remaining: 0, resetAt: new Date() }
    },
  },
})
mock.module("next/headers", {
  namedExports: { headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }) },
})

let wl: typeof import("@/actions/waitlist")
before(async () => {
  wl = await import("@/actions/waitlist")
})

const upserts = () => fake.calls.filter((c) => c.op === "upsert") as any[]

test("joinWaitlist stores signed-in user's email", async () => {
  fake = makeFakeClient(() => ({ error: null }), "u1", "a@b.co")
  const r = await wl.joinWaitlist({ data: { item: "studio", email: "other@x.y" } })
  assert.deepEqual(r, { ok: true })
  const row = upserts()[0].rows
  assert.equal(row.email, "a@b.co")
  assert.equal(row.user_id, "u1")
  assert.equal(row.item, "studio")
})

test("joinWaitlist normalises anon email", async () => {
  fake = makeFakeClient(() => ({ error: null }), null)
  await wl.joinWaitlist({ data: { item: "tip", email: "  A@B.Co " } })
  const row = upserts()[0].rows
  assert.equal(row.email, "a@b.co")
  assert.equal(row.user_id, null)
})

test("joinWaitlist rejects unknown item", async () => {
  fake = makeFakeClient(() => ({ error: null }), null)
  const r: any = await wl.joinWaitlist({ data: { item: "boost" as any, email: "a@b.co" } })
  assert.deepEqual(r, { error: "Unknown waitlist item" })
  assert.equal(upserts().length, 0)
})

test("joinWaitlist rejects bad email", async () => {
  fake = makeFakeClient(() => ({ error: null }), null)
  for (const email of ["", "nope", "a@b"]) {
    const r = await wl.joinWaitlist({ data: { item: "studio", email } })
    assert.deepEqual(r, { error: "Enter a valid email" })
  }
  assert.equal(upserts().length, 0)
})

test("joinWaitlist duplicate is success", async () => {
  fake = makeFakeClient(() => ({ error: null }), null)
  const r = await wl.joinWaitlist({ data: { item: "org", email: "a@b.co" } })
  assert.deepEqual(r, { ok: true })
  assert.deepEqual(upserts()[0].opts, { onConflict: "email,item", ignoreDuplicates: true })
})

test("joinWaitlist db error", async () => {
  fake = makeFakeClient(() => ({ error: { message: "x" } }), null)
  const r = await wl.joinWaitlist({ data: { item: "org", email: "a@b.co" } })
  assert.deepEqual(r, { error: "Could not join the waitlist" })
})

test("joinWaitlist guards non-string / oversized input", async () => {
  fake = makeFakeClient(() => ({ error: null }), null)
  for (const email of [123 as any, "a".repeat(250) + "@b.co"]) {
    const r = await wl.joinWaitlist({ data: { item: "studio", email } })
    assert.deepEqual(r, { error: "Enter a valid email" })
  }
  assert.equal(upserts().length, 0)
  await wl.joinWaitlist({ data: { item: "studio", email: "a@b.co", source: "s".repeat(100) } })
  assert.equal(upserts()[0].rows.source.length, 64)
  await wl.joinWaitlist({ data: { item: "studio", email: "c@b.co", source: 5 as any } })
  assert.equal(upserts()[1].rows.source, null)
})

test("listWaitlist non-admin gets empty and queries nothing", async () => {
  role = "reader"
  let queried = 0
  fake = makeFakeClient(() => {
    queried++
    return { data: [] }
  })
  assert.deepEqual(await wl.listWaitlist(), [])
  assert.equal(queried, 0)
})

test("listWaitlist admin: count from count response, recent capped", async () => {
  role = "admin"
  const recent = Array.from({ length: 10 }, (_, i) => ({ email: `e${i}@x.y`, created_at: `t${i}` }))
  fake = makeFakeClient((ctx: any) => {
    const item = ctx.filters.find((f: any) => f[0] === "item")?.[1]
    if (item !== "studio") return { data: [], count: 0 }
    return { data: recent, count: 1500 } // same resolver for head count and recent query
  })
  const r = await wl.listWaitlist()
  assert.equal(r.length, 1)
  assert.equal(r[0].item, "studio")
  assert.equal(r[0].count, 1500)
  assert.equal(r[0].recent.length, 10)
})

test("listWaitlist admin: query error throws", async () => {
  role = "admin"
  fake = makeFakeClient(() => ({ error: { message: "boom" } }))
  await assert.rejects(() => wl.listWaitlist())
})

test("joinWaitlist throttles anon callers per IP and writes nothing when limited", async () => {
  fake = makeFakeClient(() => ({ error: null }), null)
  limited = true
  limitCalls.length = 0
  const r = await wl.joinWaitlist({ data: { item: "studio", email: "a@b.co" } })
  limited = false
  assert.deepEqual(r, { error: "Too many requests. Try again later." })
  assert.deepEqual(limitCalls, ["waitlist:203.0.113.7"])
  assert.equal(upserts().length, 0)
})
