"use client"
import { useEffect, useRef } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LinkIcon } from "@/components/brand/link-icon"
import { MAX_LINKS } from "@/lib/profile-links"

// One row per link, with its brand icon and a remove button, like other platforms' profile editors.
export function LinksEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const rows = value.length ? value : [""]
  const box = useRef<HTMLDivElement>(null)
  const added = useRef(false)
  const add = () => {
    added.current = true
    onChange([...rows, ""])
  }
  // The row just added with "Add link" takes the cursor.
  useEffect(() => {
    if (!added.current) return
    added.current = false
    box.current?.querySelector<HTMLInputElement>(`[aria-label="Link ${rows.length}"]`)?.focus()
  }, [rows.length])
  const set = (i: number, v: string) => onChange(rows.map((r, j) => (j === i ? v : r)))
  return (
    <div ref={box} className="mt-2 space-y-2">
      {rows.map((url, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
              <LinkIcon url={url} />
            </span>
            <Input
              aria-label={`Link ${i + 1}`}
              type="text"
              inputMode="url"
              className="min-h-11 pl-9"
              placeholder={i === 0 ? "x.com/you" : "linkedin.com/in/you"}
              value={url}
              onChange={(e) => set(i, e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0"
            aria-label={`Remove link ${i + 1}`}
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
            disabled={rows.length === 1 && !url}
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
      {rows.length < MAX_LINKS && (
        <Button type="button" variant="ghost" className="min-h-11 px-2" onClick={add} disabled={!rows[rows.length - 1]}>
          <Plus className="size-4" /> Add link
        </Button>
      )}
    </div>
  )
}
