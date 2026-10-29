"use client"

import { useEffect, useRef, useState } from "react"
import {
  searchProfilesForMention,
  searchMyPiecesForLink,
} from "@/actions/social"

export type InlineHit =
  | {
      kind: "mention"
      id: string
      label: string
      sublabel?: string
      href: string
      insertText: string
    }
  | {
      kind: "wiki"
      id: string
      label: string
      sublabel?: string
      href: string
      insertText: string
    }

interface Props {
  anchor: { x: number; y: number }
  trigger: "@" | "[["
  query: string
  onSelect: (hit: InlineHit) => void
  onClose: () => void
}

export function InlineMentionMenu({
  anchor,
  trigger,
  query,
  onSelect,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [items, setItems] = useState<InlineHit[]>([])
  const [idx, setIdx] = useState(0)
  const [loading, setLoading] = useState(false)
  const searchMentions = searchProfilesForMention
  const searchPieces = searchMyPiecesForLink

  const [prevQuery, setPrevQuery] = useState(query)
  const [prevTrigger, setPrevTrigger] = useState(trigger)

  if (query !== prevQuery || trigger !== prevTrigger) {
    setPrevQuery(query)
    setPrevTrigger(trigger)
    setIdx(0)
  }

  useEffect(() => {
    let alive = true
    const q = query.trim()
    if (q.length < 1) {
      requestAnimationFrame(() => {
        if (alive) setItems([])
      })
      return
    }

    const t = setTimeout(() => {
      requestAnimationFrame(() => {
        if (alive) setLoading(true)
      })
      ;(async () => {
        try {
          if (trigger === "@") {
            const rows = await searchMentions({ data: { q } })
            if (!alive) return
            setItems(
              rows.map(
                (r: {
                  id: string
                  handle: string
                  display_name: string | null
                }) => ({
                  kind: "mention" as const,
                  id: r.id,
                  label: `@${r.handle}`,
                  sublabel: r.display_name ?? undefined,
                  href: `/u/${r.handle}`,
                  insertText: `@${r.handle}`,
                })
              )
            )
          } else {
            const rows = await searchPieces({ data: { q } })
            if (!alive) return
            setItems(
              rows.map(
                (r: {
                  id: string
                  title: string
                  status: string
                  handle: string
                  slug: string
                }) => ({
                  kind: "wiki" as const,
                  id: r.id,
                  label: r.title,
                  sublabel: r.status,
                  href: `/u/${r.handle}/${r.slug}`,
                  insertText: r.title,
                })
              )
            )
          }
        } catch (e) {
          console.error(e)
          if (alive) setItems([])
        } finally {
          if (alive) setLoading(false)
        }
      })()
    }, 250)

    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [query, trigger, searchMentions, searchPieces])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setIdx((i) => (items.length ? (i + 1) % items.length : 0))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setIdx((i) =>
          items.length ? (i - 1 + items.length) % items.length : 0
        )
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (items[idx]) {
          e.preventDefault()
          onSelect(items[idx])
        }
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

  const top = Math.min(anchor.y + 8, window.innerHeight - 320)
  const left = Math.min(anchor.x, window.innerWidth - 280)

  return (
    <div
      ref={ref}
      style={{ top, left }}
      className="fixed z-50 max-h-80 w-70 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg"
    >
      <div className="px-2 py-1 text-[10px] tracking-wider text-muted-foreground uppercase">
        {trigger === "@" ? "Mention person" : "Link to your piece"}
        {query && <span className="ml-1 font-mono">{query}</span>}
      </div>
      {loading && items.length === 0 && (
        <div className="px-2 py-3 text-xs text-muted-foreground">
          Searching…
        </div>
      )}
      {!loading && items.length === 0 && (
        <div className="px-2 py-3 text-xs text-muted-foreground">
          No matches
        </div>
      )}
      {items.map((it, i) => (
        <button
          key={it.id}
          onMouseEnter={() => setIdx(i)}
          onClick={() => onSelect(it)}
          className={`flex w-full flex-col items-start gap-0 rounded px-2 py-1.5 text-left text-sm ${
            i === idx
              ? "bg-accent text-accent-foreground"
              : "hover:bg-accent/50"
          }`}
        >
          <span className="block w-full truncate font-medium">{it.label}</span>
          {it.sublabel && (
            <span className="block w-full truncate text-[11px] text-muted-foreground">
              {it.sublabel}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
