"use client"

import { useRef, useState, type KeyboardEvent } from "react"
import Link from "next/link"
import type { Block } from "@/components/block-renderer"
import { ParagraphBlock, QuestionBlock } from "@/components/reader/text-blocks"
import { EXCERPT } from "@/lib/content/landing/data"

const MODES = ["skim", "standard", "expert", "teach", "debate"] as const
type Mode = (typeof MODES)[number]
const LABEL: Record<Mode, string> = {
  skim: "Skim",
  standard: "Standard",
  expert: "Expert",
  teach: "Teach",
  debate: "Debate",
}
const html = (h: string, extra: Partial<Block> = {}): Block => ({
  type: "paragraph",
  content: { html: h },
  ...extra,
})
const p = (text: string, extra: Partial<Block> = {}): Block => ({
  type: "paragraph",
  content: { text },
  ...extra,
})

// Passage from the seeded welcome post, rendered with the reader's own block components.
function Body({ mode }: { mode: Mode }) {
  if (mode === "skim")
    return (
      <>
        <ParagraphBlock
          block={p(EXCERPT.thesis, { semantic_role: "thesis" })}
        />
        <ParagraphBlock
          block={html(
            `<ul>${EXCERPT.skim.map((t) => `<li>${t}</li>`).join("")}</ul>`
          )}
        />
      </>
    )
  if (mode === "expert")
    return (
      <>
        <ParagraphBlock block={html(EXCERPT.expertHtml)} />
        {EXCERPT.notes.map((n, i) => (
          <ParagraphBlock
            key={n.href}
            block={html(`[${i + 1}] <a href="${n.href}">${n.title}</a>`, {
              semantic_role: "footnote",
            })}
          />
        ))}
      </>
    )
  if (mode === "debate")
    return (
      <>
        <ParagraphBlock block={p(EXCERPT.thesis, { semantic_role: "thesis" })} />
        <ParagraphBlock block={p(EXCERPT.counter, { semantic_role: "counter" })} />
      </>
    )
  if (mode === "teach")
    return (
      <>
        {EXCERPT.paragraphs.map((t) => (
          <ParagraphBlock key={t} block={p(t)} />
        ))}
        {/* Sentence-case label here so the hero keeps a single eyebrow. */}
        <QuestionBlock
          block={{ type: "question", content: { text: EXCERPT.question } }}
          labelClassName="font-medium"
        />
      </>
    )
  return (
    <>
      {EXCERPT.paragraphs.map((t) => (
        <ParagraphBlock key={t} block={p(t)} />
      ))}
    </>
  )
}

export function HomeReaderPane() {
  const [mode, setMode] = useState<Mode>("standard")
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const onKey = (e: KeyboardEvent) => {
    const i = MODES.indexOf(mode)
    const next = {
      ArrowRight: i + 1,
      ArrowLeft: i - 1,
      Home: 0,
      End: MODES.length - 1,
    }[e.key]
    if (next === undefined) return
    e.preventDefault()
    const n = (next + MODES.length) % MODES.length
    setMode(MODES[n])
    tabs.current[n]?.focus()
  }
  return (
    <article
      data-testid="home-excerpt"
      className="surface min-w-0 rounded-lg border border-border/60 p-4 sm:p-5 md:p-8"
    >
      <div
        role="tablist"
        aria-label="Reading mode"
        onKeyDown={onKey}
        className="mb-6 inline-flex max-w-full gap-0.5 overflow-x-auto rounded-md border border-border/60 p-1 [scrollbar-width:none]"
      >
        {MODES.map((m, i) => (
          <button
            key={m}
            ref={(el) => {
              tabs.current[i] = el
            }}
            role="tab"
            id={`hero-tab-${m}`}
            aria-selected={mode === m}
            aria-controls="hero-panel"
            tabIndex={mode === m ? 0 : -1}
            onClick={() => setMode(m)}
            className={`shrink-0 rounded px-1.5 py-1.5 text-[13px] sm:px-3 sm:text-sm ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {LABEL[m]}
          </button>
        ))}
      </div>
      <h2 className="mb-5 font-display text-2xl leading-tight text-foreground md:text-3xl">
        <Link
          href={EXCERPT.href}
          className="underline-offset-4 hover:underline"
        >
          {EXCERPT.title}
        </Link>
      </h2>
      <div
        role="tabpanel"
        id="hero-panel"
        aria-labelledby={`hero-tab-${mode}`}
        data-mode={mode}
        key={mode}
        className="animate-in fade-in duration-300 motion-reduce:animate-none"
      >
        <Body mode={mode} />
      </div>
      <Link
        href={EXCERPT.href}
        className="mt-2 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Read the full piece →
      </Link>
    </article>
  )
}
