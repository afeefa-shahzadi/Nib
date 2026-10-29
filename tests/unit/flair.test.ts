import { test } from "node:test"
import assert from "node:assert/strict"
import { FLAIRS, flairClass } from "@/lib/flair"

test("flair ids are unique and costs positive", () => {
  const ids = FLAIRS.map((f) => f.id)
  assert.equal(new Set(ids).size, ids.length, "duplicate flair id would corrupt ownership")
  for (const f of FLAIRS) assert.ok(f.cost > 0, `${f.id} must cost IP`)
})

test("flairClass resolves known, empty for none/unknown", () => {
  assert.equal(flairClass("gold"), "text-amber-500")
  assert.equal(flairClass(null), "")
  assert.equal(flairClass("nope"), "")
})
