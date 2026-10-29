 
"use client"

import { useState, useEffect } from "react"
import { getDiscoverFeed } from "@/actions/social"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LoginRequiredDialog } from "@/components/login-required-dialog"
import { Sparkles, Users, X, Loader2, Compass, Search, Filter } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { Piece } from "@/lib/types/content"

function PieceCard({ p, onHide }: { p: Piece; onHide?: (id: string) => void }) {
  const handle = p.author?.handle ?? "_"
  return (
    <Link
      href={`/u/${handle}/${p.slug}`}
      className="hairline group block rounded-lg p-5 transition-colors hover:border-primary/40"
    >
      <article>
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          {p.author && (
            <span className="inline-flex items-center gap-1.5">
              <span className="grid size-5 place-items-center rounded-full bg-accent text-[10px] uppercase">
                {p.author.display_name.charAt(0)}
              </span>
              <span className="font-medium text-foreground">
                {p.author.display_name}
              </span>
              <span className="text-muted-foreground">@{p.author.handle}</span>
            </span>
          )}
          {p.boosted && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] tracking-wider text-primary uppercase">
              Boosted
            </span>
          )}
          {p.published_at && (
            <span className="ml-auto">
              {/* Pinned locale + UTC keeps SSR and client output identical
                  (bare toLocaleDateString caused hydration mismatches). */}
              {new Date(p.published_at).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "UTC",
              })}
            </span>
          )}
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onHide?.(p.id)
            }}
            className="ml-2 rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            title="Not interested"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>
          </button>
        </div>
        {p.cover_image_url && (
          <div className="mb-4 overflow-hidden rounded-md border border-border">
            <Image 
              src={p.cover_image_url} 
              alt={p.title}
              width={800}
              height={400}
              unoptimized={!p.cover_image_url.includes("supabase.co")}
              className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105 max-h-48" 
            />
          </div>
        )}
        <h2 className="mb-1 font-display text-xl leading-tight transition-colors group-hover:text-primary">
          {p.title}
        </h2>
        {p.summary && (
          <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
            {p.summary}
          </p>
        )}
        {p.tags && p.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {p.tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="hairline rounded-full px-2 py-0.5 text-[10px] tracking-wider text-muted-foreground uppercase"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </article>
    </Link>
  )
}

export function FeedClient({
  initialFollowing,
  initialDiscover,
  signedIn,
}: {
  initialFollowing: { pieces: Piece[]; empty: boolean } | null
  initialDiscover: {
    pieces: Piece[]
    trending: { tag: string; count: number }[]
  }
  signedIn: boolean
}) {
  const discoverFn = getDiscoverFeed

  const [tab, setTab] = useState<"following" | "discover">(
    signedIn ? "following" : "discover"
  )
  const [discover, setDiscover] = useState(initialDiscover)
  const [tag, setTag] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [showTrending, setShowTrending] = useState(false)
  const [q, setQ] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [sortBy, setSortBy] = useState<"recent" | "oldest" | "a-z">("recent")
  const [filterTags, setFilterTags] = useState<"all" | "tagged" | "untagged">("all")
  const [filterTime, setFilterTime] = useState<"any" | "today" | "week" | "month" | "year">("any")
  const [hiddenPieces, setHiddenPieces] = useState<Set<string>>(new Set())

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), 400)
    return () => clearTimeout(timer)
  }, [q])

  // Only re-fetch discover if tag or search changes
  useEffect(() => {
    if (tag === undefined && !debouncedQ) {
      requestAnimationFrame(() => {
        setDiscover(initialDiscover)
      })
      return
    }
    requestAnimationFrame(() => {
      setLoading(true)
    })
    discoverFn({ data: { tag, q: debouncedQ || undefined } })
      .then((r) => setDiscover(r as typeof initialDiscover))
      .finally(() => setLoading(false))
  }, [discoverFn, tag, debouncedQ, initialDiscover])

  // Apply local filters/sort
  const displayedDiscoverPieces = (() => {
    let list = [...(discover?.pieces ?? [])]
    list = list.filter((p) => !hiddenPieces.has(p.id))

    if (filterTags === "tagged") list = list.filter((p) => p.tags && p.tags.length > 0)
    if (filterTags === "untagged") list = list.filter((p) => !p.tags || p.tags.length === 0)
    
    if (filterTime !== "any") {
      const now = new Date().getTime()
      let threshold = now
      if (filterTime === "today") threshold -= 24 * 60 * 60 * 1000
      if (filterTime === "week") threshold -= 7 * 24 * 60 * 60 * 1000
      if (filterTime === "month") threshold -= 30 * 24 * 60 * 60 * 1000
      if (filterTime === "year") threshold -= 365 * 24 * 60 * 60 * 1000
      list = list.filter((p) => {
        if (!p.published_at) return false
        return new Date(p.published_at).getTime() >= threshold
      })
    }
    
    list.sort((a, b) => {
      if (sortBy === "a-z") return a.title.localeCompare(b.title)
      const ta = new Date(a.published_at ?? 0).getTime()
      const tb = new Date(b.published_at ?? 0).getTime()
      return sortBy === "recent" ? tb - ta : ta - tb
    })
    return list
  })()

  const FilterUI = (
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <span className="hidden text-xs font-medium tracking-wider text-muted-foreground uppercase md:inline-block">
        Filters
      </span>
      <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
        <SelectTrigger className="h-8 w-full text-xs md:w-32.5">
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="recent" className="text-xs">Most Recent</SelectItem>
          <SelectItem value="oldest" className="text-xs">Oldest First</SelectItem>
          <SelectItem value="a-z" className="text-xs">Title A-Z</SelectItem>
        </SelectContent>
      </Select>
      <Select value={filterTime} onValueChange={(v) => setFilterTime(v as typeof filterTime)}>
        <SelectTrigger className="h-8 w-full text-xs md:w-32.5">
          <SelectValue placeholder="Time" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any" className="text-xs">Any Time</SelectItem>
          <SelectItem value="today" className="text-xs">Past 24h</SelectItem>
          <SelectItem value="week" className="text-xs">Past Week</SelectItem>
          <SelectItem value="month" className="text-xs">Past Month</SelectItem>
          <SelectItem value="year" className="text-xs">Past Year</SelectItem>
        </SelectContent>
      </Select>
      <Select value={filterTags} onValueChange={(v) => setFilterTags(v as typeof filterTags)}>
        <SelectTrigger className="h-8 w-full text-xs md:w-32.5">
          <SelectValue placeholder="Tags" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">Any Tags</SelectItem>
          <SelectItem value="tagged" className="text-xs">Has Tags</SelectItem>
          <SelectItem value="untagged" className="text-xs">Untagged</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <>
      <Tabs
        value={tab}
        onValueChange={(v) => {
          if (v === "following" && !signedIn) {
            setLoginOpen(true)
            return
          }
          setTab(v as "following" | "discover")
        }}
        className="space-y-6"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <TabsList>
            <TabsTrigger value="following" className="gap-1.5">
              <Users className="size-3.5" /> Following
            </TabsTrigger>
            <TabsTrigger value="discover" className="gap-1.5">
              <Compass className="size-3.5" /> Discover
            </TabsTrigger>
          </TabsList>

          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search pieces, authors..."
              className="w-full pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <TabsContent value="following" className="space-y-4">
          {!signedIn && (
            <div className="hairline rounded-lg p-10 text-center">
              <p className="mb-4 text-muted-foreground">
                Sign in to see pieces from the authors you follow.
              </p>
              <Button asChild>
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          )}
          {signedIn && initialFollowing?.empty && (
            <div className="hairline rounded-lg p-10 text-center">
              <Sparkles className="mx-auto mb-3 size-5 text-primary" />
              <p className="mb-2 font-display text-xl">Your feed is empty</p>
              <p className="mb-4 text-sm text-muted-foreground">
                Follow an author to start seeing their pieces here.
              </p>
              <Button variant="outline" onClick={() => setTab("discover")}>
                Explore Discover
              </Button>
            </div>
          )}
          {signedIn && initialFollowing && !initialFollowing.empty && (
            <div className="columns-1 gap-4 space-y-4 md:columns-2 xl:columns-3">
              {initialFollowing.pieces.filter((p) => !hiddenPieces.has(p.id)).map((p) => (
                <div key={p.id} className="break-inside-avoid">
                  <PieceCard 
                    p={p} 
                    onHide={(id) => {
                      setHiddenPieces(prev => new Set(prev).add(id))
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="discover" className="space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
              {debouncedQ ? (
                <h2 className="font-display text-xl text-foreground">
                  Search results for &quot;{debouncedQ}&quot;
                </h2>
              ) : (
                <h2 className="font-display text-xl text-foreground">
                  Explore pieces
                </h2>
              )}
              
              {/* Desktop Filters */}
              <div className="hidden md:block">
                {FilterUI}
              </div>
              
              {/* Mobile Filters Popover */}
              <div className="md:hidden">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2">
                      <Filter className="size-3.5" /> Filters
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-56 p-4">
                    {FilterUI}
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {!debouncedQ && discover?.trending && discover.trending.length > 0 && (
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <div className="flex items-center justify-between">
                  <span className="mr-2 text-xs tracking-[0.2em] text-muted-foreground uppercase">
                    Trending
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs md:hidden"
                    onClick={() => setShowTrending(!showTrending)}
                  >
                    {showTrending ? "Hide" : "Show"}
                  </Button>
                </div>

                <div className={`flex-wrap items-center gap-2 ${showTrending ? "flex" : "hidden md:flex"}`}>
                  {tag && (
                    <button
                      onClick={() => setTag(undefined)}
                      className="hairline inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary"
                    >
                      {tag} <X className="size-3" />
                    </button>
                  )}
                  {discover.trending
                    .filter((t) => t.tag !== tag)
                    .map((t) => (
                      <button
                        key={t.tag}
                        onClick={() => setTag(t.tag)}
                        className="hairline rounded-full px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                      >
                        {t.tag}{" "}
                        <span className="ml-1 text-muted-foreground">
                          {t.count}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          {loading && (
            <div className="inline-flex w-full items-center justify-center gap-2 py-16 text-center text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          )}
          {!loading && discover && displayedDiscoverPieces.length === 0 && (
            <div className="hairline rounded-lg p-10 text-center text-muted-foreground">
              No pieces match this criteria yet.
            </div>
          )}
          {!loading && discover && displayedDiscoverPieces.length > 0 && (
            <div className="columns-1 gap-4 space-y-4 md:columns-2 xl:columns-3">
              {displayedDiscoverPieces.map((p) => (
                <div key={p.id} className="break-inside-avoid">
                  <PieceCard 
                    p={p} 
                    onHide={(id) => {
                      setHiddenPieces(prev => new Set(prev).add(id))
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <LoginRequiredDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        title="Sign in to see your Following feed"
        description="Follow authors and we'll surface their newest pieces here."
        redirectTo="/feed"
      />
    </>
  )
}
