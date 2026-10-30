import { test } from "node:test"
import assert from "node:assert/strict"
import { tallyPoll } from "@/lib/poll"

test("counts per option in option order", () => {
  const r = tallyPoll(["a", "b", "c"], ["b", "a", "b"])
  assert.equal(r.total, 3)
  assert.deepEqual(r.rows.map((x) => x.count), [1, 2, 0])
})

test("percentages always add up to 100", () => {
  const r = tallyPoll(["a", "b", "c"], ["a", "b", "c"])
  assert.equal(r.rows.reduce((s, x) => s + x.percent, 0), 100)
  assert.deepEqual(r.rows.map((x) => x.percent).sort(), [33, 33, 34])
})

test("no votes yet; votes for removed options are ignored", () => {
  assert.equal(tallyPoll(["a"], []).rows[0].percent, 0)
  assert.equal(tallyPoll(["a"], ["gone", "a"]).total, 1)
})
