"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { KIND_META, type BlockKind } from "./types"

// Exported so the public docs list exactly what the menu offers.
export const ORDER: BlockKind[] = [
  "paragraph",
  "heading",
  "image",
  "quote",
  "callout",
  "code",
  "citation",
  "question",
  "chart",
  "mermaid",
  "flowchart",
  "exercise",
  "audio_note",
  "embed",
  "thesis",
  "evidence",
  "counter",
  "footnote",
  "gated",
]

interface Props {
  anchor: { x: number; y: number }
  query: string
  onSelect: (kind: BlockKind) => void
  onClose: () => void
}

export function SlashMenu({ anchor, query, onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const items = useMemo(() => {
    const q = query.toLowerCase()
    return ORDER.filter(
      (k) => !q || k.includes(q) || KIND_META[k].label.toLowerCase().includes(q)
    )
  }, [query])
  const [idx, setIdx] = useState(0)
  const [prevQuery, setPrevQuery] = useState(query)

  if (query !== prevQuery) {
    setPrevQuery(query)
    setIdx(0)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setIdx((i) => (i + 1) % items.length)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setIdx((i) => (i - 1 + items.length) % items.length)
      } else if (e.key === "Enter") {
        e.preventDefault()
        const it = items[idx]
        if (it) onSelect(it)
      } else if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [items, idx, onSelect, onClose])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [onClose])

  if (items.length === 0) return null

  // Clamp to viewport
  const top = Math.min(anchor.y + 8, window.innerHeight - 320)
  const left = Math.min(anchor.x, window.innerWidth - 280)

  return (
    <div
      ref={ref}
      style={{ top, left }}
      className="no-scrollbar fixed z-50 max-h-80 w-65 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg"
    >
      <div className="px-2 py-1 text-[10px] tracking-wider text-muted-foreground uppercase">
        Insert block {query && <span className="ml-1 font-mono">/{query}</span>}
      </div>
      {items.map((k, i) => (
        <button
          key={k}
          onMouseEnter={() => setIdx(i)}
          onClick={() => onSelect(k)}
          className={`flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-sm ${
            i === idx
              ? "bg-accent text-accent-foreground"
              : "hover:bg-accent/50"
          }`}
        >
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-xs">
            {KIND_META[k].icon}
          </span>
          <span className="min-w-0">
            <span className="block font-medium">{KIND_META[k].label}</span>
            <span className="block text-[11px] text-muted-foreground">
              {KIND_META[k].hint}
            </span>
          </span>
        </button>
      ))}
    </div>
  )
}
