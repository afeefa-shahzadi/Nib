import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

// The tour may only describe what the composer actually does. These claims
// had no feature behind them: a free-form canvas, outline drag-reorder,
// per-block version history in the inspector, SEO fields and a cover image
// in the metadata dialog.
test("composer tour makes no promises the composer can't keep", () => {
  const src = readFileSync("hooks/use-composer-tour.ts", "utf-8")
  for (const claim of [/infinite canvas/i, /anywhere/i, /reorder/i, /version history/i, /SEO/, /cover image/i]) {
    assert.doesNotMatch(src, claim)
  }
})
