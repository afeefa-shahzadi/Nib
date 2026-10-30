import { test, mock } from "node:test"
import assert from "node:assert/strict"
import { makeFakeClient } from "./fake-supabase"

const fake = makeFakeClient(() => ({ data: null }), "reader-1")
let piece: { id: string; status: string; visibility: string; author_id: string } | null = null
mock.module("@/lib/supabase/server", {
  namedExports: { createAdminClient: async () => fake, createClient: async () => fake, createServiceRoleClient: async () => fake },
})
mock.module("@/actions/content/helpers", { namedExports: { getViewablePiece: async () => piece } })
mock.module("@/lib/rate-limit.server", { namedExports: { checkRateLimit: async () => ({ ok: true }) } })
mock.module("@/lib/quests.server", { namedExports: { checkClapThreshold: async () => {} } })

const id = "11111111-1111-4111-8111-111111111111"

test("authors can't clap for their own piece", async () => {
  const { setMyClaps } = await import("@/actions/claps")
  piece = { id, status: "published", visibility: "public", author_id: "reader-1" }
  await assert.rejects(setMyClaps({ data: { piece_id: id, count: 5 } }), /own piece/)
})

test("drafts and pieces you can't see can't be clapped", async () => {
  const { setMyClaps } = await import("@/actions/claps")
  piece = { id, status: "draft", visibility: "public", author_id: "someone" }
  await assert.rejects(setMyClaps({ data: { piece_id: id, count: 5 } }), /can't be clapped/)
  piece = null
  await assert.rejects(setMyClaps({ data: { piece_id: id, count: 5 } }), /can't be clapped/)
})

test("a reader's claps on a published piece are clamped to 50", async () => {
  const { setMyClaps } = await import("@/actions/claps")
  piece = { id, status: "published", visibility: "public", author_id: "someone" }
  assert.deepEqual(await setMyClaps({ data: { piece_id: id, count: 999 } }), { ok: true, count: 50 })
})
