import { test, expect, type Page } from "@playwright/test"
import * as fs from "fs"
import { admin } from "./helpers"
import { availableModes } from "../../lib/reader-variants"

// Task 27: mode tabs appear only when a mode changes the piece.
const SHOTS = ".superpowers/sdd/2026-10-28-free-launch/shots/task-27"
const WELCOME = "/u/nib/welcome"
const MODES = ["skim", "standard", "expert", "teach", "debate"] as const

test.use({ viewport: { width: 1280, height: 900 }, colorScheme: "dark" })
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("cookie_preferences", JSON.stringify({ essential: true, analytics: false, marketing: false }))
      sessionStorage.setItem("subscribe_modal_shown", "1")
    } catch {}
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style")
      s.textContent = "nextjs-portal{display:none!important}"
      document.head.appendChild(s)
    })
  })
})

const tabs = (page: Page) => page.getByRole("radiogroup", { name: "Reading mode" })
const body = (page: Page) => page.locator("article")

test("Welcome to Nib offers modes that change the piece", async ({ page }) => {
  fs.mkdirSync(SHOTS, { recursive: true })
  await page.goto(WELCOME)
  await expect(tabs(page)).toBeVisible()
  for (const m of MODES) await expect(tabs(page).getByRole("radio", { name: m })).toBeVisible()

  const imgs = body(page).locator("img[alt]")
  const stdImgs = await imgs.count()
  const stdText = await body(page).innerText()
  await page.screenshot({ path: `${SHOTS}/standard.png`, fullPage: true })

  for (const m of ["skim", "expert", "teach", "debate"] as const) {
    await tabs(page).getByRole("radio", { name: m }).click()
    await expect(page).toHaveURL(new RegExp(`mode=${m}`))
    await expect(tabs(page).getByRole("radio", { name: m })).toHaveAttribute("data-state", "on")
    await expect.poll(() => body(page).innerText()).not.toBe(stdText)
    if (m === "skim") expect(await imgs.count()).toBeLessThan(stdImgs)
    if (m === "expert") await expect(body(page)).toContainText("ordered list of typed blocks")
    await page.screenshot({ path: `${SHOTS}/${m}.png`, fullPage: true })
  }
})

test("an unavailable mode in the URL reads as Standard", async ({ page }) => {
  await page.goto(`${WELCOME}?mode=bogus`)
  await expect(tabs(page).getByRole("radio", { name: "standard" })).toHaveAttribute("data-state", "on")
})

test("number keys pick the modes on offer", async ({ page }) => {
  await page.goto(`${WELCOME}`)
  await expect(tabs(page)).toBeVisible()
  const offered = await tabs(page).getByRole("radio").allInnerTexts()
  await page.waitForLoadState("networkidle")
  await page.keyboard.press(String(offered.length))
  await expect(page).toHaveURL(new RegExp(`mode=${offered.at(-1)!.toLowerCase()}`), { timeout: 15000 })
})

test("a piece with no mode data shows no switcher", async ({ page }) => {
  const db = admin()
  const { data: pieces } = await db
    .from("content_objects")
    .select("id, slug, author_id")
    .eq("status", "published")
    .eq("visibility", "public")
    .limit(50)
  let target: string | null = null
  for (const p of pieces ?? []) {
    const { data: blocks } = await db.from("blocks").select("content, mode_visibility").eq("content_object_id", p.id)
    if (!blocks?.length || availableModes(blocks, MODES).length !== 1) continue
    const { data: author } = await db.from("profiles").select("handle").eq("id", p.author_id).single()
    const handle = author?.handle
    if (handle) {
      target = `/u/${handle}/${p.slug}`
      break
    }
  }
  test.skip(!target, "no published piece without mode data in the local DB")
  await page.goto(target!)
  await expect(body(page)).toBeVisible()
  await expect(tabs(page)).toHaveCount(0)
  await expect(page.getByRole("button", { name: /^Reading mode:/ })).toHaveCount(0)
  const url = page.url()
  await page.keyboard.press("1")
  await page.waitForTimeout(500)
  expect(page.url()).toBe(url)
  await page.screenshot({ path: `${SHOTS}/no-modes.png` })
})
