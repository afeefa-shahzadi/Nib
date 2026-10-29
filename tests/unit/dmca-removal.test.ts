/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, before, mock } from "node:test"
import assert from "node:assert/strict"
import { makeFakeClient, ResolveCtx } from "./fake-supabase"

// #6: a DMCA-disabled piece must render a transparency surface ("removed
// following a copyright claim") instead of a 404, and hand the author a
// counter-notice link. getPieceBySlug signals this via restricted:"dmca".
let currentFake: ReturnType<typeof makeFakeClient>
mock.module("@/lib/supabase/server", {
  namedExports: {
    createAdminClient: async () => currentFake,
    createClient: async () => currentFake,
    createServiceRoleClient: async () => currentFake,
  },
})

let pub: typeof import("@/actions/content/pieces/public")
before(async () => {
  pub = await import("@/actions/content/pieces/public")
})

function statusOf(filters: [string, any][]) {
  return filters.find((f) => f[0] === "status")?.[1]
}

test("getPieceBySlug: DMCA-disabled piece -> restricted:'dmca' with counter link, owner flagged", async () => {
  currentFake = makeFakeClient(({ table, op, filters }: ResolveCtx): any => {
    if (table === "content_objects" && op === "select") {
      const s = statusOf(filters)
      if (s === "published") return { data: null } // hidden from the public read
      if (s === "archived") return { data: { id: "c1", author_id: "a1", status: "archived" } }
    }
    if (table === "dmca_notices" && op === "select") return { data: { id: "n1" } }
    return { data: null, error: null }
  }, "a1")
  const res: any = await pub.getPieceBySlug({ data: { slug: "the-shape" } })
  assert.equal(res.restricted, "dmca")
  assert.equal(res.noticeId, "n1")
  assert.equal(res.isOwner, true, "viewer a1 is the author")
})

test("getPieceBySlug: archived with NO actioned DMCA notice -> not a DMCA surface", async () => {
  currentFake = makeFakeClient(({ table, op, filters }: ResolveCtx): any => {
    if (table === "content_objects" && op === "select") {
      const s = statusOf(filters)
      if (s === "published") return { data: null }
      if (s === "archived") return { data: { id: "c1", author_id: "a1", status: "archived" } }
    }
    if (table === "dmca_notices" && op === "select") return { data: null } // no DMCA claim
    return { data: null, error: null }
  }, "someone-else")
  const res: any = await pub.getPieceBySlug({ data: { slug: "the-shape" } })
  // Falls through to the existing owner/404 handling, never restricted:"dmca".
  assert.notEqual(res?.restricted, "dmca")
})
