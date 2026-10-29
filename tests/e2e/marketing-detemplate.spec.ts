import { test, expect, type Page } from "@playwright/test"

// Task 22: marketing home/docs/product/about read like a publication, not a template.
const SHOTS = ".superpowers/sdd/2026-10-28-free-launch/shots/task-22"
const PAGES = { home: "/", docs: "/docs", product: "/product", about: "/about" }

async function open(page: Page, url: string) {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("subscribe_modal_shown", "1")
    } catch {}
  })
  await page.goto(url)
  await page
    .getByRole("button", { name: "Essential only" })
    .click({ timeout: 3000 })
    .catch(() => {})
}

test("home: real article excerpt and Start writing above the fold", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await open(page, "/")
  const ex = page.getByTestId("home-excerpt")
  await expect(ex.getByRole("heading")).toBeVisible()
  const cta = page.getByRole("link", { name: /^Start writing/ }).first()
  await expect(cta).toBeVisible()
  expect((await cta.boundingBox())!.y).toBeLessThan(800)
  const paras = await ex
    .locator("[role=tabpanel] .font-reading")
    .evaluateAll((els) =>
      els.map((el) => {
        const c = getComputedStyle(el)
        return {
          ff: c.fontFamily,
          fs: c.fontSize,
          lh: parseFloat(c.lineHeight) / parseFloat(c.fontSize),
          top: el.getBoundingClientRect().top,
        }
      })
    )
  expect(paras.length).toBeGreaterThanOrEqual(2)
  for (const p of paras.slice(0, 2)) {
    expect(p.ff).toContain("Source Serif")
    expect(p.fs).toBe("20px") // reader body size at md+
    expect(p.lh).toBeCloseTo(1.6, 1)
    expect(p.top).toBeLessThan(800)
  }
})

for (const [name, url] of Object.entries(PAGES))
  test(`${name}: at most one eyebrow, no icon-card grid`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await open(page, url)
    const modes =
      name === "home" ? ["Skim", "Standard", "Expert", "Teach"] : [null]
    for (const m of modes) {
      if (m) await page.getByRole("tab", { name: m }).click()
      const r = await page.evaluate(() => {
        const all = [...document.querySelectorAll("body *")] as HTMLElement[]
        const eyebrows = all
          .filter((el) => {
            const c = getComputedStyle(el)
            if (c.textTransform !== "uppercase" || !el.offsetParent)
              return false
            const own = [...el.childNodes].some(
              (n) => n.nodeType === 3 && n.textContent!.trim()
            )
            return (
              own && parseFloat(c.letterSpacing) >= 0.1 * parseFloat(c.fontSize)
            )
          })
          .map((el) => el.textContent!.trim())
        const grids = all.filter((el) => {
          const kids = [...el.children]
          return (
            kids.length >= 6 &&
            kids.every(
              (k) => k.querySelector("svg") && k.querySelector("h2,h3,h4")
            )
          )
        }).length
        return { eyebrows, grids }
      })
      expect(
        r.eyebrows.length,
        `${m ?? ""} ${r.eyebrows.join(" | ")}`
      ).toBeLessThanOrEqual(1)
      expect(r.grids).toBe(0)
    }
  })

for (const scheme of ["light", "dark"] as const)
  for (const [w, h] of [
    [375, 812],
    [768, 1024],
    [1280, 800],
  ])
    test(`home shot ${scheme} ${w}`, async ({ browser }) => {
      const ctx = await browser.newContext({
        colorScheme: scheme,
        viewport: { width: w, height: h },
      })
      const page = await ctx.newPage()
      await open(page, "/")
      await page.waitForTimeout(500)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
      ).toBe(true)
      await page.screenshot({ path: `${SHOTS}/home-${scheme}-${w}.png` })
      await page.screenshot({
        path: `${SHOTS}/home-${scheme}-${w}-full.png`,
        fullPage: true,
      })
      await ctx.close()
    })

test("home: reading-mode tabs swap the passage", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await open(page, "/")
  const panel = page.getByRole("tabpanel")
  const std = page.getByRole("tab", { name: "Standard" })
  await expect(std).toHaveAttribute("aria-selected", "true")
  const seen = new Set([await panel.innerText()])
  for (const m of ["Skim", "Expert", "Teach"]) {
    await page.getByRole("tab", { name: m }).click()
    await page.mouse.move(0, 0)
    await expect(page.getByRole("tab", { name: m })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    seen.add(await panel.innerText())
    await page.screenshot({
      path: `${SHOTS}/home-mode-${m.toLowerCase()}-1280.png`,
    })
  }
  expect(seen.size).toBe(4)
  // arrow keys move between tabs
  await page.getByRole("tab", { name: "Teach" }).focus()
  await page.keyboard.press("ArrowLeft")
  await expect(page.getByRole("tab", { name: "Expert" })).toHaveAttribute(
    "aria-selected",
    "true"
  )
  await expect(page.getByRole("tab", { name: "Expert" })).toBeFocused()
})
