import { test, expect } from "@playwright/test"

// Task 17 visual check: screenshots + no horizontal overflow.
const SHOTS = ".superpowers/sdd/2026-10-28-free-launch/shots/task-17"
const PAGES = { home: "/", reader: "/u/creator_demo/the-shape-of-attention", login: "/login" }

for (const scheme of ["light", "dark"] as const)
  for (const [w, h] of [[375, 812], [768, 1024], [1280, 800]])
    for (const [name, url] of Object.entries(PAGES))
      test(`${name} ${scheme} ${w}`, async ({ browser }) => {
        const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: w, height: h } })
        const page = await ctx.newPage()
        await page.addInitScript(() => {
          try { sessionStorage.setItem("subscribe_modal_shown", "1") } catch {}
        })
        await page.goto(url)
        await page.getByRole("button", { name: "Essential only" }).click({ timeout: 3000 }).catch(() => {})
        await page.waitForTimeout(500)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
        await page.screenshot({ path: `${SHOTS}/${name}-${scheme}-${w}.png` })
        await ctx.close()
      })
