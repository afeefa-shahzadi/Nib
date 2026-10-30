"use client"

import { useEffect, useState } from "react"
import { getDiscoverFeed } from "@/actions/social"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { LoginRequiredDialog } from "@/components/login-required-dialog"
import { Search, SlidersHorizontal, X } from "lucide-react"
import { PieceRow } from "@/components/piece-row"
import { Piece } from "@/lib/types/content"
import type { FeedSince, FeedSort } from "@/lib/feed-query"
import { cn } from "@/lib/utils"

type Discover = { pieces: Piece[]; trending: { tag: string; count: number }[]; hasMore?: boolean }

function TopicChip({ label, count, active, onClick }: { label: string; count?: number; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors lg:min-h-8",
        active ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"
      )}
    >
      {label}
      {active ? <X className="size-3.5" aria-hidden /> : count != null && <span className="text-muted-foreground">{count}</span>}
    </button>
  )
}

export function FeedClient({
  initialFollowing,
  initialDiscover,
  signedIn,
}: {
  initialFollowing: { pieces: Piece[]; empty: boolean } | null
  initialDiscover: Discover
  signedIn: boolean
}) {
  const [tab, setTab] = useState<"following" | "discover">("discover")
  const [loginOpen, setLoginOpen] = useState(false)
  const [q, setQ] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [tag, setTag] = useState<string | undefined>(undefined)
  const [sort, setSort] = useState<FeedSort>("newest")
  const [since, setSince] = useState<FeedSince>("any")
  const [tagged, setTagged] = useState<"all" | "tagged" | "untagged">("all")
  const [results, setResults] = useState<Discover | null>(null)
  const [extra, setExtra] = useState<Piece[]>([])
  const [more, setMore] = useState<boolean | null>(null)
  const [page, setPage] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  const filtered = !!(debouncedQ || tag || sort !== "newest" || since !== "any" || tagged !== "all")

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  // Any change to search or filters reloads page one from the server.
  useEffect(() => {
    if (!filtered) return
    let live = true
    getDiscoverFeed({ data: { q: debouncedQ || undefined, tag, sort, since, tagged: tagged === "all" ? undefined : tagged, page: 0 } }).then(
      (r) => live && setResults(r as Discover)
    )
    return () => {
      live = false
    }
  }, [filtered, debouncedQ, tag, sort, since, tagged])

  // Changing a filter resets paging; results arrive from the effect above.
  const reset = () => {
    setResults(null)
    setExtra([])
    setMore(null)
    setPage(0)
  }
  const change = <T,>(set: (v: T) => void) => (v: T) => {
    reset()
    set(v)
  }

  const base = filtered ? results : initialDiscover
  const loading = filtered && !results
  const pieces = [...(base?.pieces ?? []), ...extra]
  const hasMore = more ?? base?.hasMore ?? false

  async function loadMore() {
    setLoadingMore(true)
    try {
      const d = (await getDiscoverFeed({ data: { q: debouncedQ || undefined, tag, sort, since, tagged: tagged === "all" ? undefined : tagged, page: page + 1 } })) as Discover
      const seen = new Set(pieces.map((p) => p.id))
      setExtra([...extra, ...d.pieces.filter((p) => !seen.has(p.id))])
      setMore(d.hasMore ?? false)
      setPage(page + 1)
    } finally {
      setLoadingMore(false)
    }
  }

  const clearAll = () => {
    reset()
    setQ("")
    setDebouncedQ("")
    setTag(undefined)
    setSort("newest")
    setSince("any")
    setTagged("all")
  }

  const pickTag = change(setTag)
  const trending = initialDiscover.trending
  const topics = trending.length > 0 && (
    <div className="flex gap-2 overflow-x-auto no-scrollbar lg:flex-wrap lg:overflow-visible">
      {tag && <TopicChip label={tag} active onClick={() => pickTag(undefined)} />}
      {trending
        .filter((t) => t.tag !== tag)
        .map((t) => (
          <TopicChip key={t.tag} label={t.tag} count={t.count} onClick={() => pickTag(t.tag)} />
        ))}
    </div>
  )

  const search = (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        aria-label="Search pieces and writers"
        placeholder="Search"
        className="pl-9"
        value={q}
        onChange={(e) => {
          reset()
          setQ(e.target.value)
        }}
      />
    </div>
  )

  const filters = (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        <Label htmlFor="feed-sort">Sort</Label>
        <Select value={sort} onValueChange={(v) => change(setSort)(v as FeedSort)}>
          <SelectTrigger id="feed-sort" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="title">Title A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="feed-since">Published</Label>
        <Select value={since} onValueChange={(v) => change(setSince)(v as FeedSince)}>
          <SelectTrigger id="feed-since" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any time</SelectItem>
            <SelectItem value="today">Past 24 hours</SelectItem>
            <SelectItem value="week">Past week</SelectItem>
            <SelectItem value="month">Past month</SelectItem>
            <SelectItem value="year">Past year</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2 space-y-2">
        <Label htmlFor="feed-tagged">Topics</Label>
        <Select value={tagged} onValueChange={(v) => change(setTagged)(v as typeof tagged)}>
          <SelectTrigger id="feed-tagged" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any</SelectItem>
            <SelectItem value="tagged">Has topics</SelectItem>
            <SelectItem value="untagged">No topics</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )

  const activeFilters = (sort !== "newest" ? 1 : 0) + (since !== "any" ? 1 : 0) + (tagged !== "all" ? 1 : 0)

  return (
    <>
      <Tabs
        value={tab}
        onValueChange={(v) => {
          if (v === "following" && !signedIn) return setLoginOpen(true)
          setTab(v as "following" | "discover")
        }}
      >
        <TabsList>
          <TabsTrigger value="discover">Discover</TabsTrigger>
          <TabsTrigger value="following">Following</TabsTrigger>
        </TabsList>

        <div className="mt-8 grid items-start gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="min-w-0 lg:col-span-8">
            <TabsContent value="following" className="mt-0">
              {initialFollowing?.empty || !initialFollowing ? (
                <div className="hairline-t hairline-b py-12">
                  <h2 className="font-display text-2xl">Nothing here yet</h2>
                  <p className="mt-2 max-w-[38rem] text-muted-foreground">
                    Follow writers and their new pieces show up here, newest first.
                  </p>
                  <Button variant="outline" className="mt-6" onClick={() => setTab("discover")}>
                    Find writers in Discover
                  </Button>
                </div>
              ) : (
                <ul>
                  {initialFollowing.pieces.map((p) => (
                    <PieceRow key={p.id} p={p} />
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="discover" className="mt-0">
              <div className="mb-6 space-y-4 lg:hidden">
                <div className="flex gap-2">
                  <div className="flex-1">{search}</div>
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline">
                        <SlidersHorizontal className="size-4" aria-hidden />
                        Filters{activeFilters > 0 && ` · ${activeFilters}`}
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="space-y-6 p-6">
                      <SheetHeader className="p-0 text-left">
                        <SheetTitle>Filters</SheetTitle>
                      </SheetHeader>
                      {filters}
                    </SheetContent>
                  </Sheet>
                </div>
                {topics}
              </div>

              {filtered && (
                <div className="mb-2 flex min-h-11 items-center justify-between gap-4 text-sm text-muted-foreground">
                  <span>{debouncedQ ? `Results for “${debouncedQ}”` : "Filtered pieces"}</span>
                  <Button variant="link" className="px-0" onClick={clearAll}>Clear all</Button>
                </div>
              )}

              {loading ? (
                <div className="flex justify-center py-16" role="status" aria-label="Loading">
                  <Spinner />
                </div>
              ) : pieces.length === 0 ? (
                <p className="hairline-t hairline-b py-12 text-muted-foreground">
                  {filtered ? "No pieces match. Try a different search or filter." : "No pieces published yet."}
                </p>
              ) : (
                <>
                  <ul>
                    {pieces.map((p) => (
                      <PieceRow key={p.id} p={p} />
                    ))}
                  </ul>
                  {hasMore && (
                    <div className="mt-8 flex justify-center">
                      <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                        {loadingMore ? <Spinner /> : "Load more"}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </div>

          {tab === "discover" && (
            <aside className="hidden space-y-8 lg:sticky lg:top-24 lg:col-span-4 lg:block">
              {search}
              {filters}
              {topics && (
                <div>
                  <h2 className="text-sm font-medium">Trending topics</h2>
                  <div className="mt-3">{topics}</div>
                </div>
              )}
            </aside>
          )}
        </div>
      </Tabs>

      <LoginRequiredDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        title="Sign in to see who you follow"
        description="Follow writers and their newest pieces show up here."
        redirectTo="/feed"
      />
    </>
  )
}
