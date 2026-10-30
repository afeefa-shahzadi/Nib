import Link from "next/link"
import { ArrowDown, ArrowUp } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { cachedAuthorLeaderboard, cachedPieceLeaderboard, cachedReaderLeaderboard } from "@/lib/public-cache"
import { rankView } from "@/lib/leaderboard-view"
import { isLaunchFree } from "@/lib/plan"
import { formatCompactNumber } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import type { Timeframe } from "@/actions/leaderboard"
import { LeaderboardControls, Money } from "./controls"

type Who = "writers" | "readers" | "pieces"
type Col = { key: string; label: string; money?: boolean }
type Board = { label: string; key: string; cols: Col[]; unit: string }

// Each ranking: the score it sorts by, and the columns shown beside it.
const BOARDS: Record<Who, Record<string, Board>> = {
  writers: {
    popularity: {
      label: "Popularity",
      key: "popularityScore",
      unit: "score",
      cols: [
        { key: "followers", label: "Followers" },
        { key: "claps", label: "Claps" },
        { key: "published", label: "Pieces" },
      ],
    },
    activeness: {
      label: "Activeness",
      key: "activenessScore",
      unit: "score",
      cols: [
        { key: "published", label: "Pieces" },
        { key: "claps", label: "Claps" },
        { key: "followers", label: "Followers" },
      ],
    },
    earnings: {
      label: "Earnings",
      key: "earningsPaise",
      unit: "earned",
      cols: [
        { key: "tipsPaise", label: "Tips", money: true },
        { key: "followers", label: "Followers" },
        { key: "published", label: "Pieces" },
      ],
    },
  },
  pieces: {
    engagement: {
      label: "Engagement",
      key: "engagementScore",
      unit: "score",
      cols: [
        { key: "reads", label: "Reads" },
        { key: "claps", label: "Claps" },
        { key: "responses", label: "Responses" },
      ],
    },
    reads: {
      label: "Most read",
      key: "reads",
      unit: "reads",
      cols: [
        { key: "claps", label: "Claps" },
        { key: "saves", label: "Saves" },
      ],
    },
    claps: {
      label: "Claps",
      key: "claps",
      unit: "claps",
      cols: [
        { key: "responses", label: "Responses" },
        { key: "saves", label: "Saves" },
      ],
    },
    discussed: {
      label: "Most discussed",
      key: "responses",
      unit: "responses",
      cols: [
        { key: "highlights", label: "Highlights" },
        { key: "claps", label: "Claps" },
      ],
    },
    saved: {
      label: "Most saved",
      key: "saves",
      unit: "saves",
      cols: [
        { key: "claps", label: "Claps" },
        { key: "responses", label: "Responses" },
      ],
    },
  },
  readers: {
    activeness: {
      label: "Activeness",
      key: "activityScore",
      unit: "score",
      cols: [
        { key: "points", label: "Points" },
        { key: "annotations", label: "Notes" },
        { key: "claps", label: "Claps" },
        { key: "currentStreak", label: "Streak" },
      ],
    },
    earnings: {
      label: "Earnings",
      key: "earningsPaise",
      unit: "earned",
      cols: [
        { key: "points", label: "Points" },
        { key: "currentStreak", label: "Streak" },
      ],
    },
    points: {
      label: "Insight points",
      key: "points",
      unit: "points",
      cols: [
        { key: "currentStreak", label: "Streak" },
        { key: "longestStreak", label: "Best streak" },
        { key: "annotations", label: "Notes" },
      ],
    },
  },
}

const HOW: Record<Who, string[]> = {
  writers: [
    "Popularity: 5 for each follower, plus 1 for each clap your pieces get.",
    "Activeness: 10 for each piece you publish, plus 1 for each clap.",
    "Earnings: tips and sales after Nib's fee. Shown once paid features open.",
  ],
  pieces: [
    "Engagement: 1 per read, 1 per clap, 3 per response, 2 per highlight and 2 per save.",
    "A read counts when someone reaches the end after spending enough time to read it, once per visit.",
    "Only published, public pieces are ranked. The period counts what readers did in it, so an older piece can climb this week.",
  ],
  readers: [
    "Activeness: your Insight points, plus 1 per clap, 3 per note and 2 per writer you follow.",
    "Insight points come from reading closely, notes, quizzes and streaks. They're recognition, not money.",
    "Earnings: your 15% curator share when someone buys a piece through one of your public collections. Shown once paid features open.",
  ],
}

const PERIODS: Record<Timeframe, string> = { week: "this week", month: "this month", all: "all time" }

type Params = { who?: string; by?: string; period?: string; q?: string; sort?: string; dir?: string; page?: string }

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams
  const launchFree = isLaunchFree()
  const who: Who = sp.who === "readers" || sp.who === "pieces" ? sp.who : "writers"
  const boards = Object.fromEntries(
    Object.entries(BOARDS[who]).filter(([k]) => !(launchFree && k === "earnings"))
  )
  const by = sp.by && sp.by in boards ? sp.by : Object.keys(boards)[0]
  const board = boards[by]
  const period: Timeframe = sp.period === "week" || sp.period === "month" ? sp.period : "all"
  const q = (sp.q ?? "").slice(0, 100)
  const dir = sp.dir === "asc" ? "asc" : "desc"
  const sort = board.cols.some((c) => c.key === sp.sort) ? sp.sort : undefined

  const [{ data: auth }, data] = await Promise.all([
    (await createClient()).auth.getUser(),
    who === "writers" ? cachedAuthorLeaderboard(period) : who === "pieces" ? cachedPieceLeaderboard(period) : cachedReaderLeaderboard(period),
  ])
  const rows = data.rows as unknown as (Record<string, number> & {
    userId: string
    handle: string | null
    displayName: string
    avatarUrl: string | null
    slug?: string
    authorName?: string
  })[]
  const v = rankView(rows, { key: board.key, sort, dir, q, page: Number(sp.page) || 0, viewerId: who === "pieces" ? null : auth.user?.id })

  const fmt = (n: number, money?: boolean) => (money ? <Money paise={n} /> : formatCompactNumber(n))
  const href = (over: Partial<Params>) => {
    const p = new URLSearchParams()
    const next = { who, by, period, q, sort, dir, ...over }
    if (next.who !== "writers") p.set("who", next.who)
    if (next.by && next.by !== Object.keys(boards)[0]) p.set("by", next.by)
    if (next.period !== "all") p.set("period", next.period!)
    if (next.q) p.set("q", next.q)
    if (next.sort) p.set("sort", next.sort)
    if (next.dir === "asc") p.set("dir", "asc")
    if (over.page && over.page !== "0") p.set("page", over.page)
    const s = p.toString()
    return s ? `/leaderboard?${s}` : "/leaderboard"
  }
  const sortHref = (key?: string) => {
    const active = (sort ?? board.key) === (key ?? board.key)
    return href({ sort: key, dir: active && dir === "desc" ? "asc" : "desc" })
  }
  const arrow = (key?: string) =>
    (sort ?? board.key) === (key ?? board.key) &&
    (dir === "asc" ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />)
  const noun = who

  return (
    <main className="container-wide grid items-start gap-10 pt-16 pb-16 md:pt-24 md:pb-24 lg:grid-cols-12 lg:gap-12">
      <div className="lg:sticky lg:top-24 lg:col-span-5">
        <h1 className="font-display text-4xl leading-[1.05] sm:text-5xl">Leaderboard</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          The most-read writers, the most active readers and the pieces readers engage with most. Updates every minute.
        </p>

        <LeaderboardControls
          who={who}
          by={by}
          period={period}
          q={q}
          money={board.key === "earningsPaise"}
          boards={Object.entries(boards).map(([k, b]) => ({ value: k, label: b.label }))}
        />

        {v.me && (
          <p className="mt-6 rounded-lg bg-muted/50 p-4">
            You&apos;re <span className="font-medium">#{v.me.rank}</span> of {formatCompactNumber(v.total)} {noun}
            {v.me.toNext > 0 && (
              <span className="text-muted-foreground">
                {" "}
                · {fmt(v.me.toNext, board.key === "earningsPaise")} {board.unit === "earned" ? "" : board.unit} to #{v.me.rank - 1}
              </span>
            )}
          </p>
        )}

        <details className="group mt-6">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium lg:min-h-8">How scores work</summary>
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            {HOW[who].filter((l) => !(launchFree && l.startsWith("Earnings"))).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </details>
        <Link
          href="/earn"
          className="-my-1 inline-flex min-h-11 items-center py-1 text-sm text-primary hover:underline hover:underline-offset-4 lg:min-h-8"
        >
          See all the ways to earn
        </Link>
      </div>

      <div className="min-w-0 lg:col-span-7">
        {v.podium.length === 3 && (
          <ol className="mb-8 grid grid-cols-3 items-end gap-3" aria-label="Top three">
            {[v.podium[1], v.podium[0], v.podium[2]].map(
              (r) =>
                r && (
                  <li
                    key={r.userId}
                    className={`rounded-lg border p-4 text-center ${r.rank === 1 ? "border-primary" : "border-border"}`}
                  >
                    <p className={`text-sm ${r.rank === 1 ? "text-primary" : "text-muted-foreground"}`}>
                      {["1st", "2nd", "3rd"][r.rank - 1]}
                    </p>
                    {who === "pieces" ? <PieceCell r={r} stacked /> : <Person r={r} size={r.rank === 1 ? "size-12" : "size-10"} stacked />}
                    <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                      {fmt(r[board.key], board.key === "earningsPaise")}
                    </p>
                  </li>
                )
            )}
          </ol>
        )}

        <h2 className="mb-2 text-sm font-medium">
          {board.label} · {PERIODS[period]}
          {q && <span className="font-normal text-muted-foreground"> · {v.matches} matching “{q}”</span>}
        </h2>

        {v.rows.length === 0 ? (
          <div className="hairline-t hairline-b py-12">
            <p className="text-muted-foreground">
              {q ? (who === "pieces" ? "No piece or author matches that." : "Nobody matches that name.") : `No ${noun} have scores ${PERIODS[period]} yet.`}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-muted-foreground max-sm:sr-only">
              <tr className="hairline-b">
                <th scope="col" className="w-12 py-2 text-left font-normal">#</th>
                <th scope="col" className="py-2 text-left font-normal">{who === "pieces" ? "Piece" : "Member"}</th>
                {board.cols.map((c) => (
                  <th key={c.key} scope="col" className="py-2 text-right font-normal">
                    <Link href={sortHref(c.key)} className="inline-flex min-h-11 items-center gap-1 hover:text-foreground lg:min-h-8">
                      {c.label}
                      {arrow(c.key)}
                    </Link>
                  </th>
                ))}
                <th scope="col" className="py-2 text-right font-normal">
                  <Link href={sortHref()} className="inline-flex min-h-11 items-center gap-1 hover:text-foreground lg:min-h-8">
                    {board.unit === "earned" ? "Earned" : board.unit === "score" ? "Score" : board.unit[0].toUpperCase() + board.unit.slice(1)}
                    {arrow()}
                  </Link>
                </th>
              </tr>
            </thead>
            <tbody>
              {v.rows.map((r) => (
                <tr key={r.userId} className={`hairline-b ${r.userId === auth.user?.id ? "bg-primary/5" : ""}`}>
                  <td className="w-12 py-3 align-top text-muted-foreground tabular-nums sm:align-middle">{r.rank}</td>
                  <td className="py-3">
                    {who === "pieces" ? <PieceCell r={r} /> : <Person r={r} size="size-8" />}
                    {/* Phones: the secondary numbers sit under the name instead of in columns. */}
                    <p className={`mt-1 text-sm ${who === "pieces" ? "" : "pl-11"} text-muted-foreground sm:hidden`}>
                      {board.cols.map((c, i) => (
                        <span key={c.key}>
                          {i > 0 && " · "}
                          {fmt(r[c.key], c.money)} {r[c.key] === 1 ? c.label.toLowerCase().replace(/s$/, "") : c.label.toLowerCase()}
                        </span>
                      ))}
                    </p>
                  </td>
                  {board.cols.map((c) => (
                    <td key={c.key} className="py-3 text-right tabular-nums max-sm:hidden">
                      {fmt(r[c.key], c.money)}
                    </td>
                  ))}
                  <td className="py-3 pl-3 text-right align-top font-medium tabular-nums sm:align-middle">
                    {fmt(r[board.key], board.key === "earningsPaise")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {v.pages > 1 && (
          <nav aria-label="Pages" className="mt-8 flex items-center justify-between gap-4">
            {v.page > 0 ? (
              <Button asChild variant="outline">
                <Link href={href({ page: String(v.page - 1) })}>Previous</Link>
              </Button>
            ) : (
              <span />
            )}
            <span className="text-sm text-muted-foreground tabular-nums">
              {v.page * 25 + 1}–{Math.min((v.page + 1) * 25, v.matches)} of {v.matches}
            </span>
            {v.page < v.pages - 1 ? (
              <Button asChild variant="outline">
                <Link href={href({ page: String(v.page + 1) })}>Next</Link>
              </Button>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </main>
  )
}

function PieceCell({
  r,
  stacked,
}: {
  r: { displayName: string; handle: string | null; slug?: string; authorName?: string }
  stacked?: boolean
}) {
  return (
    <span className={`block min-w-0 ${stacked ? "mt-2" : ""}`}>
      {r.handle && r.slug ? (
        <Link href={`/u/${r.handle}/${r.slug}`} className={`font-medium hover:text-primary ${stacked ? "line-clamp-2" : "block truncate"}`}>
          {r.displayName}
        </Link>
      ) : (
        <span className="block truncate font-medium">{r.displayName}</span>
      )}
      {!stacked && <span className="block truncate text-muted-foreground">by {r.authorName}{r.handle && ` · @${r.handle}`}</span>}
    </span>
  )
}

function Person({
  r,
  size,
  stacked,
}: {
  r: { handle: string | null; displayName: string; avatarUrl: string | null }
  size: string
  stacked?: boolean
}) {
  const inner = (
    <>
      <Avatar className={`${size} shrink-0 ${stacked ? "mx-auto mt-2" : ""}`}>
        {r.avatarUrl && <AvatarImage src={r.avatarUrl} alt="" />}
        <AvatarFallback>{(r.displayName.trim()[0] ?? "?").toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className={`min-w-0 ${stacked ? "mt-2 block" : ""}`}>
        <span className="block truncate font-medium">{r.displayName}</span>
        {r.handle && !stacked && <span className="block truncate text-muted-foreground">@{r.handle}</span>}
      </span>
    </>
  )
  const cls = stacked ? "block min-w-0 hover:text-primary" : "flex min-w-0 items-center gap-3 hover:text-primary"
  return r.handle ? (
    <Link href={`/u/${r.handle}`} className={cls}>
      {inner}
    </Link>
  ) : (
    <span className={cls}>{inner}</span>
  )
}
