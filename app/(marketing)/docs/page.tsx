 
"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Package, Sparkles, Check, ArrowRight, Search, X } from "lucide-react"
import Link from "next/link"
import {
  SECTIONS,
  CONCEPTS,
  BUNDLE_TYPES,
  PRIVACY_POINTS,
  FAQ_ITEMS,
  SLASH_BLOCKS,
  MARKDOWN_SHORTCUTS,
  KEYBOARD_SHORTCUTS,
  INLINE_TRIGGERS,
  BLOCK_NOTES,
  COMPOSER_TOOLS,
  IMPORT_EXPORT,
} from "@/lib/content/docs/data"
import { SectionHeader } from "./components/section-header"
import { ModeDemo } from "./components/mode-demo"
import { BlockBuilderDemo } from "./components/block-builder-demo"
import { GatedDemo } from "./components/gated-demo"
import { TipJarDemo } from "./components/tip-jar-demo"
import { DebateDemo } from "./components/debate-demo"
import { ByokDemo } from "./components/byok-demo"

// =================== CONTENT ===================

export default function DocsPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Nib docs — concepts, composer, modes, branches, bundles",
    description:
      "Everything about Nib with live interactive demos and worked examples.",
    author: { "@type": "Organization", name: "Nib" },
    publisher: { "@type": "Organization", name: "Nib" },
  }

  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()

  const filtered = useMemo(() => {
    if (!q) return SECTIONS
    return SECTIONS.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.keywords.includes(q) ||
        s.keywords.split(/\s+/).some((k) => k.startsWith(q))
    )
  }, [q])

  const visible = new Set(filtered.map((s) => s.id))
  const show = (id: string) => !q || visible.has(id)

  // Highlight the section nearest the top of the viewport in the sidebar.
  const [active, setActive] = useState("intro")
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (hit) setActive(hit.target.id)
      },
      { rootMargin: "-80px 0px -70% 0px" }
    )
    document.querySelectorAll("article > section[id]").forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [query])
  // On phones the list is one sideways row; keep the current chip visible.
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>('nav[aria-label="Documentation sections"]')
    const chip = nav?.querySelector<HTMLElement>('[aria-current="location"]')
    if (nav && chip && nav.scrollWidth > nav.clientWidth)
      nav.scrollTo({ left: chip.offsetLeft - 20, behavior: "smooth" })
  }, [active])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="flex-1">
        <section className="container-wide max-w-4xl pt-16 md:pt-24 pb-10">
          <h1 className="font-display text-4xl leading-[1.05] sm:text-5xl md:text-6xl">
            Documentation
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            How Nib works, with a demo you can try in most sections.
          </p>

          <div className="relative mt-8 max-w-xl">
            <Search
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <label htmlFor="docs-search" className="sr-only">
              Search docs
            </label>
            <Input
              id="docs-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sections, concepts, demos…"
              className="h-11 pr-9 pl-9"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              >
                <X className="size-3.5" />
              </button>
            )}
            {q && (
              <p
                className="mt-2 text-xs text-muted-foreground"
                aria-live="polite"
              >
                {filtered.length}{" "}
                {filtered.length === 1 ? "section" : "sections"} match &quot;
                {query}
                &quot;.
              </p>
            )}
          </div>
        </section>

        <div className="container-wide grid gap-10 pb-24 md:grid-cols-12">
          {/* TOC */}
          <aside className="sticky top-16 z-10 -mx-5 bg-background/95 px-5 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0 md:backdrop-blur-none md:col-span-3 min-w-0">
            <div className="md:sticky md:top-20">
              <p className="mb-3 hidden text-sm font-medium text-foreground md:block">
                On this page
              </p>
              <nav aria-label="Documentation sections" className="no-scrollbar flex gap-1 overflow-x-auto py-2 md:block md:space-y-1 md:overflow-visible md:py-0">
                {(q ? filtered : SECTIONS).map((s) => {
                  const Icon = s.icon
                  return (
                    <Link
                      key={s.id}
                      href={`#${s.id}`}
                      aria-current={active === s.id ? "location" : undefined}
                      className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md md:whitespace-normal px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground aria-[current=location]:bg-accent aria-[current=location]:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <Icon className="size-3.5" aria-hidden />
                      {s.label}
                    </Link>
                  )
                })}
                {q && filtered.length === 0 && (
                  <p className="px-2 py-1.5 text-sm text-muted-foreground italic">
                    No matches.
                  </p>
                )}
              </nav>
            </div>
          </aside>

          {/* CONTENT */}
          <article className="prose-invert max-w-none min-w-0 space-y-20 md:col-span-9 docs-measure">
            {show("intro") && (
              <section id="intro" className="scroll-mt-20">
                <SectionHeader id="intro" title="Introduction" />
                <p className="mt-4 text-lg leading-relaxed text-foreground/85">
                  Nib is a publishing platform for ideas with structure.
                  Instead of a flat page, each piece you publish is a typed
                  object made of blocks. Each block declares what it is
                  (paragraph, thesis, evidence, citation, gated), which reading
                  modes it appears in, and whether it&apos;s monetizable.
                </p>
                <p className="mt-4 leading-relaxed text-muted-foreground">
                  If you&apos;re used to a markdown editor and a
                  &quot;publish&quot; button, that workflow still exists — drop
                  in paragraphs, hit publish. Nib layers structure on top,
                  opt-in per block.
                </p>
                <p className="mt-4 leading-relaxed text-muted-foreground">
                  The quickstart below takes about five minutes. There are{" "}
                  {SLASH_BLOCKS.length} block types and five reading modes.
                </p>
              </section>
            )}

            {show("concepts") && (
              <section id="concepts" className="scroll-mt-20">
                <SectionHeader
                  id="concepts"
                  title="Concepts"
                />
                <p className="mt-4 leading-relaxed text-foreground/85">
                  Four nouns. Everything else is a property.
                </p>
                <ul className="mt-6 space-y-4">
                  {CONCEPTS.map((x) => (
                    <li
                      key={x.k}
                      className="hairline-t last:hairline-b grid gap-1 py-4 sm:grid-cols-12 sm:gap-4"
                    >
                      <p className="sm:col-span-3 font-display text-xl">{x.k}</p>
                      <p className="sm:col-span-9 leading-relaxed text-muted-foreground">
                        {x.v}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {show("composer") && (
              <section id="composer" className="scroll-mt-20">
                <SectionHeader
                  id="composer"
                  title="Composer"
                />
                <p className="mt-4 mb-6 leading-relaxed text-muted-foreground">
                  Pick a block type, write its content, and toggle which reading
                  modes it appears in. The preview is live.
                </p>
                <BlockBuilderDemo />
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <div className="surface rounded-lg border border-border/60 p-4 text-sm">
                    <p className="mb-1 font-mono text-xs text-primary">
                      Shortcut
                    </p>
                    <p>
                      <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        /
                      </kbd>{" "}
                      opens the slash menu — every block type is one keystroke
                      away.
                    </p>
                  </div>
                  <div className="surface rounded-lg border border-border/60 p-4 text-sm">
                    <p className="mb-1 font-mono text-xs text-primary">
                      Shortcut
                    </p>
                    <p>
                      <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        [[
                      </kbd>{" "}
                      links to one of your pieces.{" "}
                      <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        @
                      </kbd>{" "}
                      mentions a person. Select text for the citation button.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {show("reference") && (
              <section id="reference" className="scroll-mt-20">
                <SectionHeader
                  id="reference"
                  title="Editor reference"
                />
                <p className="mt-4 mb-6 leading-relaxed text-muted-foreground">
                  Everything below works in any text block of the composer
                  (paragraph, quote, callout, question, and the
                  thesis/evidence/counter/footnote/gated kinds).
                </p>

                <h3 className="mb-3 font-display text-2xl">Slash commands</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {SLASH_BLOCKS.map((b) => (
                    <div
                      key={b.cmd}
                      className="surface flex items-start gap-3 rounded-lg border border-border/60 p-3 text-sm"
                    >
                      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded bg-muted text-xs">
                        {b.icon}
                      </span>
                      <div className="min-w-0">
                        <p>
                          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                            {b.cmd}
                          </kbd>{" "}
                          {b.label}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {b.hint}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <h3 className="mt-10 mb-3 font-display text-2xl">
                  Typing triggers
                </h3>
                <ul className="space-y-0">
                  {INLINE_TRIGGERS.map((x) => (
                    <li
                      key={x.k}
                      className="hairline-t last:hairline-b grid gap-1 py-3 sm:grid-cols-12 sm:gap-4"
                    >
                      <p className="col-span-3">
                        <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                          {x.k}
                        </kbd>
                      </p>
                      <p className="sm:col-span-9 text-sm leading-relaxed text-muted-foreground">
                        {x.v}
                      </p>
                    </li>
                  ))}
                </ul>

                <div className="mt-10 grid gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="mb-3 font-display text-2xl">
                      Markdown shortcuts
                    </h3>
                    <dl className="surface divide-y divide-border/60 rounded-lg border border-border/60 text-sm">
                      {MARKDOWN_SHORTCUTS.map((x) => (
                        <div
                          key={x.type}
                          className="flex items-center justify-between gap-3 px-4 py-2"
                        >
                          <dt className="font-mono text-xs">{x.type}</dt>
                          <dd className="text-muted-foreground">{x.result}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-2 text-xs text-muted-foreground">
                      # (H1) and &gt; don&apos;t convert — use the Heading and
                      Quote blocks.
                    </p>
                  </div>
                  <div>
                    <h3 className="mb-3 font-display text-2xl">
                      Keyboard shortcuts
                    </h3>
                    <dl className="surface divide-y divide-border/60 rounded-lg border border-border/60 text-sm">
                      {KEYBOARD_SHORTCUTS.map((x) => (
                        <div
                          key={x.keys}
                          className="flex items-center justify-between gap-3 px-4 py-2"
                        >
                          <dt className="font-mono text-xs">{x.keys}</dt>
                          <dd className="text-right text-muted-foreground">
                            {x.does}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>

                <h3 className="mt-10 mb-3 font-display text-2xl">
                  Block details
                </h3>
                <ul>
                  {BLOCK_NOTES.map((x) => (
                    <li
                      key={x.k}
                      className="hairline-t last:hairline-b grid gap-1 py-3 sm:grid-cols-12 sm:gap-4"
                    >
                      <p className="sm:col-span-3 font-display text-lg">{x.k}</p>
                      <p className="sm:col-span-9 text-sm leading-relaxed text-muted-foreground">
                        {x.v}
                      </p>
                    </li>
                  ))}
                </ul>

                <h3 className="mt-10 mb-3 font-display text-2xl">
                  Composer toolbar
                </h3>
                <ul>
                  {COMPOSER_TOOLS.map((x) => (
                    <li
                      key={x.k}
                      className="hairline-t last:hairline-b grid gap-1 py-3 sm:grid-cols-12 sm:gap-4"
                    >
                      <p className="sm:col-span-3 font-display text-lg">{x.k}</p>
                      <p className="sm:col-span-9 text-sm leading-relaxed text-muted-foreground">
                        {x.v}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {show("modes") && (
              <section id="modes" className="scroll-mt-20">
                <SectionHeader
                  id="modes"
                  title="Reading modes"
                />
                <p className="mt-4 mb-6 leading-relaxed text-muted-foreground">
                  Below is an example piece with 7 blocks. Switch modes and
                  watch the visible blocks change. Turn on &quot;show
                  hidden&quot; to see what&apos;s filtered out. On a live
                  piece, readers switch with the mode control or a link like
                  /u/&lt;handle&gt;/&lt;slug&gt;?mode=skim. New blocks show in
                  every mode until you untick one under Inspector → Mode
                  visibility (the dots on each block show the current set).
                </p>
                <ModeDemo />
              </section>
            )}

            {show("branches") && (
              <section id="branches" className="scroll-mt-20">
                <SectionHeader
                  id="branches"
                  title="Branches"
                />
                <p className="mt-4 leading-relaxed text-foreground/85">
                  A branch is a labelled companion to a piece. Create one in
                  Studio → Branches: pick the parent piece, a type (audio,
                  teaching, premium, debate, or localized), a purpose, a
                  summary, and who can see it (public, member, or private).
                  Readers find branches in the piece&apos;s sidebar, so the
                  canonical piece stays clean.
                </p>
                <div className="surface mt-6 rounded-xl border border-border/60 p-6 font-mono text-sm">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="size-3 text-primary" aria-hidden />{" "}
                    piece: &quot;Why publishing is broken&quot;
                  </div>
                  <div className="mt-2 ml-5 space-y-1 text-muted-foreground">
                    <div>├─ audio · &quot;Narrated by the author&quot; · public</div>
                    <div>├─ teaching · &quot;For beginners&quot; · public</div>
                    <div>├─ premium · &quot;The full dataset&quot; · member</div>
                    <div>├─ debate · &quot;A defense of the article&quot; · public</div>
                    <div>└─ localized · &quot;हिंदी&quot; · public</div>
                  </div>
                </div>
              </section>
            )}

            {show("bundles") && (
              <section id="bundles" className="scroll-mt-20">
                <SectionHeader
                  id="bundles"
                  title="Bundles"
                />
                <p className="mt-4 mb-6 leading-relaxed text-foreground/85">
                  Bundles package your pieces around an outcome — a course, a
                  reference set, a starter kit — with a price you set (or ₹0).
                  You can build and price bundles today; reader checkout for
                  bundles is still on the way. Collections are free public
                  reading lists you can share now.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {BUNDLE_TYPES.map((x) => (
                    <div
                      key={x.t}
                      className="surface rounded-lg border border-border/60 p-5"
                    >
                      <Package
                        className="mb-3 size-5 text-primary"
                        aria-hidden
                      />
                      <p className="font-display text-lg">{x.t}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {x.s}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {show("debates") && (
              <section id="debates" className="scroll-mt-20">
                <SectionHeader
                  id="debates"
                  title="Debates"
                />
                <p className="mt-4 mb-6 leading-relaxed text-muted-foreground">
                  Open a debate room on any of your pieces from Studio →
                  Debates. Give it a title and an opening prompt, and choose
                  who can join: everyone (sign-in to post), people you invite,
                  your organization, or members of a specific tier. Try adding
                  a response below.
                </p>
                <DebateDemo />
              </section>
            )}

            {show("ai") && (
              <section id="ai" className="scroll-mt-20">
                <SectionHeader
                  id="ai"
                  title="AI & BYOK"
                />
                <p className="mt-4 leading-relaxed text-foreground/85">
                  Click a block, then use the wand icon on it (or Inspector →
                  AI variants) and pick a reading mode: Skim condenses, Expert
                  deepens, Teach adds an analogy and a check-question, Debate
                  steel-mans the counter-argument. The rewrite opens as a diff
                  against your text — Apply replaces the block, Discard drops
                  it. Nothing changes until you choose.
                </p>
                <p className="mt-4 leading-relaxed text-muted-foreground">
                  AI also drafts your summary, thesis, and tags (Meta → AI),
                  scores block themes and suggests links in the Synthesis tab,
                  and proposes pieces for a bundle from a topic.
                </p>
                <div className="surface mt-6 rounded-xl border border-border/60 p-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="mb-2 text-sm font-medium text-muted-foreground">
                        Original (Standard)
                      </p>
                      <p className="text-sm leading-relaxed text-foreground/90">
                        For two centuries, publishing meant pouring an idea into
                        a fixed shape. The internet multiplied the shapes but
                        kept the model intact.
                      </p>
                    </div>
                    <div>
                      <p className="mb-2 flex items-center gap-1 text-sm font-medium text-primary">
                        <Sparkles className="size-3" aria-hidden /> AI variant
                        (Skim)
                      </p>
                      <p className="text-sm leading-relaxed text-foreground/90">
                        Publishing has been static for 200 years. The internet
                        didn&apos;t change the model.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            toast.success("Variant applied (demo)")
                          }
                        >
                          <Check className="mr-1 size-3" /> Apply
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toast("Regenerating… (demo)")}
                        >
                          Regenerate
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toast("Variant discarded (demo)")}
                        >
                          Discard
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <h3 className="mb-4 font-display text-2xl">
                    Bring Your Own Key (BYOK)
                  </h3>
                  <p className="mb-6 leading-relaxed text-foreground/85">
                    Every account gets a daily AI allowance. To go past it, add
                    your own key in Studio → Settings → AI Provider (BYOK):
                    Mistral, OpenAI, Anthropic, Google Gemini, OpenRouter, or
                    NVIDIA NIM, with an optional model name. Requests then run
                    on your key with no Nib daily limit, and you pay the
                    provider directly.
                  </p>
                  <ByokDemo />
                </div>
              </section>
            )}

            {show("monetization") && (
              <section id="monetization" className="scroll-mt-20">
                <SectionHeader
                  id="monetization"
                  title="Monetization"
                />
                <p className="mt-4 mb-6 leading-relaxed text-foreground/85">
                  Gated blocks for premium-within-a-free-piece: mark a block
                  &quot;Supporters only&quot; in the Inspector (or insert
                  /gated) and only your members see it — everyone else gets a
                  locked placeholder, and the text never reaches their
                  browser. Membership tiers (Studio → Tiers) for recurring
                  support. Tips and sponsors, switched on per piece in Meta.
                  During launch, every creator can use all of these for free.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-medium text-muted-foreground">
                      Gated block demo
                    </p>
                    <GatedDemo />
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-muted-foreground">
                      Tip jar demo
                    </p>
                    <TipJarDemo />
                  </div>
                </div>
                <p className="mt-6 text-sm text-muted-foreground">
                  Readers pay through Razorpay in INR. The money lands in your
                  earnings balance (Studio → Earnings), and you withdraw to
                  your saved payout method once it reaches ₹400. See{" "}
                  <Link
                    href="/pricing"
                    className="text-primary underline underline-offset-4"
                  >
                    pricing
                  </Link>{" "}
                  for fees.
                </p>
              </section>
            )}

            {show("import") && (
              <section id="import" className="scroll-mt-20">
                <SectionHeader
                  id="import"
                  title="Import, export & feeds"
                />
                <ul className="mt-6">
                  {IMPORT_EXPORT.map((x) => (
                    <li
                      key={x.k}
                      className="hairline-t last:hairline-b grid gap-1 py-3 sm:grid-cols-12 sm:gap-4"
                    >
                      <p className="sm:col-span-3 font-mono text-sm">{x.k}</p>
                      <p className="sm:col-span-9 text-sm leading-relaxed text-muted-foreground">
                        {x.v}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {show("privacy") && (
              <section id="privacy" className="scroll-mt-20">
                <SectionHeader
                  id="privacy"
                  title="Privacy & sovereignty"
                />
                <ul className="mt-6 space-y-3">
                  {PRIVACY_POINTS.map((x) => (
                    <li key={x} className="flex items-start gap-3">
                      <Check
                        className="mt-1 size-4 shrink-0 text-primary"
                        aria-hidden
                      />
                      <span className="text-foreground/90">{x}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {show("faq") && (
              <section id="faq" className="scroll-mt-20">
                <SectionHeader
                  id="faq"
                  title="FAQ"
                />
                <dl className="mt-6 space-y-px">
                  {FAQ_ITEMS.map((f) => (
                    <div key={f.q} className="hairline-t last:hairline-b py-5">
                      <dt className="mb-2 font-display text-xl">{f.q}</dt>
                      <dd className="leading-relaxed text-muted-foreground">
                        {f.a}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {q && filtered.length === 0 && (
              <div className="surface rounded-xl border border-border/60 p-10 text-center">
                <p className="mb-2 font-display text-2xl">
                  No matches for &quot;{query}&quot;.
                </p>
                <p className="mb-4 text-sm text-muted-foreground">
                  Try a different keyword, or clear the search.
                </p>
                <Button variant="outline" onClick={() => setQuery("")}>
                  Clear search
                </Button>
              </div>
            )}

            {!q && (
              <section className="hairline-t pt-12">
                <h2 className="mb-4 font-display text-3xl">Ready to try it?</h2>
                <div className="flex flex-wrap gap-3">
                  <Button asChild size="lg">
                    <Link href="/signup">Open your studio</Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link href="/product">See the product</Link>
                  </Button>
                </div>
              </section>
            )}
          </article>
        </div>
      </main>
    </div>
  )
}
