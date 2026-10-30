"use client"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Highlighter, Share2, PenLine, MessageCircle } from "lucide-react"
import { toast } from "sonner"

interface Props {
  containerRef: React.RefObject<HTMLElement | null>
  onHighlight?: (text: string, rect: DOMRect) => void
  onAnnotate?: (text: string, rect: DOMRect) => void
  onComment?: (text: string, rect: DOMRect) => void
  pieceUrl?: string
  pieceTitle?: string
}

/** Medium-style floating bubble on text selection inside the article. */
export function HighlightBubble({
  containerRef,
  onAnnotate,
  onComment,
  onHighlight,
  pieceTitle,
  pieceUrl,
}: Props) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [text, setText] = useState("")
  const [activeRect, setActiveRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onUp = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) {
        setPos(null)
        return
      }
      const s = sel.toString().replace(/\s+/g, " ").trim()
      if (s.length < 3) {
        setPos(null)
        return
      }
      const range = sel.getRangeAt(0)
      // Only act when the selection is inside our container
      if (!el.contains(range.commonAncestorContainer)) {
        setPos(null)
        return
      }
      const rect = range.getBoundingClientRect()
      setText(s)
      setActiveRect(rect)
      // Sit above the selection unless the sticky header/mode bar would cover it; then go below.
      const covered = document.querySelector("[data-reader-bar]")?.getBoundingClientRect().bottom ?? 64
      const h = window.innerWidth >= 1024 ? 44 : 56
      // Phones draw their own copy/paste menu above a selection, so ours goes below there.
      const touch = window.matchMedia("(pointer: coarse)").matches
      const top = touch || rect.top - h - 8 < covered ? rect.bottom + (touch ? 16 : 8) : rect.top - h - 8
      // Keep the whole toolbar on screen (it's centred on `left`, ~360px wide).
      const half = Math.min(180, window.innerWidth / 2 - 8)
      const left = Math.min(Math.max(rect.left + rect.width / 2, half + 8), window.innerWidth - half - 8)
      setPos({ top: top + window.scrollY, left: left + window.scrollX })
    }
    document.addEventListener("mouseup", onUp)
    document.addEventListener("touchend", onUp)
    const onSelChange = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) setPos(null)
    }
    document.addEventListener("selectionchange", onSelChange)
    return () => {
      document.removeEventListener("mouseup", onUp)
      document.removeEventListener("touchend", onUp)
      document.removeEventListener("selectionchange", onSelChange)
    }
  }, [containerRef])

  const shareQuote = async () => {
    const url =
      pieceUrl ?? (typeof window !== "undefined" ? window.location.href : "")
    const payload = `“${text}” — ${pieceTitle ?? ""} ${url}`.trim()
    if (navigator.share) {
      // Closing the share sheet rejects too; that's not an error worth showing.
      await navigator.share({ text: payload }).catch(() => {})
    } else {
      try {
        await navigator.clipboard.writeText(payload)
        toast.success("Quote copied")
      } catch {
        toast.error("Couldn't copy the quote. Select the text and copy it instead.")
      }
    }
    setPos(null)
  }

  if (!pos || typeof window === "undefined") return null

  return createPortal(
    <div
      role="toolbar"
      aria-label="Selected text"
      style={{ top: pos.top, left: pos.left, transform: "translateX(-50%)" }}
      className="animate-fade-in absolute z-50 flex items-center gap-0.5 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-xl select-none"
    >
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          if (activeRect) onHighlight?.(text, activeRect)
          setPos(null)
          toast.success("Highlighted")
        }}
        className="inline-flex h-11 items-center gap-1.5 rounded px-2.5 text-sm hover:bg-accent max-sm:w-11 max-sm:justify-center lg:h-8"
        title="Highlight"
      >
        <Highlighter className="size-3.5 text-note" /> <span className="max-sm:sr-only">Highlight</span>
      </button>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          if (activeRect) onAnnotate?.(text, activeRect)
          setPos(null)
        }}
        className="inline-flex h-11 items-center gap-1.5 rounded px-2.5 text-sm hover:bg-accent max-sm:w-11 max-sm:justify-center lg:h-8"
        title="Add an annotation"
      >
        <PenLine className="size-3.5 text-info" /> <span className="max-sm:sr-only">Annotate</span>
      </button>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          if (activeRect) onComment?.(text, activeRect)
          setPos(null)
        }}
        className="inline-flex h-11 items-center gap-1.5 rounded px-2.5 text-sm hover:bg-accent max-sm:w-11 max-sm:justify-center lg:h-8"
        title="Start a discussion"
      >
        <MessageCircle className="size-3.5 text-info" /> <span className="max-sm:sr-only">Comment</span>
      </button>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          void shareQuote()
        }}
        className="inline-flex h-11 items-center gap-1.5 rounded px-2.5 text-sm hover:bg-accent max-sm:w-11 max-sm:justify-center lg:h-8"
        title="Share quote"
      >
        <Share2 className="size-3.5" /> <span className="max-sm:sr-only">Quote</span>
      </button>
    </div>,
    document.body
  )
}
