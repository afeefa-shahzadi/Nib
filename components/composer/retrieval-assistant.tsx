 
"use client"

import { useState, useRef, useEffect } from "react"
import { Search, Quote, BookOpen, Loader2, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { searchMyArchive } from "@/actions/content"
import { makeBlock, type BlockDraft } from "./types"

interface Props {
  excludePieceId: string
  onInsert: (block: BlockDraft) => void
  onClose?: () => void
}

type Hit = Awaited<ReturnType<typeof searchMyArchive>>[number]

export function RetrievalAssistant({
  excludePieceId,
  onInsert,
  onClose,
}: Props) {
  const search = searchMyArchive
  const [q, setQ] = useState("")
  const [hits, setHits] = useState<Hit[]>([])
  const [loading, setLoading] = useState(false)
  const [touched, setTouched] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [prevQ, setPrevQ] = useState(q)

  if (q !== prevQ) {
    setPrevQ(q)
  }

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      setLoading(true)
      setTouched(true)
      try {
        const res = await search({
          data: { q: q.trim(), exclude_piece_id: excludePieceId, limit: 10 },
        })
        setHits(res)
      } catch (e) {
        console.error(e)
        setHits([])
      } finally {
        setLoading(false)
      }
    }, 280)
    return () => {
      if (debounce.current) clearTimeout(debounce.current)
    }
  }, [q, excludePieceId, search])

  function insertAsQuote(h: Hit) {
    const block = makeBlock("quote", { text: h.text, html: "" })
    onInsert(block)
  }
  function insertAsCitation(h: Hit) {
    const block = makeBlock("citation", {
      text: "",
      source: h.piece_title,
      url: h.handle ? `/u/${h.handle}/${h.piece_slug}` : `/u/${h.piece_slug}`,
      quote: h.text.slice(0, 280),
    })
    onInsert(block)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="hairline-b flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2 text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          <BookOpen className="size-3.5" /> Archive
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close archive"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <div className="hairline-b px-3 py-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search prior blocks…"
            className="h-8 pl-7 text-sm"
            autoFocus
          />
        </div>
        <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
          Search your own drafts and published pieces. Insert any block as a
          citation or pulled quote.
        </p>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-2 py-2">
        {loading && (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        )}
        {!loading && touched && hits.length === 0 && q.trim().length >= 2 && (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            No matches in your archive.
          </p>
        )}
        {!loading && !touched && (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            Type a phrase to find evidence, claims, or quotes you&apos;ve
            written before.
          </p>
        )}
        {hits.map((h) => (
          <div
            key={h.block_id}
            className="rounded-md border border-border p-2 transition-colors hover:bg-accent/30"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-[10px] tracking-wider text-muted-foreground uppercase">
                {h.piece_title}
              </span>
              <span className="shrink-0 text-[9px] tracking-wider text-muted-foreground uppercase">
                {h.piece_status} · {h.type}
              </span>
            </div>
            <p className="mb-2 line-clamp-3 text-xs leading-snug text-foreground">
              {h.snippet}
            </p>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[11px]"
                onClick={() => insertAsCitation(h)}
                title="Insert as a citation block linking to the source piece"
              >
                <BookOpen className="mr-1 size-3" /> Cite
              </Button>
              {h.type !== "piece" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => insertAsQuote(h)}
                  title="Insert as a pulled-quote block"
                >
                  <Quote className="mr-1 size-3" /> Quote
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
