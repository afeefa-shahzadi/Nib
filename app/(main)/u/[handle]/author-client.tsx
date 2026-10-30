"use client"
import { getAuthorGraph } from "@/actions/debate"
import { MembershipTiers } from "@/components/membership-tiers"
import { RelationshipGraph } from "@/components/relationship-graph"
import { FollowButton } from "@/components/follow-button"
import { SubscribeDialog } from "@/components/subscribe-dialog"
import { SubscribeCard } from "@/components/reader/subscribe-card"
import { PieceRow } from "@/components/piece-row"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useEffect, useMemo, useState } from "react"
import { Crown, Globe, Rss, Search, Share, X } from "lucide-react"
import Link from "next/link"
import { Piece, TierItem } from "@/lib/types/content"
import { toast } from "sonner"
import { cn, formatCompactNumber } from "@/lib/utils"
import { flairClass } from "@/lib/flair"
import { linkLabel } from "@/lib/profile-links"
import { LinkIcon } from "@/components/brand/link-icon"


type Graph = {
  pieces: Array<{ id: string; title: string; slug: string }>
  branches: Array<{ id: string; parent_object_id: string; branch_type: string; purpose: string | null; summary: string | null }>
  relationships: Array<{ id: string; from_object_id: string; to_object_id: string; type: string }>
}

const TAGS_COLLAPSED = 8
const PAGE = 20

function ShowMore({ total, shown, onMore }: { total: number; shown: number; onMore: () => void }) {
  if (shown >= total) return null
  return (
    <div className="mt-8 flex flex-col items-center gap-2">
      <Button variant="outline" onClick={onMore}>Show more</Button>
      <p className="text-sm text-muted-foreground">Showing {shown} of {total}</p>
    </div>
  )
}

export default function AuthorClient({
  author,
  pieces,
  tiers,
  followers: initialFollowers,
  following,
  paymentsOpen,
  collections = [],
  bundles = [],
  clapped = [],
  recommendations,
}: {
  author: {
    id: string
    handle: string
    display_name: string
    bio: string | null
    avatar_url: string | null
    flair?: string | null
    created_at?: string | null
    website?: string | null
    links?: string[] | null
    pinned_piece_id?: string | null
    birthday?: string | null
  }
  pieces: Piece[]
  tiers: TierItem[]
  followers: number
  following: number
  paymentsOpen: boolean
  collections?: Array<{ id: string; title: string; description: string | null }>
  bundles?: Array<{ id: string; title: string; outcome_statement: string | null; price: number; item_count: number }>
  clapped?: Piece[]
  recommendations: Array<{
    id: string
    blurb: string | null
    profiles: { display_name: string; handle: string; avatar_url: string | null }
  }>
}) {
  const { user } = useAuth()
  const router = useRouter()
  const [graph, setGraph] = useState<Graph | null>(null)
  const [followers, setFollowers] = useState(initialFollowers)
  const [subscribeOpen, setSubscribeOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [sort, setSort] = useState<"newest" | "oldest">("newest")
  const [allTagsOpen, setAllTagsOpen] = useState(false)
  const canSubscribe = paymentsOpen && user?.id !== author.id && tiers.some((t) => t.price_cents > 0)

  useEffect(() => {
    getAuthorGraph({ data: { author_id: author.id } })
      .then(setGraph)
      .catch(() => setGraph(null))
  }, [author.id])

  // Topics with counts, most used first.
  const tags = useMemo(() => {
    const n = new Map<string, number>()
    for (const p of pieces) for (const t of p.tags ?? []) n.set(t, (n.get(t) ?? 0) + 1)
    return [...n.entries()].sort((a, b) => b[1] - a[1])
  }, [pieces])

  const pinned = pieces.find((p) => p.id === author.pinned_piece_id) ?? null
  const filtering = !!(query.trim() || activeTag)

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const out = pieces.filter((p) => {
      if (!filtering && p.id === pinned?.id) return false
      if (activeTag && !(p.tags ?? []).includes(activeTag)) return false
      if (!q) return true
      return (
        p.title.toLowerCase().includes(q) ||
        (p.summary ?? "").toLowerCase().includes(q) ||
        (p.tags ?? []).some((t) => t.toLowerCase().includes(q))
      )
    })
    return sort === "oldest" ? [...out].reverse() : out
  }, [pieces, query, activeTag, sort, filtering, pinned])

  // Paging restarts whenever the search, topic or sort changes.
  const pageKey = `${query}|${activeTag}|${sort}`
  const [more, setMore] = useState({ key: pageKey, n: PAGE })
  const shown = more.key === pageKey ? more.n : PAGE
  const [shownCollections, setShownCollections] = useState(PAGE)
  const [shownClapped, setShownClapped] = useState(PAGE)

  const initials = author.display_name.split(/\s+/).map((n) => n[0]).join("").slice(0, 2).toUpperCase()
  const joined = author.created_at
    ? new Date(author.created_at).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })
    : null
  const links = author.links ?? []

  const share = () => {
    const url = window.location.href
    if (navigator.share) navigator.share({ title: `${author.display_name} on Nib`, url }).catch(() => {})
    else navigator.clipboard.writeText(url).then(() => toast.success("Profile link copied"))
  }

  const shownTags = allTagsOpen ? tags : tags.slice(0, TAGS_COLLAPSED)
  const chip = (label: string, active: boolean, onClick: () => void, count?: number) => (
    <button
      key={label}
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

  return (
    <main className="container-wide grid items-start gap-10 pt-16 pb-16 md:pt-24 md:pb-24 lg:grid-cols-12 lg:gap-12">
      {/* Who this is: stays in view on desktop while the work scrolls. */}
      <aside className="lg:sticky lg:top-24 lg:col-span-4">
        <Avatar className="size-24 border border-border">
          {author.avatar_url && <AvatarImage src={author.avatar_url} alt="" />}
          <AvatarFallback className="font-display text-2xl">{initials}</AvatarFallback>
        </Avatar>
        <h1 className={cn("mt-5 font-display text-4xl leading-[1.05]", flairClass(author.flair) || "text-foreground")}>
          {author.display_name}
        </h1>
        <p className="mt-2 text-muted-foreground">
          @{author.handle}
          {joined && <> · Joined {joined}</>}
          {author.birthday && <> · Birthday {author.birthday}</>}
        </p>
        {author.bio && <p className="mt-4 text-lg leading-relaxed text-foreground/85">{author.bio}</p>}

        <p className="mt-5 text-sm">
          <span className="font-medium tabular-nums">{formatCompactNumber(pieces.length)}</span>
          <span className="text-muted-foreground"> {pieces.length === 1 ? "piece" : "pieces"} · </span>
          <span className="font-medium tabular-nums">{formatCompactNumber(followers)}</span>
          <span className="text-muted-foreground"> {followers === 1 ? "follower" : "followers"} · </span>
          <span className="font-medium tabular-nums">{formatCompactNumber(following)}</span>
          <span className="text-muted-foreground"> following</span>
        </p>

        <ul className="mt-4 flex flex-wrap gap-x-5">
            {[author.website, ...links].filter(Boolean).map((url, i) => (
              <li key={url}>
                <a
                  href={url!}
                  target="_blank"
                  rel="noopener noreferrer me"
                  className="-my-1 inline-flex min-h-11 items-center gap-2 py-1 text-sm text-primary hover:underline hover:underline-offset-4 lg:min-h-8"
                >
                  {(() => {
                    if (i === 0 && author.website) return <Globe className="size-4" aria-hidden />
                    return <LinkIcon url={url!} />
                  })()}
                  {i === 0 && author.website ? new URL(url!).hostname.replace(/^www\./, "") : linkLabel(url!)}
                </a>
              </li>
            ))}
          <li>
            <a
              href={`/u/${author.handle}/feed.xml`}
              className="-my-1 inline-flex min-h-11 items-center gap-2 py-1 text-sm text-muted-foreground hover:text-foreground lg:min-h-8"
            >
              <Rss className="size-4" aria-hidden />
              RSS
            </a>
          </li>
        </ul>

        <div className="mt-6 flex gap-2">
          <FollowButton
            authorId={author.id}
            authorHandle={author.handle}
            onFollowChange={(_isFollowing, count) => setFollowers(count)}
            className="flex-1"
          />
          {canSubscribe && (
            <Button className="flex-1" onClick={() => (user ? setSubscribeOpen(true) : router.push("/login"))}>
              <Crown className="size-4" aria-hidden />
              Become a member
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={share} aria-label="Share profile">
            <Share className="size-4" aria-hidden />
          </Button>
        </div>
        {canSubscribe && (
          <SubscribeDialog
            open={subscribeOpen}
            onOpenChange={setSubscribeOpen}
            authorId={author.id}
            authorName={author.display_name || author.handle}
          />
        )}

        <div className="mt-8">
          <SubscribeCard compact authorId={author.id} authorName={author.display_name} />
        </div>
      </aside>

      <div className="min-w-0 lg:col-span-8">
        <Tabs defaultValue="pieces">
          <div className="-mx-5 overflow-x-auto px-5 no-scrollbar sm:mx-0 sm:px-0">
            <TabsList>
              <TabsTrigger value="pieces">Pieces</TabsTrigger>
              {tiers.length > 0 && <TabsTrigger value="tiers">Memberships</TabsTrigger>}
              {bundles.length > 0 && <TabsTrigger value="bundles">Bundles</TabsTrigger>}
              {collections.length > 0 && <TabsTrigger value="collections">Collections</TabsTrigger>}
              {clapped.length > 0 && <TabsTrigger value="clapped">Clapped</TabsTrigger>}
              {graph && graph.pieces.length > 0 && <TabsTrigger value="graph">Graph</TabsTrigger>}
              {recommendations?.length > 0 && <TabsTrigger value="network">Recommends</TabsTrigger>}
            </TabsList>
          </div>

          <TabsContent value="pieces" className="mt-6">
            {pieces.length > 0 && (
              <div className="mb-4 space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input
                      type="search"
                      aria-label={`Search ${author.display_name}'s pieces`}
                      placeholder="Search pieces"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={sort} onValueChange={(v) => setSort(v as "newest" | "oldest")}>
                    <SelectTrigger aria-label="Sort pieces" className="w-36 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest first</SelectItem>
                      <SelectItem value="oldest">Oldest first</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {tags.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto no-scrollbar sm:flex-wrap sm:overflow-visible" role="group" aria-label="Filter by topic">
                    {activeTag && !shownTags.some(([t]) => t === activeTag) && chip(activeTag, true, () => setActiveTag(null))}
                    {shownTags.map(([t, n]) => chip(t, activeTag === t, () => setActiveTag(activeTag === t ? null : t), n))}
                    {tags.length > TAGS_COLLAPSED && (
                      <Button variant="ghost" className="hidden shrink-0 sm:inline-flex lg:h-8" onClick={() => setAllTagsOpen(!allTagsOpen)}>
                        {allTagsOpen ? "Fewer" : `${tags.length - TAGS_COLLAPSED} more`}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {pieces.length === 0 ? (
              <p className="hairline-t hairline-b py-12 text-muted-foreground">Nothing published yet.</p>
            ) : list.length === 0 && !(pinned && !filtering) ? (
              <p className="hairline-t hairline-b py-12 text-muted-foreground">No pieces match.</p>
            ) : (
              <>
                <ul>
                  {pinned && !filtering && <PieceRow p={pinned} pinned />}
                  {list.slice(0, shown).map((p) => (
                    <PieceRow key={p.id} p={p} />
                  ))}
                </ul>
                <ShowMore total={list.length} shown={shown} onMore={() => setMore({ key: pageKey, n: shown + PAGE })} />
              </>
            )}
          </TabsContent>

          {tiers.length > 0 && (
            <TabsContent value="tiers" className="mt-6">
              <MembershipTiers tiers={tiers} authorId={author.id} authorName={author.display_name} paymentsOpen={paymentsOpen} />
            </TabsContent>
          )}

          {bundles.length > 0 && (
            <TabsContent value="bundles" className="mt-6">
              <ul>
                {bundles.map((b) => (
                  <li key={b.id} className="hairline-t last:hairline-b">
                    <Link href={`/u/${author.handle}/bundles/${b.id}`} className="group block py-6">
                      <h2 className="font-display text-xl leading-snug group-hover:text-primary">{b.title}</h2>
                      {b.outcome_statement && <p className="mt-1 text-muted-foreground">{b.outcome_statement}</p>}
                      <p className="mt-2 text-sm text-muted-foreground">
                        {b.item_count} {b.item_count === 1 ? "piece" : "pieces"} ·{" "}
                        {b.price > 0 ? `₹${(b.price / 100).toLocaleString("en-IN")}` : "Free"}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </TabsContent>
          )}

          {collections.length > 0 && (
            <TabsContent value="collections" className="mt-6">
              <ul>
                {collections.slice(0, shownCollections).map((c) => (
                  <li key={c.id} className="hairline-t last:hairline-b">
                    <Link href={`/collections/${c.id}`} className="group block py-6">
                      <h2 className="font-display text-xl leading-snug group-hover:text-primary">{c.title}</h2>
                      {c.description && <p className="mt-1 text-muted-foreground">{c.description}</p>}
                    </Link>
                  </li>
                ))}
              </ul>
              <ShowMore total={collections.length} shown={shownCollections} onMore={() => setShownCollections(shownCollections + PAGE)} />
            </TabsContent>
          )}

          {clapped.length > 0 && (
            <TabsContent value="clapped" className="mt-6">
              <ul>
                {clapped.slice(0, shownClapped).map((p) => (
                  <PieceRow key={p.id} p={p} />
                ))}
              </ul>
              <ShowMore total={clapped.length} shown={shownClapped} onMore={() => setShownClapped(shownClapped + PAGE)} />
            </TabsContent>
          )}

          {graph && graph.pieces.length > 0 && (
            <TabsContent value="graph" className="mt-6">
              <p className="mb-4 text-muted-foreground">How {author.display_name}&apos;s pieces connect and branch.</p>
              <RelationshipGraph
                handle={author.handle}
                pieces={graph.pieces}
                branches={graph.branches}
                relationships={graph.relationships}
              />
            </TabsContent>
          )}

          {recommendations?.length > 0 && (
            <TabsContent value="network" className="mt-6">
              <p className="mb-4 text-muted-foreground">Writers {author.display_name} recommends.</p>
              <ul>
                {recommendations.map((r) => (
                  <li key={r.id} className="hairline-t last:hairline-b">
                    <Link href={`/u/${r.profiles.handle}`} className="group flex items-start gap-3 py-5">
                      <Avatar className="size-10">
                        {r.profiles.avatar_url && <AvatarImage src={r.profiles.avatar_url} alt="" />}
                        <AvatarFallback>{r.profiles.display_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0">
                        <span className="block font-medium group-hover:text-primary">{r.profiles.display_name}</span>
                        <span className="block text-sm text-muted-foreground">@{r.profiles.handle}</span>
                        {r.blurb && <span className="mt-2 block text-muted-foreground">“{r.blurb}”</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </main>
  )
}
