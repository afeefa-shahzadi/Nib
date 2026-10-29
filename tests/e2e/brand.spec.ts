import { test, expect } from "@playwright/test"

// Task 21: Nib rebrand, accent themes, env-gated socials.
test("title, header mark, footer socials", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveTitle(/Nib/)
  const home = page.locator("header").getByRole("link", { name: "Nib home" })
  await expect(home.locator("svg path")).toHaveCount(2)
  await expect(home).toContainText("nib")
  // No NEXT_PUBLIC_SOCIAL_* set in dev ⇒ no social icons.
  for (const l of ["X", "GitHub", "LinkedIn", "Instagram", "YouTube"])
    await expect(page.locator("footer").getByRole("link", { name: l, exact: true })).toHaveCount(0)
})

test("/icon.svg is served", async ({ request }) => {
  const r = await request.get("/icon.svg")
  expect(r.status()).toBe(200)
  expect(r.headers()["content-type"]).toContain("image/svg+xml")
})

test("picking oxblood sets data-accent and persists across reload", async ({ page }) => {
  await page.goto("/login")
  await page.getByRole("button", { name: /I'm a reader/ }).click()
  await page.getByLabel("Email").fill("test_reader@example.com")
  await page.getByLabel("Password").fill("TestPassword123!")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.waitForURL((u) => !u.pathname.startsWith("/login"))
  await page.goto("/studio/settings")
  const html = page.locator("html")
  const primary = () => html.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--primary"))
  const ink = await primary()
  await page.locator("label", { hasText: "Oxblood" }).click()
  await expect(html).toHaveAttribute("data-accent", "oxblood")
  const ox = await primary()
  expect(ox).not.toBe(ink)
  await page.reload()
  await expect(html).toHaveAttribute("data-accent", "oxblood")
  expect(await primary()).toBe(ox)
  await page.locator("label", { hasText: "Ink" }).click()
  await expect(html).toHaveAttribute("data-accent", "ink")
})
