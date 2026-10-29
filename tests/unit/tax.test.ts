import { test } from "node:test"
import assert from "node:assert/strict"
import {
  tdsOnPayoutPaise,
  gstFromInclusiveFeePaise,
  indianFyQuarter,
  fyQuarterBounds,
} from "@/lib/tax"

test("tdsOnPayoutPaise: 1% of gross, rounded", () => {
  assert.equal(tdsOnPayoutPaise(40_000), 400)
  assert.equal(tdsOnPayoutPaise(90_050), 901) // 900.5 -> 901
  assert.equal(tdsOnPayoutPaise(0), 0)
})

test("gstFromInclusiveFeePaise: extracts 18% contained in an inclusive fee", () => {
  // fee of 11_800 contains 1_800 GST (10_000 + 18%).
  assert.equal(gstFromInclusiveFeePaise(11_800), 1_800)
  assert.equal(gstFromInclusiveFeePaise(0), 0)
})

test("indianFyQuarter: FY runs Apr–Mar", () => {
  assert.equal(indianFyQuarter(new Date("2026-07-18T00:00:00Z")), "FY2026-27-Q2")
  assert.equal(indianFyQuarter(new Date("2026-04-01T00:00:00Z")), "FY2026-27-Q1")
  assert.equal(indianFyQuarter(new Date("2026-03-31T00:00:00Z")), "FY2025-26-Q4")
  assert.equal(indianFyQuarter(new Date("2026-01-15T00:00:00Z")), "FY2025-26-Q4")
  assert.equal(indianFyQuarter(new Date("2026-10-05T00:00:00Z")), "FY2026-27-Q3")
})

test("fyQuarterBounds: [start, end) of the 3-month block containing the date", () => {
  const b = fyQuarterBounds(new Date("2026-07-18T12:00:00Z"))
  assert.equal(b.startISO, "2026-07-01T00:00:00.000Z")
  assert.equal(b.endISO, "2026-10-01T00:00:00.000Z")
})
