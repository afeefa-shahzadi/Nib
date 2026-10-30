import { test } from "node:test"
import assert from "node:assert/strict"
import { rankView, LB_PAGE_SIZE } from "@/lib/leaderboard-view"

const row = (id: string, score: number) => ({ userId: id, displayName: id, handle: id, score, claps: 100 - score })
const rows = Array.from({ length: 30 }, (_, i) => row(`u${i}`, i))

test("ranks by score, highest first, and pages", () => {
  const v = rankView(rows, { key: "score" })
  assert.equal(v.rows[0].userId, "u29")
  assert.equal(v.rows[0].rank, 1)
  assert.equal(v.rows.length, LB_PAGE_SIZE)
  assert.equal(v.pages, 2)
  assert.deepEqual(v.podium.map((r) => r.userId), ["u29", "u28", "u27"])
})

test("search keeps real ranks and hides the podium", () => {
  const v = rankView(rows, { key: "score", q: "u2" })
  assert.equal(v.rows.find((r) => r.userId === "u20")?.rank, 10)
  assert.equal(v.podium.length, 0)
})

test("sorting by another column keeps ranks", () => {
  const v = rankView(rows, { key: "score", sort: "claps" })
  assert.equal(v.rows[0].userId, "u0")
  assert.equal(v.rows[0].rank, 30)
})

test("viewer rank and the gap to the next place", () => {
  const v = rankView(rows, { key: "score", viewerId: "u27" })
  assert.deepEqual(v.me, { rank: 3, toNext: 2 })
  assert.deepEqual(rankView(rows, { key: "score", viewerId: "u29" }).me, { rank: 1, toNext: 0 })
  assert.equal(rankView(rows, { key: "score", viewerId: "nobody" }).me, null)
})

test("out-of-range pages clamp", () => {
  assert.equal(rankView(rows, { key: "score", page: 9 }).page, 1)
})
