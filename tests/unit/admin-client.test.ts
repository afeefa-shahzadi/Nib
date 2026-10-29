import { test, mock } from "node:test"
import assert from "node:assert/strict"

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321"
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key"
process.env.SUPABASE_SECRET_KEY = "secret-key"

const USER_TOKEN = "user-access-token"
const session = {
  access_token: USER_TOKEN,
  refresh_token: "r",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: "u1", aud: "authenticated", role: "authenticated" },
}
const cookie = {
  name: "sb-127-auth-token",
  value: "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"),
}

mock.module("next/headers", {
  namedExports: {
    cookies: async () => ({ getAll: () => [cookie], set: () => {} }),
  },
})

test("createAdminClient sends the secret key, not the signed-in user's token", async () => {
  const seen: string[] = []
  const realFetch = globalThis.fetch
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    seen.push(new Headers(init?.headers).get("Authorization") ?? "")
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } })
  }) as typeof fetch
  try {
    const { createAdminClient } = await import("@/lib/supabase/server")
    const admin = await createAdminClient()
    await admin.from("profiles").select("id")
  } finally {
    globalThis.fetch = realFetch
  }
  assert.deepEqual(seen, ["Bearer secret-key"])
})
