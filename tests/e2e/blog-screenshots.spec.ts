/**
 * Captures the screenshots used by the official blog (scripts/seed_official_blog.ts)
 * into public/blog/<slug>/<name>.png.
 *
 *   set -a && . ./.env.development.local && set +a
 *   pnpm seed:blog            # posts must exist for the reader shots
 *   pnpm exec playwright test tests/e2e/blog-screenshots.spec.ts --project=chromium --workers=1
 *
 * SHOTS=composer-guide/slash-menu,plans/pricing  limits the run to matching names (substring).
 * Local dev only: logs in as the seeded test_studio user and creates a demo draft for it.
 */
import { test, type Page, type Locator } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { assertLocalSupabase, fillLogin } from "./helpers"
import * as fs from "fs"
import * as path from "path"

const OUT = path.join(process.cwd(), "public", "blog")
const HANDLE = "nib"
const EMAIL = "test_studio@example.com"
const PASSWORD = "TestPassword123!" // from scripts/seed_test_users.ts (local only)
const DEMO_SLUG = "blog-demo-composer"
const ONLY = (process.env.SHOTS || "").split(",").filter(Boolean)
const failures: string[] = []

const want = (name: string) => !ONLY.length || ONLY.some((o) => name.includes(o))

async function shot(page: Page, name: string, opts: { clip?: { x: number; y: number; width: number; height: number }; el?: Locator; full?: boolean } = {}) {
  const file = path.join(OUT, `${name}.png`)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  await page.waitForTimeout(400)
  if (opts.el) await opts.el.screenshot({ path: file })
  else {
    // Callers pass viewport (boundingBox) coordinates; full-page clips need document coordinates.
    const [sx, sy] = await page.evaluate(() => [window.scrollX, window.scrollY])
    const clip = opts.clip && (opts.full ? { ...opts.clip, x: opts.clip.x + sx, y: opts.clip.y + sy } : opts.clip)
    await page.screenshot({ path: file, clip, fullPage: !!opts.full })
  }
  console.log("  saved", name)
}

/** Run a step; log and continue on failure so one flaky selector doesn't sink the run. */
async function step(page: Page, name: string, fn: () => Promise<void>) {
  if (!want(name)) return
  try {
    await fn()
  } catch (e) {
    failures.push(`${name}: ${(e as Error).message.split("\n")[0]}`)
    console.log("  FAILED", name, (e as Error).message.split("\n").slice(0, 8).join(" | "))
    await page.keyboard.press("Escape").catch(() => {})
  }
}

const ALL = { skim: true, standard: true, expert: true, teach: true, debate: true }
const notSkim = { ...ALL, skim: false }

async function ensureDemoDraft(): Promise<string> {
  assertLocalSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  })
  const { data: me } = await db.from("profiles").select("id").eq("handle", "test_studio").single()
  const uid = me!.id as string
  let { data: wm } = await db.from("workspace_members").select("workspace_id").eq("user_id", uid).limit(1).maybeSingle()
  if (!wm) {
    const { data: ws } = await db.from("workspaces").insert({ owner_id: uid, name: "Personal Workspace", slug: `ws-test-studio` }).select("id").single()
    await db.from("workspace_members").insert({ workspace_id: ws!.id, user_id: uid, role: "owner" })
    wm = { workspace_id: ws!.id }
  }
  await db.from("content_objects").delete().eq("slug", DEMO_SLUG)
  const { data: piece, error } = await db
    .from("content_objects")
    .insert({
      workspace_id: wm.workspace_id,
      author_id: uid,
      title: "How fungal networks share resources",
      slug: DEMO_SLUG,
      summary: "Notes on mycorrhizal networks, what we know, and what's still argued about.",
      tags: ["biology", "ecology"],
      status: "draft",
      visibility: "public",
      tips_enabled: true,
      allow_inline_comments: true,
    })
    .select("id")
    .single()
  if (error) throw error
  const p = (html: string) => ({ text: html.replace(/<[^>]+>/g, ""), html })
  const blocks: { type: string; content: Record<string, unknown>; semantic_role?: string | null; mode_visibility?: object; monetization_eligible?: boolean }[] = [
    { type: "heading", content: { text: "What the network does", level: 2, outlineLabel: "Intro heading" } },
    { type: "paragraph", semantic_role: "thesis", content: p("Trees in a forest are not isolated individuals: fungal networks move carbon, water and signals between them.") },
    {
      type: "paragraph",
      content: {
        ...p("Most plants form partnerships with <strong>mycorrhizal fungi</strong>. The fungus extends the root system with fine threads called <em>hyphae</em>, and in return receives sugars from the plant. Where hyphae connect several plants, they form what researchers call a <a href=\"https://en.wikipedia.org/wiki/Mycorrhizal_network\">common mycorrhizal network</a>."),
        aiVariants: { skim: { text: "Fungi link plant roots into shared networks.", html: "<p>Fungi link plant roots into shared networks.</p>" } },
      },
    },
    { type: "image", content: { text: "", imageUrl: "/blog/composer-guide/sample-network.png", alt: "Illustration of four trees whose roots are linked by a web of fungal threads", caption: "Fungal threads linking the roots of neighbouring trees.", credit: "Illustration by Jane Doe" } },
    { type: "quote", content: p("The forest is not a collection of trees but a single, interconnected system.") },
    { type: "callout", content: p("Most of these studies were done in temperate forests. Tropical systems may behave differently.") },
    {
      type: "code",
      mode_visibility: notSkim,
      content: {
        text: "",
        lang: "python",
        files: [
          { name: "transfer.py", lang: "python", content: "# Share carbon between two trees in proportion to need\ndonor, receiver = 120.0, 40.0\nshare = (donor - receiver) * 0.1\nprint(f\"Transferred {share:.1f} units\")\n" },
          { name: "trees.json", lang: "json", content: "{ \"donor\": 120, \"receiver\": 40 }\n" },
        ],
      },
    },
    { type: "citation", mode_visibility: notSkim, content: { text: "", source: "Simard et al., Nature (1997)", url: "https://www.nature.com/articles/41557", page: "p. 579", quote: "Net transfer of carbon between ectomycorrhizal tree species in the field." } },
    { type: "question", content: p("If trees share resources, does it still make sense to talk about competition between them?") },
    { type: "chart", content: { text: "", chartType: "bar", labels: ["Birch", "Fir", "Cedar", "Pine"], series: [{ label: "Carbon received (%)", data: [6, 9, 2, 4] }], caption: "Illustrative numbers only" } },
    { type: "mermaid", content: { text: "", mermaidCode: "graph LR\n  A[Donor tree] -->|sugars| F((Fungus))\n  F -->|nutrients| B[Seedling]\n  F -->|water| A", caption: "How resources move" } },
    {
      type: "flowchart",
      content: {
        text: "",
        nodes: [
          { id: "seed-1", type: "sitemap", position: { x: 40, y: 40 }, data: { title: "Mother tree", subtitle: "large donor", nodeStyle: "primary" } },
          { id: "seed-2", type: "sitemap", position: { x: 320, y: 40 }, data: { title: "Fungal network", subtitle: "", nodeStyle: "secondary" } },
          { id: "seed-3", type: "sitemap", position: { x: 600, y: 40 }, data: { title: "Seedling", subtitle: "receiver", nodeStyle: "secondary" } },
        ],
        edges: [
          { id: "e1", source: "seed-1", target: "seed-2" },
          { id: "e2", source: "seed-2", target: "seed-3" },
        ],
        caption: "",
      },
    },
    {
      type: "exercise",
      mode_visibility: notSkim,
      content: {
        text: "",
        exerciseType: "multiple_choice",
        prompt: "What does the fungus get from the plant?",
        hint: "Think about what plants make from sunlight.",
        options: [
          { id: "o1", text: "Sugars", isCorrect: true },
          { id: "o2", text: "Nitrogen", isCorrect: false },
          { id: "o3", text: "Water", isCorrect: false },
        ],
      },
    },
    { type: "audio_note", content: { text: "", transcript: "", caption: "" } },
    { type: "embed", content: { text: "", embedUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ", embedTitle: "A short film (Blender Foundation, CC BY)" } },
    { type: "paragraph", semantic_role: "evidence", content: p("In field experiments, labelled carbon from birch seedlings turned up in nearby fir seedlings within days.") },
    { type: "paragraph", semantic_role: "counter", content: p("Several recent reviews argue the evidence for large, purposeful transfers is weaker than popular accounts suggest.") },
    { type: "paragraph", semantic_role: "footnote", mode_visibility: notSkim, content: p("Numbers in the chart are illustrative and not taken from a specific study.") },
    { type: "paragraph", monetization_eligible: true, content: p("Supporters get the full data set and my reading list for this series.") },
  ]
  await db.from("content_objects").delete().eq("slug", `${DEMO_SLUG}-archive`)
  const { data: older } = await db
    .from("content_objects")
    .insert({ workspace_id: wm.workspace_id, author_id: uid, title: "Soil, carbon and the underground economy", slug: `${DEMO_SLUG}-archive`, status: "draft", visibility: "public" })
    .select("id")
    .single()
  await db.from("blocks").insert({
    content_object_id: older!.id, order: 0, type: "paragraph", mode_visibility: ALL,
    content: p("A single teaspoon of forest soil can hold kilometres of fungal threads, and the fungal network is where much of a forest's carbon ends up."),
  })
  const rows = blocks.map((b, order) => ({
    content_object_id: piece!.id,
    order,
    type: b.type,
    content: b.content,
    semantic_role: b.semantic_role ?? null,
    mode_visibility: b.mode_visibility ?? ALL,
    monetization_eligible: !!b.monetization_eligible,
    is_nsfw: false,
  }))
  const { error: bErr } = await db.from("blocks").insert(rows)
  if (bErr) throw bErr
  return piece!.id
}

async function login(page: Page) {
  await page.goto("/login")
  await fillLogin(page, EMAIL, PASSWORD)
  await page.waitForURL(/\/(studio|feed)/, { timeout: 30000 })
}

const block = (page: Page, i: number) => page.locator("[data-block-uid]").nth(i)

test.describe.configure({ mode: "serial" })
test.setTimeout(30 * 60 * 1000)

test("blog screenshots", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, colorScheme: "dark" })
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("cookie_preferences", JSON.stringify({ essential: true, analytics: false, marketing: false }))
      localStorage.setItem("mycelium:composer_tour_seen", "true")
      sessionStorage.setItem("subscribe_modal_shown", "1")
    } catch {}
    // Hide the Next.js dev-tools badge.
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style")
      s.textContent = "nextjs-portal{display:none!important}"
      document.head.appendChild(s)
    })
  })
  const page = await ctx.newPage()
  page.setDefaultTimeout(45000)

  // ── Signed-out pages ──────────────────────────────────────────────
  await step(page, "welcome/home", async () => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    await shot(page, "welcome/home")
  })
  await step(page, "getting-started/signup-role", async () => {
    await page.goto("/signup")
    await page.getByText("I'm an author").waitFor()
    await shot(page, "getting-started/signup-role")
  })
  await step(page, "getting-started/signup-author", async () => {
    await page.goto("/signup?role=creator")
    await page.locator("#em").waitFor()
    await shot(page, "getting-started/signup-author")
  })
  await step(page, "plans-explained/pricing", async () => {
    await page.goto("/pricing")
    await page.waitForLoadState("networkidle")
    await shot(page, "plans-explained/pricing")
  })

  // ── Signed in ─────────────────────────────────────────────────────
  await login(page)
  const pieceId = await ensureDemoDraft()

  await step(page, "getting-started/studio-dashboard", async () => {
    await page.goto("/studio")
    await page.waitForLoadState("networkidle")
    await shot(page, "getting-started/studio-dashboard")
  })
  await step(page, "getting-started/settings-profile", async () => {
    await page.goto("/studio/settings")
    await page.getByText("Display name").first().waitFor()
    await page.waitForLoadState("networkidle")
    // The seeded test avatar is a real-looking photo; hide it.
    await page.evaluate(() => document.querySelectorAll("img").forEach((i) => (i.style.visibility = "hidden")))
    await shot(page, "getting-started/settings-profile")
  })
  const section = async (title: string, name: string, height = 520) => {
    await page.goto("/studio/settings")
    const h = page.getByRole("heading", { name: title }).first()
    await h.waitFor()
    await page.waitForLoadState("networkidle")
    await h.evaluate((el) => el.scrollIntoView({ block: "start" }))
    await page.evaluate(() => window.scrollBy(0, -100))
    await page.waitForTimeout(400)
    const box = (await h.boundingBox())!
    const y = Math.max(0, box.y - 16)
    await shot(page, name, { full: true, clip: { x: 0, y, width: 1280, height } })
  }
  await step(page, "getting-started/author-mode", () => section("Creator Account", "getting-started/author-mode", 360))
  await step(page, "privacy-and-security/data-export", () => section("Data Export", "privacy-and-security/data-export", 400))
  await step(page, "privacy-and-security/two-factor", async () => {
    await section("Two-factor authentication", "privacy-and-security/two-factor", 300)
    const enable = page.getByRole("button", { name: "Enable 2FA" })
    if (await enable.isVisible().catch(() => false)) {
      await enable.click()
      await page.getByText("Verify & enable").waitFor()
      const h = page.getByRole("heading", { name: "Two-factor authentication" }).first()
      await h.evaluate((el) => el.scrollIntoView({ block: "start" }))
      await page.evaluate(() => window.scrollBy(0, -100))
      await page.waitForTimeout(400)
      const box = (await h.boundingBox())!
      const y = Math.max(0, box.y - 16)
      await shot(page, "privacy-and-security/two-factor", { full: true, clip: { x: 0, y, width: 1280, height: 560 } })
      await page.getByRole("button", { name: "Cancel" }).click()
    }
  })
  // Danger zone sits directly below the (hidden-from-docs) verification section; clip tightly.
  await step(page, "privacy-and-security/danger-zone", () => section("Danger zone", "privacy-and-security/danger-zone", 260))

  await step(page, "getting-started/drafts-create", async () => {
    await page.goto("/studio/drafts")
    await page.getByRole("button", { name: "Create piece" }).click()
    await page.fill('input[placeholder="New piece title…"]', "My first piece")
    await page.getByText("Loading…").or(page.getByText("Loading...")).first().waitFor({ state: "hidden" }).catch(() => {})
    await page.waitForLoadState("networkidle")
    await shot(page, "getting-started/drafts-create")
  })
  await step(page, "importing-your-writing/import-markdown", async () => {
    await page.goto("/studio/drafts")
    await page.getByRole("button", { name: "Import markdown" }).click()
    await page.getByPlaceholder("Paste your markdown here…").fill("# Notes on spores\n\nSpores travel further than you'd think.\n\n> Most land within a metre.\n")
    await shot(page, "importing-your-writing/import-markdown")
  })
  await step(page, "importing-your-writing/import-substack", async () => {
    await page.goto("/studio/drafts")
    await page.getByRole("button", { name: "Import from Substack/Medium" }).click()
    await page.getByText("Bring your writing over").waitFor()
    await shot(page, "importing-your-writing/import-substack")
  })

  // ── Composer ──────────────────────────────────────────────────────
  const C = "composer-guide"
  const openComposer = async () => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`/studio/drafts/${pieceId}`)
    await page.locator("[data-block-uid]").first().waitFor({ timeout: 60000 })
    await page.waitForTimeout(1500)
  }
  // Composer tools live in the header's More actions menu.
  const menu = async (item: string) => {
    await page.locator("header").first().getByRole("button", { name: "More actions" }).click()
    await page.getByRole("menuitem", { name: item, exact: true }).click()
  }
  const focusBlock = async (i: number) => {
    const b = block(page, i)
    await b.scrollIntoViewIfNeeded()
    await b.click({ position: { x: 200, y: 50 } })
    await page.waitForTimeout(500)
    return b
  }
  await openComposer()

  await step(page, `${C}/overview`, async () => shot(page, `${C}/overview`))
  await step(page, `${C}/header`, async () => shot(page, `${C}/header`, { clip: { x: 0, y: 0, width: 1280, height: 64 } }))
  await step(page, `${C}/more-menu`, async () => {
    await page.locator("header button").last().click()
    await page.getByText("Restart Tour").waitFor()
    await shot(page, `${C}/more-menu`, { clip: { x: 880, y: 0, width: 400, height: 420 } })
    await page.keyboard.press("Escape")
  })
  // Opening a DB-seeded rich block for editing currently blanks it (see report), so retype it.
  const retypeParagraph = async () => {
    const b = await focusBlock(2)
    const pm = b.locator(".ProseMirror").first()
    await pm.click()
    await page.keyboard.press("Control+A")
    await page.keyboard.press("Delete")
    await page.keyboard.type("Most plants form partnerships with ")
    await page.keyboard.press("Control+B")
    await page.keyboard.type("mycorrhizal fungi")
    await page.keyboard.press("Control+B")
    await page.keyboard.type(". The fungus extends the root system with fine threads called ")
    await page.keyboard.press("Control+I")
    await page.keyboard.type("hyphae")
    await page.keyboard.press("Control+I")
    await page.keyboard.type(", and in return receives sugars from the plant.")
    await page.waitForTimeout(500)
    return b
  }
  await step(page, `${C}/bubble-menu`, async () => {
    const b = await retypeParagraph()
    await b.locator(".ProseMirror strong").first().dblclick()
    await page.getByLabel("Bold").waitFor()
    await shot(page, `${C}/bubble-menu`, { el: b })
  })
  await step(page, `${C}/link-dialog`, async () => {
    await page.getByLabel("Insert link").click()
    await page.getByText("Display text (optional)").waitFor()
    await page.locator('input[placeholder="https://example.com"]').fill("https://en.wikipedia.org/wiki/Mycorrhiza")
    await shot(page, `${C}/link-dialog`)
    await page.getByRole("button", { name: "Cancel" }).click()
  })
  await step(page, `${C}/inline-citation`, async () => {
    const b = await focusBlock(2)
    await b.locator(".ProseMirror em").first().dblclick()
    await page.locator('button[title="Citation"]').click()
    await page.getByPlaceholder("https://example.com/source").fill("https://www.nature.com/articles/41557")
    await shot(page, `${C}/inline-citation`)
    await page.keyboard.press("Escape")
  })
  await step(page, `${C}/block-controls`, async () => {
    const b = await focusBlock(2)
    await page.keyboard.press("End")
    await b.hover()
    await shot(page, `${C}/block-controls`, { el: b })
  })
  await step(page, `${C}/type-switcher`, async () => {
    const b = await focusBlock(2)
    await b.locator('[title="Change block type"]').click()
    await page.waitForTimeout(400)
    await shot(page, `${C}/type-switcher`)
    await page.keyboard.press("Escape")
  })
  await step(page, `${C}/ai-variant-menu`, async () => {
    const b = await focusBlock(2)
    await b.locator('[title="Generate AI Variant"]').click()
    await page.getByText("Teach Mode").waitFor()
    await shot(page, `${C}/ai-variant-menu`)
    await page.keyboard.press("Escape")
  })
  await step(page, `${C}/inspector`, async () => {
    await focusBlock(2)
    await page.getByText("Mode visibility").first().waitFor()
    await shot(page, `${C}/inspector`, { el: page.locator("#tour-inspector") })
  })
  await step(page, `${C}/outline`, async () => shot(page, `${C}/outline`, { el: page.locator("#tour-outline") }))
  await step(page, `${C}/heading`, async () => shot(page, `${C}/heading`, { el: await focusBlock(0) }))
  await step(page, `${C}/image-editor`, async () => shot(page, `${C}/image-editor`, { el: await focusBlock(3) }))
  await step(page, `${C}/quote-callout`, async () => {
    const a = block(page, 4)
    const c = block(page, 5)
    await a.scrollIntoViewIfNeeded()
    const ba = (await a.boundingBox())!, bc = (await c.boundingBox())!
    await shot(page, `${C}/quote-callout`, { clip: { x: ba.x, y: ba.y, width: ba.width, height: bc.y + bc.height - ba.y } })
  })
  await step(page, `${C}/code-editor`, async () => shot(page, `${C}/code-editor`, { el: await focusBlock(6) }))
  // code-run: the Run button only shows when code running is enabled on the server; not captured.
  await step(page, `${C}/citation-dialog`, async () => {
    const b = await focusBlock(7)
    await b.getByRole("button", { name: /details/ }).click()
    await page.getByText("Citation details").waitFor()
    await shot(page, `${C}/citation-dialog`)
    await page.getByRole("button", { name: "Cancel" }).click()
  })
  await step(page, `${C}/chart-editor`, async () => shot(page, `${C}/chart-editor`, { el: await focusBlock(9) }))
  // Preview renders boxes without labels right now (see report), so show the editor.
  await step(page, `${C}/mermaid-editor`, async () => shot(page, `${C}/mermaid-editor`, { el: await focusBlock(10) }))
  await step(page, `${C}/flowchart`, async () => {
    const b = await focusBlock(11)
    await page.waitForTimeout(2000)
    await shot(page, `${C}/flowchart`, { el: b })
  })
  await step(page, `${C}/exercise`, async () => shot(page, `${C}/exercise`, { el: await focusBlock(12) }))
  await step(page, `${C}/audio-editor`, async () => {
    const b = block(page, 13)
    await b.scrollIntoViewIfNeeded()
    await shot(page, `${C}/audio-editor`, { el: b })
  })
  await step(page, `${C}/embed`, async () => {
    const b = block(page, 14)
    await b.scrollIntoViewIfNeeded()
    await page.waitForTimeout(2500)
    await shot(page, `${C}/embed`, { el: b })
  })
  await step(page, `${C}/argument-blocks`, async () => {
    await page.locator("header").first().getByRole("button", { name: "Preview", exact: true }).click()
    // .last(): the outline also lists this text; we want the canvas copy.
    await page.getByText("Several recent reviews argue").last().evaluate((el) => el.scrollIntoView({ block: "center" }))
    await page.waitForTimeout(800)
    await shot(page, `${C}/argument-blocks`)
  })
  await step(page, `${C}/reader-preview`, async () => {
    await page.getByText("How fungal networks share resources").first().evaluate((el) => el.scrollIntoView({ block: "start" }))
    await page.waitForTimeout(600)
    await shot(page, `${C}/reader-preview`)
  })
  // Back to edit mode
  await openComposer()
  await step(page, `${C}/gated`, async () => {
    const b = block(page, 18)
    await b.scrollIntoViewIfNeeded()
    await shot(page, `${C}/gated`, { el: b })
  })
  await step(page, `${C}/slash-menu`, async () => {
    await page.getByText("+ Add block").click()
    await page.waitForTimeout(800)
    const last = page.locator("[data-block-uid]").last()
    await last.click({ position: { x: 200, y: 45 } })
    await last.locator(".ProseMirror").first().click()
    await page.keyboard.type("/")
    await page.getByText("Insert block").waitFor()
    await shot(page, `${C}/slash-menu`)
    await page.keyboard.press("Escape")
  })
  await step(page, `${C}/mention-menu`, async () => {
    await page.locator("[data-block-uid]").last().locator(".ProseMirror").first().click()
    await page.keyboard.type("Thanks to @test")
    await page.getByText("Mention person").waitFor()
    await page.waitForTimeout(1200)
    await shot(page, `${C}/mention-menu`)
    await page.keyboard.press("Escape")
  })
  await step(page, `${C}/reading-mode-preview`, async () => {
    await openComposer()
    await page.locator("header").first().getByRole("button", { name: "More actions" }).click()
    await page.getByRole("menuitem", { name: "Reading Mode", exact: true }).hover()
    await page.getByRole("menuitemradio", { name: /Skim/ }).or(page.getByRole("menuitem", { name: /Skim/ })).first().click()
    await block(page, 5).scrollIntoViewIfNeeded()
    await shot(page, `${C}/reading-mode-preview`)
  })
  await step(page, `${C}/heatmap`, async () => {
    await openComposer()
    await menu("Heatmap")
    await block(page, 5).scrollIntoViewIfNeeded()
    await shot(page, `${C}/heatmap`)
    await menu("Heatmap")
  })
  await step(page, `${C}/commit-dialog`, async () => {
    await openComposer()
    await page.getByRole("tab", { name: "History" }).click()
    await page.getByRole("button", { name: "Save version" }).first().click()
    await page.getByPlaceholder("e.g. Added introduction, Fixed typos...").fill("Added the evidence section")
    await shot(page, `${C}/commit-dialog`)
    await page.getByRole("dialog").getByRole("button", { name: "Save version" }).click()
    await page.waitForTimeout(2000)
  })
  await step(page, `${C}/history`, async () => {
    await page.getByRole("tab", { name: "History" }).click()
    await page.waitForTimeout(800)
    await shot(page, `${C}/history`, { el: page.locator("#tour-outline") })
    await page.getByRole("tab", { name: "Outline" }).click()
  })
  await step(page, `${C}/archive`, async () => {
    await menu("Archive")
    await page.getByPlaceholder("Search prior blocks…").fill("fungal")
    await page.getByText("Soil, carbon").first().waitFor({ timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(500)
    await shot(page, `${C}/archive`, { el: page.locator("#tour-inspector") })
  })
  await step(page, `${C}/synthesis`, async () => {
    await page.getByText("Synthesis", { exact: true }).click()
    await page.waitForTimeout(600)
    await shot(page, `${C}/synthesis`, { el: page.locator("#tour-inspector") })
    await page.getByText("Inspector", { exact: true }).first().click()
  })
  await step(page, `${C}/meta-general`, async () => {
    await menu("Meta")
    await page.getByText("Piece meta").waitFor()
    await shot(page, `${C}/meta-general`)
  })
  await step(page, `${C}/meta-sponsors`, async () => {
    await page.getByRole("tab", { name: "Sponsors" }).click()
    await page.waitForTimeout(500)
    await shot(page, `${C}/meta-sponsors`)
    await page.keyboard.press("Escape")
  })
  await step(page, `${C}/schedule`, async () => {
    await menu("Schedule")
    await page.getByText("Schedule publication").first().waitFor()
    await shot(page, `${C}/schedule`)
    await page.keyboard.press("Escape")
  })
  await step(page, `${C}/minimap`, async () => {
    await menu("Minimap")
    await page.getByText("Document Minimap").waitFor()
    await page.waitForTimeout(1500)
    await shot(page, `${C}/minimap`)
    await page.keyboard.press("Escape")
  })
  await step(page, `${C}/dictation`, async () => {
    const btn = page.locator('button[title^="Voice Dictation"]')
    await btn.waitFor()
    const b = (await btn.boundingBox())!
    await shot(page, `${C}/dictation`, { clip: { x: Math.max(0, b.x - 340), y: Math.max(0, b.y - 160), width: 420, height: 230 } })
  })
  await step(page, "getting-started/publish-button", async () => shot(page, "getting-started/publish-button", { clip: { x: 640, y: 0, width: 640, height: 64 } }))
  await step(page, "getting-started/composer-new", async () => {
    await page.goto("/studio/drafts")
    await page.getByRole("button", { name: "Create piece" }).click()
    await page.fill('input[placeholder="New piece title…"]', "My first piece")
    await page.getByRole("button", { name: "Create", exact: true }).click()
    await page.waitForURL(/\/studio\/drafts\/[0-9a-f-]{36}/)
    await page.locator("[data-block-uid]").first().waitFor({ timeout: 60000 })
    await page.waitForTimeout(5000)
    await shot(page, "getting-started/composer-new")
  })

  // ── Studio pages ──────────────────────────────────────────────────
  const studio = async (route: string, name: string, wait?: string) => {
    await page.goto(route)
    if (wait) await page.getByText(wait).first().waitFor()
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(800)
    await shot(page, name)
  }
  const withForm = async (route: string, button: string, name: string) => {
    await page.goto(route)
    await page.waitForLoadState("networkidle")
    await page.getByRole("button", { name: button }).first().click()
    await page.waitForTimeout(800)
    await shot(page, name)
  }
  await step(page, "community-features/debates", () => withForm("/studio/debates", "Create room", "community-features/debates"))
  await step(page, "community-features/branches", () => withForm("/studio/branches", "Create branch", "community-features/branches"))
  await step(page, "community-features/graph", async () => {
    await page.goto(`/u/${HANDLE}`)
    await page.getByRole("tab", { name: /Graph/ }).or(page.getByRole("button", { name: /^Graph/ })).first().click()
    await page.waitForTimeout(2500)
    await shot(page, "community-features/graph")
  })
  await step(page, "community-features/network", () => studio("/studio/network", "community-features/network"))
  await step(page, "community-features/quests", () => studio("/studio/quests", "community-features/quests", "Quests & Achievements"))
  await step(page, "community-features/flair", async () => {
    await page.goto("/me/earnings")
    const h = page.getByText("Flair shop").first()
    await h.waitFor()
    await page.waitForLoadState("networkidle")
    await h.evaluate((el) => el.scrollIntoView({ block: "start" }))
    await page.evaluate(() => window.scrollBy(0, -40))
    await page.waitForTimeout(500)
    await shot(page, "community-features/flair")
  })
  await step(page, "earning/tiers", async () => {
    await page.goto("/studio/tiers")
    await page.waitForLoadState("networkidle")
    await page.getByRole("button", { name: /Create tier|New tier/ }).first().click()
    await page.waitForTimeout(600)
    const inputs = page.locator("main input, main textarea")
    await page.getByLabel(/Tier name/i).fill("Field notes").catch(() => inputs.nth(0).fill("Field notes"))
    await page.getByLabel(/Monthly price/i).fill("99").catch(() => {})
    await page.getByLabel(/Description/i).fill("Support the series and get the extras.").catch(() => {})
    await page.getByLabel(/Perks/i).fill(["Full data sets", "Monthly reading list", "Members-only debate room"].join("\n")).catch(() => {})
    await shot(page, "earning/tiers")
  })
  await step(page, "earning/earnings", async () => {
    await page.goto("/studio/earnings")
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(800)
    // Mask the seeded test UPI handle.
    await page.evaluate(() => {
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeValue?.includes("@")) n.nodeValue = n.nodeValue.replace(/[\w.-]+@[\w.-]+/g, "yourname@upi")
    })
    await shot(page, "earning/earnings")
  })

  // ── Public reading pages ──────────────────────────────────────────
  const R = "reading-and-discovery"
  const readerMore = () => page.locator("article > .hairline-b").getByRole("button", { name: "More actions" }).click()
  const post = `/u/${HANDLE}/welcome`
  await step(page, `${R}/feed-discover`, async () => {
    await page.goto("/feed")
    await page.getByRole("tab", { name: "Discover" }).click().catch(() => page.getByText("Discover").first().click())
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(1000)
    await shot(page, `${R}/feed-discover`)
  })
  await step(page, `${R}/search`, () => studio("/search?q=guide", `${R}/search`))
  await step(page, `${R}/collections`, () => studio("/collections", `${R}/collections`))
  await step(page, `${R}/leaderboard`, () => studio("/leaderboard", `${R}/leaderboard`))
  await step(page, `${R}/notifications`, () => studio("/notifications", `${R}/notifications`))
  await step(page, `${R}/profile`, () => studio(`/u/${HANDLE}`, `${R}/profile`))
  await step(page, "welcome/reader", () => studio(post, "welcome/reader"))
  await step(page, "getting-started/published-reader", () => studio(`/u/${HANDLE}/getting-started`, "getting-started/published-reader"))
  await step(page, `${R}/reader-modes`, async () => {
    await page.goto(`/u/${HANDLE}/composer-guide`)
    await page.getByRole("radiogroup", { name: "Reading mode" }).getByRole("radio", { name: "expert" }).click()
    await page.waitForTimeout(800)
    await shot(page, `${R}/reader-modes`)
  })
  await step(page, `${R}/reader-actions`, async () => {
    await page.goto(post)
    await readerMore()
    await page.waitForTimeout(300)
    const bar = (await page.locator("article > .hairline-b").boundingBox())!
    const m = (await page.getByRole("menu").boundingBox())!
    const x = Math.max(0, Math.min(bar.x + bar.width - 640, m.x - 24))
    await shot(page, `${R}/reader-actions`, { clip: { x, y: Math.max(0, bar.y - 8), width: 664, height: m.y + m.height - bar.y + 24 } })
    await page.keyboard.press("Escape")
  })
  await step(page, "accessibility/listen-menu", async () => {
    await page.goto(post)
    await readerMore()
    await page.getByRole("menuitem", { name: /Listen settings/ }).click()
    await page.waitForTimeout(800)
    await shot(page, "accessibility/listen-menu")
    await page.keyboard.press("Escape")
  })
  await step(page, "accessibility/eli5", async () => {
    await page.goto(post)
    await readerMore()
    await page.getByRole("menuitem", { name: /ELI5/ }).click()
    await page.getByText(/Synthesizing/).waitFor({ state: "hidden", timeout: 60000 }).catch(() => {})
    await page.waitForTimeout(500)
    await shot(page, "accessibility/eli5")
  })
  await step(page, `${R}/highlight-bubble`, async () => {
    await page.goto(post)
    const para = page.getByText("That idea, one piece and several ways in").first()
    await para.waitFor()
    await para.scrollIntoViewIfNeeded()
    await para.click({ clickCount: 3 })
    await page.waitForTimeout(800)
    const b = (await para.boundingBox())!
    await shot(page, `${R}/highlight-bubble`, { clip: { x: Math.max(0, b.x - 40), y: Math.max(0, b.y - 140), width: 860, height: 260 } })
  })
  await step(page, `${R}/responses`, async () => {
    await page.goto(post)
    await readerMore()
    await page.getByRole("menuitem", { name: /Responses/ }).click()
    await page.getByPlaceholder("What are your thoughts?").waitFor()
    await page.getByText("Loading...").or(page.getByText("Loading…")).first().waitFor({ state: "hidden" }).catch(() => {})
    await shot(page, `${R}/responses`)
    await page.keyboard.press("Escape")
  })
  await step(page, "community-features/repost-dialog", async () => {
    await page.goto(post)
    await readerMore()
    await page.getByRole("menuitem", { name: /Repost/ }).click()
    await page.getByText("Repost this piece").waitFor()
    await shot(page, "community-features/repost-dialog")
    await page.keyboard.press("Escape")
  })
  await step(page, "privacy-and-security/report-dialog", async () => {
    await page.goto(post)
    await readerMore()
    await page.getByRole("menuitem", { name: /Report/ }).click()
    await page.getByText("Submit Report").waitFor()
    await shot(page, "privacy-and-security/report-dialog")
    await page.keyboard.press("Escape")
  })
  await step(page, "earning/tip-jar", async () => {
    await page.goto(post)
    const t = page.getByText("Tipping opens after launch").locator("visible=true").first()
    await t.waitFor()
    await t.scrollIntoViewIfNeeded()
    const b = (await t.boundingBox())!
    await shot(page, "earning/tip-jar", { clip: { x: Math.max(0, b.x - 32), y: Math.max(0, b.y - 64), width: 380, height: 180 } })
  })

  // ── Mobile ────────────────────────────────────────────────────────
  await page.setViewportSize({ width: 375, height: 812 })
  await step(page, "getting-started/mobile-studio", () => studio("/studio", "getting-started/mobile-studio"))
  await step(page, `${R}/mobile-reader`, () => studio(post, `${R}/mobile-reader`))
  await step(page, `${C}/mobile-composer`, async () => {
    await page.goto(`/studio/drafts/${pieceId}`)
    await page.locator("[data-block-uid]").first().waitFor({ timeout: 60000 })
    await page.waitForTimeout(1500)
    for (const t of ["Collapse panel", "Collapse outline"]) {
      const b = page.locator(`button[title="${t}"]`)
      if (await b.isVisible().catch(() => false)) await b.click()
    }
    await page.waitForTimeout(600)
    await shot(page, `${C}/mobile-composer`)
  })

  await ctx.close()
  console.log(failures.length ? `\nFAILURES:\n${failures.join("\n")}` : "\nAll shots captured.")
})
