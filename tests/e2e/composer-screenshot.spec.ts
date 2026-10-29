import { test } from "@playwright/test"
import * as fs from "fs"
import * as path from "path"

const SCREENSHOT_DIR = "C:\\Users\\omkar\\.gemini\\antigravity-ide\\brain\\e70e72b9-65ae-41e3-96a1-d403299f35bb\\screenshots"

const VIEWPORTS = [
  { name: "sm", width: 375, height: 812 },
  { name: "md", width: 768, height: 1024 },
  { name: "lg", width: 1024, height: 768 },
  { name: "xl", width: 1440, height: 900 },
]

test("Composer visual audit", async ({ page }) => {
  test.setTimeout(300000)
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  }

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  console.log("Navigating to login...");
  await page.goto("/login")
  await page.waitForTimeout(2000)

  try {
    const authorTab = page.locator('text="I\'m an author"')
    if (await authorTab.isVisible({ timeout: 3000 })) {
      await authorTab.click()
    }
  } catch {}

  console.log("Filling login...");
  await page.fill("#email", "visual_creator@example.com")
  await page.fill("#password", "password123")
  await page.click('button[type="submit"]')

  console.log("Waiting for studio...");
  await page.waitForURL("**/studio", { timeout: 20000 }).catch(e => console.log("Timeout waiting for studio url:", e.message));
  await page.waitForTimeout(2000)

  console.log("Going to drafts...");
  await page.goto("/studio/drafts")
  await page.waitForTimeout(2000)

  console.log("Looking for draft link...");
  const draftLinks = await page.locator('a[href^="/studio/drafts/"]').all();
  if (draftLinks.length === 0) {
      console.log("No drafts found, creating a new piece...");
      const createBtn = page.locator('button:has-text("Create piece")').first();
      if (await createBtn.isVisible()) {
          await createBtn.click();
          await page.fill('input[placeholder="New piece title…"]', 'Screenshot Test Draft');
          await page.click('button:has-text("Create")');
          await page.waitForTimeout(5000);
      } else {
          console.error("Could not find a draft or create button!");
          return;
      }
  } else {
      console.log("Clicking first draft...");
      await draftLinks[0].click();
  }

  console.log("Waiting a bit...");
  await page.waitForTimeout(5000);

  // Take debug screenshot
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "debug_stuck.png") });
  console.log("Took debug screenshot!");

  const states = [
    { name: "both_open", outline: true, inspector: true },
    { name: "outline_only", outline: true, inspector: false },
    { name: "inspector_only", outline: false, inspector: true },
    { name: "both_closed", outline: false, inspector: false },
  ]

  for (const vp of VIEWPORTS) {
    console.log(`Testing viewport ${vp.name}...`);
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.waitForTimeout(1000)

    for (const state of states) {
      console.log(`Setting state ${state.name}...`);
      // Set Outline State
      if (state.outline) {
        const expandOutline = page.locator('button[title="Expand outline"]')
        if (await expandOutline.isVisible()) await expandOutline.click()
      } else {
        const collapseOutline = page.locator('button[title="Collapse outline"]')
        if (await collapseOutline.isVisible()) await collapseOutline.click()
      }
      
      // Set Inspector State
      if (state.inspector) {
        const expandInspector = page.locator('button[title="Expand inspector"]')
        if (await expandInspector.isVisible()) await expandInspector.click()
      } else {
        const collapsePanel = page.locator('button[title="Collapse panel"], button[title="Collapse inspector"]')
        if (await collapsePanel.isVisible()) await collapsePanel.click()
      }

      await page.waitForTimeout(1000)

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `composer_${vp.name}_${state.name}.png`),
        fullPage: false,
      })
      console.log(`Saved composer_${vp.name}_${state.name}.png`)
    }
  }
})
