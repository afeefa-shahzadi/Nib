/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, before, beforeEach, afterEach, mock } from "node:test"
import assert from "node:assert/strict"
import { makeFakeClient, ResolveCtx } from "./fake-supabase"

let currentFake: ReturnType<typeof makeFakeClient>
let selects: string[] = []

mock.module("@/lib/supabase/server", {
  namedExports: {
    createAdminClient: async () => currentFake,
    createClient: async () => currentFake,
    createServiceRoleClient: async () => currentFake,
  },
})

const tierRoom = {
  id: "r1",
  is_public: false,
  access_mode: "tier",
  created_by: "someone-else",
  org_id: null,
  required_tier_id: "t1",
}
const orgRoom = { ...tierRoom, id: "r2", access_mode: "org", org_id: "o1", required_tier_id: null }

function fake() {
  return makeFakeClient((ctx: ResolveCtx): any => {
    selects.push(ctx.table)
    if (ctx.table === "debate_rooms") return { data: [tierRoom, orgRoom] }
    return { data: null } // no membership / purchase / org membership
  })
}

let helpers: typeof import("@/actions/content/helpers")
let debate: typeof import("@/actions/debate")
before(async () => {
  helpers = await import("@/actions/content/helpers")
  debate = await import("@/actions/debate")
})

const saved = process.env.LAUNCH_FREE
beforeEach(() => {
  delete process.env.LAUNCH_FREE
  selects = []
  currentFake = fake()
})
afterEach(() => {
  if (saved === undefined) delete process.env.LAUNCH_FREE
  else process.env.LAUNCH_FREE = saved
})

test("viewerHasAuthorAccess grants anon under launch without DB", async () => {
  assert.equal(await helpers.viewerHasAuthorAccess(null, "a1"), true)
  assert.deepEqual(selects, [])
})

test("viewerHasAuthorAccess blanks anon when off", async () => {
  process.env.LAUNCH_FREE = "0"
  assert.equal(await helpers.viewerHasAuthorAccess(null, "a1"), false)
})

test("viewerHasAuthorAccess author always", async () => {
  process.env.LAUNCH_FREE = "0"
  assert.equal(await helpers.viewerHasAuthorAccess("a1", "a1"), true)
})

test("viewerHasAuthorAccess non-member when off", async () => {
  process.env.LAUNCH_FREE = "0"
  assert.equal(await helpers.viewerHasAuthorAccess("u1", "a1"), false)
})

test("tier debate room visible without membership under launch; org room stays private", async () => {
  const rooms: any[] = await debate.listRoomsForPiece({ data: { content_object_id: "c1" } })
  assert.deepEqual(rooms.map((r) => r.id), ["r1"])
})

test("tier debate room hidden without membership when off", async () => {
  process.env.LAUNCH_FREE = "0"
  const rooms: any[] = await debate.listRoomsForPiece({ data: { content_object_id: "c1" } })
  assert.deepEqual(rooms, [])
})

function fakeWith(rows: Record<string, (f: [string, any][]) => any>) {
  return makeFakeClient((ctx: ResolveCtx): any => {
    selects.push(ctx.table)
    const r = rows[ctx.table]
    return { data: r ? r(ctx.filters) : null }
  })
}

test("piece purchase unlocks only that piece", async () => {
  process.env.LAUNCH_FREE = "0"
  currentFake = fakeWith({
    purchases: (f) =>
      f.some(([c, v]) => c === "content_object_id" && v === "p1") ? [{ id: "x" }] : [],
  })
  assert.equal(await helpers.viewerHasAuthorAccess("u1", "a1", "p1"), true)
  assert.equal(await helpers.viewerHasAuthorAccess("u1", "a1", "p2"), false)
})

test("a purchase never grants author-wide access", async () => {
  process.env.LAUNCH_FREE = "0"
  currentFake = fakeWith({ purchases: () => [{ id: "x" }] })
  assert.equal(await helpers.viewerHasAuthorAccess("u1", "a1"), false)
})

test("active membership unlocks every piece", async () => {
  process.env.LAUNCH_FREE = "0"
  currentFake = fakeWith({ memberships: () => [{ id: "m" }] })
  assert.equal(await helpers.viewerHasAuthorAccess("u1", "a1", "p9"), true)
})
