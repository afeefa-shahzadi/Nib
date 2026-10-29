import { test, expect } from "@playwright/test"

test.describe("Core smoke tests", () => {
  test("landing page loads", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveTitle(/Nib/)
    // The page should render some content
    await expect(page.locator("body")).not.toBeEmpty()
  })

  test("login page is accessible", async ({ page }) => {
    await page.goto("/login")
    // Should have an email/password input or login form
    await expect(page.locator("body")).not.toBeEmpty()
  })

  test("studio redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/studio")
    // proxy.ts should redirect to /login
    await page.waitForURL(/\/login/)
    expect(page.url()).toContain("/login")
  })

  test("signup page is accessible", async ({ page }) => {
    await page.goto("/signup")
    await expect(page.locator("body")).not.toBeEmpty()
  })

  test("pricing page loads", async ({ page }) => {
    await page.goto("/pricing")
    await expect(page.locator("body")).not.toBeEmpty()
  })

  test("about page loads", async ({ page }) => {
    await page.goto("/about")
    await expect(page.locator("body")).not.toBeEmpty()
  })

  test("feed page loads", async ({ page }) => {
    await page.goto("/feed")
    await expect(page.locator("body")).not.toBeEmpty()
  })

  test("search page loads", async ({ page }) => {
    await page.goto("/search")
    await expect(page.locator("body")).not.toBeEmpty()
  })
})
