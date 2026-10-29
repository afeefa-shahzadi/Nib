import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { TIP_PLATFORM_FEE_PCT, getTiers } from "@/lib/content/pricing/data"

test("free tier states the pricing data's tip fee", () => {
  assert.ok(
    getTiers()[0].features.some((f) => f.includes(`${TIP_PLATFORM_FEE_PCT}% platform fee`))
  )
})

test("earnings pages don't present Insight Points as convertible to rupees", () => {
  for (const f of ["app/(main)/me/earnings/page.tsx", "app/studio/earnings/page.tsx"]) {
    const src = readFileSync(f, "utf-8")
    assert.doesNotMatch(src, /Insight Points = ₹|IP_PER_RUPEE/, f)
  }
})
