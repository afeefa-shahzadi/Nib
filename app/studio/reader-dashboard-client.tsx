/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Users, Rss, Sparkles, BookOpen } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
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
  const [allHighlights, setAllHighlights] = useState(false)
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
    <div className="mx-auto w-full max-w-350 px-4 py-6 sm:px-6 md:px-8 md:py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-foreground">
            Your reading desk
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catch up on the authors you follow, then go discover more.
          </p>
        </div>
        <Button className="min-h-11" asChild>
          <Link href="/feed">
            <Rss className="size-4" aria-hidden /> Open feed
          </Link>
        </Button>
      </div>

      <div className="mb-10 grid grid-cols-2 gap-3">
        {kpis.map((c) => {
          const Icon = c.icon
          return (
            <div key={c.label} className="surface flex flex-col gap-2 rounded-lg p-4">
              <p className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                {c.label}
                <Icon className="size-4 shrink-0" aria-hidden />
              </p>
              <p className="font-display text-2xl tabular-nums">
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
              className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground"
            >
              See all
            </Link>
          </div>
          <div className="surface divide-y divide-border rounded-lg">
            {feed?.empty && (
              <div className="px-5 py-10 text-center">
                <Sparkles className="mx-auto mb-2 size-5 text-primary" />
                <p className="mb-1 font-display text-lg text-foreground">
                  Your feed is empty
                </p>
                <p className="mb-4 text-sm text-muted-foreground">
                  Follow a few authors to start seeing their pieces here.
                </p>
                <Button variant="outline" className="min-h-11" asChild>
                  <Link href="/feed">Discover authors</Link>
                </Button>
              </div>
            )}
            {recent.map((p) => (
              <Link
                key={p.id}
                href={`/u/${p.author?.handle ?? "_"}/${p.slug}`}
                className="block min-h-12 px-4 py-3 transition-colors hover:bg-accent/40"
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
                  <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                    {p.summary}
                  </p>
                )}
              </Link>
            ))}
          </div>

          <div className="mt-8 mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl text-foreground">
              Your highlights and notes
            </h2>
            {highlights.length > 5 && (
              <button
                type="button"
                onClick={() => setAllHighlights((v) => !v)}
                className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground"
              >
                {allHighlights ? "Show fewer" : `Show all ${highlights.length}`}
              </button>
            )}
          </div>
          <div className="surface divide-y divide-border rounded-lg">
            {highlights.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                You haven&apos;t highlighted or annotated anything yet.
              </div>
            )}
            {(allHighlights ? highlights : highlights.slice(0, 5)).map((hl) => {
              const isAnnotation = hl.annotations && hl.annotations.length > 0;
              return (
                <div key={hl.id} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {isAnnotation ? (
                      <Badge variant="secondary" className="font-normal">Note</Badge>
                    ) : (
                      <Badge variant="outline" className="font-normal">Highlight</Badge>
                    )}
                    <span className="min-w-0 truncate text-sm text-muted-foreground">
                      on <Link href={`/u/${hl.piece?.author?.handle}/${hl.piece?.slug}`} className="hover:underline">{hl.piece?.title || 'Untitled piece'}</Link>
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
          <h2 className="mb-3 flex min-h-11 items-center font-display text-xl text-foreground">
            You follow
          </h2>
          <div className="surface divide-y divide-border rounded-lg">
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
                  className="block min-h-12 px-4 py-3 transition-colors hover:bg-accent/40"
                >
                  <p className="text-sm text-foreground">{a.display_name}</p>
                  <p className="text-sm text-muted-foreground">@{a.handle}</p>
                </Link>
              ) : null
            )}
          </div>
          <div className="surface mt-4 rounded-lg p-4">
            <p className="mb-1 inline-flex items-center gap-2 font-medium text-foreground">
              <BookOpen className="size-4 text-muted-foreground" aria-hidden /> Want to publish?
            </p>
            <p className="mb-3 text-sm text-muted-foreground">
              Switch on author mode any time from Settings.
            </p>
            <Button variant="outline" className="min-h-11" asChild>
              <Link href="/studio/settings#writing">Turn on author mode</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
