import { test, expect, type Page } from "@playwright/test"
import { admin, fillLogin } from "./helpers"

// Local dev seed user (scripts/seed_test_users.ts) — test credentials only.
const EMAIL = "test_studio@example.com"
const PASSWORD = "TestPassword123!"

async function signIn(page: Page) {
  await page.goto("/login")
  await fillLogin(page, EMAIL, PASSWORD)
  await page.waitForURL("**/studio**", { timeout: 20_000 })
}

async function dismissTour(page: Page) {
  await page.locator(".driver-overlay").waitFor({ timeout: 4000 }).catch(() => {})
  if (await page.locator(".driver-overlay").isVisible().catch(() => false)) {
    await page.keyboard.press("Escape")
    await expect(page.locator(".driver-overlay")).toBeHidden()
  }
}

test("clicking into a DB-loaded text block keeps its text (no collab snapshot)", async ({ page }) => {
  test.setTimeout(120_000)
  await signIn(page)
  await page.goto("/studio/drafts")
  await page.locator('button:has-text("Create piece")').first().click()
  await page.fill('input[placeholder="New piece title…"]', "Composer data-loss e2e")
  await page.click('button:has-text("Create")')
  await page.waitForURL(/\/studio\/drafts\/[0-9a-f-]{36}/, { timeout: 20_000 })
  const pieceId = page.url().match(/drafts\/([0-9a-f-]{36})/)![1]
  // Leave the composer (its unmount persists a snapshot), then make the DB the
  // only source: one text block with content and no saved collab snapshot.
  await page.goto("/studio/drafts")
  await page.waitForTimeout(1500)
  const db = admin()
  await db.from("piece_crdt").delete().eq("piece_id", pieceId)
  await db.from("blocks").delete().eq("content_object_id", pieceId)
  const { error } = await db.from("blocks").insert({
    content_object_id: pieceId,
    order: 0,
    type: "paragraph",
    content: { html: "<p>Hello world</p>", text: "Hello world" },
    mode_visibility: ["skim", "standard", "expert", "teach", "debate"],
  })
  expect(error).toBeNull()
  const { data: snap } = await db.from("piece_crdt").select("piece_id").eq("piece_id", pieceId)
  expect(snap ?? []).toHaveLength(0)

  await page.goto(`/studio/drafts/${pieceId}`)
  const block = page.locator("[data-block-uid]").first()
  await expect(block).toBeVisible({ timeout: 20_000 })
  await dismissTour(page)
  const editor = block.locator(".ProseMirror")
  await editor.click()
  await page.keyboard.press("End")
  await page.keyboard.type("!")
  await page.waitForTimeout(5000) // > AUTOSAVE_MS
  await expect(editor).toContainText("Hello world!")

  const { data: rows } = await db
    .from("blocks")
    .select("content")
    .eq("content_object_id", pieceId)
  expect(JSON.stringify(rows)).toContain("Hello world!")
  await page.reload()
  await expect(page.locator("[data-block-uid]").first()).toContainText("Hello world!", {
    timeout: 20_000,
  })
  await db.from("content_objects").delete().eq("id", pieceId)
})

test("slash menu closes when the match ends", async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto("/login")
  await fillLogin(page, EMAIL, PASSWORD)
  await page.waitForURL("**/studio**", { timeout: 20_000 })

  await page.goto("/studio/drafts")
  const draft = page.locator('a[href^="/studio/drafts/"]').first()
  if (await draft.isVisible({ timeout: 5000 }).catch(() => false)) {
    await draft.click()
  } else {
    await page.locator('button:has-text("Create piece")').first().click()
    await page.fill('input[placeholder="New piece title…"]', "Slash menu e2e")
    await page.click('button:has-text("Create")')
  }

  const blocks = page.locator("[data-block-uid]")
  await expect(blocks.first()).toBeVisible({ timeout: 20_000 })
  // Dismiss the onboarding tour overlay (driver.js) — it can appear late.
  await dismissTour(page)
  const editor = blocks.first().locator(".ProseMirror").first()
  await editor.click()
  const before = await blocks.count()

  await page.keyboard.type("ratio 50 / 50 today")
  await expect(page.getByText("Insert block")).toBeHidden()
  await page.keyboard.press("Enter")

  await expect(page.getByText("Insert block")).toBeHidden()
  // Enter must stay a plain newline in this block, not insert a slash-menu block.
  await expect(blocks).toHaveCount(before)
  await expect(editor).toContainText("ratio 50 / 50 today")
})

test("Enter with no slash-menu matches is a plain newline", async ({ page }) => {
  test.setTimeout(90_000)
  await signIn(page)
  await page.goto("/studio/drafts")
  await page.locator('button:has-text("Create piece")').first().click()
  await page.fill('input[placeholder="New piece title…"]', "Slash no-match e2e")
  await page.click('button:has-text("Create")')
  await page.waitForURL(/\/studio\/drafts\/[0-9a-f-]{36}/, { timeout: 20_000 })
  const pieceId = page.url().match(/drafts\/([0-9a-f-]{36})/)![1]
  try {
    const blocks = page.locator("[data-block-uid]")
    await expect(blocks.first()).toBeVisible({ timeout: 20_000 })
    await dismissTour(page)
    const editor = blocks.first().locator(".ProseMirror")
    await editor.click()
    const before = await blocks.count()

    await page.keyboard.type("/zzqx")
    await page.keyboard.press("Enter")
    await page.keyboard.type("next line")

    await expect(blocks).toHaveCount(before)
    await expect(editor.locator("p")).toHaveCount(2)
    await expect(editor).toContainText("/zzqx")
    await expect(editor).toContainText("next line")
  } finally {
    await admin().from("content_objects").delete().eq("id", pieceId)
  }
})
