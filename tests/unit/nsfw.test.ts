/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from "node:test"
import assert from "node:assert/strict"
import { makeFakeClient, ResolveCtx } from "./fake-supabase"
import {
  assertMonetizable,
  assertBundleMonetizable,
  excludeNsfw,
} from "@/lib/nsfw"

// ---------- assertMonetizable: the Razorpay NSFW gate ----------

test("assertMonetizable: NSFW piece is rejected", async () => {
  const fake = makeFakeClient(
    ({ table }: ResolveCtx): any =>
      table === "content_objects" ? { data: { is_nsfw: true } } : { data: [] }
  )
  await assert.rejects(
    assertMonetizable(fake as any, "p1"),
    /not eligible for monetization/
  )
})

test("assertMonetizable: safe piece passes, missing piece rejects", async () => {
  const safe = makeFakeClient((): any => ({ data: { is_nsfw: false } }))
  await assertMonetizable(safe as any, "p1")

  const missing = makeFakeClient((): any => ({ data: null }))
  await assert.rejects(assertMonetizable(missing as any, "p1"), /not found/)
})

// ---------- assertBundleMonetizable: one NSFW item poisons the bundle ----------

test("assertBundleMonetizable: bundle containing an NSFW piece is rejected", async () => {
  const fake = makeFakeClient(({ table }: ResolveCtx): any => {
    if (table === "bundle_items")
      return { data: [{ content_object_id: "p1" }, { content_object_id: "p2" }] }
    return { count: 1 } // content_objects head-count of NSFW items
  })
  await assert.rejects(
    assertBundleMonetizable(fake as any, "b1"),
    /not eligible for monetization/
  )
})

test("assertBundleMonetizable: clean or empty bundle passes", async () => {
  const clean = makeFakeClient(({ table }: ResolveCtx): any => {
    if (table === "bundle_items")
      return { data: [{ content_object_id: "p1" }] }
    return { count: 0 }
  })
  await assertBundleMonetizable(clean as any, "b1")

  const empty = makeFakeClient((): any => ({ data: [] }))
  await assertBundleMonetizable(empty as any, "b1")
})

// ---------- excludeNsfw: the discovery filter ----------

test("excludeNsfw chains .neq('is_nsfw', true) and returns the builder", () => {
  const seen: [string, unknown][] = []
  const q: any = {
    neq: (col: string, val: unknown) => {
      seen.push([col, val])
      return q
    },
  }
  assert.equal(excludeNsfw(q), q)
  assert.deepEqual(seen, [["is_nsfw", true]])
})
