"use client"

import { useMemo, useSyncExternalStore } from "react"
import Link from "next/link"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

type Item = { id: string; title: string; summary: string | null; href: string }

const key = (id: string) => `bundle_progress_${id}`

const EVENT = "nib:reading-progress"
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb)
  window.addEventListener(EVENT, cb)
  return () => {
    window.removeEventListener("storage", cb)
    window.removeEventListener(EVENT, cb)
  }
}
const read = (id: string) => {
  try {
    return localStorage.getItem(key(id)) ?? "{}"
  } catch {
    return "{}"
  }
}

// Reading progress lives in this browser only; it's a convenience, not a record.
export function ReadingList({ collectionId, items }: { collectionId: string; items: Item[] }) {
  const raw = useSyncExternalStore(subscribe, () => read(collectionId), () => "{}")
  const done = useMemo<Record<string, boolean>>(() => {
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }, [raw])
  const count = items.filter((i) => done[i.id]).length

  const toggle = (id: string) => {
    const next = { ...done, [id]: !done[id] }
    try {
      localStorage.setItem(key(collectionId), JSON.stringify(next))
      window.dispatchEvent(new Event(EVENT))
    } catch {}
  }

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
        {count} of {items.length} read
      </p>
      <ol>
        {items.map((p, i) => (
          <li key={p.id} className="hairline-t last:hairline-b flex items-start gap-4 py-6">
            <span className="w-6 shrink-0 pt-1 text-right font-mono text-sm text-muted-foreground tabular-nums">
              {i + 1}
            </span>
            <Link href={p.href} className="group block min-w-0 flex-1">
              <h2 className="font-display text-xl leading-snug group-hover:text-primary">{p.title}</h2>
              {p.summary && <p className="mt-1 leading-relaxed text-muted-foreground">{p.summary}</p>}
            </Link>
            <button
              type="button"
              onClick={() => toggle(p.id)}
              aria-pressed={!!done[p.id]}
              aria-label={`Mark “${p.title}” as read`}
             
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-full border transition-colors lg:size-9",
                done[p.id] ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent hover:text-muted-foreground"
              )}
            >
              <Check className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ol>
    </>
  )
}
