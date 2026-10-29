import { test } from "@playwright/test"
import { fillLogin } from "./helpers"
import * as fs from "fs"
import * as path from "path"

const SCREENSHOT_DIR =
  "C:\\Users\\omkar\\.gemini\\antigravity-ide\\brain\\e973dd9d-64be-47a4-8ed5-e41790cadea8\\screenshots"

const VIEWPORTS = [
  { name: "sm", width: 375, height: 812 },
  { name: "md", width: 768, height: 1024 },
  { name: "lg", width: 1024, height: 768 },
  { name: "xl", width: 1440, height: 900 },
]

test.describe("Mycelium Studio Visual Screenshot Runner", () => {
  test.beforeAll(() => {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
    }
  })

  test("Run Creator visual audit", async ({ page }) => {
    test.setTimeout(300000)

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log(`[BROWSER ERROR] ${msg.text()}`)
      }
    })

    // 1. Log in as creator
    await page.goto("/login")
    await page.waitForTimeout(2000)

    await fillLogin(page, "creator@demo.test", "Passw0rd!demo")

    // Wait for redirect to studio
    await page.waitForURL("**/studio", { timeout: 20000 })
    await page.waitForTimeout(2000)
    console.log("Creator login successful, navigating pages...")

    const creatorPages = [
      { name: "01_creator_dashboard", path: "/studio" },
      { name: "02_creator_drafts", path: "/studio/drafts" },
      { name: "03_creator_graph", path: "/studio/graph" },
      { name: "04_creator_branches", path: "/studio/branches" },
      { name: "05_creator_debates", path: "/studio/debates" },
      { name: "06_creator_quests", path: "/studio/quests" },
      { name: "07_creator_collections", path: "/studio/collections" },
      { name: "08_creator_analytics", path: "/studio/analytics" },
      { name: "09_creator_earnings", path: "/studio/earnings" },
      { name: "10_creator_tiers", path: "/studio/tiers" },
      { name: "11_creator_memberships", path: "/studio/memberships" },
      { name: "12_creator_bundles", path: "/studio/bundles" },
      { name: "13_creator_org", path: "/studio/org" },
      { name: "14_creator_notifications", path: "/studio/notifications" },
      { name: "15_creator_settings", path: "/studio/settings" },
    ]

    for (const p of creatorPages) {
      await page.goto(p.path, { waitUntil: "networkidle" })
      await page.waitForTimeout(1500)
      // Wait for loading indicators to disappear
      await page
        .waitForFunction(
          () =>
            !document.body.textContent?.includes("Loading…") &&
            !document.body.textContent?.includes("Loading..."),
          { timeout: 15000 }
        )
        .catch(() => {})
      await page.waitForTimeout(800)

      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height })
        await page.waitForTimeout(500)
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `${p.name}_${vp.name}.png`),
          fullPage: false,
        })
        console.log(`  ✓ ${p.name} @ ${vp.name} (${vp.width}x${vp.height})`)
      }
    }
  })

  test("Run Reader visual audit", async ({ page }) => {
    test.setTimeout(120000)

    // 1. Log in as reader
    await page.goto("/login")
    await page.waitForTimeout(2000)

    await fillLogin(page, "reader@demo.test", "Passw0rd!demo")

    // Wait for redirect (reader goes to feed)
    await page.waitForURL(/\/(feed|studio)/, { timeout: 20000 }) // fillLogin picks the author tab, which lands on /studio
    await page.waitForTimeout(2000)
    console.log("Reader login successful, navigating pages...")

    const readerPages = [
      { name: "16_reader_desk", path: "/studio" },
      { name: "17_reader_notifications", path: "/studio/notifications" },
      { name: "18_reader_settings", path: "/studio/settings" },
    ]

    for (const p of readerPages) {
      await page.goto(p.path, { waitUntil: "networkidle" })
      await page.waitForTimeout(1500)
      await page
        .waitForFunction(
          () =>
            !document.body.textContent?.includes("Loading…") &&
            !document.body.textContent?.includes("Loading..."),
          { timeout: 15000 }
        )
        .catch(() => {})
      await page.waitForTimeout(800)

      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height })
        await page.waitForTimeout(500)
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `${p.name}_${vp.name}.png`),
          fullPage: false,
        })
        console.log(`  ✓ ${p.name} @ ${vp.name} (${vp.width}x${vp.height})`)
      }
    }
  })
})
