/* eslint-disable @typescript-eslint/no-explicit-any */
// Piece leaderboard: public, published pieces ranked by reader engagement.
import { test, before, mock } from "node:test"
import assert from "node:assert/strict"
import { makeFakeClient, ResolveCtx } from "./fake-supabase"

let currentFake: ReturnType<typeof makeFakeClient>
mock.module("@/lib/supabase/server", { namedExports: { createAdminClient: async () => currentFake } })

let lb: typeof import("@/actions/leaderboard")
before(async () => {
  lb = await import("@/actions/leaderboard")
})

const data: Record<string, any[]> = {
  // The query filters to published+public; p3 stands in for a hidden piece the DB didn't return.
  content_objects: [
    { id: "p1", title: "Quiet one", slug: "quiet", author_id: "a1" },
    { id: "p2", title: "Talked about", slug: "talked", author_id: "a2" },
    { id: "p4", title: "Nobody read", slug: "none", author_id: "a1" },
  ],
  piece_claps: [{ piece_id: "p1", count: 5 }, { piece_id: "p3", count: 99 }],
  piece_responses: [{ piece_id: "p2", user_id: "r1" }, { piece_id: "p2", user_id: "r2" }, { piece_id: "p2", user_id: "a2" }],
  reader_highlights: [{ piece_id: "p2", user_id: "r1" }, { piece_id: "p1", user_id: "a1" }],
  collection_items: [{ content_object_id: "p1", collections: { curator_id: "r1" } }, { content_object_id: "p1", collections: { curator_id: "a1" } }],
  profiles: [{ id: "a1", handle: "ann", display_name: "Ann", avatar_url: null }, { id: "a2", handle: "bo", display_name: "Bo", avatar_url: null }],
}

test("ranks engaged public pieces by claps + 3×responses + 2×highlights + 2×saves, ignoring the author's own activity", async () => {
  currentFake = makeFakeClient(({ table }: ResolveCtx) => ({ data: data[table] ?? [] }), null)
  const r: any = await lb.pieceLeaderboard({ data: { timeframe: "all" } })
  assert.deepEqual(r.rows.map((x: any) => [x.userId, x.engagementScore]), [["p2", 8], ["p1", 7]])
  assert.equal(r.rows[0].handle, "bo")
  assert.equal(r.rows[0].slug, "talked")
  assert.equal(r.rows[1].saves, 1)
})
