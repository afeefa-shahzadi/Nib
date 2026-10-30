import { test } from "node:test"
import assert from "node:assert/strict"
import { splitSale, processingFeePaise, STUDIO_CAP_PAISE, type SaleKind } from "@/lib/revenue-split"
import { GST_RATE } from "@/lib/tax"

const sale = (o: Partial<Parameters<typeof splitSale>[0]> = {}) =>
  splitSale({ grossPaise: 10_000, kind: "tip", isStudio: false, studioMonthGmvPaise: 0, curated: false, ...o })

// ₹100 sale: processing ₹2.36 (2% + 18% GST) comes off the top; ₹97.64 is split.
test("processing fee is charged at cost before any split", () => {
  assert.equal(processingFeePaise(10_000), 236)
  assert.equal(sale().processing, 236)
})

test("free plan tip: author keeps 95% of the net", () => {
  assert.deepEqual(sale(), { processing: 236, author: 9_275, curator: 0, platform: 489 })
})

test("free plan sale: author keeps 93% of the net", () => {
  assert.equal(sale({ kind: "purchase" }).author, 9_080)
})

test("free plan sponsorship: author keeps 85%", () => {
  assert.equal(sale({ kind: "sponsorship" }).author, Math.floor(9_764 * 0.85))
})

test("free plan curated sale: 78 / 15 / 7", () => {
  assert.deepEqual(sale({ kind: "purchase", curated: true }), {
    processing: 236, author: 7_615, curator: 1_464, platform: 685,
  })
})

test("studio under the cap: Nib takes nothing", () => {
  assert.equal(sale({ isStudio: true }).platform, 0)
  assert.deepEqual(sale({ kind: "purchase", isStudio: true, curated: true }), {
    processing: 236, author: 8_300, curator: 1_464, platform: 0,
  })
})

test("studio past the cap: 5% to Nib", () => {
  const s = sale({ isStudio: true, studioMonthGmvPaise: STUDIO_CAP_PAISE })
  assert.equal(s.author, Math.floor(9_764 * 0.95))
})

// The rule the whole model rests on: no sale ever costs Nib money, and no
// paisa is created or lost.
test("Nib's net after GST and processing is never negative; splits always sum", () => {
  const kinds: SaleKind[] = ["tip", "sponsorship", "purchase"]
  for (const g of [1, 7, 100, 333, 1_000, 99_999, 10_000_000])
    for (const kind of kinds)
      for (const isStudio of [false, true])
        for (const curated of [false, true])
          for (const gmv of [0, STUDIO_CAP_PAISE]) {
            const s = splitSale({ grossPaise: g, kind, isStudio, studioMonthGmvPaise: gmv, curated })
            assert.equal(s.processing + s.author + s.curator + s.platform, g)
            assert.ok(s.author >= 0 && s.curator >= 0 && s.platform >= 0)
            assert.ok(s.platform - s.platform * GST_RATE / (1 + GST_RATE) >= 0)
          }
})
