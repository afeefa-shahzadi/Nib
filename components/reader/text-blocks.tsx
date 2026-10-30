"use client"

import { ExternalLink, Asterisk } from "lucide-react"
import { READER_PARAGRAPH } from "@/lib/reader-classes"
import Link from "next/link"
import {
  Block,
  getText,
  getHtml,
  getStr,
  sanitize,
  safeUrl,
  slugifyId,
  RichOrText,
} from "../block-renderer"

export function HeadingBlock({ block }: { block: Block }) {
  const text = getText(block.content)
  const html = getHtml(block.content)
  const id = slugifyId(text)
  const level = Number((block.content as { level?: number }).level) === 3 ? 3 : 2
  const Tag = level === 3 ? "h3" : "h2"
  const sizing =
    level === 3 ? "mt-8 mb-3 text-xl md:text-2xl" : "mt-12 mb-4 text-2xl md:text-3xl"
  return (
    <Tag
      id={id}
      className={`group scroll-mt-24 font-display text-foreground ${sizing}`}
    >
      <Link
        href={`#${id}`}
        className="decoration-primary/60 underline-offset-4 hover:underline"
      >
        {text ||
          (html ? (
            <span dangerouslySetInnerHTML={{ __html: sanitize(html) }} />
          ) : null)}
      </Link>
    </Tag>
  )
}

export function ParagraphBlock({ block }: { block: Block }) {
  const role = block.semantic_role ?? null
  if (role === "thesis") {
    return (
      <RichOrText
        content={block.content}
        as="div"
        className="mb-8 border-l-2 border-primary pl-5 font-display text-2xl leading-snug text-foreground md:text-3xl"
      />
    )
  }
  // Evidence/counter/callout boxes stay sans on purpose: they are UI-like asides, not long-form prose.
  if (role === "evidence") {
    return (
      <div className="surface my-5 rounded-md border border-note/30 px-5 py-4">
        <p className="mb-1 flex items-center gap-1 text-xs text-note">
          <Asterisk className="size-3" /> Evidence
        </p>
        <RichOrText
          content={block.content}
          as="div"
          className="prose prose-sm dark:prose-invert max-w-none leading-relaxed text-foreground/90"
        />
      </div>
    )
  }
  if (role === "counter") {
    return (
      <div className="surface my-5 rounded-md border border-destructive/30 px-5 py-4">
        <p className="mb-1 text-xs text-destructive">
          Counter-argument
        </p>
        <RichOrText
          content={block.content}
          as="div"
          className="prose prose-sm dark:prose-invert max-w-none leading-relaxed text-foreground/90"
        />
      </div>
    )
  }
  if (role === "footnote") {
    return (
      <aside className="my-4 border-l border-border pl-3 text-sm text-muted-foreground">
        <span className="mr-1 font-mono text-xs text-primary">†</span>
        <RichOrText content={block.content} as="span" />
      </aside>
    )
  }
  return (
    <RichOrText
      content={block.content}
      as="div"
      className={READER_PARAGRAPH}
    />
  )
}

export function QuoteBlock({ block }: { block: Block }) {
  return (
    <blockquote className="my-6 flex gap-3 border-l-2 border-primary/60 pl-5 font-display text-xl text-foreground/85 italic">
      <ExternalLink
        className="mt-1 hidden size-5 shrink-0 text-primary/60"
        aria-hidden
      />
      <RichOrText content={block.content} as="div" />
    </blockquote>
  )
}

export function CitationBlock({ block }: { block: Block }) {
  const text = getText(block.content)
  const source = getStr(block.content, "source")
  const url = safeUrl(getStr(block.content, "url"))
  const quote = getStr(block.content, "quote")
  const page = getStr(block.content, "page")
  const label = source ?? text ?? "Source"
  return (
    <figure className="surface my-5 rounded-md border border-info/30 px-5 py-4">
      <p className="mb-1 text-xs text-info">
        Citation
      </p>
      {quote && (
        <p className="mb-2 text-sm text-foreground/85 italic">
          &ldquo;{quote}&rdquo;
        </p>
      )}
      <figcaption className="text-sm text-muted-foreground">
        {url ? (
          <Link
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            {label} <ExternalLink className="size-3" />
          </Link>
        ) : (
          <span className="text-foreground">{label}</span>
        )}
        {page && <span className="ml-1">· p.{page}</span>}
      </figcaption>
    </figure>
  )
}

export function CalloutBlock({ block }: { block: Block }) {
  return (
    <aside className="surface-elevated my-6 rounded-md border-l-2 border-primary px-5 py-4">
      <p className="mb-1 text-xs text-success">
        Note
      </p>
      <RichOrText
        content={block.content}
        as="div"
        className="leading-relaxed text-foreground/90"
      />
    </aside>
  )
}

export function QuestionBlock({
  block,
  labelClassName = "",
}: {
  block: Block
  labelClassName?: string
}) {
  const text = getText(block.content)
  return (
    <div className="surface my-6 rounded-md border border-success/30 px-5 py-4">
      <p className={`mb-1 text-xs text-success ${labelClassName}`}>
        Open question
      </p>
      <p className="font-display text-xl text-foreground">{text}</p>
    </div>
  )
}
