/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"
import { Button } from "@/components/ui/button"
import { Users, Rss, Sparkles, BookOpen } from "lucide-react"
import Link from "next/link"
import { ReaderFeed, ReaderFollows } from "@/lib/types/content"

export function ReaderDashboardClient({
  feed,
  follows,
  highlights,
}: {
  feed: ReaderFeed | null
  follows: ReaderFollows | null
  highlights: any[]
}) {
  const followingCount = follows?.following?.length ?? 0
  const recent = (feed?.pieces ?? []).slice(0, 8)

  const kpis = [
    {
      label: "Following",
      value: followingCount,
      icon: Users
    },
    {
      label: "New pieces",
      value: feed?.pieces?.length ?? "—",
      icon: Sparkles,
    }
  ]

  return (
    <div className="mx-auto w-full max-w-350 p-6 md:p-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
            Reader
          </p>
          <h1 className="font-display text-3xl text-foreground">
            Your reading desk
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catch up on the authors you follow, then go discover more.
          </p>
        </div>
        <Button asChild>
          <Link href="/feed">
            <Rss className="mr-2 size-4" /> Open feed
          </Link>
        </Button>
      </div>

      <div className="mb-10 grid grid-cols-2 gap-3">
        {kpis.map((c) => {
          const Icon = c.icon
          return (
            <div key={c.label} className="surface rounded-md p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] tracking-wider text-muted-foreground uppercase">
                  {c.label}
                </p>
                <Icon className="size-3.5 text-muted-foreground" />
              </div>
              <p
                className="font-display text-2xl"
              >
                {c.value}
              </p>
            </div>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-display text-xl text-foreground">
              Latest from your follows
            </h2>
            <Link
              href="/feed"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              See all →
            </Link>
          </div>
          <div className="surface divide-y divide-border rounded-md">
            {feed?.empty && (
              <div className="px-5 py-10 text-center">
                <Sparkles className="mx-auto mb-2 size-5 text-primary" />
                <p className="mb-1 font-display text-lg text-foreground">
                  Your feed is empty
                </p>
                <p className="mb-4 text-sm text-muted-foreground">
                  Follow a few authors to start seeing their pieces here.
                </p>
                <Button variant="outline" asChild>
                  <Link href="/feed">Discover authors</Link>
                </Button>
              </div>
            )}
            {recent.map((p) => (
              <Link
                key={p.id}
                href={`/u/${p.author?.handle ?? "_"}/${p.slug}`}
                className="block px-5 py-3 transition-colors hover:bg-accent/40"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span className="truncate text-foreground">{p.title}</span>
                  {p.author && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      @{p.author.handle}
                    </span>
                  )}
                </div>
                {p.summary && (
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                    {p.summary}
                  </p>
                )}
              </Link>
            ))}
          </div>

          <div className="mt-8 mb-3 flex items-end justify-between">
            <h2 className="font-display text-xl text-foreground">
              Your Highlights & Annotations
            </h2>
          </div>
          <div className="surface divide-y divide-border rounded-md">
            {highlights.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                You haven&apos;t highlighted or annotated anything yet.
              </div>
            )}
            {highlights.map((hl) => {
              const isAnnotation = hl.annotations && hl.annotations.length > 0;
              return (
                <div key={hl.id} className="p-5 transition-colors hover:bg-accent/40">
                  <div className="flex items-center gap-2 mb-2">
                    {isAnnotation ? (
                      <span className="bg-success/50 text-foreground px-1 rounded text-xs">Annotation</span>
                    ) : (
                      <span className="bg-note/50 text-foreground px-1 rounded text-xs">Highlight</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      on <Link href={`/u/${hl.piece?.author?.handle}/${hl.piece?.slug}`} className="hover:underline">{hl.piece?.title || 'Unknown Piece'}</Link>
                    </span>
                  </div>
                  <blockquote className="border-l-2 border-primary/20 pl-3 italic text-muted-foreground text-sm my-2">
                    &quot;{hl.text_content}&quot;
                  </blockquote>
                  {isAnnotation && (
                    <p className="text-sm text-foreground mt-2 font-medium">
                      Note: {hl.annotations[0].note}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl text-foreground">
            You follow
          </h2>
          <div className="surface divide-y divide-border rounded-md">
            {follows?.following?.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                Not following anyone yet.
              </div>
            )}
            {(follows?.following ?? []).slice(0, 8).map((a) =>
              a ? (
                <Link
                  key={a.id}
                  href={`/u/${a.handle}`}
                  className="block px-5 py-3 transition-colors hover:bg-accent/40"
                >
                  <p className="text-sm text-foreground">{a.display_name}</p>
                  <p className="text-xs text-muted-foreground">@{a.handle}</p>
                </Link>
              ) : null
            )}
          </div>
          <div className="surface mt-4 rounded-md p-4">
            <p className="mb-2 inline-flex items-center gap-1 text-xs tracking-wider text-muted-foreground uppercase">
              <BookOpen className="size-3" /> Want to publish?
            </p>
            <p className="mb-3 text-sm text-foreground">
              Switch on author mode any time from Settings.
            </p>
            <Button size="sm" variant="outline" asChild>
              <Link href="/studio/settings">Open settings</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
