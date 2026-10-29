import { test, expect, type Page } from "@playwright/test"
import * as fs from "fs"
import * as path from "path"
import { admin, fillLogin } from "./helpers"

// Local dev seed user (scripts/seed_test_users.ts) — test credentials only.
const EMAIL = "test_studio@example.com"
const PASSWORD = "TestPassword123!"
const SHOTS = ".superpowers/sdd/2026-10-28-free-launch/shots/task-19"
const LONG_TITLE =
  "A deliberately long draft title that must wrap onto several lines on a phone screen"

let pieceId = ""

async function open(page: Page, width: number, height: number) {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.addInitScript(() => {
    localStorage.setItem("mycelium:composer_tour_seen", "true")
    // Earlier sessions may have left the panes expanded; the mobile sheets
    // must still start closed.
    localStorage.setItem("composer:outline-collapsed", "0")
    localStorage.setItem("composer:inspector-collapsed", "0")
  })
  await page.addInitScript(() =>
    localStorage.setItem("cookie_preferences", JSON.stringify({ essential: true, analytics: false, marketing: false }))
  )
  // open() runs repeatedly per context; a live session would redirect /login away.
  await page.context().clearCookies()
  await page.goto("/login")
  await fillLogin(page, EMAIL, PASSWORD)
  await page.waitForURL("**/studio**", { timeout: 20_000 })
  await page.setViewportSize({ width, height })
  if (!pieceId) {
    await page.goto("/studio/drafts")
    await page.locator('button:has-text("Create piece")').first().click()
    await page.fill('input[placeholder="New piece title…"]', LONG_TITLE)
    await page.click('button:has-text("Create")')
    await page.waitForURL(/\/studio\/drafts\/[0-9a-f-]{36}/, { timeout: 20_000 })
    pieceId = page.url().match(/drafts\/([0-9a-f-]{36})/)![1]
  } else {
    await page.goto(`/studio/drafts/${pieceId}`)
  }
  await expect(page.getByLabel("Piece title")).toHaveValue(LONG_TITLE, { timeout: 20_000 })
}

test.afterAll(async () => {
  if (pieceId) await admin().from("content_objects").delete().eq("id", pieceId)
})

test.describe.configure({ mode: "serial" })

test("375px: panes are closed sheets, editor unobstructed, title wraps", async ({ page }) => {
  test.setTimeout(90_000)
  await open(page, 375, 812)

  // No pane occupies the layout; the canvas gets the full width.
  await expect(page.locator("#tour-outline")).toHaveCount(0)
  await expect(page.locator("#tour-inspector")).toHaveCount(0)
  const canvas = (await page.locator("#tour-canvas").boundingBox())!
  expect(canvas.x).toBe(0)
  expect(canvas.width).toBe(375)

  const title = page.getByLabel("Piece title")
  await expect(title).toHaveValue(LONG_TITLE)
  const fit = await title.evaluate((el) => ({
    sw: el.scrollWidth, cw: el.clientWidth, h: el.clientHeight,
    lh: parseFloat(getComputedStyle(el).lineHeight),
  }))
  expect(fit.sw).toBeLessThanOrEqual(fit.cw)
  expect(fit.h).toBeGreaterThan(fit.lh * 1.5) // actually wrapped
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)

  const outlineBtn = page.getByRole("button", { name: "Outline" })
  await outlineBtn.click()
  const outline = page.getByRole("dialog", { name: "Outline & history" })
  await expect(outline).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(outline).toBeHidden()
  await expect(outlineBtn).toBeFocused()

  await page.getByRole("button", { name: "Inspector" }).click()
  const inspector = page.getByRole("dialog", { name: "Inspector & archive" })
  await expect(inspector).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(inspector).toBeHidden()
})

test("375px: undo is reachable and works, save status is visible", async ({ page }) => {
  test.setTimeout(90_000)
  await open(page, 375, 812)
  const status = page.locator("header [role=status]")
  await expect(status).toBeVisible()
  await expect(status).toHaveAttribute("aria-label", /^Sav/)

  const undo = page.getByRole("button", { name: "Undo", exact: true })
  await expect(undo).toBeVisible()
  const box = (await undo.boundingBox())!
  expect(box.width).toBeGreaterThanOrEqual(44)
  expect(box.height).toBeGreaterThanOrEqual(44)

  // Structural edit: add a block (status must react), then undo it.
  const blocks = page.locator("[data-block-uid]")
  const before = await blocks.count()
  const label0 = await status.getAttribute("aria-label")
  await page.getByText("+ Add block").click()
  await expect(blocks).toHaveCount(before + 1)
  await expect(status).not.toHaveAttribute("aria-label", label0!, { timeout: 15_000 })
  await undo.click()
  await expect(blocks).toHaveCount(before)

  // Redo lives in More below sm.
  await page.getByRole("button", { name: "More actions" }).click()
  await expect(page.getByRole("menuitem", { name: "Redo" })).toBeVisible()
  await page.keyboard.press("Escape")
})

// The blocks table is what readers and publish see; the collab snapshot alone
// restoring the editor on reload isn't persistence.
async function dbBlockCount() {
  const { count } = await admin()
    .from("blocks").select("id", { count: "exact", head: true }).eq("content_object_id", pieceId)
  return count
}

async function waitSaved(page: Page) {
  const status = page.locator("header [role=status]")
  await expect(status).toHaveAttribute("aria-label", "Saving…", { timeout: 10_000 }).catch(() => {})
  await expect(status).toHaveAttribute("aria-label", /^Saved/, { timeout: 15_000 })
}

test("375px: structural undo/redo persist across reload", async ({ page }) => {
  test.setTimeout(120_000)
  await open(page, 375, 812)
  const blocks = page.locator("[data-block-uid]")
  await page.waitForTimeout(1500) // let hydration settle
  const before = await blocks.count()
  await page.getByText("+ Add block").click()
  await expect(blocks).toHaveCount(before + 1)
  await expect.poll(dbBlockCount, { timeout: 15_000 }).toBe(before + 1)
  await page.getByRole("button", { name: "Undo", exact: true }).click()
  await expect(blocks).toHaveCount(before)
  await page.waitForTimeout(5000) // > AUTOSAVE_MS
  await waitSaved(page)
  await page.reload()
  await expect(page.getByLabel("Piece title")).toHaveValue(LONG_TITLE, { timeout: 20_000 })
  await page.waitForTimeout(1500)
  await expect(blocks).toHaveCount(before)
  await expect.poll(dbBlockCount, { timeout: 10_000 }).toBe(before)

  // Redo persists too (then undo again to leave the draft as found).
  await page.getByText("+ Add block").click()
  await expect(blocks).toHaveCount(before + 1)
  await page.getByRole("button", { name: "Undo", exact: true }).click()
  await expect(blocks).toHaveCount(before)
  await page.getByRole("button", { name: "More actions" }).click()
  await page.getByRole("menuitem", { name: "Redo" }).click()
  await expect(blocks).toHaveCount(before + 1)
  await waitSaved(page)
  await page.reload()
  await expect(page.getByLabel("Piece title")).toHaveValue(LONG_TITLE, { timeout: 20_000 })
  await page.waitForTimeout(1500)
  await expect(blocks).toHaveCount(before + 1)
  await expect.poll(dbBlockCount, { timeout: 10_000 }).toBe(before + 1)
  await page.getByRole("button", { name: "Undo", exact: true }).click().catch(() => {})
})

test("375px: bar undo/redo act on text in the last-focused block", async ({ page }) => {
  test.setTimeout(120_000)
  await open(page, 375, 812)
  const editor = page.locator("[data-block-uid] .ProseMirror").first()
  await editor.click()
  await page.keyboard.press("End")
  await page.keyboard.type(" undoable")
  await expect(editor).toContainText("undoable")
  // Prove the typed text reached the DB first, so "gone after undo" means something.
  const dbHasUndoable = async () => {
    const { data } = await admin().from("blocks").select("content").eq("content_object_id", pieceId)
    return JSON.stringify(data).includes("undoable")
  }
  await expect.poll(dbHasUndoable, { timeout: 20_000 }).toBe(true)
  const undo = page.getByRole("button", { name: "Undo", exact: true })
  await undo.click()
  await expect(editor).not.toContainText("undoable")
  await page.getByRole("button", { name: "More actions" }).click()
  await page.getByRole("menuitem", { name: "Redo" }).click()
  await expect(editor).toContainText("undoable")
  await undo.click()
  await expect(editor).not.toContainText("undoable")
  await page.waitForTimeout(3500) // > AUTOSAVE_MS
  await waitSaved(page)
  await page.reload()
  await expect(page.getByLabel("Piece title")).toHaveValue(LONG_TITLE, { timeout: 20_000 })
  await expect(page.locator("[data-block-uid]").first()).toBeVisible()
  await expect(page.locator("[data-block-uid]").first()).not.toContainText("undoable")
  await expect.poll(dbHasUndoable, { timeout: 15_000 }).toBe(false)
})

test("375px: every tour step targets an element", async ({ page }) => {
  test.setTimeout(90_000)
  await open(page, 375, 812)
  await page.getByRole("button", { name: "More actions" }).click()
  await page.getByRole("menuitem", { name: "Restart Tour" }).click()
  const pop = page.locator(".driver-popover")
  await expect(pop).toBeVisible()
  const next = pop.locator(".driver-popover-next-btn")
  // Step 1 is the untargeted welcome; every later step must highlight its
  // real target (a missing one makes driver highlight its dummy element).
  const targets = ["tour-canvas", "tour-block-create", "tour-outline-button", "tour-inspector-button", "tour-more"]
  for (const [i, id] of targets.entries()) {
    await next.click()
    await expect(pop.locator(".driver-popover-progress-text")).toHaveText(new RegExp(`^${i + 2} of`))
    await expect(page.locator(`#${id}[aria-controls=driver-popover-content]`)).toBeVisible()
  }
  await page.keyboard.press("Escape")
})

test("1280px: at most 6 top-bar actions plus More with the rest", async ({ page }) => {
  test.setTimeout(90_000)
  await open(page, 1280, 800)
  const header = page.locator("header").first()
  const more = header.getByRole("button", { name: "More actions" })
  await expect(more).toBeVisible()
  const visible = await header
    .locator("button:visible, [role=combobox]:visible, a:visible")
    .evaluateAll((els) => els.filter((e) => e.getAttribute("aria-label") !== "More actions").length)
  expect(visible).toBeLessThanOrEqual(6)
  for (const name of ["Heatmap", "Minimap", "Archive", "Schedule"])
    await expect(header.getByRole("button", { name, exact: true })).toHaveCount(0)

  await more.click()
  for (const name of [/Heatmap/, /Minimap/, /Archive/, /Schedule/])
    await expect(page.getByRole("menuitem", { name })).toBeVisible()
  await page.keyboard.press("Escape")

  // Inspector checkboxes are themed (shadcn Checkbox), not raw inputs.
  await page.locator("[data-block-uid]").first().click()
  await expect(page.locator("#tour-inspector input[type=checkbox]")).toHaveCount(0)
  await expect(page.locator("#tour-inspector button[role=checkbox]").first()).toBeVisible()
})

test("tour copy has no emoji", () => {
  const src = fs.readFileSync("hooks/use-composer-tour.ts", "utf-8")
  expect(src).not.toMatch(/\p{Extended_Pictographic}/u)
})

for (const scheme of ["light", "dark"] as const) {
  test(`screenshots (${scheme})`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.emulateMedia({ colorScheme: scheme })
    await page.addInitScript((t) => localStorage.setItem("theme", t), scheme)
    for (const [w, h] of [[375, 812], [768, 1024], [1280, 800]]) {
      await open(page, w, h)
      await expect(page.locator("html")).toHaveClass(scheme === "dark" ? /dark/ : /^(?!.*dark)/)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w)
      await page.screenshot({ path: path.join(SHOTS, `composer-${w}-${scheme}.png`) })
    }
  })
}
