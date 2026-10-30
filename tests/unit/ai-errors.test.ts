import { test, before, mock } from "node:test"
import assert from "node:assert/strict"
import { makeFakeClient } from "./fake-supabase"

const fake = makeFakeClient((ctx) =>
  ctx.table === "profiles" ? { data: { plan: "free" } } : { data: null }
)
mock.module("@/lib/supabase/server", {
  namedExports: {
    createAdminClient: async () => fake,
    createClient: async () => fake,
    createServiceRoleClient: async () => fake,
  },
})
mock.module("@/lib/rate-limit.server", {
  namedExports: {
    checkRateLimit: async () => ({ ok: true, remaining: 1, resetAt: new Date() }),
  },
})

// What the AI SDK throws once its retries give up on a provider 429: the
// status lives on lastError, not on the RetryError itself.
let thrown: unknown
mock.module("ai", {
  namedExports: {
    generateText: async () => {
      throw thrown
    },
    embed: async () => ({}),
  },
})

let ai: typeof import("@/actions/ai")
before(async () => {
  process.env.MISTRAL_API_KEY = "test-key"
  ai = await import("@/actions/ai")
})

const eli5 = () => ai.generateModeVariant({ data: { mode: "eli5", source: "Some text." } })

test("a provider rate limit wrapped in a RetryError reads as a human message", async () => {
  thrown = Object.assign(new Error("Failed after 3 attempts. Last error: Rate limit exceeded"), {
    name: "AI_RetryError",
    reason: "maxRetriesExceeded",
    lastError: Object.assign(new Error("Rate limit exceeded"), { statusCode: 429 }),
  })
  assert.deepEqual(await eli5(), { error: "AI rate limit hit. Try again in a minute." })
})

test("an unknown provider failure does not leak the raw SDK message", async () => {
  mock.method(console, "error", () => {})
  thrown = Object.assign(new Error("Invalid JSON response from https://api.mistral.ai/v1"), {
    statusCode: 500,
  })
  const { error } = await eli5()
  assert.doesNotMatch(error ?? "", /api\.mistral|JSON/)
  assert.match(error ?? "", /try again/i)
})
