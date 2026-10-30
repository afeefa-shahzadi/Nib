/**
 * Seeds the official blog: help/announcement posts published under the
 * platform's own account. Idempotent: re-running updates posts in place
 * (matched by slug + author) and replaces their blocks.
 *
 *   Local: set -a && . ./.env.development.local && set +a && pnpm seed:blog
 *   Prod:  NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SECRET_KEY=… pnpm seed:blog
 *
 * Optional env: OFFICIAL_ACCOUNT_EMAIL (login email for the account; it has no
 * password and can only be signed into via a magic link / reset you trigger).
 *
 * Screenshots live in public/blog/<slug>/*.png and are served statically.
 * Retake them with: pnpm exec playwright test tests/e2e/blog-screenshots.spec.ts --project=chromium
 */
import { createClient } from "@supabase/supabase-js"
import { existsSync, readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { join } from "node:path"
import { guidePosts, roleCollections } from "./seed_blog_guides"

// ── Brand: rename here and re-run. ──────────────────────────────────────────
const BRAND = "Nib"
const HANDLE = "nib"
const DISPLAY_NAME = BRAND
const BIO = `Official updates and guides from the ${BRAND} team.`
const ACCOUNT_EMAIL = process.env.OFFICIAL_ACCOUNT_EMAIL || `official+${HANDLE}@example.com`
// ────────────────────────────────────────────────────────────────────────────

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY.")
  process.exit(1)
}
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const MODES = { skim: true, standard: true, expert: true, teach: true, debate: true }

// ── Tiny markdown → blocks converter ────────────────────────────────────────
// Chunks are separated by blank lines:
//   ## h2 / ### h3          heading
//   ![alt](file.png) cap    image from public/blog/<slug>/file.png (caption optional)
//   !note text              callout
//   - item / 1. item        list (one paragraph block)
//   anything else           paragraph; supports **bold**, *italic*, `code`, [text](href)
//   >expert text            (line inside a paragraph chunk) that mode's version of the paragraph
//   @expert text            paragraph shown only in that mode (expert | teach | debate)
//   ?teach text             question block shown only in Teach
//   ~~~mermaid Caption      Mermaid diagram (source lines follow, closed by ~~~)
//   ~~~block chart          any block type; JSON content follows, closed by ~~~
// Skim keeps headings and the first paragraph of each section; images, callouts and
// the supporting paragraphs after the first are hidden in Skim.
type Block = { type: string; content: Record<string, unknown>; semantic_role: string | null; mode_visibility?: Record<string, boolean> }
const NOT_SKIM = { ...MODES, skim: false }
const ONLY = (m: string) => Object.fromEntries(Object.keys(MODES).map((k) => [k, k === m]))
const para = (t: string) => ({ text: plain(t), html: `<p>${inline(t)}</p>` })

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const inline = (s: string) =>
  esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
const plain = (s: string) =>
  s.replace(/`([^`]+)`/g, "$1").replace(/\*\*?([^*]+)\*\*?/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")

function toBlocks(slug: string, md: string): Block[] {
  const out: Block[] = []
  let sectionLead = true // next paragraph is the first of its section, so Skim keeps it
  for (const raw of md.trim().split(/\n\s*\n/)) {
    const variants: Record<string, Record<string, string>> = {}
    const chunk = raw
      .trim()
      .split("\n")
      .filter((l) => {
        const v = l.match(/^>(expert|teach|debate|skim) (.+)$/)
        if (v) variants[v[1]] = para(v[2])
        return !v
      })
      .join("\n")
    const only = chunk.match(/^@(expert|teach|debate) ([\s\S]+)$/)
    const ask = chunk.match(/^\?(teach|expert|debate) ([\s\S]+)$/)
    if (only || ask) {
      const [, m, t] = (only || ask)!
      out.push({ type: only ? "paragraph" : "question", content: para(t.replace(/\n/g, " ")), semantic_role: null, mode_visibility: ONLY(m) })
      continue
    }
    const h = chunk.match(/^(#{2,3}) (.+)$/)
    const img = chunk.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*([\s\S]*)$/)
    if (h) {
      out.push({ type: "heading", content: { text: h[2], level: h[1].length }, semantic_role: null })
      sectionLead = true
    } else if (img) {
      const file = join(process.cwd(), "public", "blog", slug, img[2])
      if (!existsSync(file)) {
        console.warn(`  ! missing screenshot ${slug}/${img[2]}, skipped`)
        continue
      }
      out.push({
        type: "image",
        content: { imageUrl: `/blog/${slug}/${img[2]}?v=${createHash("sha1").update(readFileSync(file)).digest("hex").slice(0, 8)}`, alt: img[1], caption: img[3] || undefined, text: "" },
        semantic_role: null,
        mode_visibility: NOT_SKIM,
      })
    } else if (chunk.startsWith("~~~mermaid")) {
      // ~~~mermaid Caption / diagram source / ~~~ : a rendered Mermaid block.
      const m = chunk.match(/^~~~mermaid ?([^\n]*)\n([\s\S]*?)\n~~~$/)
      if (m) out.push({ type: "mermaid", content: { mermaidCode: m[2], caption: m[1] || undefined, text: "" }, semantic_role: null, mode_visibility: NOT_SKIM })
    } else if (chunk.startsWith("~~~block ")) {
      // ~~~block <type> / JSON content / ~~~ : any other block (chart, flowchart, exercise…).
      const m = chunk.match(/^~~~block (\w+)\n([\s\S]*?)\n~~~$/)
      if (m) out.push({ type: m[1], content: { text: "", ...JSON.parse(m[2]) }, semantic_role: null, mode_visibility: NOT_SKIM })
    } else if (chunk.startsWith("```")) {
      // One code block; each fence is a file tab: ```lang name ... ```.
      // Example code must not contain blank lines (they split chunks).
      const files = [...chunk.matchAll(/```(\w+) ([^\n]+)\n([\s\S]*?)\n```/g)].map(([, lang, name, content]) => ({ name, lang, content }))
      out.push({
        type: "code",
        content: { files, text: files[0]?.content ?? "", lang: files[0]?.lang ?? "text" },
        semantic_role: null,
        mode_visibility: NOT_SKIM,
      })
    } else if (chunk.startsWith("!note ")) {
      const t = chunk.slice(6)
      out.push({ type: "callout", content: para(t), semantic_role: null, mode_visibility: NOT_SKIM })
    } else if (/^(- |1\. )/.test(chunk)) {
      const ordered = chunk.startsWith("1. ")
      const items = chunk.split("\n").map((l) => l.replace(/^(- |\d+\. )/, "").trim())
      const tag = ordered ? "ol" : "ul"
      out.push({
        type: "paragraph",
        content: {
          text: items.map(plain).join("\n"),
          html: `<${tag}>${items.map((i) => `<li><p>${inline(i)}</p></li>`).join("")}</${tag}>`,
        },
        semantic_role: null,
        mode_visibility: sectionLead ? MODES : NOT_SKIM,
      })
      sectionLead = false
    } else {
      const t = chunk.replace(/\n/g, " ")
      out.push({
        type: "paragraph",
        content: { ...para(t), ...(Object.keys(variants).length ? { aiVariants: variants } : {}) },
        semantic_role: null,
        mode_visibility: sectionLead ? MODES : NOT_SKIM,
      })
      sectionLead = false
    }
  }
  return out
}

// ── Posts ───────────────────────────────────────────────────────────────────
type Post = { slug: string; title: string; summary: string; tags: string[]; body: string }

// Plan-specific claims live here so they're easy to edit when paid plans ship.
const PLANS_SECTION = `
## The plans we're planning

Everything below describes plans that are **not on sale yet**. Names, prices and limits may change before they launch. Prices are in Indian rupees.

### Free (Reader / Creator)

Free stays free after launch. You'll be able to read, write, publish, run branches and debate rooms, earn Insight Points, complete quests, and receive tips. The plan includes 50,000 AI tokens a day, or unlimited if you connect your own API key.

### Reader Pass (planned: ₹199/month)

For people who read a lot. Most of the pass (85% of what remains after tax and payment fees) is pooled each month and shared among the writers you clapped for, and you get a statement showing where it went. Pass holders also get 2,500 bonus Insight Points a month.

### Studio (planned: ₹499/month)

For writers who want to run a publication. Studio covers membership tiers, block-level gating (supporters-only paragraphs), analytics, and a full export of your work. Platform fees on your sales would be 0% up to ₹50,000 a month and 5% above that.

### Organizations (planned: ₹399 per seat/month, minimum 3 seats)

For newsrooms, labs, schools and teams. An organization gets a shared workspace with its own page, member roles (owner, admin, member), and debate rooms only members can join. Every seat includes Studio.

Education site licences and Enterprise contracts are also planned. If you're interested, write to us through the [contact page](/contact).
`

function posts(): Post[] {
  return [
    {
      slug: "welcome",
      title: `Welcome to ${BRAND}`,
      summary: `What ${BRAND} is, who it's for, and what makes a piece here different from a blog post.`,
      tags: ["announcements", "guide"],
      body: `
${BRAND} is a place to publish writing that can change shape for its reader. You write a piece once, as a sequence of blocks: paragraphs, claims, evidence, code, charts, exercises, diagrams. Readers then choose how they want to read it. Someone in a hurry can skim the headline claims. A specialist can switch to Expert for the precise detail and the evidence. A student can read the Teach version, with the scaffolding left in. This post is written that way too: try the mode tabs above.
>expert Technically, a piece is an ordered list of typed blocks. Each block stores its own visibility per mode (skim, standard, expert, teach, debate) and can carry a separate version of its content for any mode. The reader filters and swaps blocks by the mode in the address bar (\`?mode=expert\`); nothing is generated on the fly when you switch.
>teach Think of a piece as a stack of cards instead of one long page. Each card is a paragraph, a picture, a chart or a quiz. The writer can say "hide this card for people skimming" or "show a simpler version of this card for learners". When you pick a mode, you see the stack the writer prepared for that mode.
>debate The obvious objection: writing one piece several ways is more work, and most writers won't do it. That's fair. A piece with no mode data simply reads the same in every mode, and the reader then hides the mode tabs instead of offering choices that change nothing.

?teach In your own words: what changes when you switch from Standard to Skim on this page, and what stays the same?

That idea, one piece and several ways in, shapes most of what you'll find here.

![The home page](home.png) The ${BRAND} home page.

## Who it's for

**Readers** who want more than a feed. You can follow writers, highlight and annotate passages, argue in debate rooms attached to a piece, and save things into collections.

**Writers** who care about structure. The composer treats a piece as a set of blocks you can tag, reorder, gate and adapt, rather than one long text field. If you write technical explainers, essays with real arguments, course material or research summaries, the block model will feel natural quickly.
>expert **Writers** who care about structure. In the composer every block has a type, an optional semantic role (thesis, evidence, counter, footnote), a per-mode visibility setting, optional per-mode variants and an optional gate. Blocks can be reordered from the outline, renamed, and saved into named versions you can restore later.
>teach **Writers** who like to plan. Instead of one big text box, you build a piece out of separate blocks, a bit like building with bricks. You can move bricks around, label what each one does, and decide who sees which brick.

**Teams and institutions** that want a shared space: a newsroom, a lab, a school department. Organizations get a common workspace, member roles and private debate rooms.

## What's different

- **Reading modes.** A piece can be read in Skim, Standard, Expert, Teach or Counterpoints mode. Writers decide which blocks appear in which mode, and can write a separate version of a block for a mode; readers only see the modes a piece actually uses.
- **Arguments as structure.** Thesis, Evidence, Counter and Footnote are block types, not formatting. Readers can see the shape of an argument at a glance.
- **Conversation attached to the work.** Inline comments, highlights, annotations and debate rooms all live on the piece itself.
- **Runnable and interactive content.** Code blocks can run in a sandbox, charts are real charts, exercises check answers, and flowcharts are interactive.
- **No ads.** Writers earn from readers directly, through tips, memberships and sponsorships, once paid features launch.

@debate The trade-off: structure has a cost. A blog editor lets you just type; a block editor asks you to think about types, roles and modes. For a quick note that is overhead you may not want, and a piece that ignores modes entirely is perfectly fine here.

![A piece in the reader](reader.png) A published piece. The mode switcher sits above the text.

## Everything is free during launch

We're opening ${BRAND} with every feature switched on for everyone, including the ones that will later belong to paid plans. You don't need a card to use any of it.
>debate A fair worry with "free during launch" is what happens afterwards. Our answer is in writing: the Free plan keeps reading, writing, publishing, debates and tips, and we'll announce paid plans here before they start, with a waitlist. You don't need a card to use any of it. When paid plans arrive we'll say so here first, and there will be a waitlist if you want to hear the moment they do. See [Plans explained](/u/${HANDLE}/plans-explained) for the details.

## Where to start

- New here? Read [Getting started](/u/${HANDLE}/getting-started) for the five-minute version: account, profile, first draft, publish.
- Want to write something serious? The [composer guide](/u/${HANDLE}/composer-guide) covers every block and tool in the editor.
- Mostly reading? [Reading and discovery](/u/${HANDLE}/reading-and-discovery) explains the feed, search, collections and notifications.

This account (@${HANDLE}) is where we'll post guides, changes and announcements. Follow it if you want them in your feed.
`,
    },
    {
      slug: "getting-started",
      title: `Getting started on ${BRAND}`,
      summary: "Create an account, set up your profile, turn on author mode, and publish your first piece.",
      tags: ["guide", "getting-started"],
      body: `
This guide takes you from no account to a published piece. It should take about five minutes, longer if you get attached to your first draft.
>expert The path is: sign up as a reader, author or organization, fill in your profile, switch on Author Mode under Creator Account in Settings if you signed up as a reader, then click New piece in the studio. Publish, Schedule and Save sit at the right of the composer header.
>teach Here is the plan in plain steps: make an account, tell people a little about yourself, switch on writing, write something short, and press Publish. You can change or delete anything afterwards, so the first piece doesn't need to be perfect.
>debate Five minutes is the happy path. If you skip the profile you'll publish faster, but readers who land on your piece will see an empty author page, so it's worth the extra minute.

?teach Which setting do you need to turn on before you can publish, and where does it live?

## 1. Create an account

Go to [Sign up](/signup). The first screen asks how you plan to use ${BRAND}:

- **I'm a reader**: follow writers, tip pieces, join debates.
- **I'm an author**: publish pieces, run tiers, host debates.
- **We're an organization**: for schools, businesses, labs and other groups.

This only decides where you land after signing up. You can do both reading and writing later, whichever you pick.

![Choosing how you'll use the site](signup-role.png) The first step of sign-up.

Next, enter your date of birth, email and a password of at least eight characters, and accept the terms. We ask for your date of birth to confirm you're at least 13 and to decide whether mature content can be shown to you. You can also continue with Google.

![The author sign-up form](signup-author.png) The sign-up form for authors.

If you sign up with email, we'll send a confirmation link. Click it, then sign in.

!note If you sign up with Google, we don't ask for a date of birth, and you can't currently add one yourself afterwards. That only matters for pieces marked as mature content. If you need it set, contact us.

## 2. Find your way around the studio

Authors land in the **studio**, the private side of ${BRAND} where your drafts, settings and tools live. Readers land on the feed, and can open the studio from the menu at any time.

![The studio dashboard](studio-dashboard.png) The studio dashboard. "New piece" starts a draft straight away.

The left sidebar holds everything: Drafts, Debates, Branches, Tiers, Collections, Quests, Earnings, Settings and more. On a phone it collapses into a menu.

## 3. Set up your profile

Open **Settings** from the sidebar. Under **Profile** you can set:

- **Display name**: shown on your pieces and profile.
- **Handle**: your public address, \`/u/your-handle\`.
- **Avatar**: upload an image (up to 5 MB) or paste a URL.
- **Bio**: up to 500 characters.

Click **Save profile** when you're done.

![Profile settings](settings-profile.png) Profile settings in the studio.

## 4. Turn on author mode

If you signed up as a reader and want to publish, scroll to **Creator Account** in Settings and switch on **Author Mode**. It unlocks drafts, branches, tiers and earnings in the sidebar. You can switch it off again without losing anything.

![The author mode switch](author-mode.png) Author mode lives under Creator Account.

## 5. Write your first draft

Open **Drafts** and click **Create piece**, give it a title and click **Create**. Or click **New piece** on the dashboard, which skips the title and drops you straight into the editor.

![Creating a piece from the drafts list](drafts-create.png) The drafts list, with the create form open.

The composer opens with one empty paragraph. Start typing. Press \`/\` at the start of a line to insert other kinds of block: headings, images, code, charts and so on. The composer saves on its own a few seconds after you stop typing, and you'll see "Saved" in the header.

![A new draft in the composer](composer-new.png) A fresh draft. The outline is on the left and the inspector on the right.

The first time you open the composer, a short tour points out the main areas. You can restart it later from the **…** menu.

## 6. Add a summary and tags

Click **Meta** in the composer header. Add a one or two sentence **Summary** (shown on cards and in search), a few **Tags**, and optionally a **Canonical thesis**, the one-sentence claim the piece makes. **AI suggest** will draft all three from your text if you'd like a starting point.

## 7. Publish

When you're ready, click **Publish** in the header, or press **Ctrl+Enter** (**Cmd+Enter** on a Mac). Your piece goes live at \`/u/your-handle/piece-slug\`. Want it to go out later? Use **Schedule** to pick a date and time instead.

![The publish button](publish-button.png) Publish, Schedule and Save sit at the right of the header.

To take a piece down, click **Unpublish**. It goes back to being a draft and keeps all its content.

![A published piece](published-reader.png) What readers see.

## On a phone

Everything above works on a phone, though the composer has more room on a larger screen. On narrow screens, the header buttons move into the **…** menu.

![The studio on a phone](mobile-studio.png) The studio at phone width.

## Next steps

- Learn the editor properly in the [composer guide](/u/${HANDLE}/composer-guide).
- Moving from another platform? See [Importing your writing](/u/${HANDLE}/importing-your-writing).
`,
    },
    {
      slug: "composer-guide",
      title: "The complete composer guide",
      summary: "Every block type, panel, dialog and shortcut in the composer, with screenshots.",
      tags: ["guide", "composer", "writing"],
      body: `
The composer is where you write on ${BRAND}. It looks like a document editor, but a piece is actually a list of **blocks**. Each block has a type (paragraph, image, chart, code, exercise…), its own settings, and its own visibility in each reading mode. This guide covers all of it, in roughly the order you'll meet it.
>expert Under the hood each block stores a type, its content, an optional semantic role, a visibility flag per reading mode and optional per-mode variants. The outline, inspector, heatmap and minimap are all views over that same block list.
>teach Imagine writing with index cards: each card is one block, like a paragraph, a picture or a quiz. You can shuffle the cards, label them, and decide which cards each kind of reader gets. The rest of this guide explains each card type and tool one at a time.
>debate The block model is the composer's biggest strength and its biggest cost. It makes modes, gating and argument structure possible, but it also means more controls than a plain editor. If you only write short notes, you can ignore most of this guide and just type.

?teach What three things does every block have, according to the first paragraph?

To open the composer, go to **Drafts** in the studio and click a piece, or click **New piece** on the dashboard.

![The composer](overview.png) The composer: outline on the left, canvas in the middle, inspector on the right.

## The layout

The screen has three parts:

- **Outline and History** (left). A list of your blocks and your saved versions.
- **Canvas** (middle). The title and the blocks themselves.
- **Inspector, Archive and Synthesis** (right). Settings for the selected block, a search over your past writing, and analysis tools.

Both side panels collapse with the « and » buttons at their top edge. The composer remembers whether you left them open or closed.

## The header

![The composer header](header.png) The header bar.

From left to right:

- **Drafts** takes you back to your list of pieces.
- **Undo / Redo** (arrow icons) undo structural changes: adding, deleting, moving or converting blocks. Text edits inside a block have their own undo (Ctrl+Z / Cmd+Z while typing).
- The **status and address** of the piece, e.g. \`draft · /my-piece-k2x9a\`.
- The **save indicator**: "Saving…" or "Saved · 5s ago".
- **All modes** (eye icon) previews the piece in one reading mode. Blocks hidden in that mode are dimmed.
- **Preview** switches the canvas to a read-only view of the finished piece. **Edit** switches back.
- **Meta** opens the piece settings.
- **Heatmap** colours each block by how many reading modes it appears in.
- **Minimap** shows the whole piece as a map.
- **Schedule** sets a future publish time.
- **Archive** opens the archive search in the right panel.
- **Save** saves immediately.
- **Publish / Unpublish** (Ctrl+Enter or Cmd+Enter).
- **…** opens a menu with **Open reader page**, **Send via Email** (emails a published piece to your followers), **Restart Tour** and **Delete piece**. On smaller screens, the reading-mode, preview, meta, minimap, heatmap, schedule and archive controls also move into this menu.

![The more menu](more-menu.png) The … menu.

**Delete piece** asks you to type the start of the piece's title to confirm. This can't be undone from the composer.

## Writing text

Click into any text block and type. Text blocks (paragraph, quote, callout, question, thesis, evidence, counter, footnote and gated) share the same rich text editor.

### Formatting

Select some text and a small toolbar appears with **Bold**, **Italic**, **Strikethrough**, **Inline code**, **Highlight**, **Insert link** and **Citation**. When the selection is already a link, **Remove link** appears too.

![The formatting toolbar](bubble-menu.png) Select text to see the formatting toolbar.

The usual shortcuts work as well: Ctrl/Cmd+B for bold, Ctrl/Cmd+I for italic, Ctrl/Cmd+Shift+S for strikethrough, Ctrl/Cmd+E for inline code and Ctrl/Cmd+Shift+H for highlight. You can also type markdown as you go: \`**bold**\`, \`\`code\`\`, \`- \` for a bullet list, \`1. \` for a numbered list. Quotes and dashes are converted to their typographic forms automatically.

### Links

**Insert link** opens a small dialog with a **URL** and optional **Display text**. If you leave out \`https://\`, it's added for you. Select an existing link and use the same button to edit or remove it.

![The link dialog](link-dialog.png) Inserting a link.

### Inline citations

The **Citation** button (quote icon) in the toolbar adds a numbered reference, like [1], after the selected text. Enter the **Source URL** and click **Insert**. Readers can hover the number to see a preview of the source. Numbers are kept in order automatically, and all the sources in the piece are collected in a **References** list at the bottom of the canvas. You can reorder the references there with the arrow buttons.

![Adding an inline citation](inline-citation.png) An inline citation and its source URL.

### Mentions and links to your own pieces

Type \`@\` followed by a name to mention another person. Pick them from the list and a chip linking to their profile is inserted. Type \`[[\` followed by a title to link to one of your own pieces the same way.

![Mentioning someone](mention-menu.png) Type @ to mention someone.

!note Right now, mention and piece-link chips appear in the editor but don't yet show up in the published piece. We're fixing this. Until then, use a normal link if it matters that readers see it.

## Adding blocks

There are three ways to add a block:

1. Type \`/\` at the start of a line, or after a space. A menu of block types appears. Keep typing to filter it (\`/code\`, \`/chart\`), use the arrow keys to move, Enter to insert, and Escape to close. If the current block is empty it turns into the new type; otherwise the new block goes below.
2. Hover a block and click the **+** to its left (**Add block below**). This adds a paragraph.
3. Click **+ Add block** at the bottom of the canvas.

![The slash menu](slash-menu.png) The slash menu lists every block type.

## Block controls

Hover any block to see its controls.

![A block and its controls](block-controls.png) The controls along the top of a block.

- **Drag handle** (six dots, left edge): drag the block onto another block to move it.
- **Change block type** (the type label): convert the block to a different type.
- **Preview / Edit**: see just this block as readers will.
- **NSFW**: mark this block as explicit. Readers who aren't verified adults see a cover over it.
- **Mode dots**: one dot per reading mode, filled when the block is visible in that mode.
- **Mode variant arrows**: switch which mode's version of the block you're editing (see below).
- **Generate AI Variant** (wand icon): ask AI to rewrite the block for a mode.
- **Move up**, **Move down** and **Delete**. Delete doesn't ask for confirmation, but the header's Undo brings the block back.

![Changing a block's type](type-switcher.png) Converting a block to another type.

## Every block type

Here's every type in the slash menu and what you can do with each one.

### Paragraph

Plain prose, with all the formatting above. This is the default block.

### Heading

A section title. Choose **H2** or **H3** with the buttons on the block. Headings become the "On this page" table of contents in the reader.

![A heading block](heading.png) Heading blocks have H2 and H3 buttons.

### Image

Drop an image onto the block, click **Choose file**, or click **From URL** and paste an address. Uploads can be PNG, JPG, GIF or WEBP, up to 8 MB. Fill in:

- **Alt text**: a description for screen readers and for when the image can't load. Please don't skip this.
- **Caption**: shown under the image.
- **Credit** and **Credit link**: e.g. "Photo by Jane Doe" with a link to the source.

Readers can click an image to see it full size.

![The image block editor](image-editor.png) An image block with alt text, caption and credit.

!note Images from other websites only display if they come from one of a few hosts we allow. If an image from a URL doesn't appear, download it and upload the file instead.

### Quote

A pulled-out quotation, set larger and in italics.

### Callout

A highlighted note set apart from the text, labelled "Note" for readers. Useful for warnings, tips and asides you don't want missed.

![Quote and callout blocks](quote-callout.png) A quote and a callout.

### Code

A small code editor with syntax highlighting.

- **Language**: TypeScript, JavaScript, Python, Rust, Go, C, C++, Java, Ruby, HTML, CSS, JSON, SQL (SQLite), PostgreSQL or Bash.
- **Multiple files**: click **+** to add a file tab. Rename a tab by editing its name; changing the extension (\`.py\`, \`.cpp\`) changes the language too.
- **Run**: for Python, JavaScript, TypeScript, Go, C, C++, Java, Ruby, SQL (SQLite) and PostgreSQL, the code runs in the reader's browser and the output appears below. Anyone can run it, with or without an account; signed-in readers can also edit their own copy, which is never saved.
- **Preview**: if the files include HTML, CSS or JavaScript, a live preview renders under the editor.
- **Copy Code** copies the current file.
- Code is formatted automatically when you click away from it.
- The **ⓘ** button opens the [code blocks guide](/u/${HANDLE}/code-blocks): multi-file programs, web pages, SQL and PostgreSQL, with examples you can run.

![The code block](code-editor.png) A code block with two files.

### Citation

A formal citation shown as its own block. Click **Add details** and fill in **Source** (author, publication or work), **URL**, **Page / locator** and **Pulled quote**. You need at least one of source, URL or quote. Citation blocks are also listed in the References section.

![The citation dialog](citation-dialog.png) Citation details.

### Question

An open question, displayed prominently to readers. Use it to end a section with something worth arguing about. It pairs well with a debate room.

### Chart

A real chart, drawn from data you type in. Choose **Bar**, **Line**, **Area**, **Pie**, **Radar**, **Scatter** or **Composed**. Add **Labels** (the categories along the axis), then one or more **Series**, each with a name and a number for each label. Add an optional caption.

![The chart editor](chart-editor.png) The chart editor. Use the block's Preview button to see the chart.

### Mermaid

Diagrams written as text, using [Mermaid](https://mermaid.js.org) syntax: flowcharts, sequence diagrams, timelines and more. Type the code into the box and use the block's **Preview** button to see it drawn. Add a caption if you like.

![The Mermaid editor](mermaid-editor.png) A Mermaid flowchart written as text.

### Flowchart

An interactive diagram you build by hand. On a computer, drag a **Primary Node** or **Secondary Node** from the **Toolbox** onto the canvas. On a phone, use **+ Add Node**. Connect nodes by dragging from one node's handle to another's. Each node has a name and an optional subtitle, a **Toggle Style** button and a **Delete Node** button. The zoom controls are in the corner. Readers can pan and zoom the finished chart.

![The flowchart builder](flowchart.png) Building a flowchart.

### Exercise

A question with an answer readers can check. Six kinds:

- **Short Answer**: a prompt and a model answer, revealed when the reader asks.
- **Multiple Choice**: options with one correct answer.
- **Multi-Select**: options with several correct answers.
- **Fill in the Blanks**: write the prompt with \`___\` (three underscores) for each blank, and give the answers separated by commas.
- **Poll**: options with no right answer; readers vote.
- **Matching**: pairs of items readers match up.

Every type can have an optional **hint**.

![The exercise editor](exercise.png) Choosing an exercise type.

### Audio / Video

A clip readers can play. Drop a file, click **Choose file**, or use **From URL**. Audio can be MP3, WAV or M4A up to 25 MB, video MP4, WebM or MOV up to 200 MB. Add a **Transcript / scene note**, which matters for deaf and hard-of-hearing readers, and an optional caption. Recording directly in the browser isn't supported yet; record elsewhere and upload.

![The audio and video block](audio-editor.png) An audio block with a transcript.

### Embed

Paste a URL to embed it. YouTube, Vimeo and Loom links become proper video players. Other pages are embedded as they are, but many sites (X/Twitter among them) don't allow embedding, so check the preview before you publish.

![The embed block](embed.png) An embedded video.

### Thesis, Evidence, Counter and Footnote

Four paragraph types that give an argument visible structure:

- **Thesis**: the core claim, set large.
- **Evidence**: a supporting fact, in a labelled box.
- **Counter**: the strongest objection, in a differently coloured box. Including one is a good habit.
- **Footnote**: an aside, set small with a dagger mark.

You can also turn an ordinary paragraph into one of these from the **Semantic role** menu in the inspector.

![Argument blocks](argument-blocks.png) Evidence, counter and footnote blocks in the reader preview.

### Gated

A paragraph only supporters can read. Other readers see a "Premium content" panel in its place. You can gate any paragraph by ticking **Supporters only** in the inspector. Paid supporter tiers arrive with the paid launch (see [Earning on ${BRAND}](/u/${HANDLE}/earning) for what that means for gated blocks today).

![A gated block](gated.png) A gated block in the composer.

## Reading modes

There are five reading modes. Readers see a mode only if your piece gives it something different from Standard:

- **Skim**: the headline claims only.
- **Standard**: the full piece. This is the default.
- **Expert**: precise detail and evidence.
- **Teach**: scaffolded for learners.
- **Counterpoints**: the strongest objection to each claim, and the answer.

You decide what each mode shows, in two ways.

**Visibility.** Select a block and tick or untick modes under **Mode visibility** in the inspector. A block hidden in Skim simply doesn't appear in Skim. To check the result, open the **…** menu in the header and pick a mode under **Reading Mode** (hidden blocks dim), or choose **Heatmap** from the same menu to colour every block by how widely it's shown.

**Variants.** A block can have a different version in each mode. Use the arrows next to the mode label on a block to pick a mode, then edit; what you type is saved as that mode's version, and the Standard text is left alone. Or click the wand and choose a mode to have AI draft the variant for you.

![Previewing a reading mode](reading-mode-preview.png) Previewing the Skim mode. Blocks that don't appear in Skim are dimmed.

![The visibility heatmap](heatmap.png) The heatmap shows how widely each block is shown.

### AI variants

When AI generates a variant, a review panel opens under the block showing the difference between the original and the new version. Click **Apply** to keep it, **Regenerate** for another attempt, or **Dismiss** to throw it away. AI works on text blocks; for images, charts, embeds and audio it has nothing to rewrite, so write those variants yourself.

![Generating an AI variant](ai-variant-menu.png) The AI variant menu.

AI use comes out of a daily token allowance (50,000 a day on the free plan). In **Settings → AI Provider (BYOK)** you can add your own API key to go beyond it.

## The inspector

Click a block and the right panel shows its settings:

- **Mode visibility**: a checkbox per mode.
- **Semantic role**: none, thesis, evidence, counter or footnote.
- **Supporters only**: gate the block.
- **Flag as NSFW**: mark it explicit.
- **AI variants**: one row per mode, with **Generate** (or **Regenerate**) and **Review**.

![The inspector](inspector.png) The inspector for a selected block.

## The outline

The left panel's **Outline** tab lists every block with a short preview and dots for its modes. Click a row to jump to the block. Double-click a row to give it a custom label, which is handy in long pieces. Labels only show in the outline and minimap, never to readers.

![The outline](outline.png) The outline with a renamed block.

## History and versions

The **History** tab keeps versions of your piece. Click **Save version** and write a short message ("Added the second example"). The composer also saves a version on its own every ten minutes if anything changed; these are marked **Auto**.

Hover a version to **Compare with previous**, which shows a word-by-word diff, or **Restore this version** to roll the piece back.

![Saving a version](commit-dialog.png) Saving a version with a message.

![Version history](history.png) The version list.

!note After restoring a version, reload the page before you carry on editing. This avoids a known issue where the next autosave can overwrite the restored blocks.

## Archive

The **Archive** tab searches everything you've written before, drafts and published pieces alike. Type a phrase, then click **Cite** to insert a citation block linking to that piece, or **Quote** to insert the passage as a quote. It's a quick way to build on your own past work without hunting for it.

![Searching your archive](archive.png) Searching your archive.

## Synthesis

The **Synthesis** tab has two analysis tools:

- **Analyze Themes** finds the central ideas in your piece and the blocks that carry them. Click a result to jump there.
- **Find Links** suggests claims in this piece that relate to your published pieces, so you can link them.

![The synthesis panel](synthesis.png) The synthesis tools.

## Piece settings (Meta)

**Meta** opens the settings for the whole piece. They save automatically.

On **General Settings**:

- **Summary**: one or two sentences for cards, search and link previews. Aim for under 160 characters.
- **Canonical thesis**: the single claim the piece makes.
- **Tags**: comma-separated.
- **Accept tips**: show the tip jar on this piece.
- **Allow public sponsorship**: let organizations sponsor the piece.
- **Require credit on reposts**: people who repost it must credit you.
- **Mark as NSFW**: mark the whole piece as mature content.
- **Allow Inline Comments**: let readers comment on specific passages.
- **Made with AI**: show readers an AI label in the piece header.
- **Prose only**: hide the reading-mode dots and AI-variant buttons on every block while you write. Handy for fiction and essays you don't split into modes.

**AI suggest** drafts the summary, thesis and tags from your text. Review them before you publish.

![Piece settings](meta-general.png) Meta → General Settings.

On **Sponsors** you can add sponsors yourself: a name, URL, disclosure text (such as "Supported by") and logo. Active sponsors are listed with a delete button.

![Adding a sponsor](meta-sponsors.png) Meta → Sponsors.

## Scheduling

**Schedule** opens a calendar. Pick a date and time and click **Schedule**, and the piece publishes itself at that moment. Open the dialog again to **Edit schedule** or **Clear schedule**.

![Scheduling a piece](schedule.png) Picking a publish time.

## Minimap

**Minimap** shows your piece as a map of blocks in order, with coloured dots showing which modes have content. It's view-only, but useful for seeing the shape of a long piece at a glance.

![The minimap](minimap.png) The document minimap.

## Preview

**Preview** in the header turns the canvas into the reader view: title, summary and rendered blocks. Blocks with variants get arrows so you can flip through their versions.

![Reader preview](reader-preview.png) Previewing the piece as readers see it.

## Voice dictation

The round microphone button at the bottom right of the composer lets you dictate. Click it, speak, and what you said is added as a new paragraph after the block you're in. It uses your browser's speech recognition, so it works best in Chrome and Edge.

## Saving, offline and collaboration

- The composer **autosaves** about three seconds after you stop typing. **Ctrl+S** (Cmd+S) saves straight away.
- If you lose your connection, keep writing. Changes are kept and saved when you're back online.
- If someone else has the piece open, you'll see a badge such as "alex is editing...".

## Keyboard shortcuts

- **Ctrl/Cmd+S**: save
- **Ctrl/Cmd+Enter**: publish or unpublish
- **/**: open the block menu; **↑ ↓** to move, **Enter** to insert, **Esc** to close
- **@** to mention a person; **[[** to link one of your pieces
- **Ctrl/Cmd+B, I, E**: bold, italic, inline code
- **Ctrl/Cmd+Shift+S / H**: strikethrough, highlight
- **Ctrl/Cmd+Z**: undo typing (use the header arrows to undo block changes)

## On a phone

The composer works at phone width. Most header buttons move into the **…** menu, and the side panels open over the canvas, so collapse them with « and » when you want room to write.

![The composer on a phone](mobile-composer.png) The composer at phone width.
`,
    },
    {
      slug: "plans-explained",
      title: "Plans explained (and why everything is free right now)",
      summary: "Every feature is free during launch. Here's what the paid plans will look like when they arrive.",
      tags: ["announcements", "plans"],
      body: `
Short version: **during launch, every feature on ${BRAND} is free for everyone.** That includes the features we plan to charge for later. There's nothing to unlock and no card to enter.
>expert Concretely: no feature checks a plan during launch, no payment method is collected, and the planned prices below are not charged. Paid plans will be announced on this account before they start, with a waitlist.
>teach Simply put: right now you pay nothing and can use everything. Later some extras will cost money, and we'll tell you before that happens.
>debate The fair criticism of a free launch is that people get used to features that later go behind a paywall. We'd rather be clear now: the plans below are a plan, not a promise of prices, and the Free plan keeps reading, writing, publishing, debates and tips.

?teach During launch, which features need a paid plan?

We're doing this because we'd rather people try the whole product and tell us what's missing than meet a paywall in the first week. Paid plans will come later. When they do, we'll announce it on this account first, and you'll be able to join a waitlist to hear the moment they open.

## What "free during launch" means in practice

- You can use every studio tool: tiers, bundles, analytics, block gating, export, organizations, AI helpers and dictation.
- Nothing you make now will be deleted or hidden when paid plans arrive. If something you use moves to a paid plan, we'll give notice first, with time to decide.
- Money-moving features (tips, memberships, sponsorships and payouts) switch on with the paid launch. You can set up tiers and payout details now so you're ready on day one. See [Earning on ${BRAND}](/u/${HANDLE}/earning).
- AI helpers have a daily token allowance so one account can't use up the shared budget. If you need more, add your own API key under **Settings → AI Provider (BYOK)**.

![The pricing page](pricing.png) The pricing page.

${PLANS_SECTION}

## Questions

**Will my account become paid automatically?** No. Nobody gets charged without choosing a plan and paying for it.

**Will what I publish now stay public?** Yes.

**Can I export my work if I leave?** Yes, now and later. See [Privacy, data export and account security](/u/${HANDLE}/privacy-and-security).
`,
    },
    {
      slug: "reading-and-discovery",
      title: "Reading and discovery",
      summary: "The feed, search, reading modes, collections, the leaderboard, following and notifications.",
      tags: ["guide", "reading"],
      body: `
You don't have to write anything to get a lot out of ${BRAND}. This guide covers the reading side: finding things, reading them the way you want, and keeping track of what you've found.
>teach This guide is about the reading side of the site: finding things to read, reading them the way you like, and keeping track of what you've read and who you follow.
>debate One choice here is deliberate and open to argument: the feeds are in plain date order with no engagement ranking. That's predictable and hard to game, but it also means a busy day can push good pieces down quickly.

?teach How do you switch reading modes from the keyboard, and what happens to the address bar when you do?

## The feed

The [feed](/feed) has two tabs:

- **Following**: the newest pieces from people you follow.
- **Discover**: the newest pieces from everyone, with trending tags at the top.

On Discover you can search, and filter by date (past day, week, month or year), by tags, or to boosted pieces only. You can sort by most recent, oldest first or title. Both tabs are in plain date order; there's no engagement algorithm deciding what you see.

![The Discover feed](feed-discover.png) The Discover tab.

## Search

[Search](/search) looks through titles, summaries, theses and tags of every published piece. It doesn't search people yet; to find a writer, open one of their pieces and click through to their profile.

![Search results](search.png) Searching for pieces.

## Reading a piece

When the author has written mode-specific content for a piece, a **Mode** switcher appears above the text, offering only the modes that change something. **Skim** keeps the key claims, **Standard** is the whole piece, **Expert** adds precise detail, **Teach** adds plainer explanations and questions, and **Counterpoints** brings forward counter-arguments and trade-offs, with a link to the piece's debate room. A piece without mode content has no switcher. Number keys **1**, **2** and so on pick the modes in the order shown. The address bar updates, so a link you share opens in the same mode.

![Reading modes](reader-modes.png) The mode switcher on a piece.

The sidebar has the table of contents ("On this page"), the author, branches and related pieces. Next to the mode switcher is the action bar: **Applause** (hold the clap button to clap up to 50 times), **Save** (add it to your saved list or a collection) and **Share** (copy the link). The **More** menu holds the rest:

- **Listen** and **Listen settings**: have the piece read aloud (see [Accessibility](/u/${HANDLE}/accessibility)).
- **Responses**: comments on the piece.
- **Repost**: share it to your own profile, with a note.
- **Report**: flag a problem to the moderators.

![The reader action bar](reader-actions.png) The action bar with the More menu open.

### Highlights, annotations and inline discussion

Select any passage and a small menu appears: **Highlight** it, **Annotate** it with a private note, **Comment** to start a discussion about that passage (if the author allows inline comments), or **Quote** to share it. Your highlights and annotations are collected on your reading desk in the studio.

![Selecting text in a piece](highlight-bubble.png) The menu that appears when you select text.

### Responses

**Responses** opens the comments. Write in the box and click **Respond**, reply to others, and vote on comments.

![Responses](responses.png) The responses panel.

## Following people

Click **Follow** on someone's profile or on one of their pieces. Their new pieces then show up in your Following feed, and you'll get a notification when they publish.

A profile shows a writer's pieces, their membership tiers, a graph of how their pieces connect, and the other writers they've endorsed.

![A profile page](profile.png) A writer's profile.

## Collections

[Collections](/collections) are hand-picked reading paths: a reading list, a course, or a playbook. Open one to read through it in order, and mark it complete when you're done. You can make your own under **Collections** in the studio.

![Collections](collections.png) Browsing collections.

To save a single piece, click **Save** on it and choose **My Saved (private)**, one of your collections, or create a new collection on the spot.

## The leaderboard

The [leaderboard](/leaderboard) shows who's writing and reading the most. Switch between **Authors** and **Readers**, between popularity, activeness and earnings, and between all-time and this month.

![The leaderboard](leaderboard.png) The leaderboard.

## Notifications

The bell in the header shows recent activity. The full list is at [Notifications](/notifications): new pieces from people you follow, new followers and tips. Filter to **Unread**, or click **Mark all read**.

![Notifications](notifications.png) Notifications.

## RSS

If you prefer a feed reader, the site has an RSS feed at \`/feed.xml\` with the latest public pieces.

## On a phone

Reading works the same on a phone. The mode switcher becomes a dropdown and the sidebar moves below the piece.

![Reading on a phone](mobile-reader.png) A piece at phone width.
`,
    },
    {
      slug: "community-features",
      title: "Debates, branches, quests and the rest of the community",
      summary: "Debate rooms, branches, the content graph, endorsements, quests, Insight Points and flair.",
      tags: ["guide", "community"],
      body: `
Writing on ${BRAND} is meant to start conversations, not end them. This guide covers the tools for that, plus the small game layer of quests and points that sits on top.
>expert Debate rooms are attached to a single piece. A branch is an alternate framing of a piece (audio, teaching, premium, debate or translation) created in the studio with a parent piece, a type, a purpose and a summary, and it is listed in the original piece's sidebar. Quests award Insight Points.
>teach Think of these as ways to talk about writing instead of just reading it: rooms for arguing, branches for answering a piece with a piece of your own, and a small points game on top.
>debate Points and leaderboards can reward volume over quality. We've kept the game layer small and separate from ranking: points don't decide what shows up in the feed.

?teach What is the difference between a debate room and a branch?

## Debate rooms

A debate room is a discussion attached to a piece, built around a single prompt. Authors create them under **Debates** in the studio: pick the piece, give the room a title and a prompt, and choose who can join:

- **Public**: anyone can read; posting needs an account.
- **Members**: any of your active subscribers.
- **Specific tier**: subscribers of one tier.
- **Invite-only**: people you pick from those you follow.
- **Organization**: members of your organization only.

![Creating a debate room](debates.png) Creating a debate room in the studio.

Readers find a piece's rooms under **Live debates** on the piece itself. Pick a side and post.

## Branches

A branch is an alternate framing of a piece: an audio version, a teaching version, a premium version, a debate version, or a translation. Authors create them under **Branches** in the studio, giving each a parent piece, a type, a purpose and a summary. Branches appear in the sidebar of the original piece so readers know they exist.

![Branches](branches.png) Branches in the studio.

## The content graph

**Graph** in the studio maps your published pieces and their branches as a network, so you can see how your work connects. Readers see the same graph on your profile under the **Graph** tab.

## Endorsements

Under **Network** in the studio, you can endorse other writers whose work you vouch for. Endorsements appear on your profile's **Network** tab, which makes them a way for readers to find people through people.

![Endorsing a creator](network.png) The creator network.

## Quests and XP

[Quests](/studio/quests) are small daily goals that reset at midnight UTC: read three pieces, leave an annotation, clap on five pieces, follow a new author, publish a piece, reply to an annotation. Finish one and click **Claim** to collect XP. XP builds your level, which is shown in the studio sidebar. There are longer-running goals and achievements on the same page.

![Quests](quests.png) Daily quests and achievements.

## Insight Points and flair

Quests and activity also earn **Insight Points**. You can see your balance on your earnings page, and spend points in the **Flair shop** on a colour for your name, from Sage Green (200 points) up to Gold (2,000). Click **Equip** to wear one. The flair shop is on your account's earnings page at [/me/earnings](/me/earnings).

![The flair shop](flair.png) Spending Insight Points on flair.

## Reposts

**Repost** on a piece shares it to your profile with your own note. It creates a draft first, so you can add your commentary before publishing. If the author asked for credit on reposts, the original is credited automatically.

![Reposting a piece](repost-dialog.png) Reposting with a note.

## Ground rules

Disagreement is welcome; harassment isn't. Anything that breaks the rules can be reported with **Report** on a piece or comment. Moderators review every report.
`,
    },
    {
      slug: `earning`,
      title: `Earning on ${BRAND}`,
      summary: "Tips, memberships, sponsorships and payouts arrive with the paid launch. You can set up your tiers and payout details now.",
      tags: ["guide", "earning"],
      body: `
${BRAND} doesn't run ads. Writers earn directly from the people who read them. The tools for that are built, but **money starts moving with the paid launch**, not before. Until then you can set everything up, so your tiers and payout details are ready the day it switches on.
>teach Short version: you can't receive money yet, but you can get everything ready now so it works on the first day paid features launch.
>debate Setting up tiers before anyone can pay may feel premature. The upside is that nothing about your setup has to change at launch; the downside is that tier prices you set now are guesses until you see real readers.

?teach Which parts of earning can you set up today, and which wait for the paid launch?

Here's how each part will work. Amounts are in Indian rupees and payments go through Razorpay (UPI and cards).

## Tips

Every piece can show a **Tip the author** box, with suggested amounts and a custom amount. Turn tips on or off per piece with **Accept tips** in the composer's Meta dialog. Until paid launch, the box tells readers tipping is on its way and lets them join the waitlist.

![The tip box during launch](tip-jar.png) The tip box on a piece, during launch.

## Membership tiers

Tiers are recurring monthly memberships, like a subscription to your work. Create them under **Tiers** in the studio: a name, a monthly price, a description and a list of perks, one per line. Readers will subscribe from the **Memberships** tab on your profile.

Supporters get access to **gated** blocks: any paragraph you've marked **Supporters only** in the composer. You can also open debate rooms to members or to a single tier.

![Creating a tier](tiers.png) Setting up tiers. You can do this now.

## Sponsorships

Organizations can sponsor a piece through **Become a Sponsor** on it, if you've allowed public sponsorship in Meta. Sponsors are shown with a disclosure line such as "Supported by". You can also add sponsors yourself under **Meta → Sponsors**.

## Payouts

Your **Earnings** page shows what's available, your lifetime earnings and what's been paid out. Under **Payout methods**, add a UPI ID or bank account. A PAN is needed once, because 1% TDS is withheld on payouts as Indian tax law requires. Earnings clear for 7 days before they can be withdrawn, and the minimum payout is ₹400.

![The earnings page](earnings.png) Earnings and payout methods.

## What to do now

1. Create your tiers, so readers can see what supporting you will get them.
2. Decide which blocks are for supporters and tick **Supporters only** on them. Until paid launch, these blocks show readers a "Premium content" panel; hold off if you'd rather everyone read them in the meantime.
3. Add a payout method on the Earnings page.
4. Leave **Accept tips** on for the pieces you'd like tips on.

When paid features go live, we'll announce it here. There's a waitlist on the pricing page if you'd like to hear first.
`,
    },
    {
      slug: `accessibility`,
      title: `Accessibility on ${BRAND}`,
      summary: "Listening to pieces, dictation, reading modes, simple summaries and what writers can do to help.",
      tags: ["guide", "accessibility"],
      body: `
We want ${BRAND} to work for people who read with their ears, write with their voice, or need a piece explained more simply. Here's what's available today, and what writers can do to make their work easier to read.
>teach Accessibility here means more than screen readers: you can listen instead of read, speak instead of type, pick a shorter or simpler version of a piece, and ask for a plain summary.
>debate Built-in voices are free and private because they run on your device, but they vary a lot between browsers and systems. A hosted voice would sound the same everywhere, at the cost of sending text to a server.

?teach Which reading mode would you pick if long text is tiring, and what does it leave out?

## Listen to any piece

Click **Listen** on a piece to have it read aloud. The block being read is highlighted, so you can follow along. The small arrow next to Listen opens settings for the **voice** and the **speed**, from 0.5× to 4.5×. Click **Stop** to finish.

Listen uses the voices built into your device and browser, so the voices you get depend on what you have installed.

![Listen settings](listen-menu.png) Choosing a voice and speed.

## Simple explanations

**Explain simply**, at the top of **Teach** mode (or of the piece, when it has no Teach mode), asks AI for a short, plain-language explanation of the whole piece. It's useful for dense or technical writing, or for checking you've understood the main point.

## Reading modes

Reading modes help with more than time. **Skim** shows only the headline claims, which helps if long text is tiring. **Teach** keeps the explanations and scaffolding in. When a piece offers modes, the number keys switch between them in the order shown.

## Voice dictation for writers

The microphone button in the composer lets you write by speaking. Click it, speak, and your words become a new paragraph. It uses your browser's speech recognition, which works best in Chrome and Edge.

## Keyboard use

The site works with the keyboard: Tab moves between controls, and focus is always visible. The reader has number-key shortcuts for modes and Escape closes the image viewer. The composer has shortcuts for saving, publishing, formatting and inserting blocks; see [Keyboard shortcuts](/u/${HANDLE}/keyboard-shortcuts).

## What writers can do

- **Write alt text** for every image. The image block has a field for it. Describe what matters in the picture, not just what it is.
- **Add transcripts** to audio and video blocks.
- **Use headings** (H2 and H3) to break up long pieces. They become the table of contents and help screen-reader users jump around.
- **Make link text meaningful.** "Read the 2024 survey" is better than "click here".
- **Use a Teach or Skim variant** for dense sections, so readers can choose a simpler version.

If something on ${BRAND} doesn't work with the tools you use, please tell us through the [contact page](/contact). Accessibility bugs get priority.
`,
    },
    {
      slug: "privacy-and-security",
      title: "Privacy, data export and account security",
      summary: "Two-factor authentication, exporting everything you've written, mature-content settings, reporting, and deleting your account.",
      tags: ["guide", "privacy", "security"],
      body: `
Your writing is yours. This guide covers how to protect your account, how to take your work with you, and how to leave entirely. Everything here is in **Settings** in the studio.
>teach Three ideas run through this guide: lock your account (two-factor), keep a copy of your work (export), and know how to leave (deletion).
>debate Two-factor authentication is a trade-off: it makes a stolen password far less useful, but it ties sign-in to your authenticator app, so losing that device without a backup of the app can lock you out.

?teach What do you need, besides your password, to sign in once two-factor authentication is on?

## Two-factor authentication

Under **Two-factor authentication**, click **Enable 2FA**. Scan the QR code with an authenticator app (Google Authenticator, 1Password, Authy and others all work), or type in the secret shown below it. Then enter the six-digit code from the app and click **Verify & enable**. To turn it off, click **Disable 2FA**.

![Setting up two-factor authentication](two-factor.png) Two-factor authentication in Settings.

!note At the moment, 2FA is set up and stored on your account but sign-in doesn't yet ask for the code. We're finishing that step. In the meantime, use a strong password you don't use anywhere else.

## Export your data

Under **Data Export**, click **Download Full Export**. You'll get a zip file with all your data as JSON, and every piece as a Markdown file you can open anywhere or import into another platform.

Authors can also **Export CSV** to download a list of their subscribers.

![Exporting your data](data-export.png) Data export.

## Mature content

**Allow NSFW Content** in your profile settings decides whether pieces and blocks marked as mature are shown to you. It's off by default, and readers under 18 can't see such content whatever the setting.

## Reporting

If you see something that breaks the rules, click **Report** on the piece or comment. Pick a reason (spam, harassment, hate speech, violence, unflagged mature content, content sexualizing minors, medical misinformation, illegal content or other), add details if you like, and click **Submit Report**. Moderators review every report.

![Reporting a piece](report-dialog.png) The report dialog.

Copyright complaints go through our [copyright page](/dmca), which also explains how to file a counter-notice.

## Delete your account

Under **Danger zone**, click **Delete my account**. Type "delete my account" to confirm and click **Delete forever**. This permanently removes your pieces, bundles, tiers and login, and can't be undone. Download your export first if you want to keep anything.

![Deleting your account](danger-zone.png) The danger zone.

## What we don't do

We don't show ads and we don't sell your data. Optional cookies stay off unless you turn them on in the cookie banner. The full details are in the [privacy policy](/privacy).
`,
    },
    {
      slug: "importing-your-writing",
      title: "Importing your writing from Substack, Medium and Markdown",
      summary: "Bring an existing archive over as drafts: Substack and Medium exports, single articles by URL, and Markdown files.",
      tags: ["guide", "import"],
      body: `
If you already write somewhere else, you don't have to start from nothing. ${BRAND} can import your archive as drafts, which you can tidy up and publish when you're ready. Nothing is published automatically.
>teach Importing copies your old posts in as drafts. Nothing goes live until you open each one and press Publish yourself.
>debate Importing everything as drafts is the safe default, but it means a large archive needs a review pass before it's public. That's slower than a one-click republish, and deliberate: formatting rarely survives a move perfectly.

?teach After an import, what has been published?

Both import options are on the **Drafts** page in the studio.

## From Substack or Medium

Click **Import from Substack/Medium**.

![The import panel](import-substack.png) Importing an export or a single article.

**A whole archive.** First download your export:

- **Substack**: Settings → Exports.
- **Medium**: Settings → Download your information.

Upload the \`.zip\` file you get. Each post becomes a draft, up to 200 posts per import, and the file can be up to 25 MB. Headings, paragraphs, quotes, images and code come across as the matching block types.

**A single article.** Paste its address into the box under "or one article by URL" and click **Import**. This works for Substack posts and most ordinary web pages. For Medium, use the export, because Medium doesn't allow single articles to be fetched this way.

The original address is kept with the draft, so you can credit where it first appeared.

## From Markdown

Click **Import markdown**, then either choose a \`.md\` file or paste Markdown into the box, give it a title, and click **Import**. Headings (\`#\`), quotes (\`>\`) and fenced code blocks become their own blocks; everything else becomes paragraphs. Bold, italic, inline code and links keep their formatting, and a \`---\` line becomes a \`* * *\` scene break. Images in Markdown aren't imported; add them afterwards with \`/image\`.

![Importing Markdown](import-markdown.png) Importing a Markdown file.

## After importing

Open each draft and check it over. Imports get the basic structure right, but this is a good moment to:

- add alt text to images,
- turn key claims into Thesis or Evidence blocks,
- decide what each reading mode shows,
- add a summary and tags in **Meta**.

Then publish. Only import writing you own or have the rights to; imported pieces are subject to the same copyright rules as everything else.
`,
    },
    {
      slug: "keyboard-shortcuts",
      title: "Keyboard shortcuts",
      summary: "Every keyboard shortcut in the reader and the composer, on one page.",
      tags: ["guide", "reference"],
      body: `
A quick reference. On a Mac, use **Cmd** wherever it says **Ctrl**.
>teach Start with just two: on a piece with a mode switcher, number keys pick a reading mode, and / in the composer opens the block menu. Learn the rest when you need them.

?teach Which key opens the slash menu in the composer?

## Reading

- **1**, **2**, …: switch to the piece's reading modes, in the order the switcher shows them
- **Esc**: close the full-size image viewer
- **Tab** / **Shift+Tab**: move between links and buttons

## Composer: saving and publishing

- **Ctrl+S**: save now
- **Ctrl+Enter**: publish, or unpublish if the piece is live

## Composer: inserting

- **/**: open the block menu. Type to filter, **↑** **↓** to move, **Enter** to insert, **Esc** to close.
- **@**: mention a person
- **[[**: link to one of your own pieces
- In the mention and link menus, **Enter** or **Tab** picks the highlighted item.

## Composer: formatting

- **Ctrl+B**: bold
- **Ctrl+I**: italic
- **Ctrl+Shift+S**: strikethrough
- **Ctrl+E**: inline code
- **Ctrl+Shift+H**: highlight
- **Ctrl+Shift+7** / **Ctrl+Shift+8**: numbered / bulleted list
- **Ctrl+Z** / **Ctrl+Shift+Z**: undo / redo typing

## Composer: as-you-type

- \`- \` or \`* \` at the start of a line: bullet list
- \`1. \`: numbered list
- \`**text**\`: bold
- \`\`text\`\`: inline code

## Composer: elsewhere

- In the outline, **double-click** a block to rename it; **Enter** saves, **Esc** cancels.
- In the link and citation dialogs, **Enter** inserts.

The header's undo and redo arrows handle block changes (adding, moving, deleting, converting); they don't have keyboard shortcuts yet.
`,
    },
    {
      slug: "code-blocks",
      title: "Code blocks: running code, several files, web pages and SQL",
      summary: "How to write code blocks readers can run: multi-file programs in every language, live web pages, SQLite and PostgreSQL.",
      tags: ["guide", "composer", "code"],
      body: `
A code block can hold one file or several, and most languages get a **Run** button. The code runs in the reader's own browser, in a sandbox, so anyone can run it, with or without an account. Every example on this page is a real code block: press Run and try it.

## The basics

- Type **/code** to add a code block. Pick the language from the menu, or name the file with an extension (\`main.py\`, \`index.html\`) and the language follows.
- Click **+** to add a file tab. The **first tab** is the one that runs; the others are there to be imported or included.
- **Run** works for Python, JavaScript, TypeScript, SQL (SQLite), PostgreSQL, C, C++, Go, Java and Ruby. HTML and CSS get **Preview** instead.
- Signed-in readers can edit the code and run their version. Their changes stay in their browser and are never saved, so your piece always shows what you wrote. The reset button brings your version back.
- The first run of a language downloads it once (C++ is the biggest, about 14 MB). Blocks start that download as they scroll into view, so it's usually done by the time someone presses Run.

## Python

Other tabs are modules. A tab named \`helper.py\` is loaded with \`import helper\` or \`from helper import ...\`. numpy, pandas and other scientific packages work too.

\`\`\`python main.py
from helper import greet
print(greet("reader"))
\`\`\`
\`\`\`python helper.py
def greet(name):
    return "Hello, " + name
\`\`\`

## JavaScript and TypeScript

Import another tab by its name, with or without the extension: \`import { add } from "./math"\`. \`require("./math")\` works as well. Output from \`console.log\` appears under the block.

\`\`\`javascript main.js
import { add, square } from "./math"
console.log(add(2, 3), square(4))
\`\`\`
\`\`\`javascript math.js
export const add = (a, b) => a + b
export const square = (n) => n * n
\`\`\`

## Web pages (HTML, CSS and JavaScript)

Add an \`index.html\` tab, then \`style.css\` and \`script.js\` tabs, and press **Preview**. The CSS and JavaScript tabs are put into the page for you, so you don't need \`<link>\` or \`<script src>\` tags. Several JavaScript tabs are joined in order into one script. Anything the page logs with \`console.log\` shows under the preview.

\`\`\`html index.html
<h1>Hello</h1>
<button id="b">Clicked 0 times</button>
\`\`\`
\`\`\`css style.css
h1 { color: #e85d04; }
button { padding: 8px 14px; border-radius: 6px; }
\`\`\`
\`\`\`javascript script.js
let n = 0
document.getElementById("b").onclick = (e) => { e.target.textContent = "Clicked " + ++n + " times"; console.log("click", n) }
\`\`\`

## SQL (SQLite)

Choose **SQL (SQLite)** for standard SQL. You get the whole of SQLite: several tables, keys and constraints, joins, views, triggers, common table expressions (recursive ones too), window functions, JSON and date functions, and transactions.

Split a lesson into tabs such as \`schema.sql\`, \`seed.sql\` and \`queries.sql\`. They run top to bottom as one script, and every query that returns rows prints a table. Each run starts from an empty database, so readers can't break anything.

\`\`\`sql schema.sql
CREATE TABLE authors (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE posts (id INTEGER PRIMARY KEY, author_id INTEGER REFERENCES authors(id), title TEXT, views INTEGER);
CREATE VIEW popular AS SELECT * FROM posts WHERE views > 100;
\`\`\`
\`\`\`sql seed.sql
INSERT INTO authors (name) VALUES ('Ada'), ('Linus');
INSERT INTO posts (author_id, title, views) VALUES (1, 'Engines', 340), (1, 'Notes', 80), (2, 'Kernels', 510);
\`\`\`
\`\`\`sql queries.sql
SELECT a.name, p.title, p.views, RANK() OVER (ORDER BY p.views DESC) AS rank
FROM popular p JOIN authors a ON a.id = p.author_id;
\`\`\`

SQLite has no stored procedures and its own spelling for a few things (\`INTEGER PRIMARY KEY\` instead of \`SERIAL\`, for example). For those, use PostgreSQL.

## PostgreSQL

Choose **PostgreSQL** for real PostgreSQL 18, running in the browser: \`SERIAL\` and identity columns, enums, schemas, PL/pgSQL functions and \`DO\` blocks, \`RAISE NOTICE\`, \`generate_series\`, JSONB and the rest. Tabs run in order just like SQLite, queries print tables and notices print as \`NOTICE:\` lines. Each run starts from an empty database. The first run downloads about 5 MB.

\`\`\`postgres schema.sql
CREATE TYPE status AS ENUM ('draft', 'published');
CREATE TABLE pieces (id SERIAL PRIMARY KEY, title TEXT, state status DEFAULT 'draft');
CREATE FUNCTION publish(p INT) RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  UPDATE pieces SET state = 'published' WHERE id = p;
  RAISE NOTICE 'published piece %', p;
  RETURN 'ok';
END $$;
\`\`\`
\`\`\`postgres queries.sql
INSERT INTO pieces (title) VALUES ('First'), ('Second');
SELECT publish(2);
SELECT id, title, state FROM pieces ORDER BY id;
\`\`\`

## C and C++

The first tab has \`main()\`. Put declarations in a header tab and \`#include "math.h"\`; every \`.c\` or \`.cpp\` tab is compiled and linked together. C++ uses C++20 with the standard library.

\`\`\`cpp main.cpp
#include <iostream>
#include "math.h"
int main() { std::cout << "6 x 7 = " << multiply(6, 7) << std::endl; }
\`\`\`
\`\`\`cpp math.h
#pragma once
int multiply(int a, int b);
\`\`\`
\`\`\`cpp math.cpp
#include "math.h"
int multiply(int a, int b) { return a * b; }
\`\`\`

## Go, Java and Ruby

- **Go**: every tab is part of one \`package main\`, so a function in one tab can be called from another.
- **Java**: one public class per tab, with the tab named after the class (\`Main.java\`, \`Greeter.java\`). The class with \`main\` runs.
- **Ruby**: load another tab with \`require_relative "greeter"\` for a tab named \`greeter.rb\`.

## Limits worth knowing

- Programs get about 10 seconds and 64 KB of output.
- There's no keyboard input while a program runs, and no network access.
- Rust isn't supported for now.

!note Code blocks show an ⓘ button that opens this guide, in the composer and in published pieces.
`,
    },
  ]
}

// ── Account ─────────────────────────────────────────────────────────────────
async function ensureAccount(): Promise<string> {
  const { data: existing } = await db.from("profiles").select("id").eq("handle", HANDLE).maybeSingle()
  let id = existing?.id as string | undefined

  if (!id) {
    // No password: the account can't be signed into unless someone sends a reset/magic link.
    const { data, error } = await db.auth.admin.createUser({
      email: ACCOUNT_EMAIL,
      email_confirm: true,
      user_metadata: { handle: HANDLE, display_name: DISPLAY_NAME, role: "creator" },
    })
    if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
    id = data.user.id
    console.log(`Created account @${HANDLE}`)
  }

  const { error: pErr } = await db
    .from("profiles")
    .upsert({ id, handle: HANDLE, display_name: DISPLAY_NAME, bio: BIO, avatar_url: "/blog/nib-avatar.svg" })
  if (pErr) throw new Error(`profile upsert: ${pErr.message}`)
  await db.from("user_roles").upsert({ user_id: id, role: "creator" }, { onConflict: "user_id,role" })
  return id
}

// Mirrors ensureUserWorkspace in actions/content/helpers.ts, with a stable slug.
async function ensureWorkspace(userId: string): Promise<string> {
  const { data: wm } = await db.from("workspace_members").select("workspace_id").eq("user_id", userId).limit(1).maybeSingle()
  if (wm?.workspace_id) return wm.workspace_id
  const { data: ws, error } = await db
    .from("workspaces")
    .insert({ owner_id: userId, name: `${BRAND} Official`, slug: `ws-${HANDLE}-official` })
    .select("id")
    .single()
  if (error || !ws) throw new Error(`workspace: ${error?.message}`)
  const { error: mErr } = await db.from("workspace_members").insert({ workspace_id: ws.id, user_id: userId, role: "owner" })
  if (mErr) throw new Error(`workspace member: ${mErr.message}`)
  return ws.id
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const authorId = await ensureAccount()
  const workspaceId = await ensureWorkspace(authorId)
  const list = [...posts(), ...guidePosts()]

  // Stagger published_at so the feed shows the welcome post first.
  const base = Date.now()
  for (const [i, p] of list.entries()) {
    // Slug lookup is global (getPieceBySlug ignores the handle), so refuse to clash.
    const { data: clash } = await db.from("content_objects").select("id, author_id").eq("slug", p.slug)
    if (clash?.some((c) => c.author_id !== authorId)) {
      throw new Error(`Slug "${p.slug}" is already used by another author; rename it in posts().`)
    }
    const prev = clash?.[0]

    const row = {
      workspace_id: workspaceId,
      author_id: authorId,
      title: p.title,
      slug: p.slug,
      summary: p.summary,
      tags: p.tags,
      status: "published",
      visibility: "public",
      tips_enabled: false,
      sponsorship_enabled: false,
      allow_inline_comments: true,
    }
    let pieceId: string
    if (prev) {
      // Keep the original published_at so re-runs don't bump posts to the top.
      const { error } = await db.from("content_objects").update(row).eq("id", prev.id)
      if (error) throw new Error(`update ${p.slug}: ${error.message}`)
      pieceId = prev.id
    } else {
      const { data, error } = await db
        .from("content_objects")
        .insert({ ...row, published_at: new Date(base - i * 60_000).toISOString() })
        .select("id")
        .single()
      if (error || !data) throw new Error(`insert ${p.slug}: ${error?.message}`)
      pieceId = data.id
    }

    const blocks = toBlocks(p.slug, p.body).map((b, order) => ({
      content_object_id: pieceId,
      order,
      ...b,
      mode_visibility: b.mode_visibility ?? MODES,
      monetization_eligible: false,
      is_nsfw: false,
    }))
    // Replace blocks wholesale; drop any composer CRDT snapshot so it can't resurrect old text.
    await db.from("piece_crdt").delete().eq("piece_id", pieceId)
    const { error: dErr } = await db.from("blocks").delete().eq("content_object_id", pieceId)
    if (dErr) throw new Error(`clear blocks ${p.slug}: ${dErr.message}`)
    const { error: bErr } = await db.from("blocks").insert(blocks)
    if (bErr) throw new Error(`blocks ${p.slug}: ${bErr.message}`)

    const words = blocks.reduce((n, b) => n + String(b.content.text ?? "").split(/\s+/).filter(Boolean).length, 0)
    const images = blocks.filter((b) => b.type === "image").length
    console.log(`✓ /u/${HANDLE}/${p.slug}  "${p.title}"  ${blocks.length} blocks, ${images} images, ~${words} words`)
  }

  // Role reading lists. Matched by title; items are replaced in order, one insert
  // at a time, because a collection reads back ordered by created_at.
  for (const c of roleCollections) {
    const { data: found } = await db.from("collections").select("id").eq("curator_id", authorId).eq("title", c.title).maybeSingle()
    let colId = found?.id as string | undefined
    if (colId) {
      await db.from("collections").update({ description: c.description, is_public: true }).eq("id", colId)
    } else {
      const { data, error } = await db.from("collections").insert({ curator_id: authorId, title: c.title, description: c.description, is_public: true }).select("id").single()
      if (error || !data) throw new Error(`collection ${c.title}: ${error?.message}`)
      colId = data.id as string
    }
    await db.from("collection_items").delete().eq("collection_id", colId)
    for (const slug of c.slugs) {
      const { data: piece } = await db.from("content_objects").select("id").eq("author_id", authorId).eq("slug", slug).single()
      if (!piece) throw new Error(`collection ${c.title}: no post "${slug}"`)
      const { error } = await db.from("collection_items").insert({ collection_id: colId, content_object_id: piece.id })
      if (error) throw new Error(`collection ${c.title} item ${slug}: ${error.message}`)
      await new Promise((r) => setTimeout(r, 5)) // distinct created_at per item
    }
    console.log(`✓ collection "${c.title}"  ${c.slugs.length} posts`)
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
