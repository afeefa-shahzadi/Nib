import { test } from "node:test"
import assert from "node:assert/strict"
import { feedWindow, FEED_PAGE_SIZE } from "@/lib/feed-query"

const now = Date.parse("2026-10-30T12:00:00Z")

test("defaults: newest first, first page, no time limit", () => {
  assert.deepEqual(feedWindow({}, now), { column: "published_at", ascending: false, from: 0, to: FEED_PAGE_SIZE, since: null })
})

test("page n asks for one extra row to know if more exist", () => {
  const w = feedWindow({ page: 2 }, now)
  assert.equal(w.from, 2 * FEED_PAGE_SIZE)
  assert.equal(w.to, 3 * FEED_PAGE_SIZE) // inclusive range => PAGE_SIZE + 1 rows
})

test("oldest sorts ascending", () => {
  assert.equal(feedWindow({ sort: "oldest" }, now).ascending, true)
})

test("time windows become a published_at cutoff", () => {
  assert.equal(feedWindow({ since: "week" }, now).since, "2026-10-23T12:00:00.000Z")
  assert.equal(feedWindow({ since: "month" }, now).since, "2026-09-30T12:00:00.000Z")
  assert.equal(feedWindow({ since: "year" }, now).since, "2025-10-30T12:00:00.000Z")
  assert.equal(feedWindow({ since: "any" }, now).since, null)
})

test("junk input falls back to safe defaults", () => {
  assert.deepEqual(feedWindow({ page: -3, sort: "x" as never, since: "x" as never }, now), feedWindow({}, now))
  assert.equal(feedWindow({ page: 1e9 }, now).from, 50 * FEED_PAGE_SIZE)
})

test("title sort is A to Z; today is the past 24 hours", () => {
  const w = feedWindow({ sort: "title", since: "today" }, now)
  assert.equal(w.column, "title")
  assert.equal(w.ascending, true)
  assert.equal(w.since, "2026-10-29T12:00:00.000Z")
})
