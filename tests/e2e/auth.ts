import { type Page } from "@playwright/test"
import { admin, fillLogin } from "./helpers"

export const AUTHOR = { email: "test_studio@example.com", password: "TestPassword123!" }

export async function loginAs(page: Page, email: string, password: string) {
  await page.addInitScript(() =>
    localStorage.setItem("cookie_preferences", JSON.stringify({ essential: true, analytics: false, marketing: false }))
  )
  await page.goto("/login")
  await fillLogin(page, email, password)
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 })
}

/** Throwaway confirmed user with the given roles (user_roles rows). */
export async function createRoleUser(email: string, password: string, roles: string[]) {
  const db = admin()
  const handle = email.split("@")[0].slice(0, 30)
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "E2E User", handle },
  })
  if (error) throw error
  const id = data.user!.id
  await db.from("profiles").upsert({ id, handle, display_name: "E2E User" })
  await db.from("user_roles").delete().eq("user_id", id)
  if (roles.length) await db.from("user_roles").insert(roles.map((role) => ({ user_id: id, role })))
  return id
}
