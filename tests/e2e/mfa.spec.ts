import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { createHmac, randomUUID } from "crypto"
import { admin as adminClient, env, fillLogin, createTestUser } from "./helpers"

// RFC 6238 TOTP (SHA-1, 30 s, 6 digits) from a base32 secret.
function totp(secret: string, at = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  let bits = ""
  for (const c of secret.replace(/=+$/, "").toUpperCase())
    bits += alphabet.indexOf(c).toString(2).padStart(5, "0")
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)))
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)))
  const h = createHmac("sha1", key).update(counter).digest()
  const o = h[h.length - 1] & 0xf
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0")
}

// Supabase rejects a TOTP code reused within its step; wait for a new one.
let lastStep = 0
async function freshCode(secret: string) {
  while (Math.floor(Date.now() / 30_000) <= lastStep) await new Promise((r) => setTimeout(r, 500))
  lastStep = Math.floor(Date.now() / 30_000)
  return totp(secret)
}

function anonClient() {
  const v = env()
  return createClient(v.NEXT_PUBLIC_SUPABASE_URL, v.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Throwaway user with a verified TOTP factor; returns its id and secret.
async function userWithTotp(email: string, password: string) {
  const userId = await createTestUser(email, password)
  const c = anonClient()
  await c.auth.signInWithPassword({ email, password })
  const { data: enrolled, error: eErr } = await c.auth.mfa.enroll({ factorType: "totp" })
  expect(eErr).toBeNull()
  const secret = enrolled!.totp.secret
  const { error: vErr } = await c.auth.mfa.challengeAndVerify({
    factorId: enrolled!.id,
    code: await freshCode(secret),
  })
  expect(vErr).toBeNull()
  await c.auth.signOut({ scope: "local" })
  return { userId, secret, factorId: enrolled!.id }
}

test("a user with a verified TOTP factor is challenged after password sign-in", async ({ page }) => {
  test.setTimeout(150_000)
  const email = `mfa_e2e_${Date.now()}@example.com`
  const password = `T-${randomUUID()}`
  const { userId, secret } = await userWithTotp(email, password)
  try {
    // Password sign-in in the browser.
    await page.goto("/login")
    await fillLogin(page, email, password)

    await page.waitForURL("**/login/mfa**", { timeout: 20_000 })
    // Any signed-in page bounces back to the challenge at AAL1.
    await page.goto("/studio")
    await expect(page).toHaveURL(/\/login\/mfa/)
    // ...and the API answers 401 instead of serving data.
    expect((await page.request.get("/api/export/subscribers")).status()).toBe(401)

    await page.fill("#mfa-code", "000000")
    await page.click('button[type="submit"]')
    await expect(page.getByText("That code didn't work", { exact: false })).toBeVisible()
    await expect(page).toHaveURL(/\/login\/mfa/)

    await page.fill("#mfa-code", await freshCode(secret))
    await page.click('button[type="submit"]')
    await page.waitForURL("**/studio**", { timeout: 20_000 })
    expect(page.url()).not.toContain("/login/mfa")
  } finally {
    await adminClient().auth.admin.deleteUser(userId)
  }
})

test("PostgREST refuses an AAL1 session of a TOTP user and serves the AAL2 one", async () => {
  test.setTimeout(150_000)
  const email = `mfa_rls_${Date.now()}@example.com`
  const password = `T-${randomUUID()}`
  const { userId, secret, factorId } = await userWithTotp(email, password)
  try {
    const c = anonClient()
    await c.auth.signInWithPassword({ email, password }) // AAL1
    const aal1 = await c.from("profiles").select("id").eq("id", userId)
    expect(aal1.error !== null || (aal1.data ?? []).length === 0).toBe(true)

    const { error: vErr } = await c.auth.mfa.challengeAndVerify({
      factorId,
      code: await freshCode(secret),
    }) // now AAL2
    expect(vErr).toBeNull()
    const aal2 = await c.from("profiles").select("id").eq("id", userId)
    expect(aal2.error).toBeNull()
    expect(aal2.data).toHaveLength(1)
  } finally {
    await adminClient().auth.admin.deleteUser(userId)
  }
})
