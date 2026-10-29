import { test, before, afterEach, mock } from "node:test"
import assert from "node:assert/strict"

mock.module("@/lib/supabase/server", {
  namedExports: {
    createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) } }),
  },
})
mock.module("@/lib/rate-limit.server", {
  namedExports: { checkRateLimit: async () => ({ ok: true }) },
})

let code: typeof import("@/actions/code")
before(async () => {
  code = await import("@/actions/code")
})

const savedEnv = process.env.PISTON_API_URL
const savedFetch = globalThis.fetch
afterEach(() => {
  if (savedEnv === undefined) delete process.env.PISTON_API_URL
  else process.env.PISTON_API_URL = savedEnv
  globalThis.fetch = savedFetch
})

test("codeRunEnabled false without env", async () => {
  delete process.env.PISTON_API_URL
  assert.equal(await code.codeRunEnabled(), false)
})

test("codeRunEnabled true with env", async () => {
  process.env.PISTON_API_URL = "http://piston.test"
  assert.equal(await code.codeRunEnabled(), true)
})

test("executeCode does not fetch when unconfigured", async () => {
  delete process.env.PISTON_API_URL
  const calls: unknown[] = []
  globalThis.fetch = (async (...a: unknown[]) => {
    calls.push(a)
    return new Response("{}")
  }) as typeof fetch
  const res = await code.executeCode("python", "print(1)")
  assert.equal(calls.length, 0)
  assert.equal(res.error, "Code execution is not configured")
})
