import { test, expect, type Page } from "@playwright/test"
import { admin } from "./helpers"
import { AUTHOR, createRoleUser, loginAs } from "./auth"
import { ADMIN_ROUTES, AUTHOR_ROUTES, PUBLIC_ROUTES, READER_ROUTES } from "./routes"

const PW = "TestPassword123!"
const tag = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`
const READER = { email: `e2e_reader_${tag}@example.com`, password: PW }
const ADMINU = { email: `e2e_admin_${tag}@example.com`, password: PW }
const ids: string[] = []
let draftRoute = ""
const DRAFT = "/studio/drafts/[first seeded draft]"

test.setTimeout(90_000)

const consent = () =>
  localStorage.setItem("cookie_preferences", JSON.stringify({ essential: true, analytics: false, marketing: false }))

async function check(page: Page, route: string) {
  const origin = new URL(test.info().project.use.baseURL ?? "http://localhost:3000").origin
  const bad: string[] = []
  page.on("console", (m) => m.type() === "error" && bad.push(`console: ${m.text()}`))
  page.on("pageerror", (e) => bad.push(`pageerror: ${e.message}`))
  page.on("response", (r) => {
    if (r.status() >= 500 && new URL(r.url()).origin === origin) bad.push(`${r.status()} ${r.url()}`)
  })
  const res = await page.goto(route)
  expect(res!.status(), route).toBeLessThan(400)
  await expect(page.locator("main, h1").first(), route).toBeVisible()
  await expect(page.locator("[data-nextjs-dialog], :text(\"Application error\")"), route).toHaveCount(0)
  expect(bad, route).toEqual([])
}

// One logged-in page per describe; one test per route so failures don't hide each other.
function suite(name: string, user: { email: string; password: string } | null, routes: string[]) {
  test.describe(name, () => {
    let page: Page
    test.beforeAll(async ({ browser }) => {
      page = await (await browser.newContext()).newPage()
      if (user) await loginAs(page, user.email, user.password)
      else await page.addInitScript(consent)
    })
    test.afterAll(() => page.context().close())
    for (const route of routes) {
      test(route, async () => {
        await check(page, route === DRAFT ? draftRoute : route)
      })
    }
  })
}

test.beforeAll(async () => {
  ids.push(await createRoleUser(READER.email, READER.password, ["reader"]))
  ids.push(await createRoleUser(ADMINU.email, ADMINU.password, ["admin"]))
  const db = admin()
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 })
  const uid = users.users.find((u) => u.email === AUTHOR.email)?.id
  const { data } = await db.from("content_objects").select("id").eq("author_id", uid!).order("created_at").limit(1)
  if (!data?.[0]) throw new Error("seed draft missing for test_studio; run scripts/seed_test_users.ts")
  draftRoute = `/studio/drafts/${data[0].id}`
})

test.afterAll(async () => {
  const db = admin()
  for (const id of ids) {
    // Don't rely on FK cascades.
    await db.from("user_roles").delete().eq("user_id", id)
    await db.from("profiles").delete().eq("id", id)
    await db.auth.admin.deleteUser(id)
  }
})

suite("public", null, PUBLIC_ROUTES)
suite("reader", READER, READER_ROUTES)
suite("author", AUTHOR, [...AUTHOR_ROUTES, DRAFT])
suite("admin", ADMINU, ADMIN_ROUTES)

test("anon is redirected from protected routes", async ({ page }) => {
  for (const r of ["/studio", "/studio/drafts", "/studio/settings", "/notifications", "/me/earnings"]) {
    await page.goto(r)
    await expect(page, r).toHaveURL(/\/login/)
  }
  for (const r of ADMIN_ROUTES) {
    await page.goto(r)
    await expect(page, r).not.toHaveURL(/\/admin/)
  }
})

test("reader is denied from /admin", async ({ browser }) => {
  const page = await (await browser.newContext()).newPage()
  await loginAs(page, READER.email, READER.password)
  for (const r of ADMIN_ROUTES) {
    await page.goto(r)
    await expect(page, r).not.toHaveURL(/\/admin/)
  }
})
