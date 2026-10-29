import { test, expect, type Page } from "@playwright/test"
import { randomUUID } from "crypto"
import * as fs from "fs"
import { admin, fillLogin, createTestUser } from "./helpers"

// Task 18: reader action bar + subscribe modal.
const PIECE = "/u/creator_demo/the-shape-of-attention"
// Mode switcher only renders when a piece has per-mode content (Task 27); creator_demo has none.
const MODE_PIECE = "/u/nib/welcome"
const SHOTS = ".superpowers/sdd/2026-10-28-free-launch/shots/task-18"
const MORE_ITEMS = [/^Listen$/, /Listen settings/, /Responses/, /ELI5/, /Repost/, /Report/]

// Keep the subscribe modal out of layout tests: mark it as already shown this session.
async function suppressSubscribeModal(page: Page) {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("subscribe_modal_shown", "1")
    } catch {}
  })
}

async function dismissCookies(page: Page) {
  await page.getByRole("button", { name: "Essential only" }).click({ timeout: 3000 }).catch(() => {})
}

const bar = (page: Page) => page.locator("article > .hairline-b")

for (const [w, h] of [
  [375, 812],
  [640, 900],
  [768, 1024],
  [1024, 768],
  [1280, 800],
] as const) {
  test(`reader bar at ${w}px: one row, Save + Share + More, no page overflow`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    await page.emulateMedia({ colorScheme: "dark" })
    await suppressSubscribeModal(page)
    await page.goto(MODE_PIECE)
    await dismissCookies(page)
    await expect(bar(page)).toBeVisible()

    // Only the mode control + Save, Share, More above the body.
    await expect(bar(page).getByRole("button", { name: /^Clap/ })).toBeVisible()
    await expect(bar(page).getByRole("button", { name: "Save", exact: true })).toBeVisible()
    await expect(bar(page).getByRole("button", { name: /^Share/ })).toBeVisible()
    await expect(bar(page).getByRole("button", { name: "More actions" })).toBeVisible()
    for (const hidden of [/Listen to this piece/, /^Responses$/, /Explain Like/, /^Repost$/, /^Report this piece$/]) {
      await expect(bar(page).getByRole("button", { name: hidden })).toHaveCount(0)
    }
    if (w < 768) {
      // Phones: one compact mode menu, no chips.
      await expect(bar(page).getByRole("button", { name: "Reading mode: standard" })).toBeVisible()
      await expect(bar(page).getByRole("radiogroup", { name: "Reading mode" })).toBeHidden()
    } else {
      await expect(bar(page).getByRole("radiogroup", { name: "Reading mode" })).toBeVisible()
    }
    await expect(bar(page).getByRole("combobox")).toHaveCount(0) // no dropdown select

    const m = await page.evaluate(() => {
      const el = document.querySelector("article > .hairline-b") as HTMLElement
      const r = el.getBoundingClientRect()
      const kids = [...el.querySelectorAll("button")].filter((b) => b.getBoundingClientRect().width > 0)
      // One row: every control's vertical centre within 4px of the first one's.
      const centres = kids.map((b) => {
        const k = b.getBoundingClientRect()
        return k.top + k.height / 2
      })
      const offRow = centres.filter((c) => Math.abs(c - centres[0]) > 4).length
      // Every visible control must sit fully inside its scroll container (or the viewport): nothing cut off.
      const clipped = [...el.querySelectorAll("a, button, [role=radio]")]
        .filter((b) => b.getBoundingClientRect().width > 0)
        .filter((b) => {
          let box = { left: 0, right: window.innerWidth }
          for (let a = b.parentElement; a && a !== el; a = a.parentElement) {
            if (getComputedStyle(a).overflowX !== "visible") {
              box = a.getBoundingClientRect()
              break
            }
          }
          const br = b.getBoundingClientRect()
          return br.left < box.left - 0.5 || br.right > box.right + 0.5
        })
        .map((b) => (b.textContent || b.getAttribute("aria-label") || "").trim())
      // Controls outside the chip scroller must not overlap each other.
      const solo = kids
        .filter((b) => !b.closest("[role=radiogroup]"))
        .map((b) => b.getBoundingClientRect())
        .sort((a, b) => a.left - b.left)
      const overlaps = solo.filter((r, i) => i > 0 && r.left < solo[i - 1].right - 0.5).length
      return {
        overlaps,
        pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
        offRow,
        clipped,
        barRight: r.right,
      }
    })
    expect(m.pageOverflow).toBeLessThanOrEqual(0)
    expect(m.offRow).toBe(0)
    expect(m.overlaps).toBe(0)
    expect(m.clipped).toEqual([])

    fs.mkdirSync(SHOTS, { recursive: true })
    await page.screenshot({ path: `${SHOTS}/reader-${w}x${h}-dark.png` })
    await bar(page).getByRole("button", { name: "More actions" }).click()
    await expect(page.getByRole("menu")).toBeVisible()
    for (const name of MORE_ITEMS) {
      await expect(page.getByRole("menu").getByRole("menuitem", { name })).toBeVisible()
    }
    await expect(page.getByRole("menu").getByRole("menuitem", { name: /Clap/ })).toHaveCount(0)
    await page.waitForTimeout(300) // let the menu's open animation finish
    await page.screenshot({ path: `${SHOTS}/reader-${w}x${h}-dark-more.png` })
  })
}

test("at 375px every header target is >= 44px tall and no text is under 12px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await suppressSubscribeModal(page)
  await page.goto(PIECE)
  await dismissCookies(page)
  await expect(bar(page)).toBeVisible()
  const bad = await page.evaluate(() => {
    const barEl = document.querySelector("article > .hairline-b") as HTMLElement
    const bottom = barEl.getBoundingClientRect().bottom
    const article = document.querySelector("article")!
    const visible = (e: Element) => {
      const r = e.getBoundingClientRect()
      return r.width > 1 && r.height > 1 && r.bottom <= bottom && getComputedStyle(e).visibility !== "hidden"
    }
    const small: string[] = []
    for (const e of article.querySelectorAll("a, button, [role=radio], [role=tab], [role=combobox]")) {
      if (!visible(e)) continue
      const hgt = e.getBoundingClientRect().height
      if (hgt < 44) small.push(`target ${e.tagName} "${(e.textContent || e.getAttribute("aria-label") || "").trim()}" ${hgt}px`)
    }
    for (const e of article.querySelectorAll("*")) {
      if (!visible(e)) continue
      const ownText = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())
      const fs = parseFloat(getComputedStyle(e).fontSize)
      if (ownText && fs < 12) small.push(`text "${e.textContent!.trim().slice(0, 30)}" ${fs}px`)
    }
    return small
  })
  expect(bad).toEqual([])
})

test("at 375px the mode menu picks a mode", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.emulateMedia({ colorScheme: "dark" })
  await suppressSubscribeModal(page)
  await page.goto(MODE_PIECE)
  await dismissCookies(page)
  const trigger = bar(page).getByRole("button", { name: "Reading mode: standard" })
  const box = await trigger.boundingBox()
  expect(box!.height).toBeGreaterThanOrEqual(44)
  expect(parseFloat(await trigger.evaluate((e) => getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(12)
  await trigger.click()
  const menu = page.getByRole("menu")
  await expect(menu.getByRole("menuitemradio")).toHaveCount(5)
  await expect(menu.getByRole("menuitemradio", { name: /standard/i })).toHaveAttribute("aria-checked", "true")
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${SHOTS}/reader-375x812-dark-mode-menu.png` })
  await menu.getByRole("menuitemradio", { name: /debate/i }).click()
  await page.waitForURL(/mode=debate/)
  await expect(bar(page).getByRole("button", { name: "Reading mode: debate" })).toBeVisible()
})

test("at 640px phones still get the mode menu (chips start at md)", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 900 })
  await suppressSubscribeModal(page)
  await page.goto(MODE_PIECE)
  await dismissCookies(page)
  await expect(bar(page).getByRole("button", { name: "Reading mode: standard" })).toBeVisible()
  await expect(bar(page).getByRole("radiogroup", { name: "Reading mode" })).toBeHidden()
})

test("Listen from More shows a Stop button in the bar that stops playback", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.emulateMedia({ colorScheme: "dark" })
  await suppressSubscribeModal(page)
  // Stub speech: speak() records and never ends; cancel() counts.
  await page.addInitScript(() => {
    const w = window as unknown as { __spoken: string[]; __cancels: number }
    w.__spoken = []
    w.__cancels = 0
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        speak: (u: SpeechSynthesisUtterance) => w.__spoken.push(u.text),
        cancel: () => w.__cancels++,
        getVoices: () => [],
        onvoiceschanged: null,
      },
    })
  })
  await page.goto(PIECE)
  await dismissCookies(page)
  const stop = bar(page).getByRole("button", { name: "Stop listening" })
  await expect(stop).toHaveCount(0)
  await bar(page).getByRole("button", { name: "More actions" }).click()
  await page.getByRole("menu").getByRole("menuitem", { name: /^Listen$/ }).click()
  await expect(stop).toBeVisible()
  expect((await stop.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await expect.poll(() => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.length)).toBeGreaterThan(0)
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${SHOTS}/reader-375x812-dark-listening.png` })
  const cancelsBefore = await page.evaluate(() => (window as unknown as { __cancels: number }).__cancels)
  await stop.click()
  await expect(stop).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __cancels: number }).__cancels)).toBeGreaterThan(cancelsBefore)
  await bar(page).getByRole("button", { name: "More actions" }).click()
  await expect(page.getByRole("menu").getByRole("menuitem", { name: /^Listen$/ })).toBeVisible()
})

test("at 768px the segmented control switches mode", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await suppressSubscribeModal(page)
  await page.goto(MODE_PIECE)
  await dismissCookies(page)
  const group = bar(page).getByRole("radiogroup", { name: "Reading mode" })
  await expect(group.getByRole("radio", { name: "standard" })).toHaveAttribute("aria-checked", "true")
  await group.getByRole("radio", { name: "debate" }).click()
  await page.waitForURL(/mode=debate/)
  await expect(group.getByRole("radio", { name: "debate" })).toHaveAttribute("aria-checked", "true")
})

test("More menu actions still work for a signed-in reader", async ({ page }) => {
  test.setTimeout(120_000)
  const email = `chrome_e2e_${Date.now()}@example.com`
  const password = `T-${randomUUID()}`
  const id = await createTestUser(email, password)
  try {
    await page.setViewportSize({ width: 375, height: 812 })
    await suppressSubscribeModal(page)
    await page.goto("/login")
    await fillLogin(page, email, password)
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 })
    await page.goto(PIECE)
    await dismissCookies(page)
    await page.getByRole("button", { name: "Maybe later" }).click({ timeout: 2000 }).catch(() => {})
    const more = bar(page).getByRole("button", { name: "More actions" })
    const item = (name: RegExp) => page.getByRole("menu").getByRole("menuitem", { name })

    // Clap lives in the bar, counts, and persists across a reload.
    const clap = bar(page).getByRole("button", { name: /^Clap/ })
    await page.waitForLoadState("networkidle") // clap totals loaded
    const before = Number(await clap.innerText())
    await clap.click()
    await expect(clap).toHaveAttribute("aria-label", /you: 1\/50/)
    await expect(clap).toHaveText(String(before + 1))
    await page.waitForTimeout(1000) // debounced save
    await page.reload()
    await expect(clap).toHaveAttribute("aria-label", /you: 1\/50/, { timeout: 15_000 })

    // Save: the accessible name contains the visible text in both states.
    await bar(page).getByRole("button", { name: "Save", exact: true }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click()
    await expect(bar(page).getByRole("button", { name: "Saved, remove from reading list" })).toBeVisible()

    for (const [name, dialog] of [
      [/Listen settings/, /Listen settings/],
      [/Responses/, /Responses/],
      [/Repost/, /Repost this piece/],
      [/Report/, /Report this piece/],
    ] as const) {
      await more.click()
      await item(name).click()
      await expect(page.getByRole("dialog", { name: dialog })).toBeVisible()
      await page.keyboard.press("Escape")
      await expect(page.getByRole("dialog")).toHaveCount(0)
    }

    // Share copies the link (no navigator.share in desktop Chromium).
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"])
    await bar(page).getByRole("button", { name: /^Share/ }).click()
    await expect(page.getByText("Link copied")).toBeVisible()

    // lg+: the bar and the aside Applause card share one clap state.
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.waitForLoadState("networkidle")
    await clap.click()
    await expect(page.getByRole("button", { name: /you: 2\/50/ })).toHaveCount(2)

    // A clap flushed on blur that fails to save is surfaced, not swallowed.
    await page.route("**/u/creator_demo/**", (r) =>
      r.request().method() === "POST" && r.request().headers()["next-action"] ? r.abort() : r.continue()
    )
    await clap.click()
    await page.keyboard.press("Tab") // blur before the 450ms debounce
    await expect(page.locator("[data-sonner-toast][data-type=error]")).toBeVisible({ timeout: 5000 })
    await page.unroute("**/u/creator_demo/**")
  } finally {
    const db = admin()
    await db.from("collections").delete().eq("curator_id", id)
    await db.from("piece_claps").delete().eq("user_id", id)
    await db.from("profiles").delete().eq("id", id)
    await db.auth.admin.deleteUser(id)
  }
})

test("subscribe modal re-checks the session before opening", async ({ page, context }) => {
  test.setTimeout(90_000)
  const email = `chrome_sub_${Date.now()}@example.com`
  const password = `T-${randomUUID()}`
  const id = await createTestUser(email, password)
  try {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(PIECE) // guest: the scroll listener is armed
    await dismissCookies(page)
    await page.waitForLoadState("networkidle")
    // Sign in from another tab of the same browser session.
    const other = await context.newPage()
    await other.goto("/login")
    await fillLogin(other, email, password)
    await other.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 })
    await other.close()
    await page.evaluate(() => {
      const a = document.querySelector("article")!
      window.scrollTo(0, a.getBoundingClientRect().top + window.scrollY + a.offsetHeight * 0.7 - window.innerHeight)
    })
    await page.waitForTimeout(2000)
    await expect(page.getByRole("dialog", { name: /Subscribe to/ })).toHaveCount(0)
  } finally {
    const db = admin()
    await db.from("profiles").delete().eq("id", id)
    await db.auth.admin.deleteUser(id)
  }
})

test("subscribe modal waits for 60% scroll and shows once per session", async ({ page }) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.emulateMedia({ colorScheme: "dark" })
  await page.goto(PIECE)
  await dismissCookies(page)
  const modal = page.getByRole("dialog", { name: /Subscribe to/ })

  await page.waitForTimeout(3000)
  await expect(modal).toHaveCount(0)

  const scrollTo = (frac: number) =>
    page.evaluate((f) => {
      const a = document.querySelector("article")!
      const top = a.getBoundingClientRect().top + window.scrollY
      window.scrollTo(0, top + a.offsetHeight * f - window.innerHeight)
    }, frac)
  await scrollTo(0.4)
  await page.waitForTimeout(800)
  await expect(modal).toHaveCount(0)

  await scrollTo(0.7)
  await expect(modal).toBeVisible({ timeout: 5000 })
  await expect(modal).toHaveClass(/bg-popover/)
  await expect(modal).not.toHaveClass(/zinc/)
  await expect(modal.getByRole("button", { name: "Create account" })).toHaveClass(/bg-primary/)
  fs.mkdirSync(SHOTS, { recursive: true })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${SHOTS}/subscribe-modal-1280x800-dark.png` })
  await page.keyboard.press("Escape")
  await expect(modal).toHaveCount(0)

  // Same session: not again.
  await page.reload()
  await scrollTo(0.7)
  await page.waitForTimeout(1500)
  await expect(modal).toHaveCount(0)
})
