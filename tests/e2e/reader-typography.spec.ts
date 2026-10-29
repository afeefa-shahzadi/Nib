import { test, expect, type Page } from "@playwright/test"

// Task 16: long-form reader typography.
const PIECE = "/u/creator_demo/the-shape-of-attention"
const SHOTS = ".superpowers/sdd/2026-10-28-free-launch/shots/task-16"

async function open(page: Page, w: number, h: number) {
  await page.setViewportSize({ width: w, height: h })
  await page.addInitScript(() => {
    try { sessionStorage.setItem("subscribe_modal_shown", "1") } catch {}
  })
  await page.goto(PIECE)
  await page.getByRole("button", { name: "Essential only" }).click({ timeout: 3000 }).catch(() => {})
  const p = page.locator("article .prose", { hasText: "Attention is not a spotlight" }).first()
  await expect(p).toBeVisible()
  return p
}

for (const [w, h, size] of [[1280, 800, "20px"], [375, 812, "18px"]] as const) {
  test(`body typography at ${w}`, async ({ page }) => {
    const p = await open(page, w, h)
    const s = await p.evaluate(async (el) => {
      await document.fonts.ready
      const first = getComputedStyle(el).fontFamily.split(",")[0].trim().replace(/["']/g, "")
      const faceLoaded = [...document.fonts].some(
        (f) => f.family.replace(/["']/g, "") === first && f.status === "loaded"
      )
      const c = getComputedStyle(el)
      const probe = document.createElement("span")
      probe.style.color = "var(--foreground)"
      document.body.appendChild(probe)
      const fg = getComputedStyle(probe).color
      probe.remove()
      return { faceLoaded, first, ff: c.fontFamily, fs: c.fontSize, lh: parseFloat(c.lineHeight), color: c.color, fg, width: el.getBoundingClientRect().width }
    })
    expect(s.ff).toContain("Source Serif")
    // The family must be the next/font one (hashed name) and actually loaded, not a bare literal.
    expect(s.faceLoaded, `family ${s.first} has no loaded FontFace`).toBe(true)
    expect(s.fs).toBe(size)
    expect(s.lh / parseFloat(s.fs)).toBeCloseTo(1.6, 1)
    expect(s.color).toBe(s.fg)
    if (w >= 1280) expect(s.width).toBeLessThanOrEqual(720)
    await page.screenshot({ path: `${SHOTS}/typography-${w}-dark.png` })
  })
}

test("theme font tokens reference the next/font variables via var()", async ({ page }) => {
  await open(page, 1280, 800)
  const decls = await page.evaluate(() => {
    const out: string[] = []
    const walk = (rules: CSSRuleList) => {
      for (const r of Array.from(rules)) {
        const st = (r as CSSStyleRule).style
        if (st && /^(:root|html)/.test((r as CSSStyleRule).selectorText ?? "")) {
          for (const n of ["--font-reading", "--font-sans", "--font-display"]) {
            const v = st.getPropertyValue(n)
            if (v) out.push(`${n}: ${v}`)
          }
        }
        if ((r as CSSGroupingRule).cssRules) walk((r as CSSGroupingRule).cssRules)
      }
    }
    for (const sh of Array.from(document.styleSheets)) { try { walk(sh.cssRules) } catch {} }
    return out
  })
  expect(decls.length).toBeGreaterThan(0)
  for (const d of decls) expect(d).toContain("var(--nf-")
})

test("prose p inherits the same typography", async ({ page }) => {
  // Rich-text (html) paragraphs render <p> inside .prose; assert they match the wrapper when present.
  await open(page, 1280, 800)
  const r = await page.locator("article .prose p").evaluateAll((els) =>
    els.map((el) => {
      const c = getComputedStyle(el)
      return [c.fontSize, parseFloat(c.lineHeight) / parseFloat(c.fontSize), c.color, c.fontFamily]
    })
  )
  for (const [fs, lh, , ff] of r) {
    expect(fs).toBe("20px")
    expect(lh).toBeCloseTo(1.6, 1)
    expect(ff).toContain("Source Serif")
  }
})

test("demo piece leads with a heading equal to the title; neither body nor TOC repeats it", async ({ page }) => {
  await open(page, 1280, 800)
  const title = (await page.locator("h1").first().innerText()).trim()
  const res = await page.request.get(PIECE)
  expect(await res.text()).toContain(title)
  // data guard: the seed really has a leading heading block with the title (so the checks below are not vacuous)
  const { execSync } = await import("child_process")
  const out = execSync(
    `docker exec supabase_db_mycelium-next psql -U postgres -At -c "select count(*) from blocks b join content_objects c on c.id=b.content_object_id where c.slug='the-shape-of-attention' and b.type='heading' and b.content->>'text'='${title}'"`
  ).toString().trim()
  expect(Number(out)).toBeGreaterThan(0)
  const tocHits = await page.locator("aside a, nav a").filter({ hasText: new RegExp(`^${title}$`) }).count()
  expect(tocHits).toBe(0)
})

for (const w of [1024, 1279]) {
  test(`below-article aside copy sits under the article at ${w}`, async ({ page }) => {
    await open(page, w, 900)
    const footer = page.locator('main > div[class~="xl:hidden"]')
    await footer.scrollIntoViewIfNeeded()
    await expect(footer).toBeVisible()
    const art = (await page.locator("article").boundingBox())!
    const fb = (await footer.boundingBox())!
    expect(fb.y).toBeGreaterThanOrEqual(art.y + art.height - 1)
  })
}

test("aside is not beside the body below 1280; no H2 equals title", async ({ page }) => {
  for (const [w, h] of [[768, 1024], [1024, 768]]) {
    await open(page, w, h)
    const art = await page.locator("article").boundingBox()
    const aside = page.locator("main > div.sticky")
    expect(await aside.isVisible()).toBe(false)
    expect(art!.width).toBeGreaterThan(w * 0.6)
    await page.screenshot({ path: `${SHOTS}/layout-${w}-dark.png` })
  }
  await open(page, 1280, 800)
  expect(await page.locator("main > div.sticky").isVisible()).toBe(true)
  const title = (await page.locator("h1").first().innerText()).trim()
  const h2s = await page.locator("article h2").allInnerTexts()
  expect(h2s.map((t) => t.trim())).not.toContain(title)
  await page.screenshot({ path: `${SHOTS}/layout-1280-dark.png` })
})
