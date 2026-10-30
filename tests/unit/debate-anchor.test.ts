/* eslint-disable @typescript-eslint/no-explicit-any */
// Debate rooms: responses can be tied to one paragraph of the piece, and the
// room's creator can pin a closing summary.
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
mock.module("@/lib/parental-consent", { namedExports: { assertCanPost: async () => {} } })

let debate: typeof import("@/actions/debate")
before(async () => {
  debate = await import("@/actions/debate")
})

const room = { id: "r1", content_object_id: "p1", is_public: true, access_mode: "public", created_by: "author", org_id: null, required_tier_id: null, summary: "Landed on: both." }
const blocks = [
  { id: "b1", content: { text: "Free claim" }, monetization_eligible: false },
  { id: "b2", content: { html: "<p>Paid <b>insight</b></p>" }, monetization_eligible: true },
  { id: "b3", content: { html: "<p>" + "x".repeat(200) + "</p>" }, monetization_eligible: false },
  { id: "b4", content: {}, monetization_eligible: false },
]
const client = (userId: string | null = "u1", roomRow: any = room) =>
  makeFakeClient(({ table, op }: ResolveCtx): any => {
    if (table === "debate_rooms") return op === "update" ? { data: null, error: null } : { data: roomRow }
    if (table === "blocks") return { data: blocks }
    return { data: null, error: null }
  }, userId)
const inserts = (f: any, t: string) => f.calls.filter((c: any) => c.table === t && c.op === "insert")
const updates = (f: any, t: string) => f.calls.filter((c: any) => c.table === t && c.op === "update")

test("room context lists the piece's free, non-empty paragraphs (paid text never leaks) and the summary", async () => {
  currentFake = client()
  const ctx: any = await debate.getRoomContext({ data: { room_id: "r1" } })
  assert.deepEqual(ctx.blocks.map((b: any) => b.id), ["b1", "b3"])
  assert.equal(ctx.blocks[0].excerpt, "Free claim")
  assert.ok(ctx.blocks[1].excerpt.length <= 121 && ctx.blocks[1].excerpt.endsWith("…"))
  assert.equal(ctx.summary, "Landed on: both.")
  assert.equal(ctx.canEditSummary, false)
  currentFake = client("author")
  assert.equal(((await debate.getRoomContext({ data: { room_id: "r1" } })) as any).canEditSummary, true)
})

test("a response can be tied to a paragraph of the room's piece", async () => {
  currentFake = client()
  await debate.postMessage({ data: { room_id: "r1", stance: "for", body: "yes", block_id: "b1" } })
  assert.equal(inserts(currentFake, "debate_messages")[0].rows.block_id, "b1")
})

test("tying a response to a paid or foreign paragraph is refused", async () => {
  for (const id of ["b2", "nope"]) {
    currentFake = client()
    await assert.rejects(debate.postMessage({ data: { room_id: "r1", stance: "for", body: "x", block_id: id } }), /paragraph/)
    assert.equal(inserts(currentFake, "debate_messages").length, 0)
  }
})

test("a response without a paragraph is about the whole piece", async () => {
  currentFake = client()
  await debate.postMessage({ data: { room_id: "r1", stance: "comment", body: "hi" } })
  assert.equal(inserts(currentFake, "debate_messages")[0].rows.block_id, null)
})

test("only the room's creator can pin the summary; blank clears it", async () => {
  currentFake = client("u1")
  await assert.rejects(debate.setRoomSummary({ data: { room_id: "r1", summary: "mine" } }), /Not authorized/)
  assert.equal(updates(currentFake, "debate_rooms").length, 0)

  currentFake = client("author")
  await debate.setRoomSummary({ data: { room_id: "r1", summary: "  Where it landed.  " } })
  assert.equal(updates(currentFake, "debate_rooms")[0].vals.summary, "Where it landed.")
  currentFake = client("author")
  await debate.setRoomSummary({ data: { room_id: "r1", summary: "   " } })
  assert.equal(updates(currentFake, "debate_rooms")[0].vals.summary, null)
  currentFake = client("author")
  await assert.rejects(debate.setRoomSummary({ data: { room_id: "r1", summary: "x".repeat(2001) } }), /2,000/)
})
