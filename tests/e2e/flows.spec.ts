import { test, expect, type Page } from "@playwright/test"
import { randomUUID } from "crypto"
import { admin, fillLogin, createTestUser } from "./helpers"
import { TEST_BYOK_KEY } from "./constants"

const PASSWORD = "TestPassword123!"
const created: string[] = [] // user ids to clean up
const pieceIds: string[] = []

async function dismissTour(page: Page) {
  await page.locator(".driver-overlay").waitFor({ timeout: 4000 }).catch(() => {})
  if (await page.locator(".driver-overlay").isVisible().catch(() => false)) {
    await page.keyboard.press("Escape")
    await expect(page.locator(".driver-overlay")).toBeHidden()
  }
}

const MAILPIT = "http://127.0.0.1:54324/api/v1" // local Mailpit only; never a remote host
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(MAILPIT)) throw new Error("Mailpit URL must be local")

// Local Supabase requires email confirmation: read the link from Mailpit.
async function confirmLink(email: string): Promise<string> {
  let link = ""
  await expect
    .poll(
      async () => {
        const list = await (await fetch(`${MAILPIT}/search?query=${encodeURIComponent("to:" + email)}`)).json()
        const id = list.messages?.[0]?.ID
        if (!id) return ""
        const msg = await (await fetch(`${MAILPIT}/message/${id}`)).json()
        link = (msg.HTML as string).match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)?.[1]?.replace(/&amp;/g, "&") ?? ""
        return link
      },
      { timeout: 30_000 },
    )
    .not.toBe("")
  return link
}

async function signUp(page: Page, tag: string) {
  const email = `e2e+${tag}${Date.now()}@example.com`
  await page.goto("/signup?role=reader")
  // Controlled inputs: a fill before hydration is wiped, so retry until it sticks.
  await expect(async () => {
    await page.fill("#dob", "1990-01-01")
    await page.fill("#em", email)
    await page.fill("#pw", PASSWORD)
    await page.getByRole("checkbox").check()
    await expect(page.locator("#dob")).toHaveValue("1990-01-01", { timeout: 1000 })
  }).toPass({ timeout: 15_000 })
  await page.getByRole("button", { name: "Create account" }).click()
  const sent = page.getByText("Confirm your email")
  const err = page.locator("[data-sonner-toast][data-type=error]")
  await expect(sent.or(err)).toBeVisible({ timeout: 30_000 })
  // supabase/config.toml caps local confirmation emails (auth.rate_limit.email_sent).
  if (await err.isVisible()) {
    const msg = `signup blocked: ${await err.first().textContent()}`
    if (process.env.CI) throw new Error(msg)
    test.skip(true, msg)
  }
  const { data: users } = await admin().auth.admin.listUsers({ perPage: 200 })
  const u = users.users.find((x) => x.email === email)!
  expect(u).toBeTruthy()
  created.push(u.id)
  await page.goto(await confirmLink(email))
  await page.goto("/login")
  await fillLogin(page, email, PASSWORD)
  await page.waitForURL(/\/feed|\/studio/, { timeout: 30_000 })
  return { email, id: u.id }
}

async function enableAuthorMode(page: Page) {
  await page.goto("/studio/settings")
  const sw = page.getByRole("switch", { name: "Author mode" })
  await expect(sw).toBeVisible({ timeout: 20_000 })
  if ((await sw.getAttribute("aria-checked")) !== "true") {
    await sw.click()
    await expect(page.locator("[data-sonner-toast]").first()).toContainText("Author mode enabled")
    await expect(sw).toHaveAttribute("aria-checked", "true")
  }
}

test.afterAll(async () => {
  const db = admin()
  for (const id of pieceIds) {
    await db.from("blocks").delete().eq("content_object_id", id)
    await db.from("piece_crdt").delete().eq("piece_id", id)
    await db.from("content_objects").delete().eq("id", id)
  }
  // Sweep by email too: covers users whose id was never recorded (signup failed midway).
  const { data: all } = await db.auth.admin.listUsers({ perPage: 1000 })
  const ids = new Set([...created, ...all.users.filter((u) => u.email?.startsWith("e2e+") && u.email.endsWith("@example.com")).map((u) => u.id)])
  for (const id of ids) {
    const { data: orgs } = await db.from("organizations").select("id").eq("owner_id", id)
    for (const o of orgs ?? []) {
      await db.from("organization_members").delete().eq("organization_id", o.id)
      await db.from("organizations").delete().eq("id", o.id)
    }
    const { data: cos } = await db.from("content_objects").select("id").eq("author_id", id)
    for (const c of cos ?? []) {
      await db.from("blocks").delete().eq("content_object_id", c.id)
      await db.from("piece_crdt").delete().eq("piece_id", c.id)
      await db.from("content_objects").delete().eq("id", c.id)
    }
    await db.from("tiers").delete().eq("author_id", id)
    await db.from("user_roles").delete().eq("user_id", id)
    await db.auth.admin.deleteUser(id)
    await db.from("profiles").delete().eq("id", id)
  }
})

test("signup to published piece", async ({ page }) => {
  test.setTimeout(150_000)
  const { id } = await signUp(page, "pub")
  await enableAuthorMode(page)

  const title = `E2E published ${Date.now()}`
  await page.goto("/studio/drafts")
  await page.locator('button:has-text("Create piece")').first().click()
  await page.fill('input[placeholder="New piece title…"]', title)
  await page.click('button:has-text("Create")')
  await page.waitForURL(/\/studio\/drafts\/[0-9a-f-]{36}/, { timeout: 20_000 })
  pieceIds.push(page.url().match(/drafts\/([0-9a-f-]{36})/)![1])

  const blocks = page.locator("[data-block-uid]")
  await expect(blocks.first()).toBeVisible({ timeout: 20_000 })
  await dismissTour(page)
  const editor = blocks.first().locator(".ProseMirror")
  await editor.click()
  await page.keyboard.type("/heading")
  await page.keyboard.press("Enter")
  await page.keyboard.type("E2E heading")
  await page.keyboard.press("Enter")
  await page.keyboard.type("E2E paragraph body text.")
  await expect(page.locator("[data-block-uid]").first()).toContainText("E2E heading")

  await page.getByRole("button", { name: "Publish", exact: true }).click()
  await expect(page.getByRole("button", { name: "Unpublish" })).toBeVisible({ timeout: 20_000 })

  const db = admin()
  const { data: co } = await db.from("content_objects").select("slug").eq("id", pieceIds[0]).single()
  const { data: prof } = await db.from("profiles").select("handle").eq("id", id).single()
  await page.goto(`/u/${prof!.handle}/${co!.slug}`)
  await expect(page.getByRole("heading", { name: title }).first()).toBeVisible({ timeout: 20_000 })
})

test("free user uses studio features", async ({ page }) => {
  test.setTimeout(150_000)
  // Signup is covered above; local auth rate-limits confirmation emails, so seed this user.
  const email = `e2e+free${Date.now()}@example.com`
  created.push(await createTestUser(email, PASSWORD))
  await page.goto("/login")
  await fillLogin(page, email, PASSWORD)
  await page.waitForURL(/\/feed|\/studio/, { timeout: 30_000 })
  await enableAuthorMode(page)

  await page.goto("/studio/tiers")
  await expect(page.getByText("Studio plan required")).toHaveCount(0)
  await page.getByRole("button", { name: "Create tier" }).click()
  await page.getByPlaceholder("Supporter").fill("E2E tier")
  await page.getByPlaceholder("What does this tier promise?").fill("e2e")
  await page.locator("form").getByRole("button", { name: /create/i }).click()
  await expect(page.getByText("Tier created")).toBeVisible({ timeout: 20_000 })

  await page.goto("/studio/analytics")
  await expect(page.getByRole("heading", { name: "Analytics" }).first()).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(/plan required/i)).toHaveCount(0)

  await page.goto("/studio/org")
  await expect(page.getByText(/plan required/i)).toHaveCount(0)
  await page.getByRole("button", { name: "Create organization" }).click()
  await page.getByPlaceholder("e.g. Sequoia Research").fill("E2E Org")
  await page.getByRole("button", { name: "Create", exact: true }).click()
  await expect(page.getByText("Organization created")).toBeVisible({ timeout: 20_000 })
})

test.describe("anon reads paid block", () => {
  const phrase = `unique-paid-phrase-${randomUUID().slice(0, 8)}`
  const slug = `e2e-paid-${Date.now()}`
  let pid = ""

  test.beforeAll(async () => {
    const db = admin()
    const { data: author } = await db.from("profiles").select("id").eq("handle", "creator_demo").single()
    const { data: tmpl } = await db.from("content_objects").select("workspace_id").eq("author_id", author!.id).eq("visibility", "public").limit(1).single()
    const { data: co, error } = await db
      .from("content_objects")
      .insert({
        workspace_id: tmpl!.workspace_id,
        author_id: author!.id,
        title: "E2E paid piece",
        slug,
        status: "published",
        visibility: "public",
        published_at: new Date().toISOString(),
      })
      .select("id")
      .single()
    expect(error).toBeNull()
    pid = co!.id
    pieceIds.push(pid)
    const { error: be } = await db.from("blocks").insert({
      content_object_id: pid,
      order: 0,
      type: "paragraph",
      content: { html: `<p>${phrase}</p>`, text: phrase },
      mode_visibility: ["skim", "standard", "expert", "teach", "debate"],
      monetization_eligible: true,
    })
    expect(be).toBeNull()
  })

  test("anon sees the phrase and the launch badge", async ({ page }) => {
    await page.goto(`/u/creator_demo/${slug}`)
    await expect(page.getByText(phrase)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText("Free during launch")).toBeVisible()
  })
})

test("BYOK save works", async ({ page }) => {
  test.setTimeout(90_000)
  const email = `e2e+byok${Date.now()}@example.com`
  const id = await createTestUser(email, PASSWORD)
  created.push(id)
  await page.goto("/login")
  await fillLogin(page, email, PASSWORD)
  await page.waitForURL(/\/feed|\/studio/, { timeout: 30_000 })
  await enableAuthorMode(page) // BYOK fields only render in author mode
  const key = page.locator("#set-byok-key")
  await expect(key).toBeVisible({ timeout: 20_000 })
  await expect(async () => {
    await key.fill(TEST_BYOK_KEY.plain)
    await expect(key).toHaveValue(TEST_BYOK_KEY.plain, { timeout: 1000 })
  }).toPass({ timeout: 15_000 })
  await page.getByRole("button", { name: "Save profile" }).click()
  const toast = page.locator("[data-sonner-toast]").first()
  await expect(toast).toBeVisible({ timeout: 20_000 })
  const text = (await toast.textContent()) ?? ""
  if (/not configured|BYOK_ENCRYPTION_KEY/i.test(text)) {
    // A reused dev server doesn't get playwright.config webServer.env.
    const msg = `server lacks BYOK_ENCRYPTION_KEY (${text}); restart the dev server with it set`
    if (process.env.CI) throw new Error(msg)
    test.skip(true, msg)
  }
  await expect(toast).toContainText("Profile updated")

  const { data: row } = await admin().from("profiles").select("*").eq("id", id).single()
  expect(row!.byok_api_key).toMatch(/^enc:v1:/)
  expect(JSON.stringify(row)).not.toContain(TEST_BYOK_KEY.plain)
  await expect(page.getByText(TEST_BYOK_KEY.plain)).toHaveCount(0)
  expect(await page.content()).not.toContain(TEST_BYOK_KEY.plain)
})
