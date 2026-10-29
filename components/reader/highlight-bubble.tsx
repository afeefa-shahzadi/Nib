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
      const s = sel.toString().trim()
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
      setPos({
        top: rect.top - 44 + window.scrollY,
        left: rect.left + rect.width / 2 + window.scrollX,
      })
    }
    document.addEventListener("mouseup", onUp)
    document.addEventListener("touchend", onUp)
    document.addEventListener("selectionchange", () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) setPos(null)
    })
    return () => {
      document.removeEventListener("mouseup", onUp)
      document.removeEventListener("touchend", onUp)
    }
  }, [containerRef])

  const shareQuote = async () => {
    const url =
      pieceUrl ?? (typeof window !== "undefined" ? window.location.href : "")
    const payload = `“${text}” — ${pieceTitle ?? ""} ${url}`.trim()
    try {
      if (navigator.share) await navigator.share({ text: payload, url })
      else {
        await navigator.clipboard.writeText(payload)
        toast.success("Quote copied")
      }
    } catch {
      /* user cancelled */
    }
    setPos(null)
  }

  if (!pos || typeof window === "undefined") return null

  return createPortal(
    <div
      role="toolbar"
      style={{ top: pos.top, left: pos.left, transform: "translateX(-50%)" }}
      className="animate-fade-in absolute z-50 flex items-center gap-0.5 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-xl select-none"
    >
      <button
        onMouseDown={(e) => {
          e.preventDefault()
          if (activeRect) onHighlight?.(text, activeRect)
          setPos(null)
          toast.success("Highlighted")
        }}
        className="inline-flex h-8 items-center gap-1 rounded px-2 text-xs hover:bg-accent"
        title="Highlight"
      >
        <Highlighter className="size-3.5 text-note" /> Highlight
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault()
          if (activeRect) onAnnotate?.(text, activeRect)
          setPos(null)
        }}
        className="inline-flex h-8 items-center gap-1 rounded px-2 text-xs hover:bg-accent"
        title="Add an annotation"
      >
        <PenLine className="size-3.5 text-info" /> Annotate
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault()
          if (activeRect) onComment?.(text, activeRect)
          setPos(null)
        }}
        className="inline-flex h-8 items-center gap-1 rounded px-2 text-xs hover:bg-accent"
        title="Start a discussion"
      >
        <MessageCircle className="size-3.5 text-info" /> Comment
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault()
          void shareQuote()
        }}
        className="inline-flex h-8 items-center gap-1 rounded px-2 text-xs hover:bg-accent"
        title="Share quote"
      >
        <Share2 className="size-3.5" /> Quote
      </button>
    </div>,
    document.body
  )
}
