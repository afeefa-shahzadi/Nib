/* eslint-disable @typescript-eslint/no-explicit-any */
// Mention / reply / response notifications: who gets one, and where it links.
import { test } from "node:test"
import assert from "node:assert/strict"
import { makeFakeClient, ResolveCtx } from "./fake-supabase"
import { notifyActivity, excerptOf } from "@/lib/activity-notifications"

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
