/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from "node:test"
import assert from "node:assert/strict"
import { makeFakeClient, ResolveCtx } from "./fake-supabase"
import { enforceMentionPolicy, unlinkMentions } from "@/lib/mentions.server"

const span = (h: string) =>
  `<span data-type="mention" class="m" data-id="${h}" data-label="${h}">@${h}</span>`

test("unlinkMentions keeps the text of blocked mentions and leaves the rest", () => {
  const html = `<p>Hi ${span("ana")} and ${span("bo")}</p>`
  assert.equal(unlinkMentions(html, new Set(["bo"])), `<p>Hi ${span("ana")} and @bo</p>`)
})

test("mentions follow each person's policy", async () => {
  const fake = makeFakeClient(({ table }: ResolveCtx): any => {
    if (table === "profiles")
      return {
        data: [
          { id: "1", handle: "open", mention_policy: "everyone" },
          { id: "2", handle: "closed", mention_policy: "none" },
          { id: "3", handle: "friend", mention_policy: "following" },
          { id: "4", handle: "stranger", mention_policy: "following" },
        ],
      }
    // only "friend" follows the writer
    if (table === "follows") return { data: [{ follower_id: "3" }] }
    return { data: [] }
  })
  const html = ["open", "closed", "friend", "stranger"].map(span).join(" ")
  const out = await enforceMentionPolicy(fake as any, html, "writer")
  assert.equal(out, [span("open"), "@closed", span("friend"), "@stranger"].join(" "))
})

test("you can always mention yourself, and text without mentions is untouched", async () => {
  const fake = makeFakeClient(({ table }: ResolveCtx): any =>
    table === "profiles" ? { data: [{ id: "me", handle: "me", mention_policy: "none" }] } : { data: [] }
  )
  assert.equal(await enforceMentionPolicy(fake as any, span("me"), "me"), span("me"))
  assert.equal(await enforceMentionPolicy(fake as any, "<p>plain</p>", "me"), "<p>plain</p>")
})
