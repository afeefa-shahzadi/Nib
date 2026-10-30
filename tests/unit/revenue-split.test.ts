import { test } from "node:test"
import assert from "node:assert/strict"
import { splitSale, STUDIO_CAP_PAISE } from "@/lib/revenue-split"

const sum = (s: { author: number; curator: number; platform: number }) => s.author + s.curator + s.platform

test("free plan tip: 90% author, 10% platform", () => {
  const s = splitSale({ grossPaise: 10_000, kind: "tip", isStudio: false, studioMonthGmvPaise: 0, curated: false })
  assert.deepEqual(s, { author: 9_000, curator: 0, platform: 1_000 })
})

test("free plan sponsorship: 80% author", () => {
  const s = splitSale({ grossPaise: 100_000, kind: "sponsorship", isStudio: false, studioMonthGmvPaise: 0, curated: false })
  assert.equal(s.author, 80_000)
})

test("free plan curated sale: 70 / 15 / 15", () => {
  const s = splitSale({ grossPaise: 10_000, kind: "purchase", isStudio: false, studioMonthGmvPaise: 0, curated: true })
  assert.deepEqual(s, { author: 7_000, curator: 1_500, platform: 1_500 })
})

test("studio curated sale under the cap: 85 / 15 / 0", () => {
  const s = splitSale({ grossPaise: 10_000, kind: "purchase", isStudio: true, studioMonthGmvPaise: 0, curated: true })
  assert.deepEqual(s, { author: 8_500, curator: 1_500, platform: 0 })
})

test("studio curated sale over the cap: 80 / 15 / 5", () => {
  const s = splitSale({ grossPaise: 10_000, kind: "purchase", isStudio: true, studioMonthGmvPaise: STUDIO_CAP_PAISE, curated: true })
  assert.deepEqual(s, { author: 8_000, curator: 1_500, platform: 500 })
})

test("studio tip keeps 100% under the cap and 95% over it", () => {
  assert.equal(splitSale({ grossPaise: 10_000, kind: "tip", isStudio: true, studioMonthGmvPaise: 0, curated: false }).author, 10_000)
  assert.equal(splitSale({ grossPaise: 10_000, kind: "tip", isStudio: true, studioMonthGmvPaise: STUDIO_CAP_PAISE, curated: false }).author, 9_500)
})

test("odd amounts never create or lose a paisa", () => {
  for (const g of [1, 7, 333, 99_999]) {
    for (const isStudio of [false, true]) {
      const s = splitSale({ grossPaise: g, kind: "purchase", isStudio, studioMonthGmvPaise: 0, curated: true })
      assert.equal(sum(s), g)
      assert.ok(s.author >= 0 && s.curator >= 0 && s.platform >= 0)
    }
  }
})
