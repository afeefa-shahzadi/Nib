"use client"

import { useEffect, useState } from "react"
import { getDiscoverFeed } from "@/actions/social"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Spinner } from "@/components/ui/spinner"
import { LoginRequiredDialog } from "@/components/login-required-dialog"
import { X } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { Piece } from "@/lib/types/content"
import { cn } from "@/lib/utils"

type Discover = { pieces: Piece[]; trending: { tag: string; count: number }[] }

const date = (iso: string) =>
  // Pinned locale + UTC keeps SSR and client output identical.
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })

function PieceRow({ p }: { p: Piece }) {
  const a = p.author
  return (
    <li className="hairline-t last:hairline-b">
      <Link href={`/u/${a?.handle ?? "_"}/${p.slug}`} className="group flex gap-5 py-6">
        <article className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {a && (
              <span className="inline-flex items-center gap-2 text-foreground">
                <Avatar className="size-6">
                  {a.avatar_url && <AvatarImage src={a.avatar_url} alt="" />}
                  <AvatarFallback className="text-xs">{a.display_name.charAt(0)}</AvatarFallback>
                </Avatar>
                {a.display_name}
              </span>
            )}
            {p.published_at && <span>· {date(p.published_at)}</span>}
            {p.boosted && <span className="rounded-sm bg-muted px-1.5 text-xs">Promoted</span>}
          </div>
          <h2 className="mt-2 font-display text-xl leading-snug group-hover:text-primary">{p.title}</h2>
          {p.summary && <p className="mt-1 line-clamp-2 text-muted-foreground">{p.summary}</p>}
          {p.tags && p.tags.length > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">{p.tags.slice(0, 3).join(" · ")}</p>
          )}
        </article>
        {p.cover_image_url && (
          <Image
            src={p.cover_image_url}
            alt=""
            width={128}
            height={128}
            unoptimized={!p.cover_image_url.includes("supabase.co")}
            className="size-20 shrink-0 rounded-md border border-border object-cover sm:size-28"
          />
        )}
      </Link>
    </li>
  )
}

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
  const [tab, setTab] = useState<"following" | "discover">(signedIn ? "following" : "discover")
  const [tag, setTag] = useState<string | undefined>(undefined)
  const [tagged, setTagged] = useState<Discover | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)

  useEffect(() => {
    if (!tag) return
    let live = true
    getDiscoverFeed({ data: { tag } }).then((r) => live && setTagged(r as Discover))
    return () => {
      live = false
    }
  }, [tag])

  const pickTag = (t?: string) => {
    setTagged(null)
    setTag(t)
  }
  const loading = !!tag && !tagged
  const pieces = (tag ? tagged?.pieces : initialDiscover.pieces) ?? []
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
          <TabsTrigger value="following">Following</TabsTrigger>
          <TabsTrigger value="discover">Discover</TabsTrigger>
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
              {topics && <div className="mb-6 lg:hidden">{topics}</div>}
              {loading ? (
                <div className="flex justify-center py-16" role="status" aria-label="Loading">
                  <Spinner />
                </div>
              ) : pieces.length === 0 ? (
                <p className="hairline-t hairline-b py-12 text-muted-foreground">
                  No pieces {tag ? `tagged “${tag}”` : "published"} yet.
                </p>
              ) : (
                <ul>
                  {pieces.map((p) => (
                    <PieceRow key={p.id} p={p} />
                  ))}
                </ul>
              )}
            </TabsContent>
          </div>

          {tab === "discover" && topics && (
            <aside className="hidden lg:sticky lg:top-24 lg:col-span-4 lg:block">
              <h2 className="text-sm font-medium">Trending topics</h2>
              <div className="mt-3">{topics}</div>
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
