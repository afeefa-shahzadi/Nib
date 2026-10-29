import { test } from "@playwright/test"
import { fillLogin } from "./helpers"

// Task 20 visual check: screenshots of public pages + one studio page.
const SHOTS = ".superpowers/sdd/2026-10-28-free-launch/shots/task-20"
const PAGES = { reader: "/u/creator_demo/the-shape-of-attention", home: "/", pricing: "/pricing", studio: "/studio/quests", analytics: "/studio/analytics" }

for (const scheme of ["light", "dark"] as const)
  for (const w of [375, 1280])
    for (const [name, url] of Object.entries(PAGES))
      test(`${name} ${scheme} ${w}`, async ({ browser }) => {
        const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: w, height: 900 } })
        const page = await ctx.newPage()
        await page.addInitScript(() => {
          try { sessionStorage.setItem("subscribe_modal_shown", "1") } catch {}
        })
        if (name.startsWith("stud") || name === "analytics") {
          await page.goto("/login")
          await fillLogin(page, "test_studio@example.com", "TestPassword123!")
          await page.waitForURL(/studio|\/$/, { timeout: 15000 }).catch(() => {})
        }
        await page.goto(url)
        await page.getByRole("button", { name: "Essential only" }).click({ timeout: 3000 }).catch(() => {})
        await page.waitForTimeout(800)
        await page.screenshot({ path: `${SHOTS}/${name}-${scheme}-${w}.png`, fullPage: name === "reader" })
        await ctx.close()
      })
