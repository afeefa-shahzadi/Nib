/* eslint-disable @typescript-eslint/no-explicit-any */
// Admin-client reads bypass RLS, so reader-facing actions must check in code
// that a piece is viewable (published+public, or the viewer is the author).
import { test, before, beforeEach, mock } from "node:test"
import assert from "node:assert/strict"
import { makeFakeClient, ResolveCtx } from "./fake-supabase"

let fake: ReturnType<typeof makeFakeClient>
mock.module("@/lib/supabase/server", {
  namedExports: {
    createAdminClient: async () => fake,
    createClient: async () => fake,
    createServiceRoleClient: async () => fake,
  },
})
mock.module("@/lib/quests.server", {
  namedExports: { tickQuest: async () => {}, checkReadThreshold: async () => {}, bumpUserStat: async () => {} },
})

const f = (ctx: ResolveCtx, col: string) => ctx.filters.find(([c]) => c === col)?.[1]
const draft = { id: "p1", status: "draft", visibility: "public", author_id: "author" }
const pub = { id: "p2", status: "published", visibility: "public", author_id: "author" }

let pub_: typeof import("@/actions/content/pieces/public")
let comments: typeof import("@/actions/comments")
let ann: typeof import("@/actions/annotations")
let bundles: typeof import("@/actions/content/bundles")
let debate: typeof import("@/actions/debate")
let tele: typeof import("@/actions/telemetry")
before(async () => {
  pub_ = await import("@/actions/content/pieces/public")
  comments = await import("@/actions/comments")
  ann = await import("@/actions/annotations")
  bundles = await import("@/actions/content/bundles")
  debate = await import("@/actions/debate")
  tele = await import("@/actions/telemetry")
})
beforeEach(() => {
  process.env.LAUNCH_FREE = "0"
})

const pieces = (ctx: ResolveCtx) => {
  const id = f(ctx, "id")
  return { data: [draft, pub].find((p) => p.id === id) ?? null }
}

test("repost hides a private original and gates paywalled original blocks", async () => {
  const repost = { id: "r1", slug: "r", status: "published", visibility: "public", author_id: "reposter", reposted_from: "orig" }
  const resolve = (origStatus: string) => (ctx: ResolveCtx): any => {
    if (ctx.table === "content_objects") {
      if (f(ctx, "slug") === "r" && f(ctx, "status") === "published") return { data: repost }
      if (f(ctx, "id") === "orig")
        return { data: { id: "orig", status: origStatus, visibility: "public", author_id: "author" } }
      return { data: [] }
    }
    if (ctx.table === "blocks" && f(ctx, "content_object_id") === "orig")
      return { data: [{ id: "b", monetization_eligible: true, content: { text: "secret" } }] }
    return { data: [] }
  }
  fake = makeFakeClient(resolve("archived"), "stranger")
  let r: any = await pub_.getPieceBySlug({ data: { slug: "r" } })
  assert.equal(r.originalPiece, null)
  assert.deepEqual(r.originalBlocks, [])

  fake = makeFakeClient(resolve("published"), "stranger")
  r = await pub_.getPieceBySlug({ data: { slug: "r" } })
  assert.equal(r.originalPiece.id, "orig")
  assert.deepEqual(r.originalBlocks[0].content, {})
})

test("listComments is empty for a draft piece and never returns voter ids", async () => {
  fake = makeFakeClient((ctx): any => {
    if (ctx.table === "content_objects") return pieces(ctx)
    if (ctx.table === "piece_responses") return { data: [{ id: "c1", user_id: "w" }] }
    if (ctx.table === "piece_response_votes")
      return { data: [{ response_id: "c1", user_id: "voter", vote_type: 1 }] }
    return { data: [] }
  }, "stranger")
  assert.deepEqual(await comments.listComments({ data: { piece_id: "p1" } }), [])
  const rows: any = await comments.listComments({ data: { piece_id: "p2" } })
  assert.equal(rows[0].upvotes, 1)
  assert.ok(!JSON.stringify(rows).includes("voter"))
})

test("postComment refuses a draft piece and a parent from another piece", async () => {
  fake = makeFakeClient((ctx): any => {
    if (ctx.table === "content_objects") return pieces(ctx)
    if (ctx.table === "piece_responses" && ctx.op === "select") return { data: { piece_id: "other" } }
    return { data: null, error: null }
  }, "stranger")
  await assert.rejects(comments.postComment({ data: { piece_id: "p1", body: "x" } }))
  await assert.rejects(comments.postComment({ data: { piece_id: "p2", body: "x", parent_id: "c9" } }))
  assert.equal(fake.calls.filter((c) => c.op === "insert").length, 0)
})

test("createBlockAnnotation refuses a draft piece", async () => {
  fake = makeFakeClient((ctx): any => (ctx.table === "content_objects" ? pieces(ctx) : { data: null }), "stranger")
  await assert.rejects(
    ann.createBlockAnnotation({ data: { content_object_id: "p1", block_id: "b", body: "x" } })
  )
  assert.equal(fake.calls.length, 0)
})

test("addBundleItem refuses someone else's draft", async () => {
  fake = makeFakeClient((ctx): any => {
    if (ctx.table === "bundles") return { data: { id: "bd", author_id: "u1" } }
    if (ctx.table === "content_objects") return pieces(ctx)
    return { data: null }
  })
  await assert.rejects(bundles.addBundleItem({ data: { bundle_id: "bd", content_object_id: "p1" } }))
  assert.equal(fake.calls.length, 0)
})

test("createRoom refuses an org the caller isn't in and a tier they don't own", async () => {
  fake = makeFakeClient((ctx): any => {
    if (ctx.table === "content_objects") return { data: { author_id: "u1" } }
    if (ctx.table === "membership_tiers") return { data: { author_id: "someone" } }
    return { data: null }
  })
  await assert.rejects(debate.createRoom({ data: { content_object_id: "p", title: "t", access_mode: "org", org_id: "o" } }))
  await assert.rejects(debate.createRoom({ data: { content_object_id: "p", title: "t", access_mode: "tier", required_tier_id: "t" } }))
  assert.equal(fake.calls.length, 0)
})

test("recordTelemetry only checks for published pieces", async () => {
  const seen: any[] = []
  fake = makeFakeClient((ctx): any => {
    if (ctx.table === "content_objects") seen.push(ctx.filters)
    return { data: null }
  })
  await tele.recordTelemetry({ data: { piece_id: "p1", event: "view" } })
  assert.deepEqual(seen[0], [["id", "p1"], ["status", "published"]])
})

const memberPiece = { id: "m1", status: "published", visibility: "member", author_id: "author" }
const memberFake = (isMember: boolean) =>
  makeFakeClient((ctx): any => {
    if (ctx.table === "content_objects") return { data: memberPiece }
    if (ctx.table === "memberships") return { data: isMember ? [{ id: "x" }] : [] }
    if (ctx.table === "purchases") return { data: [] }
    if (ctx.table === "piece_responses") return { data: [{ id: "c1", user_id: "w" }] }
    return { data: [] }
  }, "reader")

test("members-only piece is viewable to everyone during the free launch", async () => {
  delete process.env.LAUNCH_FREE
  fake = memberFake(false)
  const rows: any = await comments.listComments({ data: { piece_id: "m1" } })
  assert.equal(rows.length, 1)
})

test("members-only piece needs membership when launch is off", async () => {
  process.env.LAUNCH_FREE = "0"
  fake = memberFake(false)
  assert.deepEqual(await comments.listComments({ data: { piece_id: "m1" } }), [])
  fake = memberFake(true)
  const rows: any = await comments.listComments({ data: { piece_id: "m1" } })
  assert.equal(rows.length, 1)
})
