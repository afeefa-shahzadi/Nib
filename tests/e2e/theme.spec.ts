import { test, expect } from "@playwright/test"

// Task 17: light mode, rich-text basics, hairline.
const PIECE = "/u/creator_demo/the-shape-of-attention"
const bg = (page: import("@playwright/test").Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor)
// Computed colors come back as lab(L a b) in Chromium: compare lightness L.
const lum = (c: string) => parseFloat(c.match(/[\d.]+/)![0])

test("light vs dark background, toggle persists both ways", async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: "light", viewport: { width: 375, height: 812 } })
  const page = await ctx.newPage()
  await page.goto("/login")
  const light = await bg(page)
  const toggle = page.getByRole("button", { name: "Toggle theme" }).first()
  expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await toggle.click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  const dark = await bg(page)
  expect(lum(light)).toBeGreaterThan(lum(dark) + 50)
  await page.reload()
  await expect(page.locator("html")).toHaveClass(/dark/)
  expect(await bg(page)).toBe(dark)
  await page.getByRole("button", { name: "Toggle theme" }).first().click()
  await expect(page.locator("html")).not.toHaveClass(/dark/)
  await page.reload()
  await expect(page.locator("html")).not.toHaveClass(/dark/)
  expect(await bg(page)).toBe(light)
  await ctx.close()
})

test("rich text lists and links", async ({ page }) => {
  await page.goto(PIECE)
  // The real reader rich-text container carries the class the CSS targets.
  await expect(page.locator("article .prose").first()).toBeVisible()
  const r = await page.evaluate(() => {
    const host = document.querySelector("article .prose")!.parentElement!
    const mk = (html: string) => {
      const d = document.createElement("div")
      d.className = "prose"
      d.innerHTML = html
      host.appendChild(d)
      return d
    }
    const d = mk('<ul><li>a</li></ul><ol><li>b</li></ol><p><a href="/x">l</a></p>')
    const s = (q: string) => getComputedStyle(d.querySelector(q)!)
    return { ul: s("ul").listStyleType, ol: s("ol").listStyleType, a: s("a").textDecorationLine }
  })
  expect(r).toEqual({ ul: "disc", ol: "decimal", a: "underline" })
})

test("login role cards have a visible border", async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: "light" })
  const page = await ctx.newPage()
  await page.goto("/login")
  const card = page.locator("button.hairline").first()
  await expect(card).toBeVisible()
  const c = await card.evaluate((e) => {
    const s = getComputedStyle(e)
    return { w: s.borderTopWidth, border: s.borderTopColor, bg: s.backgroundColor }
  })
  expect(c.w).toBe("1px")
  expect(c.border).not.toBe(c.bg)
  expect(Math.abs(lum(c.border) - lum(c.bg))).toBeGreaterThan(3)
  await ctx.close()
})
