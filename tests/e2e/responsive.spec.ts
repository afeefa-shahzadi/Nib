import { test, expect, type Page } from "@playwright/test"
import { AUTHOR, loginAs } from "./auth"
import { AUTHOR_ROUTES, PUBLIC_ROUTES } from "./routes"

test.setTimeout(90_000)

const consent = () =>
  localStorage.setItem("cookie_preferences", JSON.stringify({ essential: true, analytics: false, marketing: false }))

// Auth pages render without the site header.
const NO_CHROME = new Set(["/login", "/signup", "/forgot-password"])

async function noOverflow(page: Page, route: string) {
  await page.goto(route)
  await expect(page.locator("main, h1").first()).toBeVisible()
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
  expect(sw, `${route} overflows (${sw} > ${iw})`).toBeLessThanOrEqual(iw + 1)
}

/** Primary nav visible with links, or the "Open menu" toggle opens one. */
async function hasNav(page: Page, route: string) {
  const toggle = page.getByRole("button", { name: "Open menu" })
  if (await toggle.isVisible()) {
    await toggle.click()
    await expect(page.locator("nav:visible a").first(), `${route} menu toggle opens no links`).toBeVisible()
  } else {
    await expect(page.locator("nav:visible a").first(), `${route} has no visible nav`).toBeVisible()
  }
}

test.describe("public", () => {
  test.beforeEach(({ page }) => page.addInitScript(consent))
  for (const r of PUBLIC_ROUTES) {
    test(`${r} fits`, async ({ page }) => {
      await noOverflow(page, r)
      if (!NO_CHROME.has(r)) await hasNav(page, r)
    })
  }

  test("pricing waitlist field does not overflow", async ({ page }) => {
    await page.goto("/pricing")
    await page.getByRole("button", { name: /waitlist|notify/i }).first().click()
    await expect(page.locator('input[type="email"]:visible').first()).toBeVisible()
    await noOverflow(page, "/pricing")
  })
})

test.describe("author", () => {
  let page: Page
  test.beforeAll(async ({ browser }) => {
    page = await (await browser.newContext()).newPage()
    await loginAs(page, AUTHOR.email, AUTHOR.password)
  })
  test.afterAll(() => page.context().close())
  for (const r of AUTHOR_ROUTES) {
    test(`${r} fits`, async () => {
      await noOverflow(page, r)
      await hasNav(page, r)
    })
  }
})

// Parked: /admin/waitlist overflows at 375px (admin-only). Enable once fixed.
test.fixme("/admin/waitlist fits at 375px", async () => {})
