"use client"
import { getAuthorGraph } from "@/actions/debate"
import { MembershipTiers } from "@/components/membership-tiers"
import { RelationshipGraph } from "@/components/relationship-graph"
import { FollowButton } from "@/components/follow-button"
import { SubscribeDialog } from "@/components/subscribe-dialog"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { SubscribeCard } from "@/components/reader/subscribe-card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useEffect, useMemo, useState } from "react"
import { Search, FileText, Crown, Network, X, UserPlus, Share, Library } from "lucide-react"
import Link from "next/link"
import { Piece, TierItem } from "@/lib/types/content"
import Image from "next/image"
import { toast } from "sonner"
import {
  getFollowStatus,
} from "@/actions/social"
import { Button } from "@/components/ui/button"
import { formatCompactNumber } from "@/lib/utils"
import { flairClass } from "@/lib/flair"

export default function AuthorClient({
  author,
  pieces,
  tiers,
  paymentsOpen,
  collections = [],
  recommendations,
}: {
  author: {
    id: string
    handle: string
    display_name: string
    bio: string | null
    avatar_url: string | null
    flair?: string | null
  }
  pieces: Piece[]
  tiers: TierItem[]
  paymentsOpen: boolean
  collections?: Array<{ id: string; title: string; description: string | null }>
  recommendations: Array<{
    id: string
    blurb: string | null
    profiles: {
      display_name: string
      handle: string
      avatar_url: string | null
    }
  }>
}) {
  const [graph, setGraph] = useState<{
    pieces: Array<{ id: string; title: string; slug: string }>
    branches: Array<{
      id: string
      parent_object_id: string
      branch_type: string
      purpose: string | null
      summary: string | null
    }>
    relationships: Array<{
      id: string
      from_object_id: string
      to_object_id: string
      type: string
    }>
  } | null>(null)

  const getFollowStatusFn = getFollowStatus

  const [query, setQuery] = useState("")
  const { user } = useAuth()
  const router = useRouter()
  const [subscribeOpen, setSubscribeOpen] = useState(false)
  const canSubscribe = paymentsOpen && user?.id !== author.id && tiers.some((t) => t.price_cents > 0)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [followers, setFollowers] = useState<number | null>(null)

  useEffect(() => {
    getAuthorGraph({ data: { author_id: author.id } })
      .then(setGraph)
      .catch(() => setGraph(null))
  }, [author.id])

  useEffect(() => {
    getFollowStatusFn({ data: { author_id: author.id } })
      .then((r) => setFollowers(r.followers))
      .catch(() => { })
  }, [author.id, getFollowStatusFn])

  const allTags = useMemo(() => {
    const s = new Set<string>()
    for (const p of pieces) for (const t of p.tags ?? []) s.add(t)
    return Array.from(s)
  }, [pieces])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return pieces.filter((p) => {
      if (activeTag && !(p.tags ?? []).includes(activeTag)) return false
      if (!q) return true
      return (
        p.title.toLowerCase().includes(q) ||
        (p.summary ?? "").toLowerCase().includes(q) ||
        (p.tags ?? []).some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [pieces, query, activeTag])

  const initials = author.display_name
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="container-wide max-w-4xl flex-1 pt-16 pb-16 md:pt-24">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Avatar className="size-20 border border-border">
              {author.avatar_url && (
                <AvatarImage src={author.avatar_url} alt={author.display_name} />
              )}
              <AvatarFallback className="font-display text-xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
                @{author.handle}
              </p>
              <h1 className={`mt-1 font-display text-4xl md:text-5xl ${flairClass(author.flair) || "text-foreground"}`}>
                {author.display_name}
              </h1>
              {author.bio && (
                <p className="mt-3 max-w-2xl text-lg leading-relaxed text-foreground/80">
                  {author.bio}
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-x-8 gap-y-4 text-sm text-muted-foreground shrink-0 items-center">
            <div className="flex flex-col gap-3 justify-center">
              <div className="flex items-center gap-2 h-9">
                <span className="font-display text-xl text-foreground w-6 text-right leading-none">
                  {formatCompactNumber(pieces.length)}
                </span>
                <span className="leading-none">{pieces.length === 1 ? "piece" : "pieces"}</span>
              </div>
              <div className="flex items-center gap-2 h-9">
                <span className="font-display text-xl text-foreground w-6 text-right leading-none">
                  {formatCompactNumber(tiers.length)}
                </span>
                <span className="leading-none">{tiers.length === 1 ? "tier" : "tiers"}</span>
              </div>
            </div>
            <div className="flex flex-col gap-3 justify-center">
              <div className="flex items-center gap-2 h-9">
                <span className="font-display text-xl text-foreground w-8 text-right leading-none">
                  {formatCompactNumber(allTags.length)}
                </span>
                <span className="leading-none">{allTags.length === 1 ? "topic" : "topics"}</span>
              </div>
              <div className="flex items-center gap-2 h-9">
                <span className="font-display text-xl text-foreground w-8 text-right leading-none">
                  {formatCompactNumber(followers ?? 0)}
                </span>
                <span className="leading-none">{followers === 1 ? "follower" : "followers"}</span>
              </div>
            </div>
            <div className="flex flex-col gap-3 justify-center">
              <FollowButton
                authorId={author.id}
                authorHandle={author.handle}
                onFollowChange={(_isFollowing, count) => setFollowers(count)}
                className="w-full h-9"
              />
              {canSubscribe && (
                <>
                  <Button
                    className="w-full h-9"
                    onClick={() => (user ? setSubscribeOpen(true) : router.push("/login"))}
                  >
                    <Crown className="mr-2 size-4" aria-hidden />
                    Become a member
                  </Button>
                  <SubscribeDialog
                    open={subscribeOpen}
                    onOpenChange={setSubscribeOpen}
                    authorId={author.id}
                    authorName={author.display_name || author.handle}
                  />
                </>
              )}
              <Button 
                variant="outline" 
                className="w-full text-sm h-9"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: `${author.display_name} on Nib`,
                      url: window.location.href,
                    }).catch(() => {})
                  } else {
                    navigator.clipboard.writeText(window.location.href)
                    toast.success("Profile link copied!")
                  }
                }}
              >
                <Share className="mr-2 size-3.5" /> Share
              </Button>
            </div>
          </div>
        </header>

        <SubscribeCard authorId={author.id} authorName={author.display_name} />

        <Tabs defaultValue="pieces" className="mt-12">
          <TabsList>
            <TabsTrigger value="pieces">
              <FileText className="mr-1 size-3.5" /> Pieces
            </TabsTrigger>
            {tiers.length > 0 && (
              <TabsTrigger value="tiers">
                <Crown className="mr-1 size-3.5" /> Memberships
              </TabsTrigger>
            )}
            {collections.length > 0 && (
              <TabsTrigger value="collections">
                <Library className="mr-1 size-3.5" /> Collections
              </TabsTrigger>
            )}
            {graph && graph.pieces.length > 0 && (
              <TabsTrigger value="graph">
                <Network className="mr-1 size-3.5" /> Graph
              </TabsTrigger>
            )}
            {recommendations && recommendations.length > 0 && (
              <TabsTrigger value="network">
                <UserPlus className="mr-1 size-3.5" /> Network
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="pieces" className="mt-6">
            {pieces.length > 0 && (
              <div className="mb-5 space-y-3">
                <div className="relative max-w-md">
                  <Search
                    className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <label htmlFor="author-search" className="sr-only">
                    Search pieces
                  </label>
                  <Input
                    id="author-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search title, summary, tags..."
                    className="pr-9 pl-9"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      aria-label="Clear search"
                      className="absolute top-1/2 right-2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
                {allTags.length > 0 && (
                  <div
                    className="no-scrollbar flex max-h-35 flex-wrap gap-1.5 overflow-y-auto pb-1"
                    role="group"
                    aria-label="Filter by tag"
                  >
                    <button
                      type="button"
                      onClick={() => setActiveTag(null)}
                      aria-pressed={activeTag === null}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${activeTag === null
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      All
                    </button>
                    {allTags.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setActiveTag(activeTag === t ? null : t)}
                        aria-pressed={activeTag === t}
                        className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${activeTag === t
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground"
                          }`}
                      >
                        #{t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="surface divide-y divide-border rounded-md">
              {filtered.map((p) => (
                <Link
                  key={p.id}
                  href={`/u/${author.handle}/${p.slug}`}
                  className="group block px-5 py-4 transition-colors hover:bg-accent/40"
                >
                  <div className="flex flex-wrap items-baseline gap-3">
                    <p className="font-display text-lg text-foreground group-hover:text-primary">
                      {p.title}
                    </p>
                    {p.published_at && (
                      <time className="text-[11px] tracking-wider text-muted-foreground uppercase">
                        {new Date(p.published_at).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </time>
                    )}
                  </div>
                  {p.summary && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {p.summary}
                    </p>
                  )}
                  {p.tags && p.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.tags.slice(0, 4).map((t) => (
                        <span
                          key={t}
                          className="text-[10px] tracking-wider text-muted-foreground uppercase"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
              {pieces.length === 0 && (
                <p className="px-5 py-12 text-center text-sm text-muted-foreground">
                  Nothing published yet.
                </p>
              )}
              {pieces.length > 0 && filtered.length === 0 && (
                <p className="px-5 py-12 text-center text-sm text-muted-foreground">
                  No pieces match your filters.
                </p>
              )}
            </div>
          </TabsContent>

          {tiers.length > 0 && (
            <TabsContent value="tiers" className="mt-2">
              <MembershipTiers tiers={tiers} authorId={author.id} authorName={author.display_name} paymentsOpen={paymentsOpen} />
            </TabsContent>
          )}

          {collections.length > 0 && (
            <TabsContent value="collections" className="mt-6">
              <div className="grid gap-4 md:grid-cols-2">
                {collections.map((c) => (
                  <Link
                    key={c.id}
                    href={`/collections/${c.id}`}
                    className="rounded-xl border bg-background p-4 shadow-sm transition-colors hover:bg-accent/40"
                  >
                    <div className="font-semibold text-foreground">{c.title}</div>
                    {c.description && (
                      <div className="mt-1 text-sm text-muted-foreground">{c.description}</div>
                    )}
                  </Link>
                ))}
              </div>
            </TabsContent>
          )}

          {graph && graph.pieces.length > 0 && (
            <TabsContent value="graph" className="mt-6">
              <h2 className="mb-4 font-display text-xl text-foreground">
                Knowledge graph
              </h2>
              <RelationshipGraph
                handle={author.handle}
                pieces={graph.pieces}
                branches={graph.branches}
                relationships={graph.relationships}
              />
            </TabsContent>
          )}

          {recommendations && recommendations.length > 0 && (
            <TabsContent value="network" className="mt-6">
              <h2 className="mb-4 font-display text-xl text-foreground">
                Creator Network
              </h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Creators endorsed by {author.display_name}.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {recommendations.map((r) => (
                  <Link
                    key={r.id}
                    href={`/u/${r.profiles.handle}`}
                    className="flex items-start gap-3 rounded-xl border bg-background p-4 shadow-sm transition-colors hover:bg-accent/40"
                  >
                    {r.profiles.avatar_url ? (
                      <Image
                        src={r.profiles.avatar_url}
                        className="size-12 rounded-full border border-border"
                        alt=""
                      />
                    ) : (
                      <div className="size-12 rounded-full border border-border bg-muted" />
                    )}
                    <div>
                      <div className="font-semibold text-foreground">
                        {r.profiles.display_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        @{r.profiles.handle}
                      </div>
                      {r.blurb && (
                        <div className="mt-2 text-sm text-muted-foreground italic">
                          &quot;{r.blurb}&quot;
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  )
}
