import { test, mock } from "node:test"
import assert from "node:assert/strict"
import { makeFakeClient } from "./fake-supabase"

let status = "pending"
const fake = makeFakeClient(() => ({ data: { parental_consent: status } }), "u1")
mock.module("@/lib/supabase/server", {
  namedExports: { createAdminClient: async () => fake, createClient: async () => fake },
})
mock.module("@/lib/email", { namedExports: { sendEmail: async () => ({ ok: true }) } })

test("a pending minor can't publish or post", async () => {
  const { assertCanPost, CONSENT_PENDING_MESSAGE } = await import("@/lib/parental-consent")
  status = "pending"
  await assert.rejects(assertCanPost("u1"), { message: CONSENT_PENDING_MESSAGE })
})

test("approved minors and adults can", async () => {
  const { assertCanPost } = await import("@/lib/parental-consent")
  status = "granted"
  await assertCanPost("u1")
  status = "not_required"
  await assertCanPost("u1")
})
