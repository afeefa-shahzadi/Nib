import { test, mock } from "node:test"
import assert from "node:assert/strict"
import { makeFakeClient } from "./fake-supabase"

const fake = makeFakeClient(() => ({ data: null }), "u1")
let aiCalls = 0
mock.module("@/lib/supabase/server", {
  namedExports: {
    createAdminClient: async () => fake,
    createClient: async () => fake,
    createServiceRoleClient: async () => fake,
  },
})
mock.module("ai", {
  namedExports: {
    generateText: async () => {
      aiCalls++
      return { text: '{"valid":true,"reason":"x"}' }
    },
  },
})

test("verifyDisabilityDocuments is disabled: no AI call, no profile write", async () => {
  const { verifyDisabilityDocuments } = await import("@/actions/accessibility")
  const r = await verifyDisabilityDocuments({
    type: "visual",
    documentUrl: "https://x/verifications/u1/a",
    photoUrl: "https://x/verifications/u1/b",
  })
  assert.deepEqual(r, { error: "Verification is not available right now." })
  assert.equal(aiCalls, 0)
  assert.equal(fake.calls.length, 0)
})
