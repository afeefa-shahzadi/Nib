/* eslint-disable @typescript-eslint/no-explicit-any */
import { ReactNode, createContext, useContext } from "react"
import { markText } from "@/lib/mark-text"
import { Lock } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import DOMPurify from "isomorphic-dompurify"
import { isVisibleInMode, resolveBlockForMode } from "@/lib/reader-variants"
import {
  HeadingBlock,
  ParagraphBlock,
  QuoteBlock,
  CitationBlock,
  CodeBlock,
  CalloutBlock,
  QuestionBlock,
  ImageBlock,
  ChartBlock,
  ExerciseBlock,
  AudioNoteBlock,
  EmbedBlock,
  MermaidBlock,
  FlowchartBlock,
} from "./reader/block-views"

export type Block = {
  id?: string
  type:
    | "paragraph"
    | "heading"
    | "citation"
    | "code"
    | "callout"
    | "question"
    | "quote"
    | "image"
    | "chart"
    | "mermaid"
    | "flowchart"
    | "exercise"
    | "audio_note"
    | "embed"
  content: Record<string, unknown>
  mode_visibility?: Record<string, boolean>
  monetization_eligible?: boolean
  semantic_role?: string | null
  position?: number
  is_nsfw?: boolean | null
  sources?: { title: string; url: string }[] | null
}

export type ReadingMode = "skim" | "standard" | "expert" | "teach" | "debate"

// ---------- helpers ----------
export function getText(c: Record<string, unknown>): string {
  return typeof c.text === "string" ? c.text : ""
}
export function getHtml(c: Record<string, unknown>): string | null {
  const h = c.html
  return typeof h === "string" && h.trim() ? h : null
}
export function getStr(c: Record<string, unknown>, k: string): string | null {
  const v = c[k]
  return typeof v === "string" && v.trim() ? v : null
}

// Robust HTML sanitizer using DOMPurify (battle-tested against XSS bypasses).
export function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "iframe", "form", "object", "embed", "link", "meta"],
    FORBID_ATTR: ["style", "srcdoc", "formaction"],
    ADD_ATTR: ["data-comment-id", "data-highlight-id", "class", "target"],
  })
}

// Only allow http(s)/mailto hrefs from user/DB content. React renders `javascript:`
// (and `data:`) hrefs as-is, so an attacker-supplied URL would execute on click.
export function safeUrl(u: string | null | undefined): string | undefined {
  if (!u) return undefined
  try {
    const scheme = new URL(u, "https://x.invalid").protocol
    return scheme === "http:" || scheme === "https:" || scheme === "mailto:" ? u : undefined
  } catch {
    return undefined
  }
}

/** Slugify a string for stable in-page anchors. */
export function slugifyId(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "section"
  )
}

const escapeHtml = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

export const HighlightsContext = createContext<any[]>([])
export const InlineCommentsContext = createContext<any[]>([])

export function RichOrText({
  content,
  className,
  as: As = "p",
}: {
  content: Record<string, unknown>
  className?: string
  as?: "p" | "div" | "span"
}) {
  let html = getHtml(content)
  let text = getText(content)
  const highlights = useContext(HighlightsContext)
  const inlineComments = useContext(InlineCommentsContext)

  // Paint saved highlights and inline comments. Selections are plain text but
  // the HTML can split them with tags, entities or line breaks; markText copes.
  const paint = (src: string) => {
    let out = src
    for (const hl of highlights ?? []) {
      if (!hl.text_content) continue
      const cls = hl.annotations?.length ? "bg-success/25 border-b-2 border-success" : "bg-note/25"
      out = markText(out, hl.text_content, (t) => `<mark class="${cls} text-foreground rounded-sm px-0.5 highlight-marker" data-highlight-id="${hl.id}">${t}</mark>`)
    }
    for (const c of inlineComments ?? []) {
      if (!c.quoted_text) continue
      out = markText(out, c.quoted_text, (t) => `<span class="inline-comment-marker bg-info/25 border-b-2 border-info cursor-pointer text-foreground" data-comment-id="${c.id}">${t}</span>`)
    }
    return out
  }
  const painting = !!(highlights?.length || inlineComments?.length)
  if (painting) {
    if (html) html = paint(html)
    else if (text) text = paint(escapeHtml(text))
  }

  if (html)
    return (
      <As
        className={className}
        dangerouslySetInnerHTML={{ __html: sanitize(html) }}
      />
    )
  if (text && painting) {
    return (
      <As
        className={className}
        dangerouslySetInnerHTML={{ __html: sanitize(text) }}
      />
    )
  }
  return <As className={className}>{text}</As>
}

// ---------- block view ----------
export function BlockView({ block, isPreview }: { block: Block; isPreview?: boolean }): ReactNode {
  switch (block.type) {
    case "heading":
      return <HeadingBlock block={block} />
    case "paragraph":
      return <ParagraphBlock block={block} />
    case "quote":
      return <QuoteBlock block={block} />
    case "citation":
      return <CitationBlock block={block} />
    case "code":
      return <CodeBlock block={block} isPreview={isPreview} />
    case "callout":
      return <CalloutBlock block={block} />
    case "question":
      return <QuestionBlock block={block} />
    case "image":
      return <ImageBlock block={block} />
    case "chart":
      return <ChartBlock block={block} />
    case "mermaid":
      return <MermaidBlock block={block} />
    case "flowchart":
      return <FlowchartBlock block={block} />
    case "exercise":
      return <ExerciseBlock block={block} />
    case "audio_note":
      return <AudioNoteBlock block={block} />
    case "embed":
      return <EmbedBlock block={block} />
    default:
      return null
  }
}

// ---------- body ----------
export function ReaderBody({
  blocks,
  mode,
  hasAccess = true,
  is_adult = false,
  has_dob = false,
  highlights,
  inlineComments,
  onUnlock,
}: {
  blocks: Block[]
  mode: ReadingMode
  hasAccess?: boolean
  is_adult?: boolean
  has_dob?: boolean
  highlights?: any[]
  inlineComments?: any[]
  onUnlock?: () => void
}) {
  const visible = blocks.filter((b) => isVisibleInMode(b, mode))
  return (
    <HighlightsContext.Provider value={highlights || []}>
      <InlineCommentsContext.Provider value={inlineComments || []}>
        <div>
          {visible.map((b, i) => {
        const isPremiumBlocked = b.monetization_eligible && !hasAccess
        const isNsfwBlocked = b.is_nsfw && !is_adult

        return (
          <div key={b.id ?? i} id={b.id ? `block-${b.id}` : undefined} className="relative">
            {isNsfwBlocked && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-md bg-background/80 backdrop-blur-xl">
                <span className="text-4xl">🔞</span>
                <p className="mt-2 text-sm font-medium text-foreground">
                  Content hidden. Adult users only.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {has_dob
                    ? "This content is not for you."
                    : "Please update your Date of Birth in Settings."}
                </p>
                <div className="mt-4">
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/studio/settings">
                      Contact Support / Update DoB
                    </Link>
                  </Button>
                </div>
              </div>
            )}
            {isPremiumBlocked && !isNsfwBlocked && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium text-foreground">
                  Premium content
                </p>
                {onUnlock && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 pointer-events-auto"
                    onClick={onUnlock}
                  >
                    Unlock
                  </Button>
                )}
              </div>
            )}
            <div className={
              isNsfwBlocked
                ? "pointer-events-none opacity-10"
                : isPremiumBlocked
                  ? "pointer-events-none blur-xs opacity-40 select-none transition-all duration-500" 
                  : ""
            }>
              <BlockView block={resolveBlockForMode(b, mode)} />
              {b.sources && b.sources.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted-foreground/60 select-none">
                  {b.sources.map((s, idx) => (
                    <a
                      key={idx}
                      href={safeUrl(s.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={s.title}
                      className="hover:text-foreground hover:underline transition-colors"
                    >
                      [{idx + 1}]
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
      {visible.length === 0 && (
          <p className="text-muted-foreground italic">
            No blocks visible in {mode} mode.
          </p>
        )}
      </div>
      </InlineCommentsContext.Provider>
    </HighlightsContext.Provider>
  )
}

// ---------- utilities for outline / reading time ----------

export function extractHeadings(
  blocks: Block[],
  mode: ReadingMode
): { id: string; text: string }[] {
  return blocks
    .filter((b) => {
      if (b.type !== "heading") return false
      return isVisibleInMode(b, mode)
    })
    .map((b) => {
      const t = getText(b.content) || "Section"
      return { id: slugifyId(t), text: t }
    })
}

export function estimateReadingMinutes(
  blocks: Block[],
  mode: ReadingMode
): number {
  const visible = blocks.filter((b) => isVisibleInMode(b, mode))
  const words = visible.reduce((acc, b) => {
    const t = (getText(b.content) || getHtml(b.content) || "").replace(
      /<[^>]+>/g,
      " "
    )
    return acc + t.trim().split(/\s+/).filter(Boolean).length
  }, 0)
  return Math.max(1, Math.round(words / 225))
}
