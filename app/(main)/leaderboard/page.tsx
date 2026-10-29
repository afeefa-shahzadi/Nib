/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { CurrencySelector } from "@/components/currency-selector"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useCurrency, formatPaiseMarket } from "@/lib/currency"
import { useMyPlan } from "@/hooks/use-my-plan"
import { authorLeaderboard, readerLeaderboard } from "@/actions/leaderboard"
import { ArrowDown, ArrowUp, Search, Trophy } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

type Timeframe = "all" | "month"
type SortDir = "asc" | "desc"

type Col<T> = {
  key: keyof T & string
  label: string
  numeric?: boolean
  render?: (row: T) => React.ReactNode
}

function SortableTable<
  T extends {
    userId: string
    handle: string | null
    displayName: string
    avatarUrl: string | null
  },
>({
  rows,
  columns,
  defaultSort,
  query,
}: {
  rows: T[]
  columns: Col<T>[]
  defaultSort: keyof T & string
  query: string
}) {
  const [sortKey, setSortKey] = useState<string>(defaultSort)
  const [dir, setDir] = useState<SortDir>("desc")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q
      ? rows.filter(
          (r) =>
            r.displayName.toLowerCase().includes(q) ||
            (r.handle ?? "").toLowerCase().includes(q)
        )
      : rows
    const k = sortKey as keyof T
    const sorted = [...base].sort((a, b) => {
      const av = a[k] as any as number | string
      const bv = b[k] as any as number | string
      if (typeof av === "number" && typeof bv === "number")
        return dir === "asc" ? av - bv : bv - av
      return dir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
    return sorted
  }, [rows, query, sortKey, dir])

  const toggle = (k: string) => {
    if (k === sortKey) setDir(dir === "asc" ? "desc" : "asc")
    else {
      setSortKey(k)
      setDir("desc")
    }
  }

  return (
    <div className="surface overflow-hidden rounded-xl border border-border/60">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs tracking-wider text-muted-foreground uppercase">
            <tr>
              <th className="w-12 px-3 py-3 text-left">#</th>
              <th className="px-3 py-3 text-left">Member</th>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`px-3 py-3 ${c.numeric ? "text-right" : "text-left"}`}
                >
                  <button
                    onClick={() => toggle(c.key)}
                    className="inline-flex items-center gap-1 transition hover:text-foreground"
                  >
                    {c.label}
                    {sortKey === c.key &&
                      (dir === "asc" ? (
                        <ArrowUp className="size-3" />
                      ) : (
                        <ArrowDown className="size-3" />
                      ))}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 2}
                  className="py-10 text-center text-muted-foreground"
                >
                  No results.
                </td>
              </tr>
            ) : (
              filtered.slice(0, 100).map((row, i) => (
                <tr
                  key={row.userId}
                  className="hairline-t transition hover:bg-muted/20"
                >
                  <td className="px-3 py-3 font-display text-muted-foreground tabular-nums">
                    {i + 1}
                  </td>
                  <td className="px-3 py-3">
                    {row.handle ? (
                      <Link
                        href={`/u/${row.handle}`}
                        className="flex min-w-0 items-center gap-2 hover:text-primary"
                      >
                        {row.avatarUrl ? (
                          <Image
                            src={row.avatarUrl}
                            alt=""
                            width={28}
                            height={28}
                            className="size-7 rounded-full object-cover"
                          />
                        ) : (
                          <Initials name={row.displayName} />
                        )}
                        <span className="truncate">
                          <span className="block truncate font-medium text-foreground">
                            {row.displayName}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            @{row.handle}
                          </span>
                        </span>
                      </Link>
                    ) : (
                      <span className="flex min-w-0 items-center gap-2">
                        <Initials name={row.displayName} />
                        <span className="truncate text-muted-foreground">
                          {row.displayName}
                        </span>
                      </span>
                    )}
                  </td>
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-3 py-3 tabular-nums ${c.numeric ? "text-right" : "text-left"}`}
                    >
                      {c.render
                        ? c.render(row)
                        : String(row[c.key as keyof T] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {filtered.length > 100 && (
        <div className="hairline-t px-3 py-2 text-xs text-muted-foreground">
          Showing top 100 of {filtered.length}.
        </div>
      )}
    </div>
  )
}

export default function LeaderboardPage() {
  const { code } = useCurrency()
  const { launchFree } = useMyPlan()
  const [timeframe, setTimeframe] = useState<Timeframe>("all")
  const [query, setQuery] = useState("")
  const [audience, setAudience] = useState<"author" | "reader">("author")

  const authorFn = authorLeaderboard
  const readerFn = readerLeaderboard

  const authorQ = useQuery({
    queryKey: ["lb-author", timeframe],
    queryFn: () => authorFn({ data: { timeframe } }),
    staleTime: 60_000,
  })
  const readerQ = useQuery({
    queryKey: ["lb-reader", timeframe],
    queryFn: () => readerFn({ data: { timeframe } }),
    staleTime: 60_000,
  })

  const authorRows = authorQ.data?.rows ?? []
  const readerRows = readerQ.data?.rows ?? []

  type ARow = (typeof authorRows)[number]
  type RRow = (typeof readerRows)[number]

  const popCols: Col<ARow>[] = [
    { key: "followers", label: "Followers", numeric: true },
    { key: "claps", label: "Claps", numeric: true },
    { key: "published", label: "Pieces", numeric: true },
    { key: "popularityScore", label: "Score", numeric: true },
  ]
  const actCols: Col<ARow>[] = [
    { key: "published", label: "Pieces", numeric: true },
    { key: "claps", label: "Claps", numeric: true },
    { key: "followers", label: "Followers", numeric: true },
    { key: "activenessScore", label: "Score", numeric: true },
  ]
  const earnAuthorCols: Col<ARow>[] = [
    {
      key: "earningsPaise",
      label: "Earnings",
      numeric: true,
      render: (r) => formatPaiseMarket(r.earningsPaise, code),
    },
    {
      key: "tipsPaise",
      label: "Tips",
      numeric: true,
      render: (r) => formatPaiseMarket(r.tipsPaise, code),
    },
    { key: "followers", label: "Followers", numeric: true },
    { key: "published", label: "Pieces", numeric: true },
  ]
  const actReaderCols: Col<RRow>[] = [
    { key: "points", label: "Insight pts", numeric: true },
    { key: "tier", label: "Tier", numeric: false },
    { key: "annotations", label: "Annotations", numeric: true },
    { key: "claps", label: "Claps", numeric: true },
    { key: "currentStreak", label: "Streak", numeric: true },
    { key: "activityScore", label: "Score", numeric: true },
  ]
  const earnReaderCols: Col<RRow>[] = [
    {
      key: "earningsPaise",
      label: "Reward value",
      numeric: true,
      render: (r) => formatPaiseMarket(r.earningsPaise, code),
    },
    { key: "points", label: "Insight pts", numeric: true },
    { key: "currentStreak", label: "Streak", numeric: true },
    { key: "longestStreak", label: "Best streak", numeric: true },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1">
        <section className="container-wide pt-16 pb-6 md:pt-24">
          <div className="mb-3 flex items-center gap-3">
            <Trophy className="size-5 text-note" />
            <p className="text-xs tracking-[0.22em] text-primary uppercase">
              Live leaderboard
            </p>
          </div>
          <h1 className="font-display text-3xl leading-tight sm:text-4xl md:text-5xl">
            Who&apos;s writing, reading, and earning the most.
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
            Updates every minute. Open to everyone — no sign-in needed. Currency
            switches with your preference.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="relative max-w-sm min-w-50 flex-1">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search members…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="inline-flex overflow-hidden rounded-md border border-border text-xs">
              <button
                onClick={() => setTimeframe("all")}
                className={`px-3 py-1.5 ${timeframe === "all" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                All-time
              </button>
              <button
                onClick={() => setTimeframe("month")}
                className={`px-3 py-1.5 ${timeframe === "month" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                This month
              </button>
            </div>
            <CurrencySelector />
          </div>
        </section>

        <section className="container-wide pb-16">
          <Tabs
            value={audience}
            onValueChange={(v) => setAudience(v as "author" | "reader")}
          >
            <TabsList>
              <TabsTrigger value="author">Authors</TabsTrigger>
              <TabsTrigger value="reader">Readers</TabsTrigger>
            </TabsList>

            <TabsContent value="author" className="mt-6">
              <Tabs defaultValue="popularity">
                <TabsList>
                  <TabsTrigger value="popularity">Popularity</TabsTrigger>
                  <TabsTrigger value="activeness">Activeness</TabsTrigger>
                  {!launchFree && <TabsTrigger value="earnings">Earnings</TabsTrigger>}
                </TabsList>
                <TabsContent value="popularity" className="mt-4">
                  {authorQ.isLoading ? (
                    <Skel />
                  ) : (
                    <SortableTable
                      rows={authorRows}
                      columns={popCols}
                      defaultSort="popularityScore"
                      query={query}
                    />
                  )}
                </TabsContent>
                <TabsContent value="activeness" className="mt-4">
                  {authorQ.isLoading ? (
                    <Skel />
                  ) : (
                    <SortableTable
                      rows={authorRows}
                      columns={actCols}
                      defaultSort="activenessScore"
                      query={query}
                    />
                  )}
                </TabsContent>
                {!launchFree && <TabsContent value="earnings" className="mt-4">
                  {authorQ.isLoading ? (
                    <Skel />
                  ) : (
                    <SortableTable
                      rows={authorRows}
                      columns={earnAuthorCols}
                      defaultSort="earningsPaise"
                      query={query}
                    />
                  )}
                </TabsContent>}
              </Tabs>
            </TabsContent>

            <TabsContent value="reader" className="mt-6">
              <Tabs defaultValue="activeness">
                <TabsList>
                  <TabsTrigger value="activeness">Activeness</TabsTrigger>
                  {!launchFree && <TabsTrigger value="earnings">Earnings</TabsTrigger>}
                </TabsList>
                <TabsContent value="activeness" className="mt-4">
                  {readerQ.isLoading ? (
                    <Skel />
                  ) : (
                    <SortableTable
                      rows={readerRows}
                      columns={actReaderCols}
                      defaultSort="activityScore"
                      query={query}
                    />
                  )}
                </TabsContent>
                {!launchFree && <TabsContent value="earnings" className="mt-4">
                  {readerQ.isLoading ? (
                    <Skel />
                  ) : (
                    <SortableTable
                      rows={readerRows}
                      columns={earnReaderCols}
                      defaultSort="earningsPaise"
                      query={query}
                    />
                  )}
                </TabsContent>}
              </Tabs>
            </TabsContent>
          </Tabs>

          <div className="mt-8 text-center">
            <Button asChild variant="outline" size="sm">
              <Link href="/earn">See all the ways to earn →</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  )
}

function Skel() {
  return (
    <div className="surface h-64 animate-pulse rounded-xl border border-border/60" />
  )
}

// Avatar fallback: initial letter instead of a blank gray circle.
function Initials({ name }: { name: string }) {
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
      {(name?.trim()?.[0] ?? "?").toUpperCase()}
    </span>
  )
}
