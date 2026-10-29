"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Clock, FileText, Search, User } from "lucide-react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { listPublishedPieces } from "@/actions/content/pieces/public"
import { searchPieces, searchProfiles } from "@/actions/search"

type Piece = { id: string; title: string; slug: string; author: { handle: string | null; display_name: string | null } | null }
type Person = { id: string; handle: string | null; display_name: string | null }

const RECENT_KEY = "nib:recent-searches"
const readRecent = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]")
  } catch {
    return []
  }
}
const pieceHref = (p: Piece) => `/u/${p.author?.handle ?? "_"}/${p.slug}`

export function SearchPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter()
  const [q, setQ] = useState("")
  const [pieces, setPieces] = useState<Piece[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [latest, setLatest] = useState<Piece[]>([])
  const [recent, setRecent] = useState<string[]>(readRecent)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && !latest.length)
      listPublishedPieces().then((r) => setLatest((r as Piece[]).slice(0, 5))).catch(() => {})
  }, [open, latest.length])

  // Debounced server search; a newer keystroke cancels the older request's result.
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) return
    let stale = false
    const t = setTimeout(async () => {
      const [p, u] = await Promise.all([
        searchPieces({ data: { q: term } }).catch(() => []),
        searchProfiles({ data: { q: term } }).catch(() => []),
      ])
      if (stale) return
      setPieces((p as Piece[]).slice(0, 6))
      setPeople((u as Person[]).slice(0, 4))
      setLoading(false)
    }, 200)
    return () => {
      stale = true
      clearTimeout(t)
    }
  }, [q])

  const go = (href: string, term?: string) => {
    const t = (term ?? q).trim()
    if (t) {
      const next = [t, ...readRecent().filter((r) => r !== t)].slice(0, 5)
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next))
      } catch {}
      setRecent(next)
    }
    onOpenChange(false)
    setQ("")
    router.push(href)
  }
  const seeAll = (term: string) => go(`/search?q=${encodeURIComponent(term)}`, term)
  const typing = q.trim().length >= 2

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-0 h-[100dvh] max-w-none translate-y-0 gap-0 overflow-hidden rounded-none p-0 sm:top-[15vh] sm:h-auto sm:max-w-xl sm:rounded-xl [&>button]:top-1.5 [&>button]:right-1.5 [&>button]:inline-flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center sm:[&>button]:hidden">
        <DialogTitle className="sr-only">Search Nib</DialogTitle>
        <Command shouldFilter={false} className="[&_[cmdk-input-wrapper]]:pr-12 sm:[&_[cmdk-input-wrapper]]:pr-3 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground">
          <CommandInput
            value={q}
            onValueChange={(v) => {
              setQ(v)
              setLoading(v.trim().length >= 2)
            }}
            placeholder="Search pieces and writers"
            className="h-14 text-base"
            onKeyDown={(e) => {
              // Enter with nothing highlighted, or on the input itself, opens full results.
              if (e.key === "Enter" && typing && !document.querySelector("[cmdk-item][data-selected=true]")) seeAll(q.trim())
            }}
          />
          <CommandList className="max-h-[70vh] sm:max-h-[60vh]">
            {typing ? (
              <>
                {!loading && <CommandEmpty>No results for “{q.trim()}”.</CommandEmpty>}
                {pieces.length > 0 && (
                  <CommandGroup heading="Pieces">
                    {pieces.map((p) => (
                      <CommandItem key={p.id} value={`piece-${p.id}`} onSelect={() => go(pieceHref(p))} className="gap-3 py-3">
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{p.title}</span>
                        {p.author && <span className="shrink-0 truncate text-xs text-muted-foreground">{p.author.display_name || `@${p.author.handle}`}</span>}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {people.length > 0 && (
                  <CommandGroup heading="Writers">
                    {people.map((u) => (
                      <CommandItem key={u.id} value={`person-${u.id}`} onSelect={() => go(`/u/${u.handle}`)} className="gap-3 py-3">
                        <User className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{u.display_name || u.handle}</span>
                        <span className="text-xs text-muted-foreground">@{u.handle}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                <CommandGroup>
                  <CommandItem value="see-all" onSelect={() => seeAll(q.trim())} className="gap-3 py-3">
                    <Search className="size-4 shrink-0 text-muted-foreground" />
                    See all results for “{q.trim()}”
                  </CommandItem>
                </CommandGroup>
              </>
            ) : (
              <>
                {recent.length > 0 && (
                  <CommandGroup heading="Recent">
                    {recent.map((r) => (
                      <CommandItem key={r} value={`recent-${r}`} onSelect={() => seeAll(r)} className="gap-3 py-3">
                        <Clock className="size-4 shrink-0 text-muted-foreground" />
                        {r}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {latest.length > 0 && (
                  <CommandGroup heading="Latest">
                    {latest.map((p) => (
                      <CommandItem key={p.id} value={`latest-${p.id}`} onSelect={() => go(pieceHref(p))} className="gap-3 py-3">
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{p.title}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
          <div className="hairline-t hidden items-center gap-4 px-4 py-2 text-xs text-muted-foreground sm:flex">
            <span>↑↓ to move</span>
            <span>↵ to open</span>
            <span>esc to close</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
