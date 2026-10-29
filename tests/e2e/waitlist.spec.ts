import { test, expect, type Page } from "@playwright/test"
import * as fs from "fs"

const env: Record<string, string> = {}
for (const line of fs.readFileSync(".env.development.local", "utf-8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "")
}

async function rows(email: string) {
  const res = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(email)}`,
    { headers: { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` } }
  )
  return (await res.json()) as { item: string; source: string }[]
}

const article = (page: Page, name: string) =>
  page.locator("article").filter({ has: page.getByRole("heading", { name, exact: true }) })

test.describe("waitlist", () => {
  test("anon joins Studio waitlist from pricing", async ({ page }) => {
    const email = `e2e+${Date.now()}@example.com`
    await page.goto("/pricing")
    await article(page, "Studio").getByRole("button", { name: "Join waitlist" }).click()
    await page.getByLabel("Email").fill(email)
    await page.getByRole("button", { name: "Submit" }).click()
    await expect(page.getByText("You're on the list")).toBeVisible()
    const r = await rows(email)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ item: "studio", source: "pricing" })
  })

  test("pricing says Free during launch", async ({ page }) => {
    await page.goto("/pricing")
    await expect(page.getByText("Free during launch").first()).toBeVisible()
    await expect(page.getByText(/via Razorpay/)).toHaveCount(0)
  })

  test("anon bad email shows error", async ({ page }) => {
    await page.goto("/pricing")
    await article(page, "Studio").getByRole("button", { name: "Join waitlist" }).click()
    await page.getByLabel("Email").fill("nope")
    await page.getByRole("button", { name: "Submit" }).click()
    await expect(page.getByText("You're on the list")).toHaveCount(0)
    expect(await rows("nope")).toHaveLength(0)
  })

  test("signed-in joins with one click", async ({ page }) => {
    await page.goto("/login")
    await page.getByRole("button", { name: /I'm a reader/ }).click()
    await page.getByLabel("Email").fill("test_reader@example.com")
    await page.getByLabel("Password").fill("TestPassword123!")
    await page.getByRole("button", { name: "Sign in", exact: true }).click()
    await page.waitForURL((u) => !u.pathname.startsWith("/login"))
    // pricing resolves the session client-side; click only once it has.
    const authed = page.waitForResponse((r) => r.url().includes("/auth/v1/user"))
    await page.goto("/pricing")
    await authed
    await article(page, "Reader Pass").getByRole("button", { name: "Join waitlist" }).click()
    await expect(page.getByText("You're on the list")).toBeVisible()
    await expect(page.getByLabel("Email")).toHaveCount(0)
  })

  test("tip jar shows waitlist, not checkout", async ({ page }) => {
    const hits: string[] = []
    page.on("request", (r) => {
      if (r.url().includes("checkout.razorpay.com")) hits.push(r.url())
    })
    await page.goto("/u/creator_demo/the-shape-of-attention")
    await expect(page.getByText("Tip the author").locator("xpath=ancestor::div[contains(@class,'surface')]").getByRole("button", { name: "Join waitlist" })).toBeVisible()
    expect(hits).toEqual([])
  })

  test("/pricing?checkout=studio does not open Razorpay", async ({ page }) => {
    const hits: string[] = []
    page.on("request", (r) => {
      if (r.url().includes("checkout.razorpay.com")) hits.push(r.url())
    })
    await page.goto("/pricing?checkout=studio")
    await page.waitForTimeout(1500)
    expect(hits).toEqual([])
  })
  async function login(page: Page, role: RegExp, email: string) {
    await page.goto("/login")
    await page.getByRole("button", { name: role }).click()
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill("TestPassword123!")
    await page.getByRole("button", { name: "Sign in", exact: true }).click()
    await page.waitForURL((u) => !u.pathname.startsWith("/login"))
  }

  test("admin sees waitlist counts", async ({ page }) => {
    const email = `e2e+admin${Date.now()}@example.com`
    await page.goto("/pricing")
    await article(page, "Studio").getByRole("button", { name: "Join waitlist" }).click()
    await page.getByLabel("Email").fill(email)
    await page.getByRole("button", { name: "Submit" }).click()
    await expect(page.getByText("You're on the list")).toBeVisible()
    await login(page, /I.m an author/, "test_studio@example.com")
    await page.goto("/admin/waitlist")
    await expect(page.getByRole("heading", { name: "Waitlist", exact: true })).toBeVisible()
    const card = page.locator("section").filter({ has: page.getByRole("heading", { name: "studio", exact: true }) })
    await expect(card).toBeVisible()
    expect(Number(await card.getByTestId("waitlist-count").innerText())).toBeGreaterThanOrEqual(1)
    await expect(card.getByText(email)).toBeVisible()
  })

  test("non-admin redirected", async ({ page }) => {
    await login(page, /I'm a reader/, "test_reader@example.com")
    await page.goto("/admin/waitlist")
    await expect(page).toHaveURL(/\/$/)
  })
})
