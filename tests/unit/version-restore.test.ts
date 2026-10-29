/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, before, mock } from "node:test"
import assert from "node:assert/strict"
import { makeFakeClient, ResolveCtx } from "./fake-supabase"
import { decodeBlock, encodeBlock } from "@/lib/types/composer"

let currentFake: ReturnType<typeof makeFakeClient>
mock.module("@/lib/supabase/server", {
  namedExports: {
    createAdminClient: async () => currentFake,
    createClient: async () => currentFake,
    createServiceRoleClient: async () => currentFake,
  },
})

let versions: typeof import("@/actions/content/pieces/creator/versions")
let blocksMod: typeof import("@/actions/content/blocks")
before(async () => {
  versions = await import("@/actions/content/pieces/creator/versions")
  blocksMod = await import("@/actions/content/blocks")
})

const PIECE = "p1"
const vis = { skim: true, standard: true, expert: true, teach: true, debate: true }

// A tiny in-memory `blocks` table behind the fake builder.
function fakeDb() {
  let rows: any[] = [
    { id: "cur-1", content_object_id: PIECE, order: 0, type: "paragraph", content: { html: "<p>current</p>" }, semantic_role: null, mode_visibility: vis, monetization_eligible: false },
  ]
  let n = 0
  const resolve = (ctx: ResolveCtx): any => {
    if (ctx.table === "piece_versions" && ctx.op === "select")
      return {
        data: {
          id: "v1",
          piece_id: PIECE,
          message: "first",
          // Snapshot rows carry the ids the blocks had when it was taken —
          // those rows no longer exist.
          blocks_snapshot: [
            { id: "old-1", type: "paragraph", content: { html: "<p>restored</p>" }, semantic_role: null, mode_visibility: vis, monetization_eligible: false },
          ],
        },
      }
    if (ctx.table === "content_objects") return { data: { id: PIECE, author_id: "u1" } }
    if (ctx.table !== "blocks") return { data: null }
    if (ctx.op === "select") return { data: [] }
    if (ctx.op === "delete") {
      const keep = ctx.filters.find(([c]) => c === "not.id")?.[1] as string | undefined
      const keepIds = keep ? keep.slice(1, -1).split(",") : []
      rows = rows.filter((r) => keepIds.includes(r.id))
      return { error: null }
    }
    if (ctx.op === "insert") {
      const inserted = [].concat(ctx.payload).map((r: any) => ({ id: `new-${++n}`, ...r }))
      rows.push(...inserted)
      return { data: inserted, error: null }
    }
    if (ctx.op === "upsert") {
      for (const r of [].concat(ctx.payload) as any[]) {
        rows = rows.filter((x) => x.id !== r.id)
        rows.push(r)
      }
      return { error: null }
    }
    return { error: null } // order-only update
  }
  return { resolve, rows: () => rows }
}

test("autosave after a version restore keeps the restored blocks", async () => {
  const db = fakeDb()
  currentFake = makeFakeClient(db.resolve)

  const res: any = await versions.restorePieceVersion({ data: { version_id: "v1" } })
  assert.deepEqual(db.rows().map((r) => r.content.html), ["<p>restored</p>"])

  // The composer replaces its state with what the restore returned, then the
  // debounced autosave sends that list (nothing locally dirty).
  const clientBlocks = (res.blocks as any[]).map((b) => decodeBlock(b))
  await blocksMod.saveBlocks({
    data: {
      content_object_id: PIECE,
      blocks: clientBlocks.map((b) => ({ ...encodeBlock(b), is_dirty: false })),
    },
  })

  assert.deepEqual(
    db.rows().map((r) => r.content.html),
    ["<p>restored</p>"],
    "autosave must not prune the blocks the restore just inserted"
  )
})
