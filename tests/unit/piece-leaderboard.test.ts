/* eslint-disable @typescript-eslint/no-explicit-any */
// Piece leaderboard: totals come from leaderboard_piece_totals (SQL, checked in
// supabase/tests/leaderboard_totals.sql); this covers scoring, ordering and author lookup.
import { test, before, mock } from "node:test"
import assert from "node:assert/strict"
import { makeFakeClient, ResolveCtx } from "./fake-supabase"

let currentFake: ReturnType<typeof makeFakeClient>
mock.module("@/lib/supabase/server", { namedExports: { createAdminClient: async () => currentFake } })

let lb: typeof import("@/actions/leaderboard")
before(async () => {
  lb = await import("@/actions/leaderboard")
})

const totals = [
  { id: "p2", title: "Talked about", slug: "talked", author_id: "a2", reads: 0, claps: 0, responses: 2, highlights: 1, saves: 0 },
  { id: "p1", title: "Quiet one", slug: "quiet", author_id: "a1", reads: 2, claps: 5, responses: 0, highlights: 0, saves: 1 },
  { id: "p4", title: "", slug: "none", author_id: "a1", reads: 1, claps: 0, responses: 0, highlights: 0, saves: 0 },
]
const profiles = [{ id: "a1", handle: "ann", display_name: "Ann", avatar_url: null }, { id: "a2", handle: "bo", display_name: "Bo", avatar_url: null }]

test("ranks pieces by reads + claps + 3×responses + 2×highlights + 2×saves and attaches the author", async () => {
  currentFake = makeFakeClient(({ table, op, payload }: ResolveCtx) => {
    if (op === "rpc") {
      assert.equal(table, "leaderboard_piece_totals")
      assert.equal(payload.p_start, null)
      return { data: totals }
    }
    return { data: table === "profiles" ? profiles : [] }
  }, null)
  const r: any = await lb.pieceLeaderboard({ data: { timeframe: "all" } })
  assert.deepEqual(r.rows.map((x: any) => [x.userId, x.engagementScore]), [["p1", 9], ["p2", 8], ["p4", 1]])
  assert.equal(r.total, 3)
  assert.equal(r.rows[1].handle, "bo")
  assert.equal(r.rows[1].slug, "talked")
  assert.equal(r.rows[2].displayName, "Untitled")
})
