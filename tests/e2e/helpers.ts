import { expect, type Page } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"

// Local dev env only. NEVER read .env.local (hosted prod). CI supplies process.env.
export function env() {
  const vars: Record<string, string> = {}
  const file = ".env.development.local"
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf-8").split(String.fromCharCode(10))) {
      const m = line.match(/^([A-Z_]+)=(.+)$/)
      if (m) vars[m[1]] = m[2].trim().replace(/['"]/g, "")
    }
  }
  for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"])
    if (process.env[k] && !vars[k]) vars[k] = process.env[k]!
  assertLocalSupabase(vars.NEXT_PUBLIC_SUPABASE_URL)
  return vars
}

/** Throws unless the URL is a local Supabase; tests create/delete users. */
export function assertLocalSupabase(url?: string) {
  const host = url ? new URL(url).hostname : ""
  if (host !== "127.0.0.1" && host !== "localhost") throw new Error(`Refusing to run e2e against non-local Supabase: ${host || "(unset)"}`)
}

/** Service-role client — seeds DB state the UI can't produce. */
export function admin() {
  const v = env()
  return createClient(v.NEXT_PUBLIC_SUPABASE_URL, v.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Fill the login form (assumes the page is on /login). */
export async function fillLogin(page: Page, email: string, password: string) {
  const authorTab = page.locator('text="I\'m an author"')
  // isVisible() doesn't wait, so on a cold page it raced the role picker.
  await Promise.race([authorTab.waitFor(), page.locator("#email").waitFor()]).catch(() => {})
  if (await authorTab.isVisible()) await authorTab.click()
  await page.fill("#email", email)
  await page.fill("#password", password)
  await page.click('button[type="submit"]')
}

/** Throwaway confirmed user; returns its id. Delete with admin().auth.admin.deleteUser. */
export async function createTestUser(email: string, password: string) {
  const db = admin()
  const handle = email.split("@")[0].slice(0, 30)
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "E2E User", handle },
  })
  expect(error).toBeNull()
  // Same as scripts/seed_test_users.ts: make sure the profile row exists.
  await db.from("profiles").upsert({ id: data.user!.id, handle, display_name: "E2E User" })
  return data.user!.id
}
