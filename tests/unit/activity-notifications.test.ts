/* eslint-disable @typescript-eslint/no-explicit-any */
// Mention / reply / response notifications: who gets one, and where it links.
import { test } from "node:test"
import assert from "node:assert/strict"
import { makeFakeClient, ResolveCtx } from "./fake-supabase"
import { notifyActivity, notifyPieceMentions, notifyClap, excerptOf } from "@/lib/activity-notifications"

const piece = { title: "On Attention", slug: "attention", author_id: "author", author: { handle: "ann" } }
const fake = () =>
  makeFakeClient(({ table }: ResolveCtx) => {
    if (table === "content_objects") return { data: piece }
    if (table === "profiles") return { data: [{ id: "bo" }, { id: "me" }] }
    return { data: null }
  })
const mention = (h: string) => `<span data-type="mention" class="m" data-id="${h}" data-label="${h}">@${h}</span>`

test("a mention outranks a reply, the author is told of a response, and you never notify yourself", async () => {
  const c = fake()
  await notifyActivity(c as any, {
    actorId: "me",
    pieceId: "p1",
    html: `<p>${mention("bo")} ${mention("me")} look</p>`,
    anchor: "?response=r9",
    replyToUserId: "bo",
    notifyPieceAuthor: true,
  })
  const rows = (c.calls.find((x) => x.table === "notifications") as any).rows
  assert.deepEqual(rows.map((r: any) => [r.user_id, r.type]).sort(), [["author", "response"], ["bo", "mention"]])
  assert.equal(rows[0].payload.url, "/u/ann/attention?response=r9")
  assert.equal(rows[0].payload.sender_id, "me")
  assert.equal(rows[0].payload.excerpt, "@bo @me look")
})

test("writes nothing when the only recipient is the poster", async () => {
  const c = fake()
  await notifyActivity(c as any, { actorId: "author", pieceId: "p1", html: "<p>hi</p>", anchor: "#room-1", notifyPieceAuthor: true })
  assert.equal(c.calls.filter((x) => x.table === "notifications").length, 0)
})

test("excerpt strips tags and trims long text", () => {
  assert.equal(excerptOf("<p>a&nbsp;<b>b</b></p>"), "a b")
  assert.equal(excerptOf("x".repeat(200)).length, 141)
})

const has = (filters: [string, any][], col: string) => filters.some(([c]) => c === col)

test("muted types are dropped per person", async () => {
  const c = makeFakeClient(({ table }: ResolveCtx) => {
    if (table === "content_objects") return { data: piece }
    if (table === "profiles") return { data: [{ id: "author", muted_notifications: ["response"] }] }
    return { data: null }
  })
  await notifyActivity(c as any, { actorId: "me", pieceId: "p1", html: "<p>hi</p>", anchor: "", notifyPieceAuthor: true })
  assert.equal(c.calls.filter((x) => x.table === "notifications").length, 0)
})

test("piece mentions read user ids from <a data-id>, skip the author and anyone already told", async () => {
  const link = (id: string) => `<a data-type="mention" href="/u/x" data-id="${id}" data-label="@x">@x</a>`
  const id = (n: number) => `00000000-0000-0000-0000-00000000000${n}`
  const c = makeFakeClient(({ table, filters }: ResolveCtx) => {
    if (table === "content_objects") return { data: { ...piece, author_id: id(9) } }
    if (table === "blocks") return { data: [{ id: "b1", content: { html: `${link(id(1))} ${link(id(9))}` } }, { id: "b2", content: { html: link(id(2)) + link(id(1)) } }] }
    if (table === "notifications" && has(filters, "payload->>source")) return { data: [{ user_id: id(2) }] }
    if (table === "profiles") return { data: [] }
    return { data: null }
  })
  await notifyPieceMentions(c as any, "p1")
  const rows = (c.calls.find((x) => x.op === "insert") as any).rows
  assert.deepEqual(rows.map((r: any) => [r.user_id, r.payload.url]), [[id(1), "/u/ann/attention#block-b1"]])
  assert.equal(rows[0].payload.source, "piece")
})

test("claps group into the open notification and each reader counts once", async () => {
  let seen = false
  const c = makeFakeClient(({ table, filters }: ResolveCtx) => {
    if (table === "content_objects") return { data: piece }
    if (table === "notifications" && has(filters, "contains.payload")) return { data: seen ? [{ id: "n0" }] : [] }
    if (table === "notifications") return { data: { id: "n1", payload: { sender_id: "ann", sender_ids: ["ann"], count: 1, piece_id: "p1" } } }
    return { data: null }
  })
  await notifyClap(c as any, "p1", "bo")
  const upd = c.calls.find((x) => x.op === "update") as any
  assert.deepEqual([upd.vals.payload.sender_id, upd.vals.payload.sender_ids, upd.vals.payload.count], ["bo", ["bo", "ann"], 2])
  seen = true
  const before = c.calls.length
  await notifyClap(c as any, "p1", "bo")
  assert.equal(c.calls.length, before, "a reader already counted adds nothing")
  await notifyClap(c as any, "p1", "author")
  assert.equal(c.calls.length, before, "the author's own clap never notifies")
})
