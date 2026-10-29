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

let col: typeof import("@/actions/content/collections")
before(async () => {
  col = await import("@/actions/content/collections")
})

// u1 is the caller; "victim-col" belongs to someone else.
function fake(over: (ctx: ResolveCtx) => any = () => undefined) {
  return makeFakeClient((ctx) => {
    const r = over(ctx)
    if (r !== undefined) return r
    if (ctx.table === "collections" && ctx.op === "select") {
      const curator = ctx.filters.find(([c]) => c === "curator_id")?.[1]
      // .eq("curator_id", u1) scoped lookups own nothing; single lookups show the real curator.
      return curator ? { data: [] } : { data: { curator_id: "someone-else" } }
    }
    if (ctx.table === "saves" && ctx.op === "select")
      return { data: [{ collection_id: "victim-col" }] }
    return { data: null, error: null }
  })
}

test("unsavePiece never touches another user's collection", async () => {
  currentFake = fake()
  await col.unsavePiece({ data: { content_object_id: "p1" } })
  const del = currentFake.calls.find((c) => c.table === "collection_items" && c.op === "delete")
  assert.equal(del, undefined, "must not delete items from a collection the caller doesn't curate")
})

test("unsavePiece removes the piece from the caller's own lists and surfaces errors", async () => {
  mock.method(console, "error", () => {})
  currentFake = fake((ctx) => {
    if (ctx.table === "collections" && ctx.op === "select") return { data: [{ id: "mine" }] }
    if (ctx.table === "collection_items" && ctx.op === "delete")
      return { error: { message: "boom" } }
  })
  await assert.rejects(col.unsavePiece({ data: { content_object_id: "p1" } }))
  assert.ok(currentFake.calls.find((c) => c.table === "collection_items" && c.op === "delete"))
})

test("unsavePiece surfaces a failed saves delete", async () => {
  mock.method(console, "error", () => {})
  currentFake = fake((ctx) => {
    if (ctx.table === "saves" && ctx.op === "delete") return { error: { message: "boom" } }
    if (ctx.table === "collections" && ctx.op === "select") return { data: [{ id: "mine" }] }
  })
  await assert.rejects(col.unsavePiece({ data: { content_object_id: "p1" } }))
  assert.equal(
    currentFake.calls.find((c) => c.table === "collection_items" && c.op === "delete"),
    undefined,
    "don't drop list items when the unsave itself failed"
  )
})

test("savePiece into someone else's collection writes nothing", async () => {
  currentFake = fake()
  await assert.rejects(
    col.savePiece({ data: { content_object_id: "p1", collection_id: "victim-col" } }),
    /Not authorized/
  )
  assert.equal(
    currentFake.calls.find((c) => c.table === "saves" && c.op === "insert"),
    undefined,
    "the saves row (later trusted by unsave) must not be written before the curator check"
  )
})
