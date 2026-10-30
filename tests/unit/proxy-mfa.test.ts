/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, before, mock } from "node:test"
import assert from "node:assert/strict"
import { NextRequest } from "next/server"

// What the fake session reports.
let user: any = null
let aal: any = null
mock.module("@supabase/ssr", {
  namedExports: {
    createServerClient: () => ({
      auth: {
        getClaims: async () => ({ data: user ? { claims: { sub: user.id } } : null }),
        mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: aal, error: null }) },
      },
    }),
  },
})

let proxy: typeof import("@/proxy").proxy
before(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://sb.test"
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "anon"
  proxy = (await import("@/proxy")).proxy
})

const req = (path: string, init: { method?: string; headers?: Record<string, string> } = {}) =>
  new NextRequest(new URL(path, "http://localhost:3000"), {
    method: init.method ?? "GET",
    // A signed-in browser carries the auth cookie; the proxy skips auth without it.
    headers: { host: "localhost:3000", ...(user ? { cookie: "sb-test-auth-token=x" } : {}), ...init.headers },
  })
const action = (path: string) =>
  req(path, { method: "POST", headers: { "next-action": "abc123" } })
const location = (res: Response) => res.headers.get("location")

test("AAL1 session with a verified TOTP factor is sent to the challenge", async () => {
  user = { id: "u1" }
  aal = { currentLevel: "aal1", nextLevel: "aal2" }
  for (const path of ["/studio", "/feed", "/me/earnings?tab=x"]) {
    const res = await proxy(req(path))
    const loc = new URL(location(res)!)
    assert.equal(loc.pathname, "/login/mfa", path)
    assert.equal(loc.searchParams.get("redirect"), path)
  }
})

test("the challenge page itself renders at AAL1", async () => {
  user = { id: "u1" }
  aal = { currentLevel: "aal1", nextLevel: "aal2" }
  const res = await proxy(req("/login/mfa"))
  assert.equal(location(res), null)
  assert.notEqual(res.status, 401)
})

test("AAL1 server actions are refused on every path, including /login/mfa", async () => {
  user = { id: "u1" }
  aal = { currentLevel: "aal1", nextLevel: "aal2" }
  for (const path of ["/login/mfa", "/studio", "/"]) {
    assert.equal((await proxy(action(path))).status, 401, path)
  }
})

test("AAL1 headerless form POSTs (no-JS server actions) are refused, /login/mfa included", async () => {
  user = { id: "u1" }
  aal = { currentLevel: "aal1", nextLevel: "aal2" }
  const form = (path: string, type: string) =>
    req(path, { method: "POST", headers: { "content-type": type } })
  assert.equal((await proxy(form("/login/mfa", "multipart/form-data; boundary=x"))).status, 401)
  assert.equal((await proxy(form("/studio/drafts", "application/x-www-form-urlencoded"))).status, 401)
  assert.equal((await proxy(req("/studio", { method: "PUT" }))).status, 401)
  // Reads still render / redirect.
  assert.notEqual((await proxy(req("/login/mfa", { method: "HEAD" }))).status, 401)
})

test("AAL1 API calls are refused", async () => {
  user = { id: "u1" }
  aal = { currentLevel: "aal1", nextLevel: "aal2" }
  for (const path of ["/api/export/subscribers", "/api/import", "/auth/callback"]) {
    assert.equal((await proxy(req(path))).status, 401, path)
  }
})

test("prefixes match whole path segments only", async () => {
  user = { id: "u1" }
  aal = { currentLevel: "aal1", nextLevel: "aal2" }
  for (const path of ["/authors", "/apiary"]) {
    const res = await proxy(req(path))
    assert.notEqual(res.status, 401, path) // a page, not an API route
    assert.equal(new URL(location(res)!).pathname, "/login/mfa", path)
  }
  user = null
  aal = null
  for (const path of ["/media", "/studios", "/notificationsx"]) {
    assert.equal(location(await proxy(req(path))), null, `${path} is not protected`)
  }
  assert.equal(new URL(location(await proxy(req("/me")))!).pathname, "/login")
  assert.equal(new URL(location(await proxy(req("/studio/drafts")))!).pathname, "/login")
})

test("webhooks and cron (no user session) are unaffected", async () => {
  user = null
  aal = null
  for (const path of ["/api/webhooks/razorpay", "/api/cron/payouts"]) {
    const res = await proxy(req(path, { method: "POST" }))
    assert.notEqual(res.status, 401, path)
    assert.equal(location(res), null, path)
  }
})

test("AAL2 sessions and users without a factor pass through", async () => {
  user = { id: "u1" }
  for (const level of [
    { currentLevel: "aal2", nextLevel: "aal2" },
    { currentLevel: "aal1", nextLevel: "aal1" },
  ]) {
    aal = level
    assert.equal(location(await proxy(req("/studio"))), null)
    assert.notEqual((await proxy(action("/studio"))).status, 401)
    assert.notEqual((await proxy(req("/api/export/subscribers"))).status, 401)
  }
})
