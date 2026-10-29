"use client"
import { useSyncExternalStore } from "react"
import { cn } from "@/lib/utils"
import { ACCENT_KEY } from "@/lib/accent"

export const ACCENTS = [
  { id: "ink", label: "Ink" },
  { id: "oxblood", label: "Oxblood" },
  { id: "teal", label: "Teal" },
] as const

const listeners = new Set<() => void>()
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function AccentPicker() {
  // <html data-accent> is the store (set before paint by app/layout.tsx); server snapshot is the default.
  const accent = useSyncExternalStore(subscribe, () => document.documentElement.dataset.accent ?? "ink", () => "ink")
  const pick = (id: string) => {
    document.documentElement.setAttribute("data-accent", id)
    listeners.forEach((l) => l())
    try {
      localStorage.setItem(ACCENT_KEY, id)
    } catch {}
  }
  return (
    <fieldset className="flex flex-wrap gap-3">
      <legend className="sr-only">Accent colour</legend>
      {ACCENTS.map((a) => (
        <label
          key={a.id}
          data-accent={a.id}
          className={cn(
            "flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm has-focus-visible:ring-2 has-focus-visible:ring-ring",
            accent === a.id ? "border-primary text-foreground" : "border-border text-muted-foreground",
          )}
        >
          <input
            type="radio"
            name="accent"
            value={a.id}
            checked={accent === a.id}
            onChange={() => pick(a.id)}
            className="sr-only"
          />
          <span aria-hidden className="size-4 rounded-full bg-primary" />
          {a.label}
        </label>
      ))}
    </fieldset>
  )
}
